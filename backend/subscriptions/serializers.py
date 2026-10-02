from rest_framework import serializers

from .models import Entitlement, Subscription


class EntitlementSerializer(serializers.ModelSerializer):
    product_code = serializers.CharField(
        source="product.code",
        read_only=True,
    )

    product_name = serializers.CharField(
        source="product.name",
        read_only=True,
    )

    class Meta:
        model = Entitlement
        fields = [
            "id",
            "product_code",
            "product_name",
            "status",
            "starts_at",
            "expires_at",
            "source",
            "created_at",
            "updated_at",
        ]


class SubscriptionSerializer(serializers.ModelSerializer):
    product_code = serializers.CharField(
        source="product.code",
        read_only=True,
    )

    product_name = serializers.CharField(
        source="product.name",
        read_only=True,
    )

    class Meta:
        model = Subscription
        fields = [
            "id",
            "product_code",
            "product_name",
            "status",
            "starts_at",
            "ends_at",
            "external_reference",
            "created_at",
            "updated_at",
        ]



class DieticianEntitlementCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Entitlement
        fields = [
            "id",
            "customer",
            "product",
            "starts_at",
            "expires_at",
            "source",
        ]
        read_only_fields = ["id"]

    def validate_customer(self, value):
        if value.role != "CUSTOMER":
            raise serializers.ValidationError(
                "Entitlements can only be assigned to customers."
            )

        return value

    def validate_product(self, value):
        if value.status != value.Status.ACTIVE:
            raise serializers.ValidationError(
                "This product is currently inactive."
            )

        return value

class DieticianEntitlementSerializer(serializers.ModelSerializer):
    customer_username = serializers.CharField(
        source="customer.username",
        read_only=True,
    )

    customer_name = serializers.SerializerMethodField()

    product_code = serializers.CharField(
        source="product.code",
        read_only=True,
    )

    product_name = serializers.CharField(
        source="product.name",
        read_only=True,
    )

    class Meta:
        model = Entitlement
        fields = [
            "id",
            "customer",
            "customer_username",
            "customer_name",
            "product",
            "product_code",
            "product_name",
            "status",
            "starts_at",
            "expires_at",
            "source",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "customer_username",
            "customer_name",
            "product_code",
            "product_name",
            "created_at",
            "updated_at",
        ]

    def get_customer_name(self, obj):
        full_name = obj.customer.get_full_name()

        return full_name or obj.customer.username