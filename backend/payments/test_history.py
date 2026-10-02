from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from products.models import Product

from .models import Payment

User = get_user_model()


class PaymentHistoryTests(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            username="rishi",
            email="rishi@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

        self.other = User.objects.create_user(
            username="someone",
            email="someone@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

        self.product = Product.objects.create(
            code="PERSONALIZED_VIDEOS",
            name="Personalized Videos",
            price="499.00",
            status=Product.Status.ACTIVE,
        )

        self.mine = Payment.objects.create(
            customer=self.customer,
            product=self.product,
            amount="499.00",
            status=Payment.Status.SUCCESS,
            razorpay_order_id="order_MINE",
            razorpay_payment_id="pay_MINE",
            razorpay_signature="a-secret-looking-signature",
        )

        Payment.objects.create(
            customer=self.other,
            product=self.product,
            amount="499.00",
            status=Payment.Status.SUCCESS,
            razorpay_order_id="order_THEIRS",
        )

        self.client.force_authenticate(user=self.customer)

    def test_requires_a_login(self):
        self.client.force_authenticate(user=None)

        self.assertEqual(
            self.client.get(reverse("my-payments")).status_code, 401
        )

    def test_returns_only_my_payments(self):
        response = self.client.get(reverse("my-payments"))

        self.assertEqual(response.status_code, 200)

        orders = [
            item["razorpay_order_id"] for item in response.data["data"]
        ]

        self.assertEqual(orders, ["order_MINE"])

    def test_the_signature_is_not_handed_back(self):
        """It proves nothing to the customer and need not be exposed."""

        response = self.client.get(reverse("my-payments"))

        self.assertNotIn(
            "razorpay_signature", response.data["data"][0]
        )
        self.assertNotIn(
            "a-secret-looking-signature", response.content.decode()
        )

    def test_shows_the_fields_a_customer_needs(self):
        response = self.client.get(reverse("my-payments"))

        payment = response.data["data"][0]

        for field in [
            "product_name",
            "amount",
            "currency",
            "status",
            "failure_reason",
            "created_at",
        ]:
            self.assertIn(field, payment)

        self.assertEqual(payment["product_name"], "Personalized Videos")

    def test_newest_first(self):
        newer = Payment.objects.create(
            customer=self.customer,
            product=self.product,
            amount="499.00",
            status=Payment.Status.CREATED,
            razorpay_order_id="order_NEWER",
        )

        response = self.client.get(reverse("my-payments"))

        self.assertEqual(
            response.data["data"][0]["razorpay_order_id"],
            newer.razorpay_order_id,
        )

    def test_can_filter_by_status(self):
        Payment.objects.create(
            customer=self.customer,
            product=self.product,
            amount="499.00",
            status=Payment.Status.FAILED,
            razorpay_order_id="order_FAILED",
        )

        response = self.client.get(
            reverse("my-payments"), {"status": "failed"}
        )

        self.assertEqual(len(response.data["data"]), 1)
        self.assertEqual(response.data["data"][0]["status"], "FAILED")

    def test_a_dietician_cannot_use_it(self):
        dietician = User.objects.create_user(
            username="doc",
            email="doc@example.com",
            password="password123",
            role=User.Role.DIETICIAN,
        )

        self.client.force_authenticate(user=dietician)

        self.assertEqual(
            self.client.get(reverse("my-payments")).status_code, 403
        )

    def test_it_is_read_only(self):
        response = self.client.post(
            reverse("my-payments"),
            {"amount": "1.00"},
            format="json",
        )

        self.assertEqual(response.status_code, 405)
