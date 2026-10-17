"""
Sign-up verification.

The rest of the project treats email as a side effect: `notifications.events`
never raises, so a mail problem can never fail a booking or a payment. The
sign-up code is the exception. It IS the operation, so this module calls
`send_email` directly and reports what happened instead of swallowing it.
"""

import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from notifications.email.service import send_email
from notifications.models import EmailStatus

from . import otp
from .models import PendingSignup

logger = logging.getLogger("accounts")


def _delivered(log) -> bool:
    """
    Did the code actually reach Resend?

    SKIPPED means Resend is not configured. That is normal on a laptop,
    where the code is written to the log instead, so it counts as success
    only while DEBUG is on. In production it is a real failure.
    """

    if log is None:
        return False

    if log.status == EmailStatus.SENT:
        return True

    return log.status == EmailStatus.SKIPPED and settings.DEBUG


def send_signup_code(pending: PendingSignup, code: str) -> bool:
    """
    Email one code. Returns whether it is safe to ask for it back.

    No ``dedupe_key``: a resend is a different code and must never be
    suppressed as a duplicate.
    """

    log = send_email(
        to=pending.email,
        subject=f"{settings.SITE_NAME} verification code: {code}",
        template="signup_otp",
        context={
            "first_name": pending.first_name or "there",
            "code": code,
            "minutes": max(1, otp.ttl_seconds() // 60),
        },
    )

    sent = _delivered(log)

    if sent and settings.DEBUG:
        # On a laptop with no Resend key the email is only logged, so the
        # code would be buried in a rendered HTML body. Print it plainly
        # so local sign-up can actually be finished. DEBUG only - this
        # must never run where real people are signing up.
        logger.warning(
            "DEV ONLY - sign-up code for %s is %s", pending.email, code
        )

    if not sent:
        logger.error(
            "Sign-up code could not be sent to %s (status=%s).",
            pending.email,
            getattr(log, "status", "no log"),
        )

    return sent


@transaction.atomic
def start_signup(*, username, email, password_hash, first_name, last_name):
    """
    Replace any earlier attempt for this address and issue a fresh code.

    Returns ``(pending, code)``. The caller emails the code; it is never
    returned to the browser.
    """

    PendingSignup.objects.filter(email__iexact=email).delete()

    code = otp.generate_code()

    pending = PendingSignup.objects.create(
        username=username,
        email=email,
        first_name=first_name or "",
        last_name=last_name or "",
        password=password_hash,
        code_hash=otp.hash_code(code),
        expires_at=otp.expiry_from_now(),
        last_sent_at=timezone.now(),
    )

    return pending, code


@transaction.atomic
def reissue_code(pending: PendingSignup):
    """
    A new code for an existing attempt, with the attempt counter reset.

    The old code stops working immediately, so a resend cannot be used to
    widen the number of guesses available.
    """

    code = otp.generate_code()

    pending.code_hash = otp.hash_code(code)
    pending.attempts = 0
    pending.expires_at = otp.expiry_from_now()
    pending.last_sent_at = timezone.now()
    pending.save(
        update_fields=[
            "code_hash",
            "attempts",
            "expires_at",
            "last_sent_at",
        ]
    )

    return code


def purge_expired() -> int:
    """Drop abandoned attempts. Safe to call at any time."""

    deleted, _ = PendingSignup.objects.filter(
        expires_at__lt=timezone.now()
    ).delete()

    return deleted
