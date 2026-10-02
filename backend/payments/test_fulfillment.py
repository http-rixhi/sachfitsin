from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from products.models import Product
from subscriptions.models import Entitlement, Subscription
from subscriptions.services import has_entitlement

from .fulfillment import fulfill_payment
from .models import Payment

User = get_user_model()


class FulfillmentTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            username="rishi",
            email="rishi@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

        self.monthly = Product.objects.create(
            code="PERSONALIZED_VIDEOS",
            name="Personalized Videos",
            price="499.00",
            billing_type=Product.BillingType.MONTHLY,
            duration_days=30,
            status=Product.Status.ACTIVE,
        )

        self.one_time = Product.objects.create(
            code="DIET_PLAN",
            name="Personalized Diet Plan",
            price="999.00",
            billing_type=Product.BillingType.ONE_TIME,
            duration_days=None,
            status=Product.Status.ACTIVE,
        )

    def payment_for(self, product, order="order_1", pay_id="pay_1"):
        return Payment.objects.create(
            customer=self.customer,
            product=product,
            amount=product.price,
            status=Payment.Status.SUCCESS,
            razorpay_order_id=order,
            razorpay_payment_id=pay_id,
        )

    # -- the point of all this -------------------------------------------

    def test_paying_actually_unlocks_the_feature(self):
        self.assertFalse(
            has_entitlement(self.customer, "PERSONALIZED_VIDEOS")
        )

        fulfill_payment(self.payment_for(self.monthly))

        self.assertTrue(
            has_entitlement(self.customer, "PERSONALIZED_VIDEOS")
        )

    def test_monthly_product_expires_after_its_duration(self):
        entitlement, _ = fulfill_payment(self.payment_for(self.monthly))

        expected = timezone.now() + timedelta(days=30)

        self.assertAlmostEqual(
            entitlement.expires_at,
            expected,
            delta=timedelta(seconds=5),
        )

    def test_product_without_a_duration_never_expires(self):
        entitlement, _ = fulfill_payment(self.payment_for(self.one_time))

        self.assertIsNone(entitlement.expires_at)
        self.assertTrue(has_entitlement(self.customer, "DIET_PLAN"))

    # -- monthly vs one-time ---------------------------------------------

    def test_monthly_products_get_a_subscription_row(self):
        entitlement, subscription = fulfill_payment(
            self.payment_for(self.monthly)
        )

        self.assertIsNotNone(subscription)
        self.assertEqual(subscription.status, Subscription.Status.ACTIVE)
        self.assertEqual(subscription.ends_at, entitlement.expires_at)
        self.assertEqual(subscription.external_reference, "pay_1")

    def test_one_time_products_get_no_subscription(self):
        _, subscription = fulfill_payment(
            self.payment_for(self.one_time)
        )

        self.assertIsNone(subscription)
        self.assertEqual(Subscription.objects.count(), 0)

    # -- renewal, which a plain get_or_create would break -----------------

    def test_renewing_an_expired_entitlement_grants_access_again(self):
        """
        The bug this function exists to avoid.

        An expired entitlement still has status=ACTIVE, so a
        get_or_create keyed on (customer, product, ACTIVE) would find it,
        change nothing, and the customer who just paid would still be
        locked out.
        """

        past = timezone.now() - timedelta(days=5)

        Entitlement.objects.create(
            customer=self.customer,
            product=self.monthly,
            status=Entitlement.Status.ACTIVE,
            starts_at=past - timedelta(days=30),
            expires_at=past,
            source="RAZORPAY",
        )

        self.assertFalse(
            has_entitlement(self.customer, "PERSONALIZED_VIDEOS")
        )

        fulfill_payment(self.payment_for(self.monthly))

        self.assertTrue(
            has_entitlement(self.customer, "PERSONALIZED_VIDEOS"),
            "renewing an expired entitlement must restore access",
        )

        self.assertEqual(Entitlement.objects.count(), 1)

    def test_renewing_early_keeps_the_remaining_days(self):
        """Paying early must add to the period, not reset it."""

        remaining = timezone.now() + timedelta(days=10)

        Entitlement.objects.create(
            customer=self.customer,
            product=self.monthly,
            status=Entitlement.Status.ACTIVE,
            starts_at=timezone.now() - timedelta(days=20),
            expires_at=remaining,
            source="RAZORPAY",
        )

        entitlement, _ = fulfill_payment(self.payment_for(self.monthly))

        expected = remaining + timedelta(days=30)

        self.assertAlmostEqual(
            entitlement.expires_at,
            expected,
            delta=timedelta(seconds=5),
        )

    def test_lifetime_access_is_not_downgraded(self):
        Entitlement.objects.create(
            customer=self.customer,
            product=self.one_time,
            status=Entitlement.Status.ACTIVE,
            starts_at=timezone.now() - timedelta(days=1),
            expires_at=None,
            source="RAZORPAY",
        )

        entitlement, _ = fulfill_payment(self.payment_for(self.one_time))

        self.assertIsNone(entitlement.expires_at)
        self.assertEqual(Entitlement.objects.count(), 1)

    # -- running it twice -------------------------------------------------

    def test_fulfilling_twice_does_not_create_duplicates(self):
        payment = self.payment_for(self.monthly)

        fulfill_payment(payment)
        fulfill_payment(payment)

        self.assertEqual(Entitlement.objects.count(), 1)
        self.assertEqual(Subscription.objects.count(), 1)

    def test_a_revoked_entitlement_is_not_reused(self):
        """A revoked one must not be quietly brought back to life."""

        Entitlement.objects.create(
            customer=self.customer,
            product=self.monthly,
            status=Entitlement.Status.REVOKED,
            starts_at=timezone.now() - timedelta(days=40),
            expires_at=timezone.now() - timedelta(days=10),
            source="RAZORPAY",
        )

        entitlement, _ = fulfill_payment(self.payment_for(self.monthly))

        self.assertEqual(entitlement.status, Entitlement.Status.ACTIVE)
        self.assertEqual(Entitlement.objects.count(), 2)
        self.assertTrue(
            has_entitlement(self.customer, "PERSONALIZED_VIDEOS")
        )

    # -- the customer is told ---------------------------------------------

    def test_a_new_purchase_notifies_the_customer(self):
        from notifications.models import Notification

        # The notification is deliberately sent through
        # transaction.on_commit, so no email goes out for a payment that
        # ends up rolled back. TestCase wraps each test in a transaction
        # that never commits, so the callbacks need running explicitly.
        with self.captureOnCommitCallbacks(execute=True):
            fulfill_payment(self.payment_for(self.monthly))

        self.assertTrue(
            Notification.objects.filter(
                user=self.customer,
                category="SUBSCRIPTION",
            ).exists()
        )

    def test_nothing_is_sent_if_the_transaction_rolls_back(self):
        from notifications.models import Notification

        with self.captureOnCommitCallbacks(execute=False):
            fulfill_payment(self.payment_for(self.monthly))

        self.assertFalse(
            Notification.objects.filter(
                user=self.customer,
                category="SUBSCRIPTION",
            ).exists()
        )

    def test_one_customer_cannot_be_fulfilled_into_anothers_account(self):
        other = User.objects.create_user(
            username="someone",
            email="someone@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

        fulfill_payment(self.payment_for(self.monthly))

        self.assertFalse(
            has_entitlement(other, "PERSONALIZED_VIDEOS")
        )
