from django.core.management.base import BaseCommand

from appointments.calendly import sync_calendly_appointments


class Command(BaseCommand):
    help = "Synchronize Calendly appointments with Sachfitsin appointments."

    def handle(self, *args, **options):
        try:
            count = sync_calendly_appointments()

            self.stdout.write(
                self.style.SUCCESS(
                    f"Calendly sync completed. {count} appointment(s) synchronized."
                )
            )

        except Exception as exc:
            self.stderr.write(
                self.style.ERROR(
                    f"Calendly sync failed: {exc}"
                )
            )