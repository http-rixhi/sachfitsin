from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from appointments.models import Appointment

User = get_user_model()


def make_customer(username="rishi"):
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="password123",
        first_name="Rishi",
        role=User.Role.CUSTOMER,
    )


def make_dietician():
    return User.objects.create_user(
        username="doc",
        email="doc@example.com",
        password="password123",
        role=User.Role.DIETICIAN,
    )


class BookingTests(APITestCase):
    def setUp(self):
        self.customer = make_customer()
        self.client.force_authenticate(user=self.customer)

    def test_booking_with_only_reason_and_notes(self):
        """
        The exact body the front end sends.

        This used to fail with "customer: This field is required", because
        the serializer demanded a field the view fills in itself.
        """

        response = self.client.post(
            reverse("customer-appointments"),
            {"reason": "Review my diet plan", "notes": "feeling tired"},
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)

        appointment = Appointment.objects.get()

        self.assertEqual(appointment.customer, self.customer)
        self.assertEqual(appointment.reason, "Review my diet plan")
        self.assertEqual(appointment.status, Appointment.Status.PENDING)

    def test_booking_with_no_notes(self):
        response = self.client.post(
            reverse("customer-appointments"),
            {"reason": "Quick question", "notes": ""},
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)

    def test_booking_gets_a_reference_and_default_length(self):
        self.client.post(
            reverse("customer-appointments"),
            {"reason": "Review", "notes": ""},
            format="json",
        )

        appointment = Appointment.objects.get()

        self.assertTrue(appointment.booking_reference)
        self.assertEqual(appointment.duration_minutes, 30)

    def test_booking_creates_a_notification(self):
        from notifications.models import Notification

        self.client.post(
            reverse("customer-appointments"),
            {"reason": "Review", "notes": ""},
            format="json",
        )

        self.assertTrue(
            Notification.objects.filter(
                user=self.customer, category="APPOINTMENT"
            ).exists()
        )

    def test_customer_only_sees_their_own(self):
        other = make_customer("someone")

        Appointment.objects.create(customer=other, reason="Not mine")
        Appointment.objects.create(customer=self.customer, reason="Mine")

        response = self.client.get(reverse("customer-appointments"))

        reasons = [item["reason"] for item in response.data]

        self.assertEqual(reasons, ["Mine"])


