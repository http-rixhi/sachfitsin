"""
One-time codes for proving an email address at sign-up.

The code is never stored in the clear. ``make_password`` is Django's own
password hasher, which is slow on purpose: even with a copy of the
database, walking through the million possible six digit codes costs far
longer than the ten minutes a code stays valid.
"""

import secrets

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone


def code_length() -> int:
    return getattr(settings, "SIGNUP_OTP_LENGTH", 6)


def ttl_seconds() -> int:
    return getattr(settings, "SIGNUP_OTP_TTL_SECONDS", 600)


def max_attempts() -> int:
    return getattr(settings, "SIGNUP_OTP_MAX_ATTEMPTS", 5)


def resend_cooldown_seconds() -> int:
    return getattr(settings, "SIGNUP_OTP_RESEND_COOLDOWN_SECONDS", 60)


def generate_code() -> str:
    """
    A numeric code of the configured length.

    ``secrets`` rather than ``random``: the latter is seeded predictably
    and is not meant for anything an attacker would want to guess.
    """

    upper = 10 ** code_length()

    return str(secrets.randbelow(upper)).zfill(code_length())


def hash_code(code: str) -> str:
    return make_password(code)


def code_matches(code: str, code_hash: str) -> bool:
    return check_password(code, code_hash)


def expiry_from_now():
    return timezone.now() + timezone.timedelta(seconds=ttl_seconds())


def seconds_until_resend_allowed(last_sent_at) -> int:
    """
    How long the caller must still wait, in whole seconds. 0 means now.
    """

    if not last_sent_at:
        return 0

    elapsed = (timezone.now() - last_sent_at).total_seconds()
    remaining = resend_cooldown_seconds() - elapsed

    return max(0, int(remaining + 0.999))
