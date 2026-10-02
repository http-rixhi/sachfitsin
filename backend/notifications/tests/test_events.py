from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from diet_plans.models import DietPlan
from exercises.models import Exercise, ExerciseRecommendation
from notifications import events
from notifications.models import Category, EmailLog, EmailStatus, Notification
from videos.models import PersonalizedVideo, Video

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


@override_settings(EMAIL_ENABLED=True, RESEND_API_KEY="test-key")
@patch("notifications.email.service.client.send", return_value="msg_1")
class EventTests(TestCase):
    def setUp(self):
        self.customer = make_customer()
        self.dietician = make_dietician()

    def test_user_registered(self, mocked_send):
        events.user_registered(self.customer)

        notification = Notification.objects.get(user=self.customer)

        self.assertEqual(notification.category, Category.ACCOUNT)
        self.assertEqual(notification.link, "/dashboard/profile")
        self.assertEqual(mocked_send.call_count, 1)

    def test_user_registered_is_idempotent(self, mocked_send):
        events.user_registered(self.customer)
        events.user_registered(self.customer)

        self.assertEqual(
            Notification.objects.filter(user=self.customer).count(), 1
        )
        self.assertEqual(mocked_send.call_count, 1)

    def test_diet_plan_created(self, mocked_send):
        plan = DietPlan.objects.create(
            customer=self.customer,
            created_by=self.dietician,
            title="Summer reset",
            description="Lighter dinners.",
        )

        events.diet_plan_created(plan)

        notification = Notification.objects.get(user=self.customer)

        self.assertEqual(notification.category, Category.DIET_PLAN)
        self.assertIn("Summer reset", notification.body)
        self.assertEqual(mocked_send.call_count, 1)

    def test_personalized_video_assigned(self, mocked_send):
        video = Video.objects.create(
            title="Reading food labels",
            video_url="https://youtu.be/abc123",
            category="Nutrition",
        )

        assignment = PersonalizedVideo.objects.create(
            customer=self.customer,
            video=video,
            notes="Watch before our next call.",
        )

        events.personalized_video_assigned(assignment)

        notification = Notification.objects.get(user=self.customer)

        self.assertEqual(notification.category, Category.VIDEO)
        self.assertEqual(notification.link, "/dashboard/videos")
        self.assertEqual(mocked_send.call_count, 1)

    def test_exercise_assigned(self, mocked_send):
        exercise = Exercise.objects.create(
            name="Brisk walking",
            category="Cardio",
            difficulty="BEGINNER",
            precautions="Stop if you feel dizzy.",
        )

        recommendation = ExerciseRecommendation.objects.create(
            customer=self.customer,
            exercise=exercise,
            recommended_by=self.dietician,
            frequency="3 times a week",
        )

        events.exercise_assigned(recommendation)

        notification = Notification.objects.get(user=self.customer)

        self.assertEqual(notification.category, Category.EXERCISE)
        self.assertEqual(mocked_send.call_count, 1)

    def test_customer_without_an_email_still_gets_a_notification(
        self, mocked_send
    ):
        self.customer.email = ""
        self.customer.save()

        events.user_registered(self.customer)

        self.assertTrue(
            Notification.objects.filter(user=self.customer).exists()
        )
        mocked_send.assert_not_called()


class EventFailureTests(TestCase):
    """An email problem must never reach the caller."""

    def setUp(self):
        self.customer = make_customer()

    @override_settings(EMAIL_ENABLED=True, RESEND_API_KEY="test-key")
    @patch(
        "notifications.email.service.client.send",
        side_effect=RuntimeError("Resend is down"),
    )
    def test_email_failure_does_not_raise(self, _mock):
        events.user_registered(self.customer)

        self.assertTrue(
            Notification.objects.filter(user=self.customer).exists()
        )
        self.assertEqual(
            EmailLog.objects.get(user=self.customer).status,
            EmailStatus.FAILED,
        )

    @patch(
        "notifications.events.create_notification",
        side_effect=RuntimeError("database gone"),
    )
    def test_notification_failure_does_not_raise(self, _mock):
        # _safe is the backstop: no exception escapes an event handler.
        self.assertIsNone(events.user_registered(self.customer))


