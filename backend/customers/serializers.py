from rest_framework import serializers
from accounts.models import User
from .models import CustomerProfile


class CustomerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerProfile
        fields = [
            "id",
            "phone_number",
            "profession",
            "current_diet",
            "dietary_preference",
            "allergies",
            "food_dislikes",
            "height_cm",
            "current_weight_kg",
            "target_weight_kg",
            "activity_level",
            "goals",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class DieticianCustomerListSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "created_at",
        ]


class DieticianCustomerDetailSerializer(serializers.ModelSerializer):
    profile = CustomerProfileSerializer(
        source="customer_profile",
        read_only=True,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "created_at",
            "profile",
        ]