from rest_framework import serializers

from .models import (
    CalorieProfile,
    CalorieEntry,
    WaterProfile,
    WaterEntry,
)


class CalorieProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalorieProfile
        fields = [
            "id",
            "daily_calorie_target",
            "protein_target_g",
            "carbs_target_g",
            "fat_target_g",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class CalorieEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = CalorieEntry
        fields = [
            "id",
            "date",
            "meal_type",
            "food_name",
            "quantity",
            "calories",
            "protein_g",
            "carbs_g",
            "fat_g",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        if attrs.get("calories", 0) < 0:
            raise serializers.ValidationError({
                "calories": "Calories cannot be negative."
            })

        return attrs


class DieticianCalorieProfileSerializer(serializers.ModelSerializer):
    customer_username = serializers.CharField(
        source="customer.username",
        read_only=True,
    )

    class Meta:
        model = CalorieProfile
        fields = [
            "id",
            "customer",
            "customer_username",
            "daily_calorie_target",
            "protein_target_g",
            "carbs_target_g",
            "fat_target_g",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class DieticianCalorieEntrySerializer(serializers.ModelSerializer):
    customer_username = serializers.CharField(
        source="customer.username",
        read_only=True,
    )

    class Meta:
        model = CalorieEntry
        fields = [
            "id",
            "customer",
            "customer_username",
            "date",
            "meal_type",
            "food_name",
            "quantity",
            "calories",
            "protein_g",
            "carbs_g",
            "fat_g",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class WaterProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaterProfile
        fields = [
            "id",
            "daily_water_target_ml",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class WaterEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = WaterEntry
        fields = [
            "id",
            "date",
            "amount_ml",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]

    def validate_amount_ml(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Water amount must be greater than 0 ml."
            )

        return value


class DieticianWaterProfileSerializer(serializers.ModelSerializer):
    customer_username = serializers.CharField(
        source="customer.username",
        read_only=True,
    )

    class Meta:
        model = WaterProfile
        fields = [
            "id",
            "customer",
            "customer_username",
            "daily_water_target_ml",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class DieticianWaterEntrySerializer(serializers.ModelSerializer):
    customer_username = serializers.CharField(
        source="customer.username",
        read_only=True,
    )

    class Meta:
        model = WaterEntry
        fields = [
            "id",
            "customer",
            "customer_username",
            "date",
            "amount_ml",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