@override_settings(EMAIL_ENABLED=True, RESEND_API_KEY="test-key")
class RegistrationFlowTests(APITestCase):
    """End to end: the business operation must survive a broken mailer."""

    def setUp(self):
        from django.core.cache import cache

        # The register endpoint is rate limited per IP, and every test here
        # comes from the same one.
        cache.clear()
        self.addCleanup(cache.clear)

    @patch("notifications.email.service.client.send", return_value="msg_1")
    def test_register_creates_user_notification_and_email(self, mocked_send):
        response = self.client.post(
            reverse("register"),
            {
                "username": "newbie",
                "email": "newbie@example.com",
                "password": "password123",
                "first_name": "New",
                "last_name": "Person",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        user = User.objects.get(username="newbie")

        self.assertTrue(
            Notification.objects.filter(user=user).exists()
        )
        self.assertEqual(
            EmailLog.objects.get(user=user).status, EmailStatus.SENT
        )
        self.assertEqual(mocked_send.call_count, 1)

    @patch(
        "notifications.email.service.client.send",
        side_effect=RuntimeError("Resend is down"),
    )
    def test_registration_still_succeeds_when_email_fails(self, _mock):
        response = self.client.post(
            reverse("register"),
            {
                "username": "newbie",
                "email": "newbie@example.com",
                "password": "password123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(username="newbie").exists())


@override_settings(EMAIL_ENABLED=True, RESEND_API_KEY="test-key")
class DietPlanFlowTests(APITestCase):
    def setUp(self):
        self.customer = make_customer()
        self.dietician = make_dietician()
        self.client.force_authenticate(user=self.dietician)

    @patch("notifications.email.service.client.send", return_value="msg_1")
    def test_creating_a_plan_notifies_the_customer(self, mocked_send):
        response = self.client.post(
            reverse("dietician-diet-plans"),
            {
                "customer": self.customer.pk,
                "title": "Summer reset",
                "description": "Lighter dinners.",
                "status": "ACTIVE",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        notification = Notification.objects.get(user=self.customer)

        self.assertEqual(notification.category, Category.DIET_PLAN)
        self.assertEqual(mocked_send.call_count, 1)

    @patch("notifications.email.service.client.send", return_value="msg_1")
    def test_updating_a_plan_notifies_the_customer(self, mocked_send):
        plan = DietPlan.objects.create(
            customer=self.customer,
            created_by=self.dietician,
            title="Summer reset",
        )

        response = self.client.patch(
            reverse(
                "dietician-diet-plan-detail", kwargs={"pk": plan.pk}
            ),
            {"title": "Summer reset v2"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.assertTrue(
            Notification.objects.filter(
                user=self.customer,
                title="Your diet plan was updated",
            ).exists()
        )
        self.assertEqual(mocked_send.call_count, 1)


@override_settings(EMAIL_ENABLED=True, RESEND_API_KEY="test-key")
@patch("notifications.email.service.client.send", return_value="msg_1")
class AppointmentDedupeTests(TestCase):
    """Calendly is polled, so the same confirmation arrives repeatedly."""

    def setUp(self):
        from appointments.models import Appointment

        self.customer = make_customer()

        self.appointment = Appointment.objects.create(
            customer=self.customer,
            status="CONFIRMED",
            reason="Review my plan",
        )

    def test_repeated_confirmations_notify_once(self, mocked_send):
        events.appointment_confirmed(self.appointment)
        events.appointment_confirmed(self.appointment)
        events.appointment_confirmed(self.appointment)

        self.assertEqual(
            Notification.objects.filter(user=self.customer).count(), 1
        )
        self.assertEqual(mocked_send.call_count, 1)

    def test_rescheduling_notifies_again(self, mocked_send):
        from django.utils import timezone

        events.appointment_confirmed(self.appointment)

        self.appointment.scheduled_at = timezone.now()
        self.appointment.save()

        events.appointment_confirmed(self.appointment)

        self.assertEqual(
            Notification.objects.filter(user=self.customer).count(), 2
        )
        self.assertEqual(mocked_send.call_count, 2)


@override_settings(EMAIL_ENABLED=True, RESEND_API_KEY="test-key")
@patch("notifications.email.service.client.send", return_value="msg_1")
class SubscriptionEventTests(TestCase):
    def setUp(self):
        from products.models import Product

        self.customer = make_customer()

        self.product = Product.objects.create(
            code="PERSONALIZED_VIDEOS",
            name="Personalized Videos",
            status="ACTIVE",
        )

    def _entitlement(self, status="ACTIVE"):
        from django.utils import timezone

        from subscriptions.models import Entitlement

        return Entitlement.objects.create(
            customer=self.customer,
            product=self.product,
            status=status,
            starts_at=timezone.now(),
        )

    def test_activation_notifies_the_customer(self, mocked_send):
        events.entitlement_activated(self._entitlement())

        notification = Notification.objects.get(user=self.customer)

        self.assertEqual(notification.category, Category.SUBSCRIPTION)
        self.assertIn("Personalized Videos", notification.body)
        self.assertEqual(mocked_send.call_count, 1)

    def test_revoked_entitlement_notifies_nobody(self, mocked_send):
        events.entitlement_activated(self._entitlement(status="REVOKED"))

        self.assertFalse(
            Notification.objects.filter(user=self.customer).exists()
        )
        mocked_send.assert_not_called()

    def test_repeat_activation_notifies_once(self, mocked_send):
        entitlement = self._entitlement()

        events.entitlement_activated(entitlement)
        events.entitlement_activated(entitlement)

        self.assertEqual(
            Notification.objects.filter(user=self.customer).count(), 1
        )
        self.assertEqual(mocked_send.call_count, 1)


@override_settings(EMAIL_ENABLED=True, RESEND_API_KEY="test-key")
class EntitlementFlowTests(APITestCase):
    def setUp(self):
        from products.models import Product

        self.customer = make_customer()
        self.dietician = make_dietician()

        self.product = Product.objects.create(
            code="PERSONALIZED_VIDEOS",
            name="Personalized Videos",
            status="ACTIVE",
        )

        self.client.force_authenticate(user=self.dietician)

    @patch("notifications.email.service.client.send", return_value="msg_1")
    def test_granting_access_notifies_the_customer(self, mocked_send):
        from django.utils import timezone

        response = self.client.post(
            reverse("dietician-entitlements"),
            {
                "customer": self.customer.pk,
                "product": self.product.pk,
                "starts_at": timezone.now().isoformat(),
                "source": "MANUAL",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        notification = Notification.objects.get(user=self.customer)

        self.assertEqual(notification.category, Category.SUBSCRIPTION)
        self.assertEqual(mocked_send.call_count, 1)
