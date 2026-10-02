from django.conf import settings
from django.db import models

from products.models import Product


class Subscription(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        EXPIRED = "EXPIRED", "Expired"
        CANCELLED = "CANCELLED", "Cancelled"
        PENDING = "PENDING", "Pending"

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="subscriptions",
        limit_choices_to={"role": "CUSTOMER"},
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="subscriptions",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    starts_at = models.DateTimeField()

    ends_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    external_reference = models.CharField(
        max_length=255,
        blank=True,
        help_text="Payment provider reference, such as Razorpay subscription/payment ID.",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return f"{self.customer.username} - {self.product.name}"



class Entitlement(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        EXPIRED = "EXPIRED", "Expired"
        REVOKED = "REVOKED", "Revoked"

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="entitlements",
        limit_choices_to={"role": "CUSTOMER"},
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="entitlements",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )

    starts_at = models.DateTimeField()

    expires_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    source = models.CharField(
        max_length=50,
        default="MANUAL",
        help_text="Example: MANUAL, RAZORPAY, ADMIN.",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return f"{self.customer.username} - {self.product.code}"