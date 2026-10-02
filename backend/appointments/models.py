import uuid

from django.conf import settings
from django.db import models


class Appointment(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CONFIRMED = "CONFIRMED", "Confirmed"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="appointments",
        limit_choices_to={"role": "CUSTOMER"},
    )

    booking_reference = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
    )

    scheduled_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    duration_minutes = models.PositiveIntegerField(
        default=30,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    # Intake information
    reason = models.TextField(
        blank=True,
    )

    notes = models.TextField(
        blank=True,
    )

    # Calendly information
    calendly_event_uri = models.URLField(
        blank=True,
    )

    calendly_invitee_uri = models.URLField(
        blank=True,
    )

    calendly_scheduling_url = models.URLField(
        blank=True,
    )

    meeting_url = models.URLField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return f"{self.customer.username} - {self.status}"