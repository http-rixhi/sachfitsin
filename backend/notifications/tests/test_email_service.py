from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from notifications.email import client
from notifications.email.service import render, send_email
from notifications.models import EmailLog, EmailStatus

User = get_user_model()


class RenderTests(TestCase):
    def test_renders_html_and_text(self):
        html, text = render("welcome", {"first_name": "Rishi"})

        self.assertIn("Welcome to Sachfitsin", html)
        self.assertIn("Rishi", html)
        self.assertIn("Rishi", text)
        self.assertNotIn("<table", text)

    def test_links_use_the_frontend_url(self):
        html, _ = render("welcome", {"first_name": "Rishi"})

        self.assertIn("http://localhost:5173/dashboard", html)

    def test_details_table_is_rendered(self):
        html, _ = render(
            "diet_plan_created",
            {
                "first_name": "Rishi",
                "details": [("Plan", "Summer reset")],
                "description": "",
            },
        )

        self.assertIn("Summer reset", html)


@override_settings(EMAIL_ENABLED=True, RESEND_API_KEY="test-key")
class SendEmailTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="rishi",
            email="rishi@example.com",
            password="password123",
        )

    @patch("notifications.email.service.client.send", return_value="msg_1")
    def test_successful_send_is_logged(self, mocked_send):
        log = send_email(
            to=self.user.email,
            subject="Hello",
            template="welcome",
            context={"first_name": "Rishi"},
            user=self.user,
        )

        self.assertEqual(log.status, EmailStatus.SENT)
        self.assertEqual(log.provider_message_id, "msg_1")
        mocked_send.assert_called_once()

    @patch(
        "notifications.email.service.client.send",
        side_effect=client.EmailDeliveryError("Resend returned 500"),
    )
    def test_delivery_failure_is_logged_and_does_not_raise(self, _mock):
        log = send_email(
            to=self.user.email,
            subject="Hello",
            template="welcome",
            context={"first_name": "Rishi"},
            user=self.user,
        )

        self.assertEqual(log.status, EmailStatus.FAILED)
        self.assertIn("Resend returned 500", log.error)

    @patch(
        "notifications.email.service.client.send",
        side_effect=RuntimeError("something unexpected"),
    )
    def test_unexpected_error_is_swallowed(self, _mock):
        log = send_email(
            to=self.user.email,
            subject="Hello",
            template="welcome",
            context={"first_name": "Rishi"},
            user=self.user,
        )

        self.assertEqual(log.status, EmailStatus.FAILED)

    @patch("notifications.email.service.client.send")
    def test_missing_template_is_logged_not_raised(self, mocked_send):
        log = send_email(
            to=self.user.email,
            subject="Hello",
            template="does_not_exist",
            context={},
            user=self.user,
        )

        self.assertEqual(log.status, EmailStatus.FAILED)
        self.assertIn("Template error", log.error)
        mocked_send.assert_not_called()

    @patch("notifications.email.service.client.send", return_value="msg_1")
    def test_no_recipient_sends_nothing(self, mocked_send):
        log = send_email(
            to="",
            subject="Hello",
            template="welcome",
            context={},
        )

        self.assertIsNone(log)
        mocked_send.assert_not_called()

    @patch("notifications.email.service.client.send", return_value="msg_1")
    def test_duplicate_dedupe_key_is_not_resent(self, mocked_send):
        for _ in range(3):
            send_email(
                to=self.user.email,
                subject="Hello",
                template="welcome",
                context={"first_name": "Rishi"},
                user=self.user,
                dedupe_key="welcome:1",
            )

        self.assertEqual(mocked_send.call_count, 1)

        self.assertEqual(
            EmailLog.objects.filter(status=EmailStatus.SENT).count(), 1
        )
        self.assertEqual(
            EmailLog.objects.filter(status=EmailStatus.DUPLICATE).count(), 2
        )

    @patch(
        "notifications.email.service.client.send",
        side_effect=client.EmailDeliveryError("down"),
    )
    def test_a_failed_send_can_be_retried(self, mocked_send):
        """A failure must not block a later attempt with the same key."""

        send_email(
            to=self.user.email,
            subject="Hello",
            template="welcome",
            context={"first_name": "Rishi"},
            dedupe_key="welcome:1",
        )

        mocked_send.side_effect = None
        mocked_send.return_value = "msg_2"

        log = send_email(
            to=self.user.email,
            subject="Hello",
            template="welcome",
            context={"first_name": "Rishi"},
            dedupe_key="welcome:1",
        )

        self.assertEqual(log.status, EmailStatus.SENT)


