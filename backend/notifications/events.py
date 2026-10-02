"""
Business events.

This is the only module the rest of the project imports. Each function
takes a saved model instance and fires both sides of the communication:
the in-app notification and the email.

Two rules hold for everything in here:

1. Call it AFTER the business operation has been saved.
2. It never raises. The helpers it calls swallow their own errors, and
   ``_safe`` is the backstop for anything unexpected (a missing related
   object, a bad attribute).
"""

import logging
from functools import wraps

from django.utils import timezone

from notifications.email.service import send_email
from notifications.models import Category
from notifications.services import create_notification

logger = logging.getLogger("notifications.events")


def _safe(function):
    """Never let a notification problem break the caller's request."""

    @wraps(function)
    def wrapper(*args, **kwargs):
        try:
            return function(*args, **kwargs)
        except Exception:
            logger.exception(
                "Event handler '%s' failed. The business operation was not "
                "affected.",
                function.__name__,
            )
            return None

    return wrapper


def _display_name(user) -> str:
    return (user.first_name or user.username or "there").strip()


def _format_datetime(value) -> str:
    if not value:
        return "Not scheduled yet"

    return timezone.localtime(value).strftime("%d %b %Y at %I:%M %p")


def _format_date(value) -> str:
    if not value:
        return "Not set"

    return value.strftime("%d %b %Y")


# ---------------------------------------------------------------------------
# Account
# ---------------------------------------------------------------------------


@_safe
def user_registered(user):
    create_notification(
        user=user,
        category=Category.ACCOUNT,
        title="Welcome to Sachfitsin",
        body=(
            "Complete your health profile so your dietician can build a "
            "plan that fits you."
        ),
        link="/dashboard/profile",
        dedupe_key=f"welcome:{user.pk}",
    )

    send_email(
        to=user.email,
        subject="Welcome to Sachfitsin",
        template="welcome",
        context={"first_name": _display_name(user)},
        user=user,
        dedupe_key=f"welcome:{user.pk}",
    )


# ---------------------------------------------------------------------------
# Appointments
# ---------------------------------------------------------------------------


def _appointment_details(appointment) -> list[tuple[str, str]]:
    details = [
        ("Reference", str(appointment.booking_reference)),
        ("When", _format_datetime(appointment.scheduled_at)),
        ("Length", f"{appointment.duration_minutes} minutes"),
    ]

    if appointment.reason:
        details.append(("About", appointment.reason))

    return details


@_safe
def appointment_booked(appointment):
    customer = appointment.customer

    create_notification(
        user=customer,
        category=Category.APPOINTMENT,
        title="Appointment request received",
        body="Pick a time slot so your dietician can confirm it.",
        link="/dashboard/appointments",
        dedupe_key=f"appointment-booked:{appointment.pk}",
    )

    send_email(
        to=customer.email,
        subject="We have your appointment request",
        template="appointment_booked",
        context={
            "first_name": _display_name(customer),
            "details": _appointment_details(appointment),
        },
        user=customer,
        dedupe_key=f"appointment-booked:{appointment.pk}",
    )


@_safe
def appointment_confirmed(appointment):
    customer = appointment.customer

    when = _format_datetime(appointment.scheduled_at)

    # Keyed on the scheduled time, so a rescheduled appointment is allowed
    # to notify again but the same time never does twice.
    key = f"appointment-confirmed:{appointment.pk}:{appointment.scheduled_at}"

    create_notification(
        user=customer,
        category=Category.APPOINTMENT,
        title="Appointment confirmed",
        body=f"Your consultation is booked for {when}.",
        link="/dashboard/appointments",
        dedupe_key=key,
    )

    send_email(
        to=customer.email,
        subject="Your Sachfitsin appointment is confirmed",
        template="appointment_confirmed",
        context={
            "first_name": _display_name(customer),
            "details": _appointment_details(appointment),
            "meeting_url": appointment.meeting_url,
        },
        user=customer,
        dedupe_key=key,
    )


@_safe
def appointment_cancelled(appointment):
    customer = appointment.customer

    key = f"appointment-cancelled:{appointment.pk}"

    create_notification(
        user=customer,
        category=Category.APPOINTMENT,
        title="Appointment cancelled",
        body="This consultation is no longer booked.",
        link="/dashboard/appointments",
        dedupe_key=key,
    )

    send_email(
        to=customer.email,
        subject="Your Sachfitsin appointment was cancelled",
        template="appointment_cancelled",
        context={
            "first_name": _display_name(customer),
            "details": _appointment_details(appointment),
        },
        user=customer,
        dedupe_key=key,
    )


# ---------------------------------------------------------------------------
# Diet plans
# ---------------------------------------------------------------------------


def _diet_plan_details(plan) -> list[tuple[str, str]]:
    return [
        ("Plan", plan.title),
        ("Starts", _format_date(plan.start_date)),
        ("Ends", _format_date(plan.end_date)),
        ("Status", plan.get_status_display()),
    ]


