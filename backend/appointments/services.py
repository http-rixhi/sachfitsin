"""
Actions on an appointment that reach outside our database.
"""

import logging

from api.exceptions import CalendlyUnavailable
from notifications import events

from .calendly import cancel_calendly_event
from .models import Appointment

logger = logging.getLogger("appointments")


def cancel_appointment(appointment, *, reason: str = "") -> Appointment:
    """
    Cancel an appointment here AND in Calendly.

    Marking it cancelled only in our database is not enough, and is in fact
    worse than doing nothing:

    - the slot stays blocked in the dietician's Calendly calendar
    - the customer keeps their Calendly invite and calendar entry
    - the next sync sees the event still active in Calendly and flips the
      status straight back to CONFIRMED

    So when Calendly holds the booking, Calendly is cancelled first. If that
    call fails, nothing is changed here either and the caller is told, which
    is the honest outcome: the session really is still booked.

    An appointment with no Calendly event (the customer never picked a slot)
    is cancelled locally, because there is nothing out there to cancel.
    """

    if appointment.status == Appointment.Status.CANCELLED:
        return appointment

    if appointment.calendly_event_uri:
        try:
            cancelled = cancel_calendly_event(
                appointment.calendly_event_uri,
                reason=reason,
            )
        except Exception as exc:
            logger.exception(
                "Could not reach Calendly to cancel appointment %s.",
                appointment.pk,
            )

            raise CalendlyUnavailable(
                "We could not reach Calendly, so the appointment is still "
                "booked. Nothing was changed. Please try again."
            ) from exc

        if not cancelled:
            raise CalendlyUnavailable(
                "Calendly refused to cancel this appointment, so it is "
                "still booked. Nothing was changed."
            )

    appointment.status = Appointment.Status.CANCELLED
    appointment.save(update_fields=["status", "updated_at"])

    events.appointment_cancelled(appointment)

    return appointment
