"""
Mark entitlements and subscriptions expired once their date has passed.

This changes nothing about who can use what. ``has_entitlement`` already
checks ``expires_at`` on every request, so access stops on the right day
whether or not this ever runs.

What it fixes is the record: without it, a long-lapsed entitlement still
reads ACTIVE in the admin, and anyone looking at the data would reasonably
conclude the customer still has access.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from subscriptions.models import Entitlement, Subscription


class Command(BaseCommand):
    help = (
        "Mark entitlements and subscriptions as expired once their "
        "expiry date has passed."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would change without writing anything.",
        )

    def handle(self, *args, **options):
        now = timezone.now()
        dry_run = options["dry_run"]

        # Rows that have run out but still say ACTIVE. A NULL expiry means
        # lifetime access and is never touched.
        entitlements = Entitlement.objects.filter(
            status=Entitlement.Status.ACTIVE,
            expires_at__isnull=False,
            expires_at__lte=now,
        )

        subscriptions = Subscription.objects.filter(
            status=Subscription.Status.ACTIVE,
            ends_at__isnull=False,
            ends_at__lte=now,
        )

        if dry_run:
            self.stdout.write(
                f"Would expire {entitlements.count()} entitlement(s) "
                f"and {subscriptions.count()} subscription(s)."
            )

            for entitlement in entitlements.select_related(
                "customer", "product"
            )[:20]:
                self.stdout.write(
                    f"  {entitlement.customer.username} - "
                    f"{entitlement.product.code} "
                    f"(expired {entitlement.expires_at:%d %b %Y})"
                )

            return

        entitlement_count = entitlements.update(
            status=Entitlement.Status.EXPIRED,
        )

        subscription_count = subscriptions.update(
            status=Subscription.Status.EXPIRED,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Expired {entitlement_count} entitlement(s) "
                f"and {subscription_count} subscription(s)."
            )
        )
