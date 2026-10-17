"""
Sign-up with email verification.

The thing worth protecting here is that no account can exist without
somebody having read the code in that inbox. Most of these tests are
attempts to get an account without doing that.
"""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts import otp
from accounts.models import PendingSignup


User = get_user_model()

VALID = {
    "username": "newcustomer",
    "email": "new@example.com",
    "password": "a-strong-pass-9134",
    "first_name": "New",
    "last_name": "Customer",
}


def _sent_code(mock_send):
    """Pull the code out of the email the code actually rendered."""

    assert mock_send.called, "no email was sent"

    text = mock_send.call_args.kwargs["text"]

    digits = [
        token
        for token in text.replace("\n", " ").split()
        if token.isdigit() and len(token) == otp.code_length()
    ]

    assert digits, f"no {otp.code_length()} digit code in:\n{text}"

    return digits[0]


@patch("notifications.email.service.client.send", return_value="msg_1")
class SignupFlowTests(TestCase):
    def setUp(self):
        # DRF throttles live in the cache, which outlives a test. Without
        # this, later tests fail with 429 for reasons that have nothing to
        # do with what they are checking.
        cache.clear()

        self.client = APIClient()
        self.register_url = reverse("register")
        self.verify_url = reverse("verify-email")
        self.resend_url = reverse("resend-code")

    # --- step one ----------------------------------------------------

    def test_register_creates_no_user(self, mock_send):
        response = self.client.post(self.register_url, VALID, format="json")

        self.assertEqual(response.status_code, 202)
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(PendingSignup.objects.count(), 1)

    def test_register_sends_a_code(self, mock_send):
        self.client.post(self.register_url, VALID, format="json")

        self.assertTrue(mock_send.called)
        self.assertEqual(
            mock_send.call_args.kwargs["to"], VALID["email"]
        )

    def test_response_never_contains_the_code(self, mock_send):
        response = self.client.post(self.register_url, VALID, format="json")

        code = _sent_code(mock_send)

        self.assertNotIn(code, str(response.data))

    def test_code_is_not_stored_in_the_clear(self, mock_send):
        self.client.post(self.register_url, VALID, format="json")

        code = _sent_code(mock_send)
        pending = PendingSignup.objects.get()

        self.assertNotEqual(pending.code_hash, code)
        self.assertTrue(otp.code_matches(code, pending.code_hash))

    def test_password_is_not_stored_in_the_clear(self, mock_send):
        self.client.post(self.register_url, VALID, format="json")

        pending = PendingSignup.objects.get()

        self.assertNotEqual(pending.password, VALID["password"])

    def test_duplicate_username_is_refused(self, mock_send):
        User.objects.create_user(
            username=VALID["username"],
            email="someone@example.com",
            password="x" * 12,
        )

        response = self.client.post(self.register_url, VALID, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(PendingSignup.objects.count(), 0)

    def test_duplicate_email_is_refused_ignoring_case(self, mock_send):
        User.objects.create_user(
            username="other",
            email="NEW@EXAMPLE.COM",
            password="x" * 12,
        )

        response = self.client.post(self.register_url, VALID, format="json")

        self.assertEqual(response.status_code, 400)

    def test_asking_twice_replaces_the_first_attempt(self, mock_send):
        self.client.post(self.register_url, VALID, format="json")
        first = _sent_code(mock_send)

        self.client.post(self.register_url, VALID, format="json")

        self.assertEqual(PendingSignup.objects.count(), 1)

        pending = PendingSignup.objects.get()
        self.assertFalse(otp.code_matches(first, pending.code_hash))

    def test_nothing_is_left_behind_when_the_email_fails(self, mock_send):
        mock_send.side_effect = RuntimeError("resend is down")

        response = self.client.post(self.register_url, VALID, format="json")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(PendingSignup.objects.count(), 0)
        self.assertEqual(User.objects.count(), 0)

    # --- step two ----------------------------------------------------

    def test_correct_code_creates_the_account(self, mock_send):
        self.client.post(self.register_url, VALID, format="json")
        code = _sent_code(mock_send)

        response = self.client.post(
            self.verify_url,
            {"email": VALID["email"], "code": code},
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        user = User.objects.get()
        self.assertEqual(user.username, VALID["username"])
        self.assertEqual(user.role, User.Role.CUSTOMER)
        self.assertEqual(PendingSignup.objects.count(), 0)

    def test_the_password_chosen_at_step_one_works(self, mock_send):
        self.client.post(self.register_url, VALID, format="json")
        code = _sent_code(mock_send)

        self.client.post(
            self.verify_url,
            {"email": VALID["email"], "code": code},
            format="json",
        )

        response = self.client.post(
            reverse("login"),
            {
                "username": VALID["username"],
                "password": VALID["password"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)

    def test_wrong_code_creates_nothing(self, mock_send):
        self.client.post(self.register_url, VALID, format="json")

        response = self.client.post(
            self.verify_url,
            {"email": VALID["email"], "code": "000000"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.count(), 0)

    def test_code_is_burned_after_too_many_guesses(self, mock_send):
        self.client.post(self.register_url, VALID, format="json")
        code = _sent_code(mock_send)

        for _ in range(otp.max_attempts()):
            self.client.post(
                self.verify_url,
                {"email": VALID["email"], "code": "000001"},
                format="json",
            )

        self.assertEqual(PendingSignup.objects.count(), 0)

        # Even the real code is useless now.
        response = self.client.post(
            self.verify_url,
            {"email": VALID["email"], "code": code},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.count(), 0)

    def test_expired_code_is_refused(self, mock_send):
        self.client.post(self.register_url, VALID, format="json")
        code = _sent_code(mock_send)

        pending = PendingSignup.objects.get()
        pending.expires_at = timezone.now() - timezone.timedelta(seconds=1)
        pending.save(update_fields=["expires_at"])

        response = self.client.post(
            self.verify_url,
            {"email": VALID["email"], "code": code},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.count(), 0)

    def test_unknown_email_is_refused(self, mock_send):
        response = self.client.post(
            self.verify_url,
            {"email": "nobody@example.com", "code": "123456"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_a_code_cannot_be_used_twice(self, mock_send):
        self.client.post(self.register_url, VALID, format="json")
        code = _sent_code(mock_send)

        self.client.post(
            self.verify_url,
            {"email": VALID["email"], "code": code},
            format="json",
        )

        response = self.client.post(
            self.verify_url,
            {"email": VALID["email"], "code": code},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.count(), 1)

    def test_welcome_email_arrives_only_after_verifying(self, mock_send):
        self.client.post(self.register_url, VALID, format="json")

        templates = [
            call.kwargs.get("subject", "") for call in mock_send.call_args_list
        ]
        self.assertFalse(
            any("Welcome" in s for s in templates),
            "welcome email was sent before the email was proved",
        )

        code = _sent_code(mock_send)
        self.client.post(
            self.verify_url,
            {"email": VALID["email"], "code": code},
            format="json",
        )

        subjects = [
            call.kwargs.get("subject", "") for call in mock_send.call_args_list
        ]
        self.assertTrue(any("Welcome" in s for s in subjects))

    # --- resend ------------------------------------------------------

    @override_settings(SIGNUP_OTP_RESEND_COOLDOWN_SECONDS=0)
    def test_resend_replaces_the_code(self, mock_send):
        self.client.post(self.register_url, VALID, format="json")
        first = _sent_code(mock_send)

        response = self.client.post(
            self.resend_url, {"email": VALID["email"]}, format="json"
        )

        self.assertEqual(response.status_code, 202)

        pending = PendingSignup.objects.get()
        self.assertFalse(otp.code_matches(first, pending.code_hash))

    @override_settings(SIGNUP_OTP_RESEND_COOLDOWN_SECONDS=0)
    def test_resend_resets_the_attempt_counter(self, mock_send):
        self.client.post(self.register_url, VALID, format="json")

        for _ in range(otp.max_attempts() - 1):
            self.client.post(
                self.verify_url,
                {"email": VALID["email"], "code": "000001"},
                format="json",
            )

        self.assertEqual(PendingSignup.objects.get().attempts, 4)

        self.client.post(
            self.resend_url, {"email": VALID["email"]}, format="json"
        )

        self.assertEqual(PendingSignup.objects.get().attempts, 0)

    def test_resend_is_rate_limited(self, mock_send):
        self.client.post(self.register_url, VALID, format="json")

        response = self.client.post(
            self.resend_url, {"email": VALID["email"]}, format="json"
        )

        self.assertEqual(response.status_code, 429)

    def test_resend_for_unknown_email(self, mock_send):
        response = self.client.post(
            self.resend_url,
            {"email": "nobody@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 404)


class EmailUniquenessTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_two_accounts_cannot_share_an_email(self):
        User.objects.create_user(
            username="a", email="same@example.com", password="x" * 12
        )

        with self.assertRaises(Exception):
            User.objects.create_user(
                username="b", email="SAME@example.com", password="x" * 12
            )

    def test_blank_emails_do_not_collide(self):
        User.objects.create_user(username="a", email="", password="x" * 12)
        User.objects.create_user(username="b", email="", password="x" * 12)

        self.assertEqual(User.objects.filter(email="").count(), 2)
