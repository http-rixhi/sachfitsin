import hashlib
import hmac
import json

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from products.models import Product
from subscriptions.models import Entitlement
from subscriptions.services import has_entitlement

from .models import Payment

User = get_user_model()

WEBHOOK_SECRET = "whsec_test"


@override_settings(
    RAZORPAY_KEY_ID="rzp_test_key",
    RAZORPAY_KEY_SECRET="key_secret",
    RAZORPAY_WEBHOOK_SECRET=WEBHOOK_SECRET,
)
class RazorpayWebhookTests(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            username="rishi",
            email="rishi@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

        self.product = Product.objects.create(
            code="PERSONALIZED_VIDEOS",
            name="Personalized Videos",
            price="499.00",
            billing_type=Product.BillingType.MONTHLY,
            duration_days=30,
            status=Product.Status.ACTIVE,
        )

        self.payment = Payment.objects.create(
            customer=self.customer,
            product=self.product,
            amount="499.00",
            status=Payment.Status.CREATED,
            razorpay_order_id="order_WH1",
        )

    # -- helpers ----------------------------------------------------------

    def body(
        self,
        event="payment.captured",
        order_id="order_WH1",
        payment_id="pay_WH1",
        amount=49900,
        extra=None,
    ):
        entity = {
            "id": payment_id,
            "order_id": order_id,
            "amount": amount,
            "status": "captured",
        }

        entity.update(extra or {})

        return {
            "event": event,
            "payload": {"payment": {"entity": entity}},
        }

    def post(self, body, secret=WEBHOOK_SECRET, signature=None):
        raw = json.dumps(body)

        if signature is None:
            signature = hmac.new(
                secret.encode(), raw.encode(), hashlib.sha256
            ).hexdigest()

        return self.client.post(
            reverse("razorpay-webhook"),
            data=raw,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=signature,
        )

    # -- the reliability gap this closes ---------------------------------

    def test_a_captured_payment_grants_access_without_the_browser(self):
        """
        The whole reason for the webhook: the customer closed the tab, so
        /verify/ was never called.
        """

        self.assertFalse(
            has_entitlement(self.customer, "PERSONALIZED_VIDEOS")
        )

        with self.captureOnCommitCallbacks(execute=True):
            response = self.post(self.body())

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["status"], "fulfilled")

        self.payment.refresh_from_db()

        self.assertEqual(self.payment.status, Payment.Status.SUCCESS)
        self.assertEqual(self.payment.razorpay_payment_id, "pay_WH1")
        self.assertTrue(
            has_entitlement(self.customer, "PERSONALIZED_VIDEOS")
        )

    # -- signature --------------------------------------------------------

    def test_a_forged_signature_is_rejected(self):
        response = self.post(self.body(), signature="forged")

        self.assertEqual(response.status_code, 400)

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.CREATED)

    def test_a_signature_from_the_wrong_secret_is_rejected(self):
        response = self.post(self.body(), secret="not-our-secret")

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Entitlement.objects.exists())

    def test_a_missing_signature_is_rejected(self):
        response = self.client.post(
            reverse("razorpay-webhook"),
            data=json.dumps(self.body()),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)

    @override_settings(RAZORPAY_WEBHOOK_SECRET="")
    def test_an_unset_secret_rejects_everything(self):
        """An unconfigured webhook must not mean "let anyone in"."""

        response = self.post(self.body(), secret="anything")

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Entitlement.objects.exists())

    def test_the_signature_covers_the_body(self):
        """Signing one payload and sending another must fail."""

        signed_for = json.dumps(self.body(payment_id="pay_CHEAP"))

        signature = hmac.new(
            WEBHOOK_SECRET.encode(), signed_for.encode(), hashlib.sha256
        ).hexdigest()

        response = self.client.post(
            reverse("razorpay-webhook"),
            data=json.dumps(self.body(payment_id="pay_DIFFERENT")),
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=signature,
        )

        self.assertEqual(response.status_code, 400)

    # -- event types ------------------------------------------------------

    def test_a_failed_payment_is_recorded_and_grants_nothing(self):
        response = self.post(
            self.body(
                event="payment.failed",
                extra={
                    "error_description": "Card declined by the bank.",
                },
            )
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "failed")

        self.payment.refresh_from_db()

        self.assertEqual(self.payment.status, Payment.Status.FAILED)
        self.assertIn("declined", self.payment.failure_reason)
        self.assertFalse(Entitlement.objects.exists())

    def test_unrelated_events_are_acknowledged_and_ignored(self):
        for event in [
            "payment.authorized",
            "order.paid",
            "refund.created",
            "subscription.charged",
        ]:
            with self.subTest(event=event):
                response = self.post(self.body(event=event))

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["status"], "ignored")

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.CREATED)

    def test_a_failure_notice_cannot_undo_a_successful_payment(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.post(self.body())

        response = self.post(self.body(event="payment.failed"))

        self.assertEqual(response.status_code, 200)

        self.payment.refresh_from_db()

        self.assertEqual(self.payment.status, Payment.Status.SUCCESS)
        self.assertTrue(
            has_entitlement(self.customer, "PERSONALIZED_VIDEOS")
        )

    # -- idempotency ------------------------------------------------------

    def test_the_same_webhook_twice_grants_access_once(self):
        with self.captureOnCommitCallbacks(execute=True):
            first = self.post(self.body())
            second = self.post(self.body())

        self.assertEqual(first.data["status"], "fulfilled")
        self.assertEqual(second.data["status"], "already_done")

        self.assertEqual(Entitlement.objects.count(), 1)

    def test_the_webhook_after_the_browser_already_verified(self):
        """Both paths can fire. The second must be harmless."""

        self.payment.status = Payment.Status.SUCCESS
        self.payment.razorpay_payment_id = "pay_WH1"
        self.payment.save()

        response = self.post(self.body())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "already_done")

    # -- tampering --------------------------------------------------------

    def test_a_wrong_amount_grants_nothing(self):
        """Even correctly signed, the amount must match the order."""

        response = self.post(self.body(amount=100))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "mismatch")

        self.payment.refresh_from_db()

        self.assertEqual(self.payment.status, Payment.Status.FAILED)
        self.assertIn("mismatch", self.payment.failure_reason.lower())
        self.assertFalse(Entitlement.objects.exists())

    def test_one_payment_id_cannot_settle_two_orders(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.post(self.body())

        Payment.objects.create(
            customer=self.customer,
            product=self.product,
            amount="499.00",
            status=Payment.Status.CREATED,
            razorpay_order_id="order_WH2",
        )

        response = self.post(
            self.body(order_id="order_WH2", payment_id="pay_WH1")
        )

        self.assertEqual(response.data["status"], "ignored")
        self.assertEqual(Entitlement.objects.count(), 1)

    # -- unknown orders ---------------------------------------------------

    def test_an_unknown_order_asks_razorpay_to_retry(self):
        response = self.post(self.body(order_id="order_NOT_OURS"))

        self.assertEqual(
            response.status_code,
            404,
            "a non-2xx makes Razorpay retry, which covers a lagging "
            "database better than silently dropping a real payment",
        )

    def test_a_payload_with_no_order_id_is_ignored(self):
        body = self.body()
        del body["payload"]["payment"]["entity"]["order_id"]

        response = self.post(body)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "ignored")

    def test_malformed_json_is_rejected(self):
        raw = "{not json"

        signature = hmac.new(
            WEBHOOK_SECRET.encode(), raw.encode(), hashlib.sha256
        ).hexdigest()

        response = self.client.post(
            reverse("razorpay-webhook"),
            data=raw,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=signature,
        )

        self.assertEqual(response.status_code, 400)

    # -- access -----------------------------------------------------------

    def test_the_webhook_needs_no_login(self):
        """Razorpay cannot authenticate, so the signature is the gate."""

        with self.captureOnCommitCallbacks(execute=True):
            response = self.post(self.body())

        self.assertEqual(response.status_code, 200)

    def test_the_webhook_is_not_rate_limited(self):
        """
        The global anonymous throttle is 60/min. If it applied here,
        Razorpay's retries during a burst would be dropped.
        """

        statuses = []

        for index in range(70):
            Payment.objects.create(
                customer=self.customer,
                product=self.product,
                amount="499.00",
                status=Payment.Status.CREATED,
                razorpay_order_id=f"order_BURST{index}",
            )

            statuses.append(
                self.post(
                    self.body(
                        order_id=f"order_BURST{index}",
                        payment_id=f"pay_BURST{index}",
                    )
                ).status_code
            )

        self.assertNotIn(429, statuses)
