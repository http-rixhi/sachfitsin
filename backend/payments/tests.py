import hashlib
import hmac

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from products.models import Product

from .models import Payment

User = get_user_model()

TEST_SECRET = "test_secret_key"


def real_signature(order_id: str, payment_id: str) -> str:
    """Exactly what Razorpay would send back for this order and payment."""

    return hmac.new(
        TEST_SECRET.encode(),
        f"{order_id}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()


@override_settings(
    RAZORPAY_KEY_ID="rzp_test_key",
    RAZORPAY_KEY_SECRET=TEST_SECRET,
)
class VerifyPaymentTests(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            username="rishi",
            email="rishi@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

        self.attacker = User.objects.create_user(
            username="attacker",
            email="attacker@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

        self.product = Product.objects.create(
            code="PERSONALIZED_VIDEOS",
            name="Personalized Videos",
            price="499.00",
            billing_type=Product.BillingType.MONTHLY,
            status=Product.Status.ACTIVE,
        )

        self.payment = Payment.objects.create(
            customer=self.customer,
            product=self.product,
            amount="499.00",
            currency="INR",
            status=Payment.Status.CREATED,
            razorpay_order_id="order_ABC123",
        )

        self.client.force_authenticate(user=self.customer)

    def url(self):
        return reverse("verify-payment")

    def valid_body(self, payment_id="pay_XYZ789"):
        return {
            "razorpay_order_id": self.payment.razorpay_order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": real_signature(
                self.payment.razorpay_order_id, payment_id
            ),
        }

    # -- the happy path ---------------------------------------------------

    def test_a_genuine_signature_is_accepted(self):
        response = self.client.post(
            self.url(), self.valid_body(), format="json"
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["success"])

        self.payment.refresh_from_db()

        self.assertEqual(self.payment.status, Payment.Status.SUCCESS)
        self.assertEqual(self.payment.razorpay_payment_id, "pay_XYZ789")
        self.assertTrue(self.payment.razorpay_signature)

    def test_verifying_grants_the_entitlement(self):
        from subscriptions.models import Entitlement

        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(
                self.url(), self.valid_body(), format="json"
            )

        self.assertTrue(
            Entitlement.objects.filter(
                customer=self.customer,
                product=self.product,
                status=Entitlement.Status.ACTIVE,
            ).exists()
        )

    def test_paying_actually_opens_the_paywall(self):
        """
        The whole point, end to end.

        Before paying, the personalised videos endpoint is closed. After a
        verified payment it is open — without anyone touching the database
        by hand.
        """

        before = self.client.get(reverse("my-personalized-videos"))

        self.assertEqual(before.status_code, 403)
        self.assertEqual(
            before.json()["error"]["code"], "entitlement_required"
        )

        with self.captureOnCommitCallbacks(execute=True):
            paid = self.client.post(
                self.url(), self.valid_body(), format="json"
            )

        self.assertEqual(paid.status_code, 200)

        after = self.client.get(reverse("my-personalized-videos"))

        self.assertEqual(
            after.status_code,
            200,
            "a verified payment must unlock the feature",
        )

    def test_a_forged_signature_unlocks_nothing(self):
        from subscriptions.models import Entitlement

        self.client.post(
            self.url(),
            {
                "razorpay_order_id": "order_ABC123",
                "razorpay_payment_id": "pay_XYZ789",
                "razorpay_signature": "forged",
            },
            format="json",
        )

        self.assertFalse(
            Entitlement.objects.filter(customer=self.customer).exists()
        )

        self.assertEqual(
            self.client.get(
                reverse("my-personalized-videos")
            ).status_code,
            403,
        )

    def test_verifying_twice_grants_access_once(self):
        from subscriptions.models import Entitlement

        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(
                self.url(), self.valid_body(), format="json"
            )
            self.client.post(
                self.url(), self.valid_body(), format="json"
            )

        self.assertEqual(
            Entitlement.objects.filter(customer=self.customer).count(), 1
        )

    # -- forgery ----------------------------------------------------------

    def test_a_made_up_signature_is_rejected(self):
        response = self.client.post(
            self.url(),
            {
                "razorpay_order_id": "order_ABC123",
                "razorpay_payment_id": "pay_XYZ789",
                "razorpay_signature": "completely-made-up",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.FAILED)
        self.assertEqual(self.payment.razorpay_payment_id, None)

    def test_a_signature_for_a_different_payment_id_is_rejected(self):
        """Signed correctly, but for another payment. Must not pass."""

        response = self.client.post(
            self.url(),
            {
                "razorpay_order_id": "order_ABC123",
                "razorpay_payment_id": "pay_ATTACKER",
                "razorpay_signature": real_signature(
                    "order_ABC123", "pay_SOMETHING_ELSE"
                ),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

        self.payment.refresh_from_db()
        self.assertNotEqual(self.payment.status, Payment.Status.SUCCESS)

    def test_a_signature_made_with_the_wrong_secret_is_rejected(self):
        forged = hmac.new(
            b"the-attacker-guessed-this",
            b"order_ABC123|pay_XYZ789",
            hashlib.sha256,
        ).hexdigest()

        response = self.client.post(
            self.url(),
            {
                "razorpay_order_id": "order_ABC123",
                "razorpay_payment_id": "pay_XYZ789",
                "razorpay_signature": forged,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

        self.payment.refresh_from_db()
        self.assertNotEqual(self.payment.status, Payment.Status.SUCCESS)

    def test_the_rejection_message_does_not_leak_the_secret(self):
        response = self.client.post(
            self.url(),
            {
                "razorpay_order_id": "order_ABC123",
                "razorpay_payment_id": "pay_XYZ789",
                "razorpay_signature": "wrong",
            },
            format="json",
        )

        self.assertNotIn(TEST_SECRET, response.content.decode())

    # -- ownership --------------------------------------------------------

    def test_another_customer_cannot_verify_my_payment(self):
        self.client.force_authenticate(user=self.attacker)

        response = self.client.post(
            self.url(), self.valid_body(), format="json"
        )

        self.assertEqual(response.status_code, 404)

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.CREATED)

    def test_an_unknown_order_and_someone_elses_look_the_same(self):
        """So order ids cannot be probed for."""

        self.client.force_authenticate(user=self.attacker)

        theirs = self.client.post(
            self.url(), self.valid_body(), format="json"
        )

        unknown = self.client.post(
            self.url(),
            {
                "razorpay_order_id": "order_DOES_NOT_EXIST",
                "razorpay_payment_id": "pay_1",
                "razorpay_signature": "x",
            },
            format="json",
        )

        self.assertEqual(theirs.status_code, unknown.status_code)
        self.assertEqual(theirs.json(), unknown.json())

    def test_a_dietician_cannot_use_this_endpoint(self):
        dietician = User.objects.create_user(
            username="doc",
            email="doc@example.com",
            password="password123",
            role=User.Role.DIETICIAN,
        )

        self.client.force_authenticate(user=dietician)

        response = self.client.post(
            self.url(), self.valid_body(), format="json"
        )

        self.assertEqual(response.status_code, 403)

    def test_anonymous_callers_are_rejected(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            self.url(), self.valid_body(), format="json"
        )

        self.assertEqual(response.status_code, 401)

    # -- replay and reuse -------------------------------------------------

    def test_verifying_twice_is_harmless(self):
        first = self.client.post(
            self.url(), self.valid_body(), format="json"
        )

        second = self.client.post(
            self.url(), self.valid_body(), format="json"
        )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertIn("already", second.data["message"].lower())

        self.assertEqual(
            Payment.objects.filter(
                status=Payment.Status.SUCCESS
            ).count(),
            1,
        )

    def test_one_payment_cannot_settle_two_orders(self):
        """A real payment, replayed against a second order."""

        self.client.post(self.url(), self.valid_body(), format="json")

        second_order = Payment.objects.create(
            customer=self.customer,
            product=self.product,
            amount="499.00",
            status=Payment.Status.CREATED,
            razorpay_order_id="order_SECOND",
        )

        response = self.client.post(
            self.url(),
            {
                "razorpay_order_id": "order_SECOND",
                "razorpay_payment_id": "pay_XYZ789",
                "razorpay_signature": real_signature(
                    "order_SECOND", "pay_XYZ789"
                ),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

        second_order.refresh_from_db()
        self.assertNotEqual(
            second_order.status, Payment.Status.SUCCESS
        )

    def test_a_failed_payment_can_be_verified_again(self):
        """A bad first attempt must not block the real one."""

        self.client.post(
            self.url(),
            {
                "razorpay_order_id": "order_ABC123",
                "razorpay_payment_id": "pay_XYZ789",
                "razorpay_signature": "wrong",
            },
            format="json",
        )

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.FAILED)

        response = self.client.post(
            self.url(), self.valid_body(), format="json"
        )

        self.assertEqual(response.status_code, 200, response.data)

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.SUCCESS)
        self.assertEqual(self.payment.failure_reason, "")

    # -- input shape ------------------------------------------------------

    def test_missing_fields_are_rejected(self):
        response = self.client.post(
            self.url(),
            {"razorpay_order_id": "order_ABC123"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

        fields = response.json()["error"]["fields"]

        self.assertIn("razorpay_payment_id", fields)
        self.assertIn("razorpay_signature", fields)

    def test_errors_use_the_standard_shape(self):
        response = self.client.post(self.url(), {}, format="json")

        body = response.json()

        self.assertIn("error", body)
        self.assertEqual(body["error"]["code"], "validation_error")
