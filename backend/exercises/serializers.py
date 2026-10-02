from rest_framework import serializers

from .models import Exercise, ExerciseRecommendation


class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = [
            "id",
            "name",
            "description",
            "category",
            "difficulty",
            "duration_minutes",
            "instructions",
            "precautions",
            "video_url",
            "image_url",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class ExerciseRecommendationSerializer(
    serializers.ModelSerializer
):
    exercise_name = serializers.CharField(
        source="exercise.name",
        read_only=True,
    )

    exercise_category = serializers.CharField(
        source="exercise.category",
        read_only=True,
    )

    exercise_difficulty = serializers.CharField(
        source="exercise.difficulty",
        read_only=True,
    )

    exercise_description = serializers.CharField(
        source="exercise.description",
        read_only=True,
    )

    exercise_instructions = serializers.CharField(
        source="exercise.instructions",
        read_only=True,
    )

    exercise_precautions = serializers.CharField(
        source="exercise.precautions",
        read_only=True,
    )

    exercise_video_url = serializers.URLField(
        source="exercise.video_url",
        read_only=True,
    )

    exercise_image_url = serializers.URLField(
        source="exercise.image_url",
        read_only=True,
    )

    customer_username = serializers.CharField(
        source="customer.username",
        read_only=True,
    )

    recommended_by_username = serializers.CharField(
        source="recommended_by.username",
        read_only=True,
    )

    class Meta:
        model = ExerciseRecommendation
        fields = [
            "id",
            "customer",
            "customer_username",
            "exercise",
            "exercise_name",
            "exercise_category",
            "exercise_difficulty",
            "exercise_description",
            "exercise_instructions",
            "exercise_precautions",
            "exercise_video_url",
            "exercise_image_url",
            "recommended_by",
            "recommended_by_username",
            "sets",
            "reps",
            "duration_minutes",
            "frequency",
            "notes",
            "status",
            "starts_at",
            "ends_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "customer_username",
            "exercise_name",
            "exercise_category",
            "exercise_difficulty",
            "exercise_description",
            "exercise_instructions",
            "exercise_precautions",
            "exercise_video_url",
            "exercise_image_url",
            "recommended_by",
            "recommended_by_username",
            "created_at",
            "updated_at",
        ]