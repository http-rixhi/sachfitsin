"""
The one place the rest of the project sends email from.

``send_email`` never raises. Whatever happens, it writes an ``EmailLog`` row
and returns it, so a delivery problem can never turn a saved diet plan into
a 500 response.
"""

import logging

from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags

from notifications.email import client
from notifications.models import EmailLog, EmailStatus

logger = logging.getLogger("notifications.email")


def render(template: str, context: dict) -> tuple[str, str]:
    """Render an email template to (html, plain text)."""

    base_context = {
        "site_name": settings.SITE_NAME,
        "frontend_url": settings.FRONTEND_URL.rstrip("/"),
        "support_email": settings.SUPPORT_EMAIL,
    }

    html = render_to_string(
        f"emails/{template}.html",
        {**base_context, **context},
    )

    text = strip_tags(html)
    text = "\n".join(
        line.strip() for line in text.splitlines() if line.strip()
    )

    return html, text


def already_sent(dedupe_key: str) -> bool:
    """True when this exact email has already been accepted by Resend."""

    if not dedupe_key:
        return False

    return EmailLog.objects.filter(
        dedupe_key=dedupe_key,
        status=EmailStatus.SENT,
    ).exists()


def send_email(
    *,
    to: str,
    subject: str,
    template: str,
    context: dict | None = None,
    user=None,
    dedupe_key: str = "",
) -> EmailLog | None:
    """
    Render a template and send it through Resend.

    Returns the ``EmailLog`` row, or ``None`` when there was no address to
    send to. This function swallows every exception on purpose.
    """

    if not to:
        logger.warning(
            "Skipping email '%s': no recipient address.", template
        )
        return None

    if already_sent(dedupe_key):
        logger.info(
            "Skipping duplicate email '%s' to %s (key=%s).",
            template,
            to,
            dedupe_key,
        )

        return EmailLog.objects.create(
            user=user,
            to_email=to,
            subject=subject,
            template=template,
            status=EmailStatus.DUPLICATE,
            dedupe_key=dedupe_key,
        )

    try:
        html, text = render(template, context or {})
    except Exception as exc:
        logger.exception("Could not render email template '%s'.", template)

        return EmailLog.objects.create(
            user=user,
            to_email=to,
            subject=subject,
            template=template,
            status=EmailStatus.FAILED,
            error=f"Template error: {exc}"[:2000],
            dedupe_key=dedupe_key,
        )

    try:
        message_id = client.send(
            to=to,
            subject=subject,
            html=html,
            text=text,
        )
    except client.EmailNotConfigured as exc:
        # Expected before Resend is set up. Log the body so the flow can
        # still be followed end to end during development.
        logger.info(
            "Email not sent (%s). To=%s Subject=%s", exc, to, subject
        )

        if settings.DEBUG:
            logger.debug("Email body:\n%s", text)

        return EmailLog.objects.create(
            user=user,
            to_email=to,
            subject=subject,
            template=template,
            status=EmailStatus.SKIPPED,
            error=str(exc)[:2000],
            dedupe_key=dedupe_key,
        )
    except Exception as exc:
        logger.exception(
            "Email failed. To=%s Subject=%s Template=%s",
            to,
            subject,
            template,
        )

        return EmailLog.objects.create(
            user=user,
            to_email=to,
            subject=subject,
            template=template,
            status=EmailStatus.FAILED,
            error=str(exc)[:2000],
            dedupe_key=dedupe_key,
        )

    logger.info("Email sent. To=%s Template=%s", to, template)

    return EmailLog.objects.create(
        user=user,
        to_email=to,
        subject=subject,
        template=template,
        status=EmailStatus.SENT,
        provider_message_id=message_id,
        dedupe_key=dedupe_key,
    )
