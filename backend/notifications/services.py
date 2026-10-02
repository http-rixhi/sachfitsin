"""
Creating in-app notifications.

Like the email service, ``create_notification`` never raises. A notification
is a side effect of a business operation, never a reason to fail one.
"""

import logging

from django.db import IntegrityError, transaction

from notifications.models import Category, Notification

logger = logging.getLogger("notifications")


def create_notification(
    *,
    user,
    title: str,
    body: str = "",
    category: str = Category.GENERAL,
    link: str = "",
    dedupe_key: str = "",
) -> Notification | None:
    """
    Create one notification for a user.

    Returns the row, or ``None`` when it was a duplicate or something went
    wrong. Duplicates are decided by the unique constraint on
    ``(user, dedupe_key)``, so two parallel requests cannot both win.
    """

    if user is None:
        logger.warning("Skipping notification '%s': no user.", title)
        return None

    try:
        with transaction.atomic():
            return Notification.objects.create(
                user=user,
                title=title,
                body=body,
                category=category,
                link=link,
                dedupe_key=dedupe_key,
            )
    except IntegrityError:
        logger.info(
            "Skipping duplicate notification for %s (key=%s).",
            user,
            dedupe_key,
        )
        return None
    except Exception:
        logger.exception(
            "Could not create notification '%s' for %s.", title, user
        )
        return None


def unread_count(user) -> int:
    return Notification.objects.filter(user=user, is_read=False).count()


def mark_all_read(user) -> int:
    """Mark every unread notification read. Returns how many changed."""

    from django.utils import timezone

    return Notification.objects.filter(
        user=user,
        is_read=False,
    ).update(
        is_read=True,
        read_at=timezone.now(),
    )
