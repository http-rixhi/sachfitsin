"""
Every error the API can return must come back in the standard shape.

These tests trigger real errors through real endpoints rather than calling
the handler directly, so a view that bypasses it would be caught.
"""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from api.errors import ErrorCode

User = get_user_model()


def assert_error_shape(testcase, response, code, status_code):
    """Every assertion about the contract lives here, in one place."""

    testcase.assertEqual(response.status_code, status_code)

    body = response.json()

    testcase.assertIn("error", body, f"missing 'error' key: {body}")

    error = body["error"]

    testcase.assertEqual(error["code"], code)
    testcase.assertEqual(error["status"], status_code)

    testcase.assertIsInstance(error["message"], str)
    testcase.assertTrue(error["message"], "message must not be empty")
    testcase.assertTrue(
        error["message"][0].isupper(),
        f"message should read like a sentence: {error['message']!r}",
    )

    return error


class ValidationErrorTests(APITestCase):
    def test_missing_required_fields(self):
        response = self.client.post(
            reverse("register"), {}, format="json"
        )

        error = assert_error_shape(
            self, response, ErrorCode.VALIDATION_ERROR, 400
        )

        self.assertIn("fields", error)
        self.assertIn("username", error["fields"])
        self.assertIsInstance(error["fields"]["username"], list)

    def test_invalid_field_value(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "newbie",
                "email": "not-an-email",
                "password": "password123",
            },
            format="json",
        )

        error = assert_error_shape(
            self, response, ErrorCode.VALIDATION_ERROR, 400
        )

        self.assertIn("email", error["fields"])

    def test_short_password(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "newbie",
                "email": "a@example.com",
                "password": "short",
            },
            format="json",
        )

        error = assert_error_shape(
            self, response, ErrorCode.VALIDATION_ERROR, 400
        )

        self.assertIn("password", error["fields"])

    def test_duplicate_username(self):
        User.objects.create_user(
            username="taken", email="a@example.com", password="password123"
        )

        response = self.client.post(
            reverse("register"),
            {
                "username": "taken",
                "email": "b@example.com",
                "password": "password123",
            },
            format="json",
        )

        error = assert_error_shape(
            self, response, ErrorCode.VALIDATION_ERROR, 400
        )

        self.assertIn("username", error["fields"])

    def test_message_is_the_first_field_error(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "newbie",
                "email": "not-an-email",
                "password": "password123",
            },
            format="json",
        )

        error = response.json()["error"]

        self.assertEqual(
            error["message"], error["fields"]["email"][0]
        )


class AuthenticationErrorTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="rishi",
            email="rishi@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

    def test_no_token(self):
        response = self.client.get(reverse("notification-list"))

        assert_error_shape(
            self, response, ErrorCode.AUTHENTICATION_REQUIRED, 401
        )

    def test_garbage_token(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer not-a-token")

        response = self.client.get(reverse("notification-list"))

        assert_error_shape(self, response, ErrorCode.INVALID_TOKEN, 401)

    def test_expired_token(self):
        from datetime import timedelta

        from rest_framework_simplejwt.tokens import AccessToken

        token = AccessToken.for_user(self.user)
        token.set_exp(from_time=timezone.now() - timedelta(days=2))

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.get(reverse("notification-list"))

        assert_error_shape(self, response, ErrorCode.TOKEN_EXPIRED, 401)

    def test_wrong_password(self):
        response = self.client.post(
            reverse("login"),
            {"username": "rishi", "password": "wrong"},
            format="json",
        )

        error = assert_error_shape(
            self, response, ErrorCode.INVALID_CREDENTIALS, 401
        )

        # Not "your session expired" — the user typed the wrong password.
        self.assertNotIn("session", error["message"].lower())

    def test_unknown_username(self):
        response = self.client.post(
            reverse("login"),
            {"username": "nobody", "password": "whatever"},
            format="json",
        )

        error = assert_error_shape(
            self, response, ErrorCode.INVALID_CREDENTIALS, 401
        )

        # Same wording as a wrong password, so the response cannot be used
        # to find out which usernames exist.
        self.assertEqual(error["message"], "Invalid username or password.")

    def test_wrong_password_and_unknown_user_are_indistinguishable(self):
        wrong_password = self.client.post(
            reverse("login"),
            {"username": "rishi", "password": "wrong"},
            format="json",
        )

        unknown_user = self.client.post(
            reverse("login"),
            {"username": "nobody", "password": "wrong"},
            format="json",
        )

        self.assertEqual(wrong_password.json(), unknown_user.json())
        self.assertEqual(
            wrong_password.status_code, unknown_user.status_code
        )


class PermissionErrorTests(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            username="rishi",
            email="rishi@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

        self.dietician = User.objects.create_user(
            username="doc",
            email="doc@example.com",
            password="password123",
            role=User.Role.DIETICIAN,
        )

    def test_customer_cannot_reach_an_admin_endpoint(self):
        self.client.force_authenticate(user=self.customer)

        response = self.client.get(reverse("dietician-customer-list"))

        error = assert_error_shape(
            self, response, ErrorCode.PERMISSION_DENIED, 403
        )

        self.assertIn("dietician", error["message"].lower())

    def test_dietician_cannot_reach_a_customer_endpoint(self):
        self.client.force_authenticate(user=self.dietician)

        response = self.client.get(reverse("my-exercise-recommendations"))

        assert_error_shape(
            self, response, ErrorCode.PERMISSION_DENIED, 403
        )

    def test_missing_entitlement_has_its_own_code(self):
        self.client.force_authenticate(user=self.customer)

        response = self.client.get(reverse("my-personalized-videos"))

        error = assert_error_shape(
            self, response, ErrorCode.ENTITLEMENT_REQUIRED, 403
        )

        self.assertIn("plan", error["message"].lower())

    def test_entitlement_holder_is_allowed_through(self):
        from products.models import Product
        from subscriptions.models import Entitlement

        product, _ = Product.objects.get_or_create(
            code="PERSONALIZED_NUTRITION_COACHING",
            defaults={
                "name": "Personalized Nutrition Coaching, 1 Month",
                "status": "ACTIVE",
            },
        )

        Entitlement.objects.create(
            customer=self.customer,
            product=product,
            status=Entitlement.Status.ACTIVE,
            starts_at=timezone.now(),
        )

        self.client.force_authenticate(user=self.customer)

        response = self.client.get(reverse("my-personalized-videos"))

        self.assertEqual(response.status_code, 200)


class NotFoundAndMethodTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="rishi",
            email="rishi@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

        self.client.force_authenticate(user=self.user)

    def test_missing_object(self):
        response = self.client.get(
            reverse("notification-detail", kwargs={"pk": 999999})
        )

        assert_error_shape(self, response, ErrorCode.NOT_FOUND, 404)

    def test_unknown_api_url_returns_json_not_html(self):
        response = self.client.get("/api/v1/does-not-exist/")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response["Content-Type"], "application/json")

        body = response.json()

        self.assertEqual(body["error"]["code"], ErrorCode.NOT_FOUND)

    def test_wrong_method(self):
        response = self.client.put(reverse("notification-list"))

        assert_error_shape(
            self, response, ErrorCode.METHOD_NOT_ALLOWED, 405
        )

    def test_malformed_json_body(self):
        # Sent to an endpoint that actually parses a body, so the parse
        # error is real rather than silently ignored.
        response = self.client.post(
            reverse("register"),
            data="{not json",
            content_type="application/json",
        )

        assert_error_shape(
            self, response, ErrorCode.VALIDATION_ERROR, 400
        )


class ServerErrorTests(APITestCase):
    """An unexpected crash must be logged but never described to the user."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="rishi",
            email="rishi@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

        self.client.force_authenticate(user=self.user)

    @patch(
        "notifications.views.unread_count",
        side_effect=RuntimeError(
            "SECRET_KEY=abc123 leaked from /var/app/settings.py"
        ),
    )
    def test_crash_is_a_generic_500(self, _mock):
        self.client.raise_request_exception = False

        response = self.client.get(reverse("notification-unread-count"))

        error = assert_error_shape(
            self, response, ErrorCode.SERVER_ERROR, 500
        )

        self.assertNotIn("fields", error)

    @patch(
        "notifications.views.unread_count",
        side_effect=RuntimeError(
            "SECRET_KEY=abc123 leaked from /var/app/settings.py"
        ),
    )
    def test_crash_never_leaks_internals(self, _mock):
        self.client.raise_request_exception = False

        response = self.client.get(reverse("notification-unread-count"))

        body = response.content.decode()

        for secret in ("SECRET_KEY", "abc123", "/var/app", "RuntimeError"):
            self.assertNotIn(secret, body)

    @patch(
        "notifications.views.unread_count",
        side_effect=RuntimeError("boom"),
    )
    def test_crash_is_logged_with_the_traceback(self, _mock):
        self.client.raise_request_exception = False

        with self.assertLogs("api.errors", level="ERROR") as logs:
            self.client.get(reverse("notification-unread-count"))

        joined = "\n".join(logs.output)

        self.assertIn("Unhandled error", joined)
        self.assertIn("RuntimeError", joined)


class HealthCheckTests(APITestCase):
    def test_success_responses_are_untouched(self):
        """The handler must only touch errors."""

        response = self.client.get(reverse("health-check"))

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("error", response.json())
        self.assertEqual(response.json()["status"], "ok")
