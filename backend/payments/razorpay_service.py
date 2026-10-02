import logging

import razorpay
from django.conf import settings
from razorpay.errors import SignatureVerificationError

logger = logging.getLogger("payments")


def get_razorpay_client():
    return razorpay.Client(
        auth=(
            settings.RAZORPAY_KEY_ID,
            settings.RAZORPAY_KEY_SECRET,
        )
    )


def verify_payment_signature(
    *,
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
) -> bool:
    """
    Check that Razorpay really issued this payment for this order.

    The signature is HMAC-SHA256 of "<order_id>|<payment_id>" keyed with
    the secret, which only our server and Razorpay know. A browser cannot
    produce one, which is the whole point: the success callback in React
    can be faked, this cannot.

    Returns True or False. The SDK raises on a mismatch; that is turned
    into False here so callers deal with one thing.
    """

    client = get_razorpay_client()

    try:
        client.utility.verify_payment_signature(
            {
                "razorpay_order_id": razorpay_order_id,
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_signature": razorpay_signature,
            }
        )
    except SignatureVerificationError:
        logger.warning(
            "Razorpay signature did not match for order %s.",
            razorpay_order_id,
        )

        return False
    except Exception:
        # A bad key, a library change, anything unexpected. Treat it as
        # "not verified" rather than letting it read as success.
        logger.exception(
            "Could not check the Razorpay signature for order %s.",
            razorpay_order_id,
        )

        return False

    return True
