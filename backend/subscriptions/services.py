from django.db.models import Q
from django.utils import timezone

from products.models import Product

from .features import plans_for_feature
from .models import Entitlement


def _live_entitlement_codes(user, product_codes):
    """Which of these plans the user currently holds."""

    now = timezone.now()

    return set(
        Entitlement.objects.filter(
            customer=user,
            product__code__in=product_codes,
            status=Entitlement.Status.ACTIVE,
            starts_at__lte=now,
        )
        .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        .values_list("product__code", flat=True)
    )


def _any_free(product_codes):
    """Is any of these plans on sale and free to everyone?"""

    return Product.objects.filter(
        code__in=product_codes,
        status=Product.Status.ACTIVE,
        billing_type=Product.BillingType.FREE,
    ).exists()


def has_entitlement(user, product_code):
    """
    Does this user hold one specific plan?

    Two ways to qualify:

    1. The plan is free. A plan marked Free and on sale is available to
       every customer, with no Entitlement row needed. Without this,
       setting a plan to Free left it locked for everyone: it could not
       be bought (Razorpay refuses a zero-value order) and nothing granted
       it, so "Free" meant "nobody can have it".

    2. They have a live entitlement: ACTIVE, already started, and either
       no expiry or an expiry still in the future.

    For gating a feature, prefer ``has_feature``. Several plans can unlock
    the same feature, and this function only ever looks at one of them.
    """

    if not user.is_authenticated:
        return False

    if _any_free([product_code]):
        return True

    return bool(_live_entitlement_codes(user, [product_code]))


def has_feature(user, feature):
    """
    Can this user use ``feature``, through any plan that includes it?

    This is what permission classes should ask. A customer on the three
    month training package and a customer on the one month package both
    get exercise routines, and neither gate needs to know that.
    """

    if not user.is_authenticated:
        return False

    codes = plans_for_feature(feature)

    if not codes:
        return False

    if _any_free(codes):
        return True

    return bool(_live_entitlement_codes(user, codes))
