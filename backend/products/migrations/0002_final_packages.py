"""
The five packages that are actually on sale.

Written as a migration rather than a one off script so that every
environment ends up with the same catalogue, and so a fresh database is
ready to sell from the moment it is created.

Prices and wording come from the owner's package sheet. Codes are never
reused or renamed: entitlements and payment records point at them, so a
rename would orphan what somebody already bought.
"""

from django.db import migrations


PACKAGES = [
    {
        "code": "LIFESTYLE_DIET_PLAN",
        "name": "Lifestyle Diet Plan",
        "description": (
            "A diet plan customised to your lifestyle, dietary "
            "preferences, and fitness or health goals."
        ),
        "billing_type": "ONE_TIME",
        "price": "499.00",
        "duration_days": None,
    },
    {
        # Kept under its original code. The package was renamed, the code
        # was not, because entitlements already point at it.
        "code": "PERSONALIZED_NUTRITION_COACHING",
        "name": "Personalized Nutrition Coaching, 1 Month",
        "description": (
            "A personalised diet plan with daily personal assistance, "
            "guidance, and progress support. Includes personalised videos."
        ),
        "billing_type": "MONTHLY",
        "price": "2499.00",
        "duration_days": 30,
    },
    {
        "code": "NUTRITION_COACHING_3M",
        "name": "Personalized Nutrition Coaching, 3 Months",
        "description": (
            "A personalised diet plan with ongoing personal assistance, "
            "regular guidance, and progress monitoring. Includes "
            "personalised videos."
        ),
        "billing_type": "MONTHLY",
        "price": "3999.00",
        "duration_days": 90,
    },
    {
        "code": "NUTRITION_TRAINING_1M",
        "name": "Nutrition and Personal Training, 1 Month",
        "description": (
            "A personalised diet plan with daily personal training, "
            "personal assistance, and progress guidance. Includes "
            "personalised videos and exercise routines."
        ),
        "billing_type": "MONTHLY",
        "price": "3999.00",
        "duration_days": 30,
    },
    {
        "code": "NUTRITION_TRAINING_3M",
        "name": "Nutrition and Personal Training, 3 Months",
        "description": (
            "A personalised diet plan with daily personal training, "
            "continuous personal assistance, and structured progress "
            "monitoring. Includes personalised videos and exercise "
            "routines."
        ),
        "billing_type": "MONTHLY",
        "price": "6999.00",
        "duration_days": 90,
    },
]

# Sold before the packages were finalised. Hidden rather than deleted:
# payments and entitlements reference it, and anyone who bought it keeps
# their access through subscriptions.features.
RETIRED_CODES = ["EXERCISE_RECOMMENDATIONS"]


def apply_catalogue(apps, schema_editor):
    Product = apps.get_model("products", "Product")

    for package in PACKAGES:
        Product.objects.update_or_create(
            code=package["code"],
            defaults={**package, "status": "ACTIVE"},
        )

    Product.objects.filter(code__in=RETIRED_CODES).update(
        status="INACTIVE"
    )


def undo(apps, schema_editor):
    """
    Put the retired plan back on sale and hide the new packages.

    The rows themselves are left alone. Deleting a product would take its
    payment history with it, which is never the right trade.
    """

    Product = apps.get_model("products", "Product")

    Product.objects.filter(code__in=RETIRED_CODES).update(status="ACTIVE")

    new_codes = [
        p["code"]
        for p in PACKAGES
        if p["code"] != "PERSONALIZED_NUTRITION_COACHING"
        and p["code"] != "LIFESTYLE_DIET_PLAN"
    ]

    Product.objects.filter(code__in=new_codes).update(status="INACTIVE")


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(apply_catalogue, undo),
    ]
