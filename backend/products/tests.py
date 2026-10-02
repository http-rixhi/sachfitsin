from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Product

User = get_user_model()


class ProductListTests(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            username="rishi",
            email="rishi@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

        self.active = Product.objects.create(
            code="PERSONALIZED_VIDEOS",
            name="Personalized Videos",
            description="Videos chosen for your plan.",
            price="499.00",
            status=Product.Status.ACTIVE,
        )

        self.inactive = Product.objects.create(
            code="OLD_PLAN",
            name="Discontinued plan",
            price="199.00",
            status=Product.Status.INACTIVE,
        )

    def test_requires_a_login(self):
        self.assertEqual(
            self.client.get(reverse("product-list")).status_code, 401
        )

    def test_lists_active_products(self):
        self.client.force_authenticate(user=self.customer)

        response = self.client.get(reverse("product-list"))

        self.assertEqual(response.status_code, 200)

        names = [item["name"] for item in response.data]

        self.assertIn("Personalized Videos", names)

    def test_hides_inactive_products(self):
        self.client.force_authenticate(user=self.customer)

        response = self.client.get(reverse("product-list"))

        names = [item["name"] for item in response.data]

        self.assertNotIn("Discontinued plan", names)

    def test_can_filter_by_code(self):
        self.client.force_authenticate(user=self.customer)

        response = self.client.get(
            reverse("product-list"), {"code": "personalized_videos"}
        )

        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["code"], "PERSONALIZED_VIDEOS")

    def test_is_read_only(self):
        self.client.force_authenticate(user=self.customer)

        response = self.client.post(
            reverse("product-list"),
            {"code": "FREE_STUFF", "name": "Free", "price": "0.00"},
            format="json",
        )

        self.assertEqual(response.status_code, 405)
        self.assertEqual(Product.objects.count(), 2)


class AdminProductTests(APITestCase):
    """The dietician managing plans and pricing."""

    def setUp(self):
        self.dietician = User.objects.create_user(
            username="doc",
            email="doc@example.com",
            password="password123",
            role=User.Role.DIETICIAN,
        )

        self.customer = User.objects.create_user(
            username="rishi",
            email="rishi@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

        self.product = Product.objects.create(
            code="DIET_PLAN",
            name="Diet Plan",
            price="999.00",
            billing_type=Product.BillingType.ONE_TIME,
            status=Product.Status.ACTIVE,
        )

        self.client.force_authenticate(user=self.dietician)

    def detail_url(self, product=None):
        return reverse(
            "dietician-product-detail",
            kwargs={"pk": (product or self.product).pk},
        )

    # -- access -----------------------------------------------------------

    def test_a_customer_cannot_manage_plans(self):
        self.client.force_authenticate(user=self.customer)

        self.assertEqual(
            self.client.get(reverse("dietician-products")).status_code,
            403,
        )

    def test_a_customer_cannot_change_a_price(self):
        self.client.force_authenticate(user=self.customer)

        response = self.client.patch(
            self.detail_url(), {"price": "1.00"}, format="json"
        )

        self.assertEqual(response.status_code, 403)

        self.product.refresh_from_db()
        self.assertEqual(str(self.product.price), "999.00")

    def test_anonymous_cannot_manage_plans(self):
        self.client.force_authenticate(user=None)

        self.assertEqual(
            self.client.get(reverse("dietician-products")).status_code,
            401,
        )

    # -- listing ----------------------------------------------------------

    def test_inactive_plans_are_visible_to_the_dietician(self):
        Product.objects.create(
            code="OLD",
            name="Retired plan",
            price="99.00",
            status=Product.Status.INACTIVE,
        )

        response = self.client.get(reverse("dietician-products"))

        codes = [item["code"] for item in response.data]

        self.assertIn("OLD", codes)

    def test_the_list_shows_how_many_customers_have_each_plan(self):
        from django.utils import timezone

        from subscriptions.models import Entitlement

        Entitlement.objects.create(
            customer=self.customer,
            product=self.product,
            status=Entitlement.Status.ACTIVE,
            starts_at=timezone.now(),
        )

        response = self.client.get(reverse("dietician-products"))

        plan = next(
            item for item in response.data if item["code"] == "DIET_PLAN"
        )

        self.assertEqual(plan["customer_count"], 1)

    # -- creating ---------------------------------------------------------

    def test_creating_a_plan(self):
        response = self.client.post(
            reverse("dietician-products"),
            {
                "code": "new_plan",
                "name": "New Plan",
                "description": "Something new.",
                "billing_type": "ONE_TIME",
                "price": "1499.00",
                "status": "ACTIVE",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)

        # Codes are normalised so they stay consistent.
        self.assertEqual(response.data["code"], "NEW_PLAN")

    def test_a_paid_plan_must_have_a_price(self):
        """
        A zero-priced paid plan cannot be bought: Razorpay rejects an
        order for nothing, so the Buy button would always fail.
        """

        response = self.client.post(
            reverse("dietician-products"),
            {
                "code": "BROKEN",
                "name": "Broken",
                "billing_type": "ONE_TIME",
                "price": "0.00",
                "status": "ACTIVE",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("price", response.json()["error"]["fields"])

    def test_a_monthly_plan_must_have_a_length(self):
        response = self.client.post(
            reverse("dietician-products"),
            {
                "code": "NO_LENGTH",
                "name": "No length",
                "billing_type": "MONTHLY",
                "price": "499.00",
                "status": "ACTIVE",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn(
            "duration_days", response.json()["error"]["fields"]
        )

    def test_a_free_plan_may_have_no_price(self):
        response = self.client.post(
            reverse("dietician-products"),
            {
                "code": "FREE_TIPS",
                "name": "Free tips",
                "billing_type": "FREE",
                "price": "0.00",
                "status": "ACTIVE",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)

    def test_a_negative_price_is_refused(self):
        response = self.client.post(
            reverse("dietician-products"),
            {
                "code": "NEGATIVE",
                "name": "Negative",
                "billing_type": "ONE_TIME",
                "price": "-5.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    # -- editing ----------------------------------------------------------

    def test_changing_the_price(self):
        response = self.client.patch(
            self.detail_url(), {"price": "1299.00"}, format="json"
        )

        self.assertEqual(response.status_code, 200, response.data)

        self.product.refresh_from_db()
        self.assertEqual(str(self.product.price), "1299.00")

    def test_the_code_cannot_be_changed(self):
        """
        Entitlements and the front end both key off the code. Renaming it
        on a live plan would cut off everyone who already bought it.
        """

        self.client.patch(
            self.detail_url(), {"code": "SOMETHING_ELSE"}, format="json"
        )

        self.product.refresh_from_db()
        self.assertEqual(self.product.code, "DIET_PLAN")

    def test_retiring_a_plan_hides_it_from_customers(self):
        self.client.patch(
            self.detail_url(), {"status": "INACTIVE"}, format="json"
        )

        self.client.force_authenticate(user=self.customer)

        response = self.client.get(reverse("product-list"))

        codes = [item["code"] for item in response.data]

        self.assertNotIn("DIET_PLAN", codes)

    def test_plans_cannot_be_deleted(self):
        """Payments and entitlements point at them; history must survive."""

        response = self.client.delete(self.detail_url())

        self.assertEqual(response.status_code, 405)
        self.assertTrue(
            Product.objects.filter(pk=self.product.pk).exists()
        )
