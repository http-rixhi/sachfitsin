from django.conf import settings
from django.db import models


class CalorieProfile(models.Model):
    customer = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="calorie_profile",
        limit_choices_to={"role": "CUSTOMER"},
    )

    daily_calorie_target = models.PositiveIntegerField(
        default=2000,
    )

    protein_target_g = models.PositiveIntegerField(
        default=0,
    )

    carbs_target_g = models.PositiveIntegerField(
        default=0,
    )

    fat_target_g = models.PositiveIntegerField(
        default=0,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return f"{self.customer.username} - calorie profile"


class CalorieEntry(models.Model):
    class MealType(models.TextChoices):
        BREAKFAST = "BREAKFAST", "Breakfast"
        LUNCH = "LUNCH", "Lunch"
        DINNER = "DINNER", "Dinner"
        SNACK = "SNACK", "Snack"

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="calorie_entries",
        limit_choices_to={"role": "CUSTOMER"},
    )

    date = models.DateField()

    meal_type = models.CharField(
        max_length=20,
        choices=MealType.choices,
        default=MealType.BREAKFAST,
    )

    food_name = models.CharField(
        max_length=200,
    )

    quantity = models.CharField(
        max_length=100,
        blank=True,
    )

    calories = models.PositiveIntegerField(
        default=0,
    )

    protein_g = models.PositiveIntegerField(
        default=0,
    )

    carbs_g = models.PositiveIntegerField(
        default=0,
    )

    fat_g = models.PositiveIntegerField(
        default=0,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-date", "created_at"]

    def __str__(self):
        return (
            f"{self.customer.username} - "
            f"{self.food_name} ({self.date})"
        )


class WaterProfile(models.Model):
    customer = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="water_profile",
        limit_choices_to={"role": "CUSTOMER"},
    )
    daily_water_target_ml = models.PositiveIntegerField(
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.customer.username} - Water Profile"


class WaterEntry(models.Model):
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="water_entries",
        limit_choices_to={"role": "CUSTOMER"},
    )
    date = models.DateField()
    amount_ml = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        indexes = [
            models.Index(fields=["customer", "date"]),
        ]

    def __str__(self):
        return (
            f"{self.customer.username} - "
            f"{self.amount_ml}ml - {self.date}"
        )