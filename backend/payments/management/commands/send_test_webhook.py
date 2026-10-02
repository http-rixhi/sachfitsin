"""
Send a correctly signed webhook to your own server.

Razorpay cannot reach localhost, so without this the webhook path cannot
be exercised until the app is deployed behind HTTPS. This signs a payload
with RAZORPAY_WEBHOOK_SECRET exactly the way Razorpay does, so it proves
the secret, the signature check and the fulfilment all work.

    python manage.py send_test_webhook order_XXXX
"""

import hashlib
import hmac
import json

import requests
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from payments.models import Payment


class Command(BaseCommand):
    help = "Send a signed Razorpay webhook to a running local server."

    def add_arguments(self, parser):
        parser.add_argument(
            "order_id",
            help="razorpay_order_id of an existing Payment.",
        )

        parser.add_argument(
            "--event",
            default="payment.captured",
            choices=["payment.captured", "payment.failed"],
        )

        parser.add_argument(
            "--url",
            default="http://127.0.0.1:8000/api/v1/payments/webhook/",
        )

        parser.add_argument(
            "--payment-id",
            default=None,
            help="Defaults to pay_test_<order id>.",
        )

    def handle(self, *args, **options):
        secret = settings.RAZORPAY_WEBHOOK_SECRET

        if not secret:
            raise CommandError(
                "RAZORPAY_WEBHOOK_SECRET is not set in .env, so the "
                "webhook will reject everything. Set it and restart the "
                "server first."
            )

        order_id = options["order_id"]

        try:
            payment = Payment.objects.get(razorpay_order_id=order_id)
        except Payment.DoesNotExist:
            raise CommandError(
                f"No Payment with razorpay_order_id={order_id}. "
                "Create an order through the app first."
            )

        payment_id = (
            options["payment_id"] or f"pay_test_{order_id[-8:]}"
        )

        body = json.dumps(
            {
                "event": options["event"],
                "payload": {
                    "payment": {
                        "entity": {
                            "id": payment_id,
                            "order_id": order_id,
                            # Razorpay reports paise, and the amount must
                            # match the order or the webhook rejects it.
                            "amount": int(payment.amount * 100),
                            "currency": payment.currency,
                            "status": (
                                "captured"
                                if options["event"] == "payment.captured"
                                else "failed"
                            ),
                            "error_description": (
                                "Test failure from send_test_webhook."
                            ),
                        }
                    }
                },
            }
        )

        signature = hmac.new(
            secret.encode(),
            body.encode(),
            hashlib.sha256,
        ).hexdigest()

        self.stdout.write(f"Event    : {options['event']}")
        self.stdout.write(f"Order    : {order_id}")
        self.stdout.write(f"Amount   : {int(payment.amount * 100)} paise")
        self.stdout.write(f"Status   : {payment.status} (before)")
        self.stdout.write("")

        try:
            response = requests.post(
                options["url"],
                data=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Razorpay-Signature": signature,
                },
                timeout=20,
            )
        except requests.RequestException as exc:
            raise CommandError(
                f"Could not reach {options['url']}: {exc}\n"
                "Is the development server running?"
            )

        self.stdout.write(f"HTTP {response.status_code}: {response.text}")

        payment.refresh_from_db()

        self.stdout.write("")

        if response.status_code == 200:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Payment is now {payment.status}."
                )
            )
        else:
            self.stdout.write(
                self.style.ERROR(
                    f"Payment is still {payment.status}."
                )
            )
