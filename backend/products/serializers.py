from rest_framework import serializers

from subscriptions.features import features_for_plan

from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    """
    What a customer is allowed to see about a product.

    Read-only everywhere: products are created in the Django admin, never
    through the API, so there is no write path to get wrong.
    """

    features = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "code",
            "name",
            "description",
            "billing_type",
            "price",
            "duration_days",
            "features",
        ]
        read_only_fields = fields

    def get_features(self, product):
        """
        What this plan unlocks in the app.

        Sent so the front end never needs its own copy of the plan to
        feature mapping, which would drift the moment pricing changed.
        """

        return features_for_plan(product.code)


class AdminProductSerializer(serializers.ModelSerializer):
    """
    A plan as the dietician manages it.

    ``code`` is what the rest of the system keys off — the entitlement
    checks and the front end both look products up by code — so it can be
    set when creating a plan but never changed afterwards. Renaming a code
    on a live plan would silently cut off every customer who bought it.
    """

    customer_count = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "code",
            "name",
            "description",
            "billing_type",
            "price",
            "duration_days",
            "status",
            "customer_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "customer_count",
            "created_at",
            "updated_at",
        ]

    def get_customer_count(self, product):
        """How many customers currently have access to this plan."""

        from django.db.models import Q
        from django.utils import timezone

        from subscriptions.models import Entitlement

        now = timezone.now()

        return (
            Entitlement.objects
            .filter(
                product=product,
                status=Entitlement.Status.ACTIVE,
                starts_at__lte=now,
            )
            .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
            .count()
        )

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError(
                "Price cannot be negative."
            )

        return value

    def validate_code(self, value):
        return value.strip().upper().replace(" ", "_").replace("-", "_")

    def validate(self, attrs):
        billing_type = attrs.get(
            "billing_type",
            getattr(self.instance, "billing_type", None),
        )

        price = attrs.get("price", getattr(self.instance, "price", 0))

        duration = attrs.get(
            "duration_days",
            getattr(self.instance, "duration_days", None),
        )

        # A paid plan with no price cannot be bought: the order would be
        # for zero rupees and Razorpay rejects it.
        if billing_type != Product.BillingType.FREE and price <= 0:
            raise serializers.ValidationError(
                {
                    "price": [
                        "A paid plan needs a price above zero. Set the "
                        "billing type to Free instead if it is free."
                    ]
                }
            )

        if billing_type == Product.BillingType.MONTHLY and not duration:
            raise serializers.ValidationError(
                {
                    "duration_days": [
                        "A monthly plan needs a length in days, "
                        "otherwise access would never expire."
                    ]
                }
            )

        return attrs

    def update(self, instance, validated_data):
        # Changing the code of a live plan would break every entitlement
        # already granted against it.
        validated_data.pop("code", None)

        return super().update(instance, validated_data)
