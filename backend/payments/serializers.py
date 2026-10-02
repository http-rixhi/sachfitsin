from rest_framework import serializers

from products.models import Product

from .models import Payment


class CreatePaymentOrderSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()

    def validate_product_id(self, value):
        try:
            product = Product.objects.get(
                id=value,
                status=Product.Status.ACTIVE,
            )
        except Product.DoesNotExist:
            raise serializers.ValidationError(
                "Product not found or is inactive."
            )

        if product.billing_type == Product.BillingType.FREE:
            raise serializers.ValidationError(
                "Free products do not require payment."
            )

        self.product = product

        return value

class VerifyPaymentSerializer(serializers.Serializer):
    """
    The three values Razorpay Checkout hands back to the browser.

    This only checks they are present and the right shape. It proves
    nothing on its own — the signature still has to be recomputed on the
    server with the secret key before the payment can be trusted.
    """

    razorpay_order_id = serializers.CharField(max_length=100)
    razorpay_payment_id = serializers.CharField(max_length=100)
    razorpay_signature = serializers.CharField(max_length=255)


class PaymentSerializer(serializers.ModelSerializer):
    """
    A payment as the customer sees it in their history.

    Read-only throughout. razorpay_signature is deliberately left out:
    it proves nothing to the customer and there is no reason to hand it
    back out.
    """

    product_name = serializers.CharField(
        source="product.name",
        read_only=True,
    )

    class Meta:
        model = Payment
        fields = [
            "id",
            "product",
            "product_name",
            "amount",
            "currency",
            "status",
            "razorpay_order_id",
            "razorpay_payment_id",
            "failure_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
