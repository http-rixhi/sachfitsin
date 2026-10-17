"""
Step 12O — the Razorpay test matrix, as tests rather than a checklist.

Each class below is one scenario from the matrix. Written so a failure
names the scenario, and so none of it can quietly regress later.

Test 5 (a real card decline in Razorpay Test Mode) still has to be done by
hand against Razorpay. Its server-side half — a payment.failed webhook —
is covered here.
"""

import hashlib
import hmac
import json
from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from products.models import Product
from subscriptions.models import Entitlement, Subscription
from subscriptions.features import Feature
from subscriptions.services import has_entitlement, has_feature

from .models import Payment

User = get_user_model()

KEY_SECRET = "key_secret_for_tests"
WEBHOOK_SECRET = "whsec_for_tests"


def checkout_signature(order_id, payment_id):
    return hmac.new(
        KEY_SECRET.encode(),
        f"{order_id}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()


@override_settings(
    RAZORPAY_KEY_ID="rzp_test_key",
    RAZORPAY_KEY_SECRET=KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET=WEBHOOK_SECRET,
)
class MatrixBase(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            username="rishi",
            email="rishi@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

        self.one_time = Product.objects.create(
            code="DIET_PLAN",
            name="Personalized Diet Plan",
            price="999.00",
            billing_type=Product.BillingType.ONE_TIME,
            duration_days=None,
            status=Product.Status.ACTIVE,
        )

        # A real monthly plan, because the paywall tests below check that
        # buying it opens personalised videos.
        self.monthly, _ = Product.objects.get_or_create(
            code="PERSONALIZED_NUTRITION_COACHING",
            defaults={
                "name": "Personalized Nutrition Coaching, 1 Month",
                "price": "2499.00",
                "billing_type": Product.BillingType.MONTHLY,
                "duration_days": 30,
                "status": Product.Status.ACTIVE,
            },
        )

        self.client.force_authenticate(user=self.customer)

    @staticmethod
    def paise(product):
        """Razorpay works in paise, and the amount must match exactly."""

        return int(product.price * 100)

    def order_for(self, product, order_id):
        return Payment.objects.create(
            customer=self.customer,
            product=product,
            amount=product.price,
            currency="INR",
            status=Payment.Status.CREATED,
            razorpay_order_id=order_id,
        )

    def verify(self, order_id, payment_id, signature=None):
        return self.client.post(
            reverse("verify-payment"),
            {
                "razorpay_order_id": order_id,
                "razorpay_payment_id": payment_id,
                "razorpay_signature": (
                    signature
                    if signature is not None
                    else checkout_signature(order_id, payment_id)
                ),
            },
            format="json",
        )

    def webhook(self, event, order_id, payment_id, amount):
        body = json.dumps(
            {
                "event": event,
                "payload": {
                    "payment": {
                        "entity": {
                            "id": payment_id,
                            "order_id": order_id,
                            "amount": amount,
                            "status": "captured",
                        }
                    }
                },
            }
        )

        signature = hmac.new(
            WEBHOOK_SECRET.encode(), body.encode(), hashlib.sha256
        ).hexdigest()

        return self.client.post(
            reverse("razorpay-webhook"),
            data=body,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=signature,
        )


class Test1SuccessfulOneTimePurchase(MatrixBase):
    def test_one_entitlement_and_no_subscription(self):
        self.order_for(self.one_time, "order_T1")

        with self.captureOnCommitCallbacks(execute=True):
            response = self.verify("order_T1", "pay_T1")

        self.assertEqual(response.status_code, 200)

        self.assertEqual(
            Entitlement.objects.filter(
                customer=self.customer, product=self.one_time
            ).count(),
            1,
        )

        self.assertEqual(
            Subscription.objects.filter(
                customer=self.customer, product=self.one_time
            ).count(),
            0,
            "a one-time product must not create a subscription",
        )

        self.assertTrue(has_entitlement(self.customer, "DIET_PLAN"))


class Test2SuccessfulMonthlyPurchase(MatrixBase):
    def test_entitlement_and_subscription_with_matching_expiry(self):
        self.order_for(self.monthly, "order_T2")

        with self.captureOnCommitCallbacks(execute=True):
            self.verify("order_T2", "pay_T2")

        self.assertEqual(
            Entitlement.objects.filter(
                customer=self.customer, product=self.monthly
            ).count(),
            1,
        )

        self.assertEqual(
            Subscription.objects.filter(
                customer=self.customer, product=self.monthly
            ).count(),
            1,
        )

        entitlement = Entitlement.objects.get(product=self.monthly)
        subscription = Subscription.objects.get(product=self.monthly)

        self.assertEqual(subscription.ends_at, entitlement.expires_at)

        self.assertAlmostEqual(
            entitlement.expires_at,
            timezone.now() + timedelta(days=30),
            delta=timedelta(seconds=10),
        )


class Test3DuplicateVerification(MatrixBase):
    def test_verifying_twice_grants_access_once(self):
        self.order_for(self.monthly, "order_T3")

        with self.captureOnCommitCallbacks(execute=True):
            first = self.verify("order_T3", "pay_T3")
            second = self.verify("order_T3", "pay_T3")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)

        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(Entitlement.objects.count(), 1)
        self.assertEqual(Subscription.objects.count(), 1)


class Test4ForgedSignature(MatrixBase):
    def test_a_fake_signature_grants_nothing(self):
        payment = self.order_for(self.monthly, "order_T4")

        response = self.verify(
            "order_T4", "pay_T4", signature="fake_signature"
        )

        self.assertEqual(response.status_code, 400)

        payment.refresh_from_db()

        self.assertNotEqual(payment.status, Payment.Status.SUCCESS)
        self.assertEqual(Entitlement.objects.count(), 0)
        self.assertFalse(
            has_feature(self.customer, Feature.PERSONALIZED_VIDEOS)
        )


class Test5FailedPayment(MatrixBase):
    """
    The server-side half of a declined card.

    The card decline itself has to be done by hand in Razorpay Test Mode;
    what reaches us is this webhook.
    """

    def test_a_failed_payment_grants_nothing(self):
        payment = self.order_for(self.monthly, "order_T5")

        response = self.webhook(
            "payment.failed", "order_T5", "pay_T5", self.paise(self.monthly)
        )

        self.assertEqual(response.status_code, 200)

        payment.refresh_from_db()

        self.assertEqual(payment.status, Payment.Status.FAILED)
        self.assertEqual(Entitlement.objects.count(), 0)
        self.assertEqual(Subscription.objects.count(), 0)


class Test6Webhook(MatrixBase):
    def test_a_captured_webhook_grants_access(self):
        payment = self.order_for(self.monthly, "order_T6")

        with self.captureOnCommitCallbacks(execute=True):
            response = self.webhook(
                "payment.captured", "order_T6", "pay_T6", self.paise(self.monthly)
            )

        self.assertEqual(response.status_code, 200)

        payment.refresh_from_db()

        self.assertEqual(payment.status, Payment.Status.SUCCESS)
        self.assertEqual(
            Entitlement.objects.get().status,
            Entitlement.Status.ACTIVE,
        )

    def test_the_same_webhook_twice_grants_access_once(self):
        self.order_for(self.monthly, "order_T6B")

        with self.captureOnCommitCallbacks(execute=True):
            self.webhook(
                "payment.captured", "order_T6B", "pay_T6B", self.paise(self.monthly)
            )
            self.webhook(
                "payment.captured", "order_T6B", "pay_T6B", self.paise(self.monthly)
            )

        self.assertEqual(Entitlement.objects.count(), 1)
        self.assertEqual(Subscription.objects.count(), 1)

    def test_browser_then_webhook_grants_access_once(self):
        """Both paths firing for one payment is normal, not a problem."""

        self.order_for(self.monthly, "order_T6C")

        with self.captureOnCommitCallbacks(execute=True):
            self.verify("order_T6C", "pay_T6C")
            self.webhook(
                "payment.captured", "order_T6C", "pay_T6C", self.paise(self.monthly)
            )

        self.assertEqual(Entitlement.objects.count(), 1)


class Test7Expiry(MatrixBase):
    def test_expired_access_is_denied_and_the_record_catches_up(self):
        self.order_for(self.monthly, "order_T7")

        with self.captureOnCommitCallbacks(execute=True):
            self.verify("order_T7", "pay_T7")

        self.assertTrue(
            has_feature(self.customer, Feature.PERSONALIZED_VIDEOS)
        )

        # Wind the clock past the expiry.
        past = timezone.now() - timedelta(minutes=1)

        Entitlement.objects.update(expires_at=past)
        Subscription.objects.update(ends_at=past)

        # Access stops immediately, before the command is anywhere near.
        self.assertFalse(
            has_feature(self.customer, Feature.PERSONALIZED_VIDEOS),
            "access must stop on the date, not when a command runs",
        )

        out = StringIO()
        call_command("expire_entitlements", stdout=out)

        self.assertEqual(
            Entitlement.objects.get().status,
            Entitlement.Status.EXPIRED,
        )
        self.assertEqual(
            Subscription.objects.get().status,
            Subscription.Status.EXPIRED,
        )

        self.assertFalse(
            has_feature(self.customer, Feature.PERSONALIZED_VIDEOS)
        )

    def test_the_paywall_returns_after_expiry(self):
        """End to end: paid, used it, expired, locked out again."""

        self.order_for(self.monthly, "order_T7B")

        with self.captureOnCommitCallbacks(execute=True):
            self.verify("order_T7B", "pay_T7B")

        self.assertEqual(
            self.client.get(
                reverse("my-personalized-videos")
            ).status_code,
            200,
        )

        Entitlement.objects.update(
            expires_at=timezone.now() - timedelta(minutes=1)
        )

        call_command("expire_entitlements", stdout=StringIO())

        response = self.client.get(reverse("my-personalized-videos"))

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json()["error"]["code"], "entitlement_required"
        )


class Test8PaymentHistoryReflectsEverything(MatrixBase):
    def test_history_shows_the_outcome_of_each_attempt(self):
        self.order_for(self.monthly, "order_T8A")
        self.order_for(self.one_time, "order_T8B")

        with self.captureOnCommitCallbacks(execute=True):
            self.verify("order_T8A", "pay_T8A")

        self.verify("order_T8B", "pay_T8B", signature="forged")

        response = self.client.get(reverse("my-payments"))

        statuses = {
            item["razorpay_order_id"]: item["status"]
            for item in response.data["data"]
        }

        self.assertEqual(statuses["order_T8A"], "SUCCESS")
        self.assertEqual(statuses["order_T8B"], "FAILED")
