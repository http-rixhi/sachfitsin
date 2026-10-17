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
from subscriptions.features import Feature, PlanCode
from subscriptions.services import has_entitlement, has_feature

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

        # Codes of their own. The real catalogue is seeded by a data
        # migration, so reusing a live code would collide on the unique
        # constraint and would also tie this test to today's pricing.
        self.free = Product.objects.create(
            code="TEST_FREE_PLAN",
            name="A free plan",
            price="0.00",
            billing_type=Product.BillingType.FREE,
            status=Product.Status.ACTIVE,
        )

        self.paid = Product.objects.create(
            code="TEST_PAID_PLAN",
            name="A paid plan",
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
            has_entitlement(self.customer, "TEST_FREE_PLAN")
        )

    def test_a_paid_plan_still_needs_an_entitlement(self):
        self.assertFalse(
            has_entitlement(self.customer, "TEST_PAID_PLAN")
        )

    def test_taking_a_free_plan_off_sale_removes_access(self):
        self.free.status = Product.Status.INACTIVE
        self.free.save()

        self.assertFalse(
            has_entitlement(self.customer, "TEST_FREE_PLAN")
        )

    def test_making_a_free_plan_paid_removes_access(self):
        """Switching a plan to paid must close it again."""

        self.free.billing_type = Product.BillingType.ONE_TIME
        self.free.price = "499.00"
        self.free.save()

        self.assertFalse(
            has_entitlement(self.customer, "TEST_FREE_PLAN")
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


class FeatureAccessTests(TestCase):
    """
    One purchase can unlock several features, and several plans can unlock
    the same one. These check the ladder the packages are priced around:
    diet plan, then coaching adds videos, then training adds exercises.
    """

    def setUp(self):
        self.customer = User.objects.create_user(
            username="customer",
            email="customer@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

    def grant(self, code, expires_at=None):
        """Give the customer a live entitlement for one catalogue plan."""

        product = Product.objects.get(code=code)

        return Entitlement.objects.create(
            customer=self.customer,
            product=product,
            status=Entitlement.Status.ACTIVE,
            starts_at=timezone.now() - timedelta(minutes=1),
            expires_at=expires_at,
        )

    def test_a_new_customer_has_nothing(self):
        self.assertFalse(
            has_feature(self.customer, Feature.PERSONALIZED_VIDEOS)
        )
        self.assertFalse(
            has_feature(self.customer, Feature.EXERCISE_ROUTINES)
        )

    def test_the_diet_plan_unlocks_no_app_features(self):
        self.grant(PlanCode.LIFESTYLE_DIET_PLAN)

        self.assertFalse(
            has_feature(self.customer, Feature.PERSONALIZED_VIDEOS)
        )
        self.assertFalse(
            has_feature(self.customer, Feature.EXERCISE_ROUTINES)
        )

    def test_coaching_unlocks_videos_but_not_exercises(self):
        self.grant(PlanCode.NUTRITION_COACHING_1M)

        self.assertTrue(
            has_feature(self.customer, Feature.PERSONALIZED_VIDEOS)
        )
        self.assertFalse(
            has_feature(self.customer, Feature.EXERCISE_ROUTINES)
        )

    def test_three_month_coaching_unlocks_the_same_as_one_month(self):
        self.grant(PlanCode.NUTRITION_COACHING_3M)

        self.assertTrue(
            has_feature(self.customer, Feature.PERSONALIZED_VIDEOS)
        )
        self.assertFalse(
            has_feature(self.customer, Feature.EXERCISE_ROUTINES)
        )

    def test_training_unlocks_both(self):
        self.grant(PlanCode.NUTRITION_TRAINING_1M)

        self.assertTrue(
            has_feature(self.customer, Feature.PERSONALIZED_VIDEOS)
        )
        self.assertTrue(
            has_feature(self.customer, Feature.EXERCISE_ROUTINES)
        )

    def test_three_month_training_unlocks_both(self):
        self.grant(PlanCode.NUTRITION_TRAINING_3M)

        self.assertTrue(
            has_feature(self.customer, Feature.PERSONALIZED_VIDEOS)
        )
        self.assertTrue(
            has_feature(self.customer, Feature.EXERCISE_ROUTINES)
        )

    def test_the_retired_plan_still_works_for_whoever_bought_it(self):
        # The old plan only exists on databases that sold it, so this
        # test recreates that situation rather than assuming it.
        legacy, _ = Product.objects.get_or_create(
            code=PlanCode.LEGACY_EXERCISE_RECOMMENDATIONS,
            defaults={
                "name": "Exercise Recommendations",
                "price": "299.00",
                "billing_type": Product.BillingType.ONE_TIME,
                "status": Product.Status.INACTIVE,
            },
        )

        Entitlement.objects.create(
            customer=self.customer,
            product=legacy,
            status=Entitlement.Status.ACTIVE,
            starts_at=timezone.now() - timedelta(minutes=1),
        )

        # Off sale, but access that was paid for must not vanish.
        self.assertTrue(
            has_feature(self.customer, Feature.EXERCISE_ROUTINES)
        )

    def test_an_expired_plan_unlocks_nothing(self):
        self.grant(
            PlanCode.NUTRITION_TRAINING_1M,
            expires_at=timezone.now() - timedelta(seconds=1),
        )

        self.assertFalse(
            has_feature(self.customer, Feature.PERSONALIZED_VIDEOS)
        )
        self.assertFalse(
            has_feature(self.customer, Feature.EXERCISE_ROUTINES)
        )

    def test_one_customer_does_not_unlock_another(self):
        self.grant(PlanCode.NUTRITION_TRAINING_3M)

        other = User.objects.create_user(
            username="other",
            email="other@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

        self.assertFalse(
            has_feature(other, Feature.EXERCISE_ROUTINES)
        )


class CataloguePricingTests(TestCase):
    """The packages on sale, exactly as the owner priced them."""

    EXPECTED = {
        PlanCode.LIFESTYLE_DIET_PLAN: ("499.00", "ONE_TIME", None),
        PlanCode.NUTRITION_COACHING_1M: ("2499.00", "MONTHLY", 30),
        PlanCode.NUTRITION_COACHING_3M: ("3999.00", "MONTHLY", 90),
        PlanCode.NUTRITION_TRAINING_1M: ("3999.00", "MONTHLY", 30),
        PlanCode.NUTRITION_TRAINING_3M: ("6999.00", "MONTHLY", 90),
    }

    def test_every_package_is_on_sale_at_the_right_price(self):
        for code, (price, billing, days) in self.EXPECTED.items():
            with self.subTest(code=code):
                product = Product.objects.get(code=code)

                self.assertEqual(str(product.price), price)
                self.assertEqual(product.billing_type, billing)
                self.assertEqual(product.duration_days, days)
                self.assertEqual(product.status, Product.Status.ACTIVE)

    def test_the_retired_plan_is_not_on_sale(self):
        # True whether the row was never created or was switched off: the
        # property that matters is that nobody can buy it.
        self.assertFalse(
            Product.objects.filter(
                code=PlanCode.LEGACY_EXERCISE_RECOMMENDATIONS,
                status=Product.Status.ACTIVE,
            ).exists()
        )

    def test_no_paid_package_is_free_by_accident(self):
        for product in Product.objects.filter(status=Product.Status.ACTIVE):
            with self.subTest(code=product.code):
                if product.billing_type != Product.BillingType.FREE:
                    self.assertGreater(
                        product.price,
                        0,
                        "a paid plan priced at zero cannot be bought",
                    )