class BookingCannotBeTamperedWithTests(APITestCase):
    """A customer must not be able to set the fields Calendly owns."""

    def setUp(self):
        self.customer = make_customer()
        self.client.force_authenticate(user=self.customer)

    def test_customer_cannot_confirm_their_own_appointment(self):
        response = self.client.post(
            reverse("customer-appointments"),
            {"reason": "Sneaky", "status": "CONFIRMED"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            Appointment.objects.get().status, Appointment.Status.PENDING
        )

    def test_customer_cannot_set_the_meeting_url(self):
        self.client.post(
            reverse("customer-appointments"),
            {
                "reason": "Sneaky",
                "meeting_url": "https://evil.example.com",
            },
            format="json",
        )

        self.assertEqual(Appointment.objects.get().meeting_url, "")

    def test_customer_cannot_book_for_someone_else(self):
        victim = make_customer("victim")

        self.client.post(
            reverse("customer-appointments"),
            {"reason": "Sneaky", "customer": victim.pk},
            format="json",
        )

        self.assertEqual(Appointment.objects.get().customer, self.customer)

    def test_customer_cannot_set_their_own_time(self):
        from django.utils import timezone

        self.client.post(
            reverse("customer-appointments"),
            {
                "reason": "Sneaky",
                "scheduled_at": timezone.now().isoformat(),
            },
            format="json",
        )

        self.assertIsNone(Appointment.objects.get().scheduled_at)


class DieticianAppointmentTests(APITestCase):
    def setUp(self):
        self.customer = make_customer()
        self.dietician = make_dietician()

        self.appointment = Appointment.objects.create(
            customer=self.customer,
            reason="Review my plan",
        )

        self.client.force_authenticate(user=self.dietician)

    def test_dietician_sees_every_appointment(self):
        response = self.client.get(reverse("dietician-appointments"))

        self.assertEqual(len(response.data), 1)

    def test_dietician_can_move_the_status(self):
        """The one field the dietician may write that a customer may not."""

        response = self.client.patch(
            reverse(
                "dietician-appointment-detail",
                kwargs={"pk": self.appointment.pk},
            ),
            {"status": "COMPLETED"},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)

        self.appointment.refresh_from_db()
        self.assertEqual(
            self.appointment.status, Appointment.Status.COMPLETED
        )

    def test_dietician_still_cannot_write_calendly_fields(self):
        self.client.patch(
            reverse(
                "dietician-appointment-detail",
                kwargs={"pk": self.appointment.pk},
            ),
            {"meeting_url": "https://typo.example.com"},
            format="json",
        )

        self.appointment.refresh_from_db()
        self.assertEqual(self.appointment.meeting_url, "")

    def test_customer_cannot_use_the_dietician_endpoint(self):
        self.client.force_authenticate(user=self.customer)

        response = self.client.get(reverse("dietician-appointments"))

        self.assertEqual(response.status_code, 403)


class CalendlyEventApplyTests(APITestCase):
    """
    The step that was broken: writing a picked time onto the appointment.

    The webhook used to set the status to CONFIRMED and silently drop the
    time, so the customer saw "Time not picked yet" after booking.
    """

    def setUp(self):
        self.customer = make_customer()

        self.appointment = Appointment.objects.create(
            customer=self.customer,
            reason="Review my plan",
        )

    @staticmethod
    def calendly_event(status="active"):
        return {
            "uri": "https://api.calendly.com/scheduled_events/EV1",
            "status": status,
            "start_time": "2026-10-05T10:00:00.000000Z",
            "end_time": "2026-10-05T10:45:00.000000Z",
            "location": {
                "type": "zoom",
                "join_url": "https://zoom.us/j/123",
            },
        }

    def test_applying_an_event_sets_the_time(self):
        from appointments.calendly import apply_calendly_event

        apply_calendly_event(
            self.appointment,
            event=self.calendly_event(),
            invitee={"uri": "https://api.calendly.com/.../invitees/IN1"},
        )

        self.appointment.refresh_from_db()

        self.assertIsNotNone(self.appointment.scheduled_at)
        self.assertEqual(
            self.appointment.status, Appointment.Status.CONFIRMED
        )

    def test_applying_an_event_sets_the_meeting_url(self):
        from appointments.calendly import apply_calendly_event

        apply_calendly_event(
            self.appointment, event=self.calendly_event()
        )

        self.appointment.refresh_from_db()

        self.assertEqual(
            self.appointment.meeting_url, "https://zoom.us/j/123"
        )

    def test_duration_comes_from_the_event(self):
        from appointments.calendly import apply_calendly_event

        apply_calendly_event(
            self.appointment, event=self.calendly_event()
        )

        self.appointment.refresh_from_db()

        self.assertEqual(self.appointment.duration_minutes, 45)

    def test_a_cancelled_event_cancels_the_appointment(self):
        from appointments.calendly import apply_calendly_event

        apply_calendly_event(
            self.appointment, event=self.calendly_event(status="canceled")
        )

        self.appointment.refresh_from_db()

        self.assertEqual(
            self.appointment.status, Appointment.Status.CANCELLED
        )

    def test_a_partial_event_never_wipes_a_known_time(self):
        from django.utils import timezone

        from appointments.calendly import apply_calendly_event

        known = timezone.now()

        self.appointment.scheduled_at = known
        self.appointment.save()

        apply_calendly_event(
            self.appointment,
            event={"uri": "https://api.calendly.com/scheduled_events/EV1"},
        )

        self.appointment.refresh_from_db()

        self.assertEqual(self.appointment.scheduled_at, known)

    def test_a_completed_appointment_is_not_reopened(self):
        from appointments.calendly import apply_calendly_event

        self.appointment.status = Appointment.Status.COMPLETED
        self.appointment.save()

        apply_calendly_event(
            self.appointment, event=self.calendly_event()
        )

        self.appointment.refresh_from_db()

        self.assertEqual(
            self.appointment.status, Appointment.Status.COMPLETED
        )


class CalendlyWebhookTests(APITestCase):
    """The webhook path, end to end, with a realistic Calendly payload."""

    def setUp(self):
        self.customer = make_customer()

        self.appointment = Appointment.objects.create(
            customer=self.customer,
            reason="Review my plan",
        )

    def payload(self, event="invitee.created"):
        return {
            "event": event,
            "payload": {
                "uri": "https://api.calendly.com/.../invitees/IN1",
                "email": self.customer.email,
                "status": "active",
                "tracking": {
                    "utm_content": str(self.appointment.booking_reference),
                },
                "scheduled_event": {
                    "uri": "https://api.calendly.com/scheduled_events/EV1",
                    "status": "active",
                    "start_time": "2026-10-05T10:00:00.000000Z",
                    "end_time": "2026-10-05T10:30:00.000000Z",
                    "location": {
                        "type": "zoom",
                        "join_url": "https://zoom.us/j/123",
                    },
                },
            },
        }

    def post_webhook(self, body):
        """Sign the body the way Calendly does."""

        import hashlib
        import hmac
        import json

        from django.test import override_settings

        secret = "test-signing-key"
        raw = json.dumps(body)
        timestamp = "1700000000"

        signature = hmac.new(
            secret.encode(),
            f"{timestamp}.{raw}".encode(),
            hashlib.sha256,
        ).hexdigest()

        with override_settings(CALENDLY_WEBHOOK_SIGNING_KEY=secret):
            return self.client.post(
                reverse("calendly-webhook"),
                data=raw,
                content_type="application/json",
                HTTP_CALENDLY_WEBHOOK_SIGNATURE=(
                    f"t={timestamp},v1={signature}"
                ),
            )

    def test_webhook_sets_the_time_and_the_meeting_url(self):
        response = self.post_webhook(self.payload())

        self.assertEqual(response.status_code, 200, response.data)

        self.appointment.refresh_from_db()

        self.assertEqual(
            self.appointment.status, Appointment.Status.CONFIRMED
        )
        self.assertIsNotNone(
            self.appointment.scheduled_at,
            "the picked time must be stored, not dropped",
        )
        self.assertEqual(
            self.appointment.meeting_url, "https://zoom.us/j/123"
        )
        self.assertEqual(self.appointment.duration_minutes, 30)

    def test_webhook_matches_by_booking_reference_not_email(self):
        """A different email in Calendly must still find the appointment."""

        body = self.payload()
        body["payload"]["email"] = "typed-something-else@example.com"

        self.post_webhook(body)

        self.appointment.refresh_from_db()

        self.assertEqual(
            self.appointment.status, Appointment.Status.CONFIRMED
        )
        self.assertIsNotNone(self.appointment.scheduled_at)

    def test_webhook_rejects_a_bad_signature(self):
        response = self.client.post(
            reverse("calendly-webhook"),
            data="{}",
            content_type="application/json",
            HTTP_CALENDLY_WEBHOOK_SIGNATURE="t=1,v1=wrong",
        )

        self.assertIn(response.status_code, (400, 500))

        self.appointment.refresh_from_db()
        self.assertEqual(
            self.appointment.status, Appointment.Status.PENDING
        )

    def test_webhook_cancellation(self):
        self.post_webhook(self.payload())

        body = self.payload(event="invitee.canceled")
        body["payload"]["status"] = "canceled"

        self.post_webhook(body)

        self.appointment.refresh_from_db()

        self.assertEqual(
            self.appointment.status, Appointment.Status.CANCELLED
        )


class ConfirmEndpointTests(APITestCase):
    """The browser-triggered confirmation, used when webhooks cannot reach."""

    def setUp(self):
        self.customer = make_customer()

        self.appointment = Appointment.objects.create(
            customer=self.customer,
            reason="Review my plan",
        )

        self.client.force_authenticate(user=self.customer)

    def url(self, pk=None):
        return reverse(
            "customer-appointment-confirm",
            kwargs={"pk": pk or self.appointment.pk},
        )

    def test_confirm_applies_the_event(self):
        from unittest.mock import patch

        event = {
            "uri": "https://api.calendly.com/scheduled_events/EV1",
            "status": "active",
            "start_time": "2026-10-05T10:00:00.000000Z",
            "end_time": "2026-10-05T10:30:00.000000Z",
            "location": {"join_url": "https://zoom.us/j/123"},
        }

        with patch(
            "appointments.views.resolve_event", return_value=event
        ):
            response = self.client.post(
                self.url(),
                {
                    "event_uri": (
                        "https://api.calendly.com/scheduled_events/EV1"
                    ),
                    "invitee_uri": "https://api.calendly.com/.../IN1",
                },
                format="json",
            )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNotNone(response.data["scheduled_at"])
        self.assertEqual(response.data["status"], "CONFIRMED")

    def test_confirm_requires_an_event_uri(self):
        response = self.client.post(self.url(), {}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("event_uri", response.json()["error"]["fields"])

    def test_cannot_confirm_someone_elses_appointment(self):
        other = make_customer("someone")

        theirs = Appointment.objects.create(
            customer=other, reason="Not mine"
        )

        response = self.client.post(
            self.url(pk=theirs.pk),
            {"event_uri": "https://api.calendly.com/scheduled_events/EV1"},
            format="json",
        )

        self.assertEqual(response.status_code, 404)

        theirs.refresh_from_db()
        self.assertEqual(theirs.status, Appointment.Status.PENDING)


class CancelFromAdminTests(APITestCase):
    """
    Cancelling must reach Calendly, not just our database.

    A local-only cancel leaves the slot booked in the dietician's calendar,
    leaves the customer holding an invite, and is undone by the next sync.
    """

    def setUp(self):
        self.customer = make_customer()
        self.dietician = make_dietician()

        self.appointment = Appointment.objects.create(
            customer=self.customer,
            reason="Review my plan",
            status=Appointment.Status.CONFIRMED,
            calendly_event_uri=(
                "https://api.calendly.com/scheduled_events/EV1"
            ),
        )

        self.client.force_authenticate(user=self.dietician)

    def url(self, pk=None):
        return reverse(
            "dietician-appointment-cancel",
            kwargs={"pk": pk or self.appointment.pk},
        )

    def test_cancel_calls_calendly(self):
        from unittest.mock import patch

        with patch(
            "appointments.services.cancel_calendly_event",
            return_value=True,
        ) as mocked:
            response = self.client.post(self.url(), {}, format="json")

        self.assertEqual(response.status_code, 200, response.data)

        mocked.assert_called_once()
        self.assertEqual(
            mocked.call_args.args[0],
            "https://api.calendly.com/scheduled_events/EV1",
        )

        self.appointment.refresh_from_db()
        self.assertEqual(
            self.appointment.status, Appointment.Status.CANCELLED
        )

    def test_cancel_passes_the_reason_to_calendly(self):
        from unittest.mock import patch

        with patch(
            "appointments.services.cancel_calendly_event",
            return_value=True,
        ) as mocked:
            self.client.post(
                self.url(), {"reason": "Dietician is unwell"}, format="json"
            )

        self.assertEqual(
            mocked.call_args.kwargs["reason"], "Dietician is unwell"
        )

    def test_nothing_changes_here_when_calendly_refuses(self):
        from unittest.mock import patch

        with patch(
            "appointments.services.cancel_calendly_event",
            return_value=False,
        ):
            response = self.client.post(self.url(), {}, format="json")

        self.assertEqual(response.status_code, 502)
        self.assertEqual(
            response.json()["error"]["code"], "upstream_error"
        )

        # Still booked, which is the truth.
        self.appointment.refresh_from_db()
        self.assertEqual(
            self.appointment.status, Appointment.Status.CONFIRMED
        )

    def test_nothing_changes_here_when_calendly_is_unreachable(self):
        from unittest.mock import patch

        with patch(
            "appointments.services.cancel_calendly_event",
            side_effect=OSError("connection refused"),
        ):
            response = self.client.post(self.url(), {}, format="json")

        self.assertEqual(response.status_code, 502)

        self.appointment.refresh_from_db()
        self.assertEqual(
            self.appointment.status, Appointment.Status.CONFIRMED
        )

    def test_the_failure_message_says_it_is_still_booked(self):
        from unittest.mock import patch

        with patch(
            "appointments.services.cancel_calendly_event",
            return_value=False,
        ):
            response = self.client.post(self.url(), {}, format="json")

        message = response.json()["error"]["message"].lower()

        # A generic "something went wrong" would let the dietician believe
        # the session was cancelled when it was not.
        self.assertIn("still", message)
        self.assertNotIn("something went wrong", message)

    def test_an_appointment_with_no_slot_cancels_locally(self):
        from unittest.mock import patch

        never_booked = Appointment.objects.create(
            customer=self.customer,
            reason="No slot picked",
        )

        with patch(
            "appointments.services.cancel_calendly_event"
        ) as mocked:
            response = self.client.post(
                self.url(pk=never_booked.pk), {}, format="json"
            )

        self.assertEqual(response.status_code, 200)
        mocked.assert_not_called()

        never_booked.refresh_from_db()
        self.assertEqual(
            never_booked.status, Appointment.Status.CANCELLED
        )

    def test_cancelling_twice_is_harmless(self):
        from unittest.mock import patch

        with patch(
            "appointments.services.cancel_calendly_event",
            return_value=True,
        ) as mocked:
            self.client.post(self.url(), {}, format="json")
            self.client.post(self.url(), {}, format="json")

        self.assertEqual(mocked.call_count, 1)

    def test_cancel_notifies_the_customer(self):
        from unittest.mock import patch

        from notifications.models import Notification

        with patch(
            "appointments.services.cancel_calendly_event",
            return_value=True,
        ):
            self.client.post(self.url(), {}, format="json")

        self.assertTrue(
            Notification.objects.filter(
                user=self.customer, title="Appointment cancelled"
            ).exists()
        )

    def test_patching_the_status_to_cancelled_is_refused(self):
        """The back door that would skip Calendly entirely."""

        response = self.client.patch(
            reverse(
                "dietician-appointment-detail",
                kwargs={"pk": self.appointment.pk},
            ),
            {"status": "CANCELLED"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("status", response.json()["error"]["fields"])

        self.appointment.refresh_from_db()
        self.assertEqual(
            self.appointment.status, Appointment.Status.CONFIRMED
        )

    def test_other_status_changes_still_work(self):
        response = self.client.patch(
            reverse(
                "dietician-appointment-detail",
                kwargs={"pk": self.appointment.pk},
            ),
            {"status": "COMPLETED"},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)

    def test_a_customer_cannot_cancel_through_the_admin_endpoint(self):
        self.client.force_authenticate(user=self.customer)

        response = self.client.post(self.url(), {}, format="json")

        self.assertEqual(response.status_code, 403)


class CancelledAppointmentStaysCancelledTests(APITestCase):
    """The sync must not resurrect a cancellation."""

    def setUp(self):
        self.customer = make_customer()

        self.appointment = Appointment.objects.create(
            customer=self.customer,
            reason="Review my plan",
            status=Appointment.Status.CANCELLED,
            calendly_event_uri=(
                "https://api.calendly.com/scheduled_events/EV1"
            ),
        )

    def test_calendly_reporting_it_cancelled_keeps_it_cancelled(self):
        from appointments.calendly import apply_calendly_event

        apply_calendly_event(
            self.appointment,
            event={
                "uri": "https://api.calendly.com/scheduled_events/EV1",
                "status": "canceled",
                "start_time": "2026-10-05T10:00:00.000000Z",
                "end_time": "2026-10-05T10:30:00.000000Z",
            },
        )

        self.appointment.refresh_from_db()

        self.assertEqual(
            self.appointment.status, Appointment.Status.CANCELLED
        )
