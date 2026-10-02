"""
Send one real email through Resend to prove the setup works.

    python manage.py send_test_email you@example.com
"""

from django.conf import settings
from django.core.management.base import BaseCommand

from notifications.email import client
from notifications.email.service import send_email
from notifications.models import EmailStatus


class Command(BaseCommand):
    help = "Send a test email through Resend to check the configuration."

    def add_arguments(self, parser):
        parser.add_argument(
            "email",
            help="Where to send the test email.",
        )

        parser.add_argument(
            "--template",
            default="welcome",
            help="Template name to render (default: welcome).",
        )

    def handle(self, *args, **options):
        recipient = options["email"]
        template = options["template"]

        self.stdout.write("Configuration")
        self.stdout.write(f"  EMAIL_ENABLED  : {settings.EMAIL_ENABLED}")
        self.stdout.write(
            f"  RESEND_API_KEY : "
            f"{'set' if settings.RESEND_API_KEY else 'MISSING'}"
        )
        self.stdout.write(f"  From           : {settings.DEFAULT_FROM_EMAIL}")
        self.stdout.write(f"  Frontend URL   : {settings.FRONTEND_URL}")
        self.stdout.write("")

        if not client.is_configured():
            self.stdout.write(
                self.style.WARNING(
                    "Email is not configured. The send will be recorded as "
                    "SKIPPED and nothing will leave the server."
                )
            )
            self.stdout.write("")

        log = send_email(
            to=recipient,
            subject=f"{settings.SITE_NAME} test email",
            template=template,
            context={"first_name": "there"},
        )

        if log is None:
            self.stdout.write(self.style.ERROR("No recipient given."))
            return

        if log.status == EmailStatus.SENT:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Sent to {recipient}. "
                    f"Resend message id: {log.provider_message_id or 'n/a'}"
                )
            )
        elif log.status == EmailStatus.SKIPPED:
            self.stdout.write(
                self.style.WARNING(f"Skipped: {log.error}")
            )
        else:
            self.stdout.write(
                self.style.ERROR(f"{log.status}: {log.error}")
            )
