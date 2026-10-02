from django.db import models


class Product(models.Model):
    class BillingType(models.TextChoices):
        FREE = "FREE", "Free"
        ONE_TIME = "ONE_TIME", "One Time"
        MONTHLY = "MONTHLY", "Monthly"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"

    code = models.CharField(
        max_length=100,
        unique=True,
    )

    name = models.CharField(
        max_length=200,
    )

    description = models.TextField(
        blank=True,
    )

    billing_type = models.CharField(
        max_length=20,
        choices=BillingType.choices,
        default=BillingType.ONE_TIME,
    )

    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )

    duration_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Number of days the product remains active. Leave blank for lifetime access.",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return self.name