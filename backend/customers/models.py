from django.conf import settings
from django.db import models


class CustomerProfile(models.Model):
    class ActivityLevel(models.TextChoices):
        SEDENTARY = "SEDENTARY", "Sedentary"
        LIGHT = "LIGHT", "Lightly Active"
        MODERATE = "MODERATE", "Moderately Active"
        VERY_ACTIVE = "VERY_ACTIVE", "Very Active"
        ATHLETE = "ATHLETE", "Athlete"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="customer_profile",
    )

    phone_number = models.CharField(
        max_length=20,
        blank=True,
    )

    profession = models.CharField(
        max_length=100,
        blank=True,
    )

    current_diet = models.TextField(
        blank=True,
    )

    dietary_preference = models.CharField(
        max_length=100,
        blank=True,
    )

    allergies = models.TextField(
        blank=True,
    )

    food_dislikes = models.TextField(
        blank=True,
    )

    height_cm = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )

    current_weight_kg = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )

    target_weight_kg = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )

    activity_level = models.CharField(
        max_length=20,
        choices=ActivityLevel.choices,
        blank=True,
    )

    goals = models.TextField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return f"Profile - {self.user.username}"