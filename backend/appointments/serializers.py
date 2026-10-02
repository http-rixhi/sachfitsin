from rest_framework import serializers

from .models import Appointment


class AppointmentSerializer(serializers.ModelSerializer):
    """
    Customer-facing appointment.

    A customer only chooses *why* they want the session. Everything else is
    decided elsewhere:

    - ``customer`` comes from the logged-in user, set by the view.
    - ``scheduled_at``, ``duration_minutes``, ``meeting_url`` and the
      ``calendly_*`` fields come back from Calendly when the slot is picked.
    - ``status`` is moved by Calendly or by the dietician.

    All of those are read-only here. Leaving ``status`` writable would let a
    customer confirm their own appointment, and leaving ``customer``
    writable made every booking fail, because the view supplies it but the
    serializer still demanded it in the request body.
    """

    customer_username = serializers.CharField(
        source="customer.username",
        read_only=True,
    )

    class Meta:
        model = Appointment
        fields = [
            "id",
            "customer",
            "customer_username",
            "booking_reference",
            "scheduled_at",
            "duration_minutes",
            "status",
            "reason",
            "notes",
            "calendly_event_uri",
            "calendly_invitee_uri",
            "meeting_url",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "customer",
            "customer_username",
            "booking_reference",
            "scheduled_at",
            "duration_minutes",
            "status",
            "calendly_event_uri",
            "calendly_invitee_uri",
            "meeting_url",
            "created_at",
            "updated_at",
        ]


class DieticianAppointmentSerializer(AppointmentSerializer):
    """
    Same appointment, seen by the dietician.

    The dietician may move the status — for example marking a session
    COMPLETED after it happens. The Calendly fields stay read-only, because
    only the sync should ever write those.
    """

    class Meta(AppointmentSerializer.Meta):
        read_only_fields = [
            field
            for field in AppointmentSerializer.Meta.read_only_fields
            if field != "status"
        ]
