"""
Which plans unlock which features.

A plan is something a customer buys. A feature is something the app lets
them do. They are not the same thing: one purchase can unlock several
features, and several plans can unlock the same feature.

Keeping the two apart means the pricing can change without touching the
permission code. Adding a plan is a row in the database plus one line in
``FEATURE_PLANS``; it never needs a new gate.

This is the only place the mapping is written down. The products API
reads it too, so the front end never has to keep its own copy.
"""


class Feature:
    """What a customer can reach, as opposed to what they bought."""

    PERSONALIZED_VIDEOS = "PERSONALIZED_VIDEOS"
    EXERCISE_ROUTINES = "EXERCISE_ROUTINES"


class PlanCode:
    """The products on sale. These are stored on rows, so never rename."""

    LIFESTYLE_DIET_PLAN = "LIFESTYLE_DIET_PLAN"

    # Kept under its original code even though the package is now called
    # "Personalized Nutrition Coaching - 1 Month". Entitlements and
    # payments point at the code, so renaming it would orphan them.
    NUTRITION_COACHING_1M = "PERSONALIZED_NUTRITION_COACHING"
    NUTRITION_COACHING_3M = "NUTRITION_COACHING_3M"

    NUTRITION_TRAINING_1M = "NUTRITION_TRAINING_1M"
    NUTRITION_TRAINING_3M = "NUTRITION_TRAINING_3M"

    # Retired, and not sold any more. It stays in the map below so that
    # anyone who already bought it keeps the access they paid for.
    LEGACY_EXERCISE_RECOMMENDATIONS = "EXERCISE_RECOMMENDATIONS"


FEATURE_PLANS = {
    # Coaching and training both include personal guidance through videos.
    Feature.PERSONALIZED_VIDEOS: (
        PlanCode.NUTRITION_COACHING_1M,
        PlanCode.NUTRITION_COACHING_3M,
        PlanCode.NUTRITION_TRAINING_1M,
        PlanCode.NUTRITION_TRAINING_3M,
    ),
    # Only the training packages include structured exercise routines.
    Feature.EXERCISE_ROUTINES: (
        PlanCode.NUTRITION_TRAINING_1M,
        PlanCode.NUTRITION_TRAINING_3M,
        PlanCode.LEGACY_EXERCISE_RECOMMENDATIONS,
    ),
}


def plans_for_feature(feature: str) -> tuple:
    """The plan codes that unlock one feature, or an empty tuple."""

    return FEATURE_PLANS.get(feature, ())


def features_for_plan(plan_code: str) -> list:
    """Everything one plan unlocks. Used to describe a plan to a customer."""

    return [
        feature
        for feature, codes in FEATURE_PLANS.items()
        if plan_code in codes
    ]