class EmailNotConfiguredTests(TestCase):
    @override_settings(EMAIL_ENABLED=True, RESEND_API_KEY="")
    def test_missing_api_key_is_skipped_not_failed(self):
        user = User.objects.create_user(
            username="rishi",
            email="rishi@example.com",
            password="password123",
        )

        log = send_email(
            to=user.email,
            subject="Hello",
            template="welcome",
            context={"first_name": "Rishi"},
            user=user,
        )

        self.assertEqual(log.status, EmailStatus.SKIPPED)

    @override_settings(EMAIL_ENABLED=False, RESEND_API_KEY="test-key")
    def test_email_can_be_switched_off(self):
        log = send_email(
            to="someone@example.com",
            subject="Hello",
            template="welcome",
            context={"first_name": "Rishi"},
        )

        self.assertEqual(log.status, EmailStatus.SKIPPED)


class ResendClientTests(TestCase):
    @override_settings(EMAIL_ENABLED=True, RESEND_API_KEY="test-key")
    @patch("notifications.email.client.requests.post")
    def test_payload_sent_to_resend(self, mocked_post):
        mocked_post.return_value.status_code = 200
        mocked_post.return_value.json.return_value = {"id": "msg_9"}

        message_id = client.send(
            to="rishi@example.com",
            subject="Hello",
            html="<p>Hi</p>",
            text="Hi",
        )

        self.assertEqual(message_id, "msg_9")

        _, kwargs = mocked_post.call_args

        self.assertEqual(kwargs["json"]["to"], ["rishi@example.com"])
        self.assertEqual(kwargs["json"]["subject"], "Hello")
        self.assertEqual(kwargs["json"]["html"], "<p>Hi</p>")
        self.assertEqual(
            kwargs["headers"]["Authorization"], "Bearer test-key"
        )

    @override_settings(EMAIL_ENABLED=True, RESEND_API_KEY="test-key")
    @patch("notifications.email.client.requests.post")
    def test_error_response_raises_delivery_error(self, mocked_post):
        mocked_post.return_value.status_code = 422
        mocked_post.return_value.text = "Invalid from address"

        with self.assertRaises(client.EmailDeliveryError):
            client.send(
                to="rishi@example.com",
                subject="Hello",
                html="<p>Hi</p>",
            )

    @override_settings(EMAIL_ENABLED=True, RESEND_API_KEY="")
    def test_no_key_raises_not_configured(self):
        with self.assertRaises(client.EmailNotConfigured):
            client.send(
                to="rishi@example.com",
                subject="Hello",
                html="<p>Hi</p>",
            )

    @override_settings(EMAIL_ENABLED=True, RESEND_API_KEY="test-key")
    @patch("notifications.email.client.requests.post")
    def test_api_key_never_appears_in_the_stored_error(self, mocked_post):
        mocked_post.return_value.status_code = 500
        mocked_post.return_value.text = "server error"

        user = User.objects.create_user(
            username="rishi",
            email="rishi@example.com",
            password="password123",
        )

        log = send_email(
            to=user.email,
            subject="Hello",
            template="welcome",
            context={"first_name": "Rishi"},
            user=user,
        )

        self.assertEqual(log.status, EmailStatus.FAILED)
        self.assertNotIn("test-key", log.error)
