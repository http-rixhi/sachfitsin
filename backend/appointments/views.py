import json
import hmac
import hashlib

from decouple import config
from django.conf import settings
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.exceptions import (
    NotAuthenticated,
    NotFound,
    ValidationError,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications import events

from .calendly import (
    apply_calendly_event,
    resolve_event,
    sync_calendly_appointments,
)
from .services import cancel_appointment
from .models import Appointment

from rest_framework import generics

from .models import Appointment
from .permissions import IsCustomer, IsDietician
from .serializers import (
    AppointmentSerializer,
    DieticianAppointmentSerializer,
)


class CustomerAppointmentListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = AppointmentSerializer
    permission_classes = [IsCustomer]

    def get_queryset(self):
        return (
            Appointment.objects
            .filter(customer=self.request.user)
            .select_related("customer")
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        appointment = serializer.save(customer=self.request.user)

        events.appointment_booked(appointment)


class CustomerAppointmentConfirmView(APIView):
    """
    Called by the browser the moment Calendly says a slot was picked.

    Webhooks cannot reach a laptop, so in development the appointment would
    sit on PENDING until someone ran the sync by hand. The widget tells the
    page which event was booked, and this endpoint pulls that one event
    from Calendly and applies it. In production it simply makes the update
    instant instead of waiting for the webhook.
    """

    permission_classes = [IsCustomer]

    def post(self, request, pk):
        appointment = (
            Appointment.objects
            .filter(pk=pk, customer=request.user)
            .first()
        )

        if not appointment:
            raise NotFound("Appointment not found.")

        event_uri = request.data.get("event_uri")

        if not event_uri:
            raise ValidationError(
                {"event_uri": ["This field is required."]}
            )

        event = resolve_event(event_uri)

        invitee = {}

        invitee_uri = request.data.get("invitee_uri")

        if invitee_uri:
            invitee["uri"] = invitee_uri

        apply_calendly_event(
            appointment,
            event=event,
            invitee=invitee,
        )

        appointment.refresh_from_db()

        return Response(AppointmentSerializer(appointment).data)


class DieticianAppointmentListView(generics.ListAPIView):
    serializer_class = DieticianAppointmentSerializer
    permission_classes = [IsDietician]

    def get_queryset(self):
        return (
            Appointment.objects
            .filter(
                customer__role="CUSTOMER"
            )
            .select_related("customer")
            .order_by("-created_at")
        )


class DieticianAppointmentDetailView(
    generics.RetrieveUpdateAPIView
):
    serializer_class = DieticianAppointmentSerializer
    permission_classes = [IsDietician]

    def get_queryset(self):
        return (
            Appointment.objects
            .filter(
                customer__role="CUSTOMER"
            )
            .select_related("customer")
        )

    def perform_update(self, serializer):
        """
        Cancelling has to go through the cancel endpoint.

        Allowing it here would write CANCELLED to our database while the
        slot stayed booked in Calendly, and the next sync would undo it.
        """

        new_status = serializer.validated_data.get("status")

        if new_status == Appointment.Status.CANCELLED:
            raise ValidationError(
                {
                    "status": [
                        "Use the cancel endpoint so the booking is also "
                        "cancelled in Calendly."
                    ]
                }
            )

        serializer.save()


class DieticianAppointmentCancelView(APIView):
    """
    Cancel a booking properly: in Calendly first, then here.

    See appointments/services.cancel_appointment for why the order matters.
    """

    permission_classes = [IsDietician]

    def post(self, request, pk):
        appointment = (
            Appointment.objects
            .filter(pk=pk, customer__role="CUSTOMER")
            .select_related("customer")
            .first()
        )

        if not appointment:
            raise NotFound("Appointment not found.")

        cancel_appointment(
            appointment,
            reason=str(request.data.get("reason", "")).strip(),
        )

        appointment.refresh_from_db()

        return Response(
            DieticianAppointmentSerializer(appointment).data
        )


class CalendlyWebhookView(APIView):
    permission_classes = [AllowAny]

    authentication_classes = []

    def post(self, request):
        signature = request.headers.get(
            "Calendly-Webhook-Signature"
        )

        if not signature:
            return Response(
                {"detail": "Missing webhook signature."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        secret = getattr(
            settings,
            "CALENDLY_WEBHOOK_SIGNING_KEY",
            "",
        )

        if not secret:
            return Response(
                {"detail": "Webhook signing key is not configured."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        timestamp = signature.split(",")[0].replace("t=", "")
        signature_value = (
            signature.split(",")[1].replace("v1=", "")
            if "," in signature
            else ""
        )

        signed_payload = (
            f"{timestamp}.{request.body.decode('utf-8')}"
        )

        expected_signature = hmac.new(
            secret.encode(),
            signed_payload.encode(),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(
            expected_signature,
            signature_value,
        ):
            return Response(
                {"detail": "Invalid webhook signature."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payload = request.data
            event_type = payload.get("event")

            if event_type == "invitee.created":
                self.handle_invitee_created(payload)

            elif event_type == "invitee.canceled":
                self.handle_invitee_canceled(payload)

            return Response({"status": "ok"})

        except Exception:
            return Response(
                {"detail": "Webhook processing failed."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def handle_invitee_created(self, payload):
        """
        Calendly says someone picked a slot.

        The booking reference travels in utm_content, set by the front end
        when it opens the widget, so it is the reliable way to find the
        appointment. Email is only a fallback, because a customer can type
        a different address into Calendly than the one on their account.
        """

        calendly_payload = payload.get("payload", {})

        invitee_uri = calendly_payload.get("uri")

        if not invitee_uri:
            return

        appointment = self.find_appointment(calendly_payload)

        if not appointment:
            return

        event = resolve_event(calendly_payload.get("scheduled_event"))

        apply_calendly_event(
            appointment,
            event=event,
            invitee=calendly_payload,
        )

    @staticmethod
    def find_appointment(calendly_payload):
        tracking = calendly_payload.get("tracking") or {}

        booking_reference = tracking.get("utm_content")

        if booking_reference:
            appointment = Appointment.objects.filter(
                booking_reference=booking_reference
            ).first()

            if appointment:
                return appointment

        email = calendly_payload.get("email")

        if not email:
            return None

        return (
            Appointment.objects
            .filter(
                customer__email=email,
                status=Appointment.Status.PENDING,
            )
            .order_by("-created_at")
            .first()
        )

    def handle_invitee_canceled(self, payload):
        calendly_payload = payload.get("payload", {})

        invitee_uri = calendly_payload.get("uri")

        if not invitee_uri:
            return

        appointment = (
            Appointment.objects
            .filter(calendly_invitee_uri=invitee_uri)
            .first()
            or self.find_appointment(calendly_payload)
        )

        if appointment:
            was_cancelled = (
                appointment.status == Appointment.Status.CANCELLED
            )

            appointment.status = (
                Appointment.Status.CANCELLED
            )

            appointment.save()

            if not was_cancelled:
                events.appointment_cancelled(appointment)


class CalendlySyncView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        expected_secret = config("CALENDLY_SYNC_SECRET", default="")

        provided_secret = request.headers.get("X-Calendly-Sync-Secret", "")

        # An unset secret must not mean "everyone is allowed in", and the
        # comparison is constant-time so the secret cannot be guessed one
        # character at a time by measuring how long the reply takes.
        if not expected_secret or not hmac.compare_digest(
            provided_secret,
            expected_secret,
        ):
            raise NotAuthenticated("Invalid sync secret.")

        try:
            count = sync_calendly_appointments()

            return Response({
                "status": "ok",
                "synchronized": count,
            })

        except Exception:
            return Response(
                {"detail": "Calendly synchronization failed."},
                status=500,
            )