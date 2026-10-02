from django.conf import settings
from django.db import models
from django.utils import timezone


class Category(models.TextChoices):
    ACCOUNT = "ACCOUNT", "Account"
    APPOINTMENT = "APPOINTMENT", "Appointment"
    DIET_PLAN = "DIET_PLAN", "Diet Plan"
    VIDEO = "VIDEO", "Video"
    EXERCISE = "EXERCISE", "Exercise"
    CONTENT = "CONTENT", "Content"
    SUBSCRIPTION = "SUBSCRIPTION", "Subscription"
    GENERAL = "GENERAL", "General"


class Notification(models.Model):
    """
    An in-app message shown in the notification centre.

    ``dedupe_key`` is what stops the same notification being created twice
    for the same user. It is unique per user when it is not blank, so a
    repeated event is silently ignored instead of piling up.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.GENERAL,
    )

    title = models.CharField(
        max_length=200,
    )

    body = models.TextField(
        blank=True,
    )

    # Front-end path, e.g. "/dashboard/videos". Never an absolute URL, so the
    # same row works across environments.
    link = models.CharField(
        max_length=300,
        blank=True,
    )

    is_read = models.BooleanField(
        default=False,
    )

    read_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    dedupe_key = models.CharField(
        max_length=200,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["-created_at"]

        indexes = [
            models.Index(fields=["user", "is_read"]),
            models.Index(fields=["user", "-created_at"]),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["user", "dedupe_key"],
                condition=~models.Q(dedupe_key=""),
                name="unique_notification_dedupe_key_per_user",
            ),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.title}"

    def mark_read(self):
        if self.is_read:
            return

        self.is_read = True
        self.read_at = timezone.now()
        self.save(update_fields=["is_read", "read_at"])


class EmailStatus(models.TextChoices):
    SENT = "SENT", "Sent"
    FAILED = "FAILED", "Failed"
    SKIPPED = "SKIPPED", "Skipped"
    DUPLICATE = "DUPLICATE", "Duplicate"


class EmailLog(models.Model):
    """
    One row per attempted email.

    This is the audit trail for item 10 (failure handling) and the backing
    store for item 11 (duplicate prevention). It is written whether the send
    succeeds, fails, or is skipped because email is switched off.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="email_logs",
    )

    to_email = models.EmailField()

    subject = models.CharField(
        max_length=300,
    )

    template = models.CharField(
        max_length=100,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=EmailStatus.choices,
    )

    provider_message_id = models.CharField(
        max_length=200,
        blank=True,
    )

    error = models.TextField(
        blank=True,
    )

    dedupe_key = models.CharField(
        max_length=200,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["-created_at"]

        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["dedupe_key"]),
        ]

    def __str__(self):
        return f"{self.to_email} - {self.subject} ({self.status})"
