import logging
from datetime import datetime, timedelta, timezone

import requests
from decouple import config
from django.utils.dateparse import parse_datetime

from appointments.models import Appointment
from notifications import events

logger = logging.getLogger("appointments.calendly")

# Overridable so the cancellation path can be exercised against a stub.
CALENDLY_API_BASE_URL = config(
    "CALENDLY_API_BASE_URL",
    default="https://api.calendly.com",
)


def calendly_headers():
    token = config("CALENDLY_ACCESS_TOKEN")

    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def get_calendly_current_user():
    response = requests.get(
        f"{CALENDLY_API_BASE_URL}/users/me",
        headers=calendly_headers(),
        timeout=15,
    )

    response.raise_for_status()

    return response.json()


def get_scheduled_events(
    user_uri: str,
    invitee_email: str | None = None,
    status: str = "active",
):
    now = datetime.now(timezone.utc)

    min_time = now - timedelta(days=7)
    max_time = now + timedelta(days=60)

    params = {
        "user": user_uri,
        "status": status,
        "min_start_time": min_time.isoformat(),
        "max_start_time": max_time.isoformat(),
        "sort": "start_time:asc",
        "count": 100,
    }

    if invitee_email:
        params["invitee_email"] = invitee_email

    response = requests.get(
        f"{CALENDLY_API_BASE_URL}/scheduled_events",
        headers=calendly_headers(),
        params=params,
        timeout=15,
    )

    response.raise_for_status()

    return response.json()


def get_scheduled_event(event_uri: str):
    """Fetch one scheduled event by its API URI."""

    event_uuid = event_uri.rstrip("/").split("/")[-1]

    response = requests.get(
        f"{CALENDLY_API_BASE_URL}/scheduled_events/{event_uuid}",
        headers=calendly_headers(),
        timeout=15,
    )

    response.raise_for_status()

    return response.json().get("resource", {})


def get_event_invitees(event_uri: str):
    event_uuid = event_uri.rstrip("/").split("/")[-1]

    response = requests.get(
        f"{CALENDLY_API_BASE_URL}/scheduled_events/{event_uuid}/invitees",
        headers=calendly_headers(),
        params={
            "status": "active",
            "count": 100,
        },
        timeout=15,
    )

    response.raise_for_status()

    return response.json()



def cancel_calendly_event(event_uri: str, reason: str = "") -> bool:
    """
    Cancel a scheduled event in Calendly itself.

    Returns True when Calendly now considers the event cancelled.

    A 404 means the event is already gone, and Calendly answers 400 when it
    is already cancelled. Both mean "it is not booked any more", which is
    what the caller wanted, so both count as success — otherwise a second
    click on Cancel would report a failure that is not one.
    """

    event_uuid = event_uri.rstrip("/").split("/")[-1]

    response = requests.post(
        f"{CALENDLY_API_BASE_URL}/scheduled_events/{event_uuid}/cancellation",
        headers=calendly_headers(),
        json={"reason": reason or "Cancelled by your dietician."},
        timeout=15,
    )

    if response.status_code in (200, 201):
        return True

    if response.status_code == 404:
        logger.info(
            "Calendly event %s was already gone; treating as cancelled.",
            event_uri,
        )
        return True

    if response.status_code == 400 and "already" in response.text.lower():
        logger.info(
            "Calendly event %s was already cancelled.", event_uri
        )
        return True

    logger.error(
        "Calendly refused to cancel %s: %s %s",
        event_uri,
        response.status_code,
        response.text[:300],
    )

    return False


