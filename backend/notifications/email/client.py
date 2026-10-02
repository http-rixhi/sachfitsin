"""
Thin wrapper around the Resend HTTP API.

This module only knows how to put one email on the wire. It does not know
about templates, logging, or business events — that is the job of
``notifications.email.service``.
"""

import logging

import requests
from django.conf import settings

logger = logging.getLogger("notifications.email")


class EmailError(Exception):
    """Base class for anything that stops an email leaving the building."""


class EmailNotConfigured(EmailError):
    """No Resend API key, or email is switched off in settings."""


class EmailDeliveryError(EmailError):
    """Resend was reached but refused or failed to accept the email."""


def is_configured() -> bool:
    return bool(settings.EMAIL_ENABLED and settings.RESEND_API_KEY)


def send(
    *,
    to: str,
    subject: str,
    html: str,
    text: str = "",
    reply_to: str = "",
) -> str:
    """
    Send one email through Resend and return the provider message id.

    Raises ``EmailNotConfigured`` or ``EmailDeliveryError``. Callers should
    use ``notifications.email.service.send_email`` instead of this, which
    turns those exceptions into logged rows.
    """

    if not settings.EMAIL_ENABLED:
        raise EmailNotConfigured("EMAIL_ENABLED is False.")

    if not settings.RESEND_API_KEY:
        raise EmailNotConfigured("RESEND_API_KEY is not set.")

    payload = {
        "from": settings.DEFAULT_FROM_EMAIL,
        "to": [to],
        "subject": subject,
        "html": html,
    }

    if text:
        payload["text"] = text

    reply_to = reply_to or settings.EMAIL_REPLY_TO

    if reply_to:
        payload["reply_to"] = [reply_to]

    try:
        response = requests.post(
            settings.RESEND_API_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=settings.EMAIL_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise EmailDeliveryError(
            f"Could not reach Resend: {exc}"
        ) from exc

    if response.status_code >= 400:
        raise EmailDeliveryError(
            f"Resend returned {response.status_code}: "
            f"{_safe_body(response)}"
        )

    try:
        data = response.json()
    except ValueError:
        # Accepted, but the body was not JSON. Nothing to fail over.
        return ""

    return str(data.get("id", ""))


def _safe_body(response) -> str:
    """Trim the provider response so a long HTML error page cannot flood logs."""

    try:
        return response.text[:500]
    except Exception:  # pragma: no cover - defensive
        return "<unreadable response body>"