@_safe
def diet_plan_created(plan):
    customer = plan.customer

    key = f"diet-plan-created:{plan.pk}"

    create_notification(
        user=customer,
        category=Category.DIET_PLAN,
        title="Your new diet plan is ready",
        body=plan.title,
        link="/dashboard",
        dedupe_key=key,
    )

    send_email(
        to=customer.email,
        subject="Your new Sachfitsin diet plan is ready",
        template="diet_plan_created",
        context={
            "first_name": _display_name(customer),
            "details": _diet_plan_details(plan),
            "description": plan.description,
        },
        user=customer,
        dedupe_key=key,
    )


@_safe
def diet_plan_updated(plan):
    customer = plan.customer

    # Keyed on the save time, so every real edit notifies, but a double
    # submit inside the same second does not.
    stamp = plan.updated_at.strftime("%Y%m%d%H%M%S") if plan.updated_at else ""

    key = f"diet-plan-updated:{plan.pk}:{stamp}"

    create_notification(
        user=customer,
        category=Category.DIET_PLAN,
        title="Your diet plan was updated",
        body=plan.title,
        link="/dashboard",
        dedupe_key=key,
    )

    send_email(
        to=customer.email,
        subject="Your Sachfitsin diet plan has been updated",
        template="diet_plan_updated",
        context={
            "first_name": _display_name(customer),
            "details": _diet_plan_details(plan),
            "description": plan.description,
        },
        user=customer,
        dedupe_key=key,
    )


# ---------------------------------------------------------------------------
# Personalized videos
# ---------------------------------------------------------------------------


@_safe
def personalized_video_assigned(assignment):
    customer = assignment.customer
    video = assignment.video

    key = f"video-assigned:{assignment.pk}"

    details = [("Video", video.title)]

    if video.category:
        details.append(("Category", video.category))

    if assignment.starts_at:
        details.append(("Available from", _format_datetime(assignment.starts_at)))

    if assignment.ends_at:
        details.append(("Available until", _format_datetime(assignment.ends_at)))

    create_notification(
        user=customer,
        category=Category.VIDEO,
        title="A new video for you",
        body=video.title,
        link="/dashboard/videos",
        dedupe_key=key,
    )

    send_email(
        to=customer.email,
        subject="Your dietician picked a new video for you",
        template="personalized_video_assigned",
        context={
            "first_name": _display_name(customer),
            "details": details,
            "notes": assignment.notes,
        },
        user=customer,
        dedupe_key=key,
    )


# ---------------------------------------------------------------------------
# Exercises
# ---------------------------------------------------------------------------


@_safe
def exercise_assigned(recommendation):
    customer = recommendation.customer
    exercise = recommendation.exercise

    key = f"exercise-assigned:{recommendation.pk}"

    details = [("Exercise", exercise.name)]

    if exercise.category:
        details.append(("Category", exercise.category))

    details.append(("Level", exercise.get_difficulty_display()))

    if recommendation.sets:
        details.append(("Sets", str(recommendation.sets)))

    if recommendation.reps:
        details.append(("Reps", str(recommendation.reps)))

    if recommendation.duration_minutes:
        details.append(
            ("Duration", f"{recommendation.duration_minutes} minutes")
        )

    if recommendation.frequency:
        details.append(("How often", recommendation.frequency))

    create_notification(
        user=customer,
        category=Category.EXERCISE,
        title="A new exercise for you",
        body=exercise.name,
        link="/dashboard/exercises",
        dedupe_key=key,
    )

    send_email(
        to=customer.email,
        subject="A new exercise has been added to your plan",
        template="exercise_assigned",
        context={
            "first_name": _display_name(customer),
            "details": details,
            "notes": recommendation.notes,
            "precautions": exercise.precautions,
        },
        user=customer,
        dedupe_key=key,
    )


# ---------------------------------------------------------------------------
# Subscriptions
# ---------------------------------------------------------------------------


@_safe
def entitlement_activated(entitlement):
    """
    A customer has been given access to a paid product.

    Today the only path here is a dietician granting an entitlement by hand.
    When payments go live, the Razorpay handler should call this same
    function rather than writing its own notification.
    """

    from subscriptions.models import Entitlement

    if entitlement.status != Entitlement.Status.ACTIVE:
        return

    customer = entitlement.customer
    product = entitlement.product

    key = f"entitlement-activated:{entitlement.pk}"

    details = [
        ("Plan", product.name),
        ("Active from", _format_datetime(entitlement.starts_at)),
    ]

    if entitlement.expires_at:
        details.append(("Active until", _format_datetime(entitlement.expires_at)))
    else:
        details.append(("Active until", "No expiry"))

    create_notification(
        user=customer,
        category=Category.SUBSCRIPTION,
        title="Your subscription is active",
        body=f"{product.name} is now unlocked on your account.",
        link="/dashboard",
        dedupe_key=key,
    )

    send_email(
        to=customer.email,
        subject=f"{product.name} is now active on your account",
        template="subscription_activated",
        context={
            "first_name": _display_name(customer),
            "product_name": product.name,
            "details": details,
        },
        user=customer,
        dedupe_key=key,
    )