def read_event_fields(event: dict) -> dict:
    """
    Pull the bits we store out of a Calendly scheduled event.

    Calendly sends ``location`` as an object whose shape depends on the
    meeting type, and the join URL is not always called the same thing, so
    each candidate is tried in turn.
    """

    start_time = event.get("start_time")
    end_time = event.get("end_time")

    scheduled_at = parse_datetime(start_time) if start_time else None

    duration = None

    if start_time and end_time:
        start = parse_datetime(start_time)
        end = parse_datetime(end_time)

        if start and end:
            duration = max(1, int((end - start).total_seconds() // 60))

    location = event.get("location") or {}

    meeting_url = ""

    if isinstance(location, dict):
        for key in ("join_url", "location"):
            value = location.get(key)

            if isinstance(value, str) and value.startswith("http"):
                meeting_url = value
                break

    return {
        "scheduled_at": scheduled_at,
        "duration_minutes": duration,
        "meeting_url": meeting_url,
        "event_uri": event.get("uri", ""),
        "event_status": event.get("status"),
    }


def apply_calendly_event(
    appointment,
    *,
    event: dict,
    invitee: dict | None = None,
) -> bool:
    """
    Write a Calendly event onto an appointment and notify if it changed.

    This is the single place that turns Calendly data into our fields. The
    webhook, the polling sync and the browser confirmation all go through
    it, so none of them can drift from the others again — the webhook used
    to set the status but silently drop the time, which is why a booked
    appointment still read "Time not picked yet".

    Returns True when something was written.
    """

    invitee = invitee or {}

    fields = read_event_fields(event)

    previous_status = appointment.status
    previous_scheduled_at = appointment.scheduled_at

    cancelled = (
        invitee.get("status") == "canceled"
        or fields["event_status"] == "canceled"
    )

    if cancelled:
        appointment.status = Appointment.Status.CANCELLED
    elif appointment.status != Appointment.Status.COMPLETED:
        appointment.status = Appointment.Status.CONFIRMED

        # Only overwrite with real values. A partial payload must never
        # wipe a time we already had.
        if fields["scheduled_at"]:
            appointment.scheduled_at = fields["scheduled_at"]

        if fields["duration_minutes"]:
            appointment.duration_minutes = fields["duration_minutes"]

        if fields["meeting_url"]:
            appointment.meeting_url = fields["meeting_url"]

    if fields["event_uri"]:
        appointment.calendly_event_uri = fields["event_uri"]

    if invitee.get("uri"):
        appointment.calendly_invitee_uri = invitee["uri"]

    appointment.save()

    notify_appointment_change(
        appointment,
        previous_status=previous_status,
        previous_scheduled_at=previous_scheduled_at,
    )

    return True


def resolve_event(scheduled_event) -> dict:
    """
    Normalise whatever Calendly handed us into a full event object.

    A webhook sends ``scheduled_event`` as a nested object. Other places
    give only its URI. Either way we want the object, so a bare URI is
    fetched from the API.
    """

    if isinstance(scheduled_event, dict):
        # A webhook payload usually carries start_time already. If it does
        # not, fall back to fetching the full record.
        if scheduled_event.get("start_time"):
            return scheduled_event

        uri = scheduled_event.get("uri")
    else:
        uri = scheduled_event

    if not uri:
        return {}

    try:
        return get_scheduled_event(uri)
    except Exception:
        logger.exception("Could not fetch Calendly event %s", uri)

        return {"uri": uri}


def sync_calendly_appointments():
    calendly_user = get_calendly_current_user()
    user_uri = calendly_user["resource"]["uri"]

    synced_count = 0

    # Active events
    active_events = get_scheduled_events(
        user_uri=user_uri,
        status="active",
    )

    for event in active_events.get("collection", []):
        synced_count += sync_calendly_event(event)

    # Cancelled events
    cancelled_events = get_scheduled_events(
        user_uri=user_uri,
        status="canceled",
    )

    for event in cancelled_events.get("collection", []):
        synced_count += sync_calendly_event(event)

    return synced_count


def sync_calendly_event(event):
    event_uri = event.get("uri")

    if not event_uri:
        return 0

    invitees_data = get_event_invitees(event_uri)

    updated_count = 0

    for invitee in invitees_data.get("collection", []):
        tracking = invitee.get("tracking") or {}

        booking_reference = tracking.get("utm_content")

        if not booking_reference:
            continue

        try:
            appointment = Appointment.objects.get(
                booking_reference=booking_reference
            )
        except Appointment.DoesNotExist:
            continue

        apply_calendly_event(
            appointment,
            event=event,
            invitee=invitee,
        )

        updated_count += 1

    return updated_count


def notify_appointment_change(
    appointment,
    *,
    previous_status,
    previous_scheduled_at,
):
    """
    Tell the customer only when something they care about actually changed.

    Calendly is polled, so the same event comes back on every sync. Without
    this check the customer would be emailed once per sync. The dedupe key
    in ``events`` is the second line of defence; this is the first.
    """

    status_changed = appointment.status != previous_status
    time_changed = appointment.scheduled_at != previous_scheduled_at

    if appointment.status == Appointment.Status.CANCELLED:
        if status_changed:
            events.appointment_cancelled(appointment)

        return

    if appointment.status == Appointment.Status.CONFIRMED:
        if status_changed or time_changed:
            events.appointment_confirmed(appointment)