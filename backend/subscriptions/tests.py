from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from products.models import Product
from subscriptions.models import Entitlement, Subscription
from subscriptions.services import has_entitlement

User = get_user_model()


class ExpireEntitlementsCommandTests(TestCase):
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
            status=Product.Status.ACTIVE,
        )

        now = timezone.now()

        self.lapsed = Entitlement.objects.create(
            customer=self.customer,
            product=self.product,
            status=Entitlement.Status.ACTIVE,
            starts_at=now - timedelta(days=40),
            expires_at=now - timedelta(days=1),
        )

        self.current = Entitlement.objects.create(
            customer=self.customer,
            product=self.product,
            status=Entitlement.Status.ACTIVE,
            starts_at=now - timedelta(days=1),
            expires_at=now + timedelta(days=29),
        )

        self.lifetime = Entitlement.objects.create(
            customer=self.customer,
            product=self.product,
            status=Entitlement.Status.ACTIVE,
            starts_at=now - timedelta(days=100),
            expires_at=None,
        )

        self.lapsed_subscription = Subscription.objects.create(
            customer=self.customer,
            product=self.product,
            status=Subscription.Status.ACTIVE,
            starts_at=now - timedelta(days=40),
            ends_at=now - timedelta(days=1),
        )

    def run_command(self, *args):
        out = StringIO()

        call_command("expire_entitlements", *args, stdout=out)

        return out.getvalue()

    def test_lapsed_rows_are_marked_expired(self):
        self.run_command()

        self.lapsed.refresh_from_db()
        self.lapsed_subscription.refresh_from_db()

        self.assertEqual(
            self.lapsed.status, Entitlement.Status.EXPIRED
        )
        self.assertEqual(
            self.lapsed_subscription.status,
            Subscription.Status.EXPIRED,
        )

    def test_current_access_is_untouched(self):
        self.run_command()

        self.current.refresh_from_db()

        self.assertEqual(
            self.current.status, Entitlement.Status.ACTIVE
        )

    def test_lifetime_access_is_never_expired(self):
        """A null expiry means forever, not "expired long ago"."""

        self.run_command()

        self.lifetime.refresh_from_db()

        self.assertEqual(
            self.lifetime.status, Entitlement.Status.ACTIVE
        )

    def test_access_is_unchanged_by_running_it(self):
        """
        The command tidies the record, it does not decide access.

        The customer still has a current entitlement, so they keep access
        whether or not this has run.
        """

        before = has_entitlement(self.customer, "PERSONALIZED_VIDEOS")

        self.run_command()

        after = has_entitlement(self.customer, "PERSONALIZED_VIDEOS")

        self.assertTrue(before)
        self.assertEqual(before, after)

    def test_it_reports_what_it_did(self):
        output = self.run_command()

        self.assertIn("Expired 1 entitlement(s)", output)
        self.assertIn("1 subscription(s)", output)

    def test_running_it_again_changes_nothing(self):
        self.run_command()

        output = self.run_command()

        self.assertIn("Expired 0 entitlement(s)", output)

    def test_dry_run_writes_nothing(self):
        output = self.run_command("--dry-run")

        self.assertIn("Would expire 1 entitlement(s)", output)

        self.lapsed.refresh_from_db()

        self.assertEqual(
            self.lapsed.status,
            Entitlement.Status.ACTIVE,
            "--dry-run must not change anything",
        )


class FreePlanAccessTests(TestCase):
    """
    Setting a plan to Free must actually give customers access.

    It used to change nothing: a free plan could not be bought, because
    Razorpay refuses a zero-value order, and nothing granted an
    entitlement for it. So the customer still saw "Not in your plan yet".
    """

    def setUp(self):
        self.customer = User.objects.create_user(
            username="rishi",
            email="rishi@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

        self.free = Product.objects.create(
            code="EXERCISE_RECOMMENDATIONS",
            name="Exercise Recommendations",
            price="0.00",
            billing_type=Product.BillingType.FREE,
            status=Product.Status.ACTIVE,
        )

        self.paid = Product.objects.create(
            code="PERSONALIZED_NUTRITION_COACHING",
            name="Coaching",
            price="2499.00",
            billing_type=Product.BillingType.MONTHLY,
            duration_days=30,
            status=Product.Status.ACTIVE,
        )

    def test_a_free_plan_is_available_without_an_entitlement(self):
        self.assertFalse(
            Entitlement.objects.filter(customer=self.customer).exists()
        )

        self.assertTrue(
            has_entitlement(self.customer, "EXERCISE_RECOMMENDATIONS")
        )

    def test_a_paid_plan_still_needs_an_entitlement(self):
        self.assertFalse(
            has_entitlement(
                self.customer, "PERSONALIZED_NUTRITION_COACHING"
            )
        )

    def test_taking_a_free_plan_off_sale_removes_access(self):
        self.free.status = Product.Status.INACTIVE
        self.free.save()

        self.assertFalse(
            has_entitlement(self.customer, "EXERCISE_RECOMMENDATIONS")
        )

    def test_making_a_free_plan_paid_removes_access(self):
        """Switching a plan to paid must close it again."""

        self.free.billing_type = Product.BillingType.ONE_TIME
        self.free.price = "499.00"
        self.free.save()

        self.assertFalse(
            has_entitlement(self.customer, "EXERCISE_RECOMMENDATIONS")
        )

    def test_a_logged_out_visitor_gets_nothing(self):
        from django.contrib.auth.models import AnonymousUser

        self.assertFalse(
            has_entitlement(AnonymousUser(), "EXERCISE_RECOMMENDATIONS")
        )

    def test_an_unknown_product_code_is_denied(self):
        self.assertFalse(
            has_entitlement(self.customer, "DOES_NOT_EXIST")
        )


class FreePlanEndToEndTests(APITestCase):
    """Through the real endpoint, the way a customer meets it."""

    def setUp(self):
        self.customer = User.objects.create_user(
            username="rishi",
            email="rishi@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

        self.product = Product.objects.create(
            code="EXERCISE_RECOMMENDATIONS",
            name="Exercise Recommendations",
            price="0.00",
            billing_type=Product.BillingType.ONE_TIME,
            status=Product.Status.ACTIVE,
        )

        self.client.force_authenticate(user=self.customer)

    def test_locked_before_and_open_after_switching_to_free(self):
        locked = self.client.get(
            reverse("my-exercise-recommendations")
        )

        self.assertEqual(locked.status_code, 403)
        self.assertEqual(
            locked.json()["error"]["code"], "entitlement_required"
        )

        # What the dietician does in the admin panel.
        self.product.billing_type = Product.BillingType.FREE
        self.product.save()

        opened = self.client.get(
            reverse("my-exercise-recommendations")
        )

        self.assertEqual(
            opened.status_code,
            200,
            "setting a plan to Free must unlock it for customers",
        )
