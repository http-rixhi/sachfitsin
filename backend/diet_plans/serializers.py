from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import DietPlan

User = get_user_model()


class DietPlanSerializer(serializers.ModelSerializer):
    customer_username = serializers.CharField(
        source="customer.username",
        read_only=True,
    )
    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True,
    )

    class Meta:
        model = DietPlan
        fields = [
            "id",
            "customer",
            "customer_username",
            "created_by",
            "created_by_username",
            "title",
            "description",
            "start_date",
            "end_date",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "customer_username",
            "created_by_username",
            "created_at",
            "updated_at",
        ]

    def validate_customer(self, value):
        if value.role != User.Role.CUSTOMER:
            raise serializers.ValidationError(
                "Selected user must be a customer."
            )

        return value