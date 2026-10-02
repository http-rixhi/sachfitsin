import json
import logging
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from rest_framework import generics, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User

from .fulfillment import fulfill_payment
from .models import Payment
from .permissions import IsCustomer
from .razorpay_service import (
    get_razorpay_client,
    verify_payment_signature,
)
from .serializers import (
    CreatePaymentOrderSerializer,
    PaymentSerializer,
    VerifyPaymentSerializer,
)
from .webhooks import handle_event, verify_webhook_signature

logger = logging.getLogger("payments")


class CreatePaymentOrderView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        if request.user.role != User.Role.CUSTOMER:
            return Response(
                {
                    "success": False,
                    "message": "Only customers can make payments.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = CreatePaymentOrderSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        product = serializer.product

        amount = Decimal(product.price)

        if amount <= 0:
            return Response(
                {
                    "success": False,
                    "message": "This product has an invalid price.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Razorpay expects the amount in the smallest currency unit.
        amount_in_paise = int(amount * 100)

        client = get_razorpay_client()

        razorpay_order = client.order.create(
            {
                "amount": amount_in_paise,
                "currency": "INR",
                "receipt": f"sachfitsin-{request.user.id}-{product.id}",
            }
        )

        payment = Payment.objects.create(
            customer=request.user,
            product=product,
            amount=amount,
            currency="INR",
            status=Payment.Status.CREATED,
            razorpay_order_id=razorpay_order["id"],
        )

        return Response(
            {
                "success": True,
                "message": "Payment order created successfully.",
                "data": {
                    "payment_id": payment.id,
                    "razorpay_order_id": razorpay_order["id"],
                    "razorpay_key_id": settings.RAZORPAY_KEY_ID,
                    "amount": amount_in_paise,
                    "currency": "INR",
                    "product_id": product.id,
                    "product_name": product.name,
                },
            },
            status=status.HTTP_201_CREATED,
        )

class VerifyPaymentView(APIView):
    """
    Confirm a payment really happened, using Razorpay's signature.

    React calls this after Razorpay's success callback. That callback runs
    in the browser and can be invoked by hand from the console, so nothing
    it says is trusted. What makes this safe is the signature: it is
    HMAC-SHA256 of "<order_id>|<payment_id>" keyed with the secret, which
    never leaves this server.

    No entitlement is granted here yet.
    """

    permission_classes = [IsCustomer]

    def post(self, request):
        serializer = VerifyPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        outcome, payment = self.process(
            customer=request.user,
            data=serializer.validated_data,
        )

        # Every error is raised out here, AFTER the transaction in
        # process() has committed. Raising inside it would roll back the
        # FAILED status that records the rejected attempt, leaving no
        # trace that anyone tried.
        if outcome == "not_found":
            raise NotFound("Payment not found.")

        if outcome == "refunded":
            raise ValidationError(
                {"razorpay_order_id": ["This payment was refunded."]}
            )

        if outcome == "bad_signature":
            logger.warning(
                "Rejected payment verification for order %s by user %s.",
                serializer.validated_data["razorpay_order_id"],
                request.user.pk,
            )

            raise ValidationError(
                {
                    "razorpay_signature": [
                        "We could not verify this payment. "
                        "It has not been activated."
                    ]
                }
            )

        if outcome == "reused":
            raise ValidationError(
                {
                    "razorpay_payment_id": [
                        "This payment has already been used."
                    ]
                }
            )

        return Response(
            {
                "success": True,
                "message": (
                    "Payment was already verified."
                    if outcome == "already_verified"
                    else "Payment verified successfully."
                ),
                "data": self.payment_data(payment),
            }
        )

    @transaction.atomic
    def process(self, *, customer, data):
        """
        Do the database work and report what happened.

        Returns (outcome, payment). Never raises for an expected outcome,
        so the caller can commit first and complain afterwards.
        """

        # select_for_update holds the row until this transaction finishes,
        # so two verify calls arriving together cannot both process it.
        payment = (
            Payment.objects
            .select_for_update()
            .filter(
                razorpay_order_id=data["razorpay_order_id"],
                customer=customer,
            )
            .first()
        )

        # "Not found" and "belongs to someone else" give the same answer,
        # so this cannot be used to discover other people's order ids.
        if not payment:
            return "not_found", None

        # Already done. Reporting success keeps a double submit, a refresh
        # or a retry harmless.
        if payment.status == Payment.Status.SUCCESS:
            return "already_verified", payment

        if payment.status == Payment.Status.REFUNDED:
            return "refunded", payment

        signature_ok = verify_payment_signature(
            razorpay_order_id=data["razorpay_order_id"],
            razorpay_payment_id=data["razorpay_payment_id"],
            razorpay_signature=data["razorpay_signature"],
        )

        if not signature_ok:
            payment.status = Payment.Status.FAILED
            payment.failure_reason = (
                "Razorpay signature verification failed."
            )

            payment.save(
                update_fields=[
                    "status",
                    "failure_reason",
                    "updated_at",
                ]
            )

            return "bad_signature", payment

        # One real payment must not settle several orders.
        already_used = (
            Payment.objects
            .filter(razorpay_payment_id=data["razorpay_payment_id"])
            .exclude(pk=payment.pk)
            .exists()
        )

        if already_used:
            logger.warning(
                "Payment id %s was already used on another order.",
                data["razorpay_payment_id"],
            )

            return "reused", payment

        payment.razorpay_payment_id = data["razorpay_payment_id"]
        payment.razorpay_signature = data["razorpay_signature"]
        payment.status = Payment.Status.SUCCESS
        payment.failure_reason = ""

        payment.save(
            update_fields=[
                "razorpay_payment_id",
                "razorpay_signature",
                "status",
                "failure_reason",
                "updated_at",
            ]
        )

        logger.info(
            "Payment %s verified for user %s.", payment.pk, customer.pk
        )

        # Inside this transaction on purpose. If access cannot be granted,
        # the SUCCESS above is rolled back with it, so a payment can never
        # be marked paid while the customer has nothing to show for it.
        fulfill_payment(payment)

        return "verified", payment

    @staticmethod
    def payment_data(payment):
        return {
            "payment_id": payment.id,
            "status": payment.status,
            "product_id": payment.product_id,
            "product_name": payment.product.name,
            "amount": str(payment.amount),
            "currency": payment.currency,
        }


class MyPaymentsView(generics.ListAPIView):
    """
    The logged-in customer's own payment history.

    Scoped to request.user, so there is no way to read anyone else's.
    """

    serializer_class = PaymentSerializer
    permission_classes = [IsCustomer]

    def get_queryset(self):
        queryset = (
            Payment.objects
            .filter(customer=self.request.user)
            .select_related("product")
            .order_by("-created_at")
        )

        payment_status = self.request.query_params.get("status")

        if payment_status:
            queryset = queryset.filter(status=payment_status.upper())

        return queryset

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)

        return Response(
            {
                "success": True,
                "data": serializer.data,
            }
        )


class RazorpayWebhookView(APIView):
    """
    Razorpay telling us directly what happened.

    Open to the internet by necessity — Razorpay cannot log in — so the
    signature over the raw body is the only thing that makes it safe.

    Status codes matter here: Razorpay retries anything that is not 2xx.
    A handled event therefore returns 200 even when it changed nothing,
    and only a genuinely unknown order returns 404 so it is tried again.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    # The global 60/min anonymous throttle would quietly drop deliveries
    # during a burst, and Razorpay would keep retrying the rest.
    throttle_classes = []

    def post(self, request):
        signature = request.headers.get("X-Razorpay-Signature", "")

        # request.body, not request.data. Re-serialising the JSON changes
        # the bytes and the signature would never match.
        if not verify_webhook_signature(request.body, signature):
            logger.warning(
                "Rejected a Razorpay webhook with a bad signature."
            )

            return Response(
                {"detail": "Invalid signature."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payload = json.loads(request.body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return Response(
                {"detail": "Malformed payload."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = handle_event(payload)
        except Exception:
            # Returning 5xx asks Razorpay to retry, which is what we want
            # for an unexpected failure on our side.
            logger.exception(
                "Razorpay webhook '%s' could not be processed.",
                payload.get("event"),
            )

            return Response(
                {"detail": "Could not process the webhook."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if result.status == "not_found":
            # 404 so Razorpay tries again. This is far more likely to be
            # our database lagging than an order that was never ours, and
            # losing a real payment is worse than a few retries.
            return Response(
                {"status": result.status, "detail": result.detail},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {"status": result.status, "detail": result.detail},
            status=status.HTTP_200_OK,
        )
