"""
Handling Razorpay webhooks.

Why this exists at all: /payments/verify/ only runs if the customer's
browser is still there. Close the tab, lose signal, or have the phone die
between paying and the redirect, and the money is taken while the account
stays locked. The webhook is Razorpay talking to us directly, so it
arrives whatever the browser did.

The two paths end in the same place on purpose — both call
``fulfill_payment`` — so a customer gets exactly the same access however
their payment was confirmed.
"""

import logging

from django.conf import settings
from django.db import transaction
from razorpay.errors import SignatureVerificationError

from .fulfillment import fulfill_payment
from .models import Payment
from .razorpay_service import get_razorpay_client

logger = logging.getLogger("payments.webhooks")


# Razorpay sends many event types. Only these change anything here;
# everything else is acknowledged and ignored so it is not retried.
EVENT_CAPTURED = "payment.captured"
EVENT_FAILED = "payment.failed"

HANDLED_EVENTS = {EVENT_CAPTURED, EVENT_FAILED}


class WebhookResult:
    """What happened, so the view can pick a status code."""

    def __init__(self, status: str, detail: str = ""):
        self.status = status
        self.detail = detail

    def __repr__(self):  # pragma: no cover - debugging aid
        return f"<WebhookResult {self.status}: {self.detail}>"


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    """
    Check the signature over the RAW request body.

    It must be the exact bytes Razorpay sent. Parsing the JSON and
    re-serialising it changes whitespace and key order, and the signature
    would never match again — a bug that looks like "the webhook randomly
    stopped working".
    """

    secret = settings.RAZORPAY_WEBHOOK_SECRET

    if not secret:
        logger.error(
            "RAZORPAY_WEBHOOK_SECRET is not set. Rejecting the webhook."
        )

        return False

    if not signature:
        return False

    try:
        get_razorpay_client().utility.verify_webhook_signature(
            raw_body.decode("utf-8"),
            signature,
            secret,
        )
    except SignatureVerificationError:
        logger.warning("Razorpay webhook signature did not match.")

        return False
    except Exception:
        logger.exception("Could not check the webhook signature.")

        return False

    return True


def _payment_entity(payload: dict) -> dict:
    return (
        payload.get("payload", {})
        .get("payment", {})
        .get("entity", {})
    ) or {}


def handle_event(payload: dict) -> WebhookResult:
    """
    Act on one webhook payload. Assumes the signature already checked out.

    Returns a WebhookResult rather than raising, so the view decides what
    Razorpay should be told.
    """

    event = payload.get("event", "")

    if event not in HANDLED_EVENTS:
        logger.info("Ignoring Razorpay webhook event '%s'.", event)

        return WebhookResult("ignored", f"Event '{event}' is not handled.")

    entity = _payment_entity(payload)

    order_id = entity.get("order_id")
    payment_id = entity.get("id")

    if not order_id:
        logger.warning("Webhook '%s' had no order_id.", event)

        return WebhookResult("ignored", "No order id in the payload.")

    if event == EVENT_CAPTURED:
        return _handle_captured(order_id, payment_id, entity)

    return _handle_failed(order_id, payment_id, entity)


@transaction.atomic
def _handle_captured(order_id, payment_id, entity) -> WebhookResult:
    payment = _lock_payment(order_id)

    if payment is None:
        # Retrying is the safer choice: this is more likely our database
        # lagging than an order that was never ours.
        return WebhookResult("not_found", f"No payment for {order_id}.")

    # Already done, by this webhook arriving twice or by the browser
    # having called /verify/ first. Both are normal.
    if payment.status == Payment.Status.SUCCESS:
        logger.info(
            "Payment %s is already successful; webhook ignored.",
            payment.pk,
        )

        return WebhookResult("already_done", "Already verified.")

    if payment.status == Payment.Status.REFUNDED:
        return WebhookResult("ignored", "Payment was refunded.")

    # Razorpay reports paise. A mismatch means this webhook is not about
    # the order we think it is, so nothing is granted.
    expected_paise = int(payment.amount * 100)
    captured_paise = entity.get("amount")

    if captured_paise is not None and captured_paise != expected_paise:
        logger.error(
            "Amount mismatch for order %s: expected %s, captured %s.",
            order_id,
            expected_paise,
            captured_paise,
        )

        payment.status = Payment.Status.FAILED
        payment.failure_reason = (
            f"Amount mismatch: expected {expected_paise}, "
            f"captured {captured_paise}."
        )
        payment.save(
            update_fields=["status", "failure_reason", "updated_at"]
        )

        return WebhookResult("mismatch", "Amount did not match.")

    # The same real payment must not settle two different orders.
    if payment_id and (
        Payment.objects
        .filter(razorpay_payment_id=payment_id)
        .exclude(pk=payment.pk)
        .exists()
    ):
        logger.error(
            "Webhook payment id %s already belongs to another order.",
            payment_id,
        )

        return WebhookResult("ignored", "Payment id already used.")

    payment.razorpay_payment_id = payment_id or payment.razorpay_payment_id
    payment.status = Payment.Status.SUCCESS
    payment.failure_reason = ""

    payment.save(
        update_fields=[
            "razorpay_payment_id",
            "status",
            "failure_reason",
            "updated_at",
        ]
    )

    # Same call the browser path makes, so access is identical either way.
    fulfill_payment(payment)

    logger.info(
        "Payment %s fulfilled from the webhook for user %s.",
        payment.pk,
        payment.customer_id,
    )

    return WebhookResult("fulfilled", "Access granted.")


@transaction.atomic
def _handle_failed(order_id, payment_id, entity) -> WebhookResult:
    payment = _lock_payment(order_id)

    if payment is None:
        return WebhookResult("not_found", f"No payment for {order_id}.")

    # A failure notice must never undo a payment that already succeeded.
    if payment.status == Payment.Status.SUCCESS:
        logger.warning(
            "Ignoring a failure webhook for payment %s, which is "
            "already successful.",
            payment.pk,
        )

        return WebhookResult("already_done", "Already successful.")

    payment.status = Payment.Status.FAILED
    payment.failure_reason = (
        entity.get("error_description")
        or entity.get("error_reason")
        or "Razorpay reported the payment as failed."
    )[:2000]

    payment.save(
        update_fields=["status", "failure_reason", "updated_at"]
    )

    logger.info(
        "Payment %s marked failed from the webhook: %s",
        payment.pk,
        payment.failure_reason,
    )

    return WebhookResult("failed", "Payment marked failed.")


def _lock_payment(order_id):
    return (
        Payment.objects
        .select_for_update()
        .filter(razorpay_order_id=order_id)
        .first()
    )
