"""
Turning a verified payment into actual access.

Called only after a payment's signature has been checked. Everything here
assumes the money is real.
"""

import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from notifications import events
from products.models import Product
from subscriptions.models import Entitlement, Subscription

logger = logging.getLogger("payments")

SOURCE = "RAZORPAY"


def _expiry_for(product, start):
    """None means lifetime access."""

    if not product.duration_days:
        return None

    return start + timedelta(days=product.duration_days)


def grant_entitlement(payment, now=None):
    """
    Give the customer access to the product they paid for.

    Renewal is why this is not a plain get_or_create. Access is granted by
    ``subscriptions.services.has_entitlement``, which requires
    ``expires_at`` to be in the future — but an expired entitlement still
    has ``status=ACTIVE``. A get_or_create keyed on
    (customer, product, ACTIVE) would therefore find the expired row,
    change nothing, and the customer who just paid to renew would get
    nothing for their money.

    So an existing row is extended instead:

    - still valid  -> add the new period to the end of the current one,
                      so renewing early does not lose the remaining days
    - expired      -> start a fresh period from now
    - none yet     -> create it
    """

    now = now or timezone.now()

    customer = payment.customer
    product = payment.product

    existing = (
        Entitlement.objects
        .select_for_update()
        .filter(
            customer=customer,
            product=product,
            status=Entitlement.Status.ACTIVE,
        )
        .order_by("-expires_at")
        .first()
    )

    if existing is None:
        entitlement = Entitlement.objects.create(
            customer=customer,
            product=product,
            status=Entitlement.Status.ACTIVE,
            starts_at=now,
            expires_at=_expiry_for(product, now),
            source=SOURCE,
        )

        logger.info(
            "Entitlement %s created for user %s (%s).",
            entitlement.pk,
            customer.pk,
            product.code,
        )

        return entitlement, True

    # Lifetime access already. Nothing to extend.
    if existing.expires_at is None:
        logger.info(
            "User %s already has lifetime access to %s.",
            customer.pk,
            product.code,
        )

        return existing, False

    # Renewing before it runs out keeps the unused days.
    base = existing.expires_at if existing.expires_at > now else now

    existing.expires_at = _expiry_for(product, base)
    existing.source = SOURCE

    existing.save(update_fields=["expires_at", "source", "updated_at"])

    logger.info(
        "Entitlement %s extended to %s for user %s (%s).",
        existing.pk,
        existing.expires_at,
        customer.pk,
        product.code,
    )

    return existing, False


def record_subscription(payment, entitlement, now=None):
    """
    Keep a Subscription row for anything billed monthly.

    The Entitlement is what actually unlocks a feature. This is the
    billing record that sits beside it, so a renewal has somewhere to
    point and the Razorpay payment id is kept against it.
    """

    now = now or timezone.now()

    product = payment.product

    if product.billing_type != Product.BillingType.MONTHLY:
        return None

    subscription, created = Subscription.objects.get_or_create(
        customer=payment.customer,
        product=product,
        status=Subscription.Status.ACTIVE,
        defaults={
            "starts_at": now,
            "ends_at": entitlement.expires_at,
            "external_reference": payment.razorpay_payment_id or "",
        },
    )

    if not created:
        subscription.ends_at = entitlement.expires_at
        subscription.external_reference = (
            payment.razorpay_payment_id or subscription.external_reference
        )

        subscription.save(
            update_fields=[
                "ends_at",
                "external_reference",
                "updated_at",
            ]
        )

    return subscription


@transaction.atomic
def fulfill_payment(payment):
    """
    Grant everything a verified payment has bought.

    Returns (entitlement, subscription). ``subscription`` is None for
    one-time products.

    This raises on failure rather than swallowing it. It runs inside the
    verification transaction on purpose: if access cannot be granted, the
    payment must not be left marked SUCCESS with nothing to show for it.
    Both roll back together and the customer can retry.
    """

    now = timezone.now()

    entitlement, created = grant_entitlement(payment, now=now)

    subscription = record_subscription(payment, entitlement, now=now)

    # Sent after the transaction commits, so no email goes out for a
    # payment that ended up rolled back, and no network call is made while
    # the payment row is still locked.
    if created:
        transaction.on_commit(
            lambda: events.entitlement_activated(entitlement)
        )

    return entitlement, subscription
