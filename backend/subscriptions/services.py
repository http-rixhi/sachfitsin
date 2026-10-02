from django.db.models import Q
from django.utils import timezone

from products.models import Product

from .models import Entitlement


def has_entitlement(user, product_code):
    """
    Can this user use the feature behind ``product_code``?

    Two ways to qualify:

    1. The plan is free. A plan marked Free and on sale is available to
       every customer, with no Entitlement row needed. Without this,
       setting a plan to Free left it locked for everyone — it could not
       be bought (Razorpay refuses a zero-value order) and nothing granted
       it, so "Free" meant "nobody can have it".

    2. They have a live entitlement: ACTIVE, already started, and either
       no expiry or an expiry still in the future.
    """

    if not user.is_authenticated:
        return False

    now = timezone.now()

    is_free = Product.objects.filter(
        code=product_code,
        status=Product.Status.ACTIVE,
        billing_type=Product.BillingType.FREE,
    ).exists()

    if is_free:
        return True

    return Entitlement.objects.filter(
        customer=user,
        product__code=product_code,
        status=Entitlement.Status.ACTIVE,
        starts_at__lte=now,
    ).filter(
        Q(expires_at__isnull=True) | Q(expires_at__gt=now)
    ).exists()
