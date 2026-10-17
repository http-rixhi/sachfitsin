"""
Step 11J — deliberately attempt unauthorized access.

Two customers and a dietician exist. Customer A tries to reach everything
belonging to Customer B, and an anonymous caller tries to reach everything.
Nothing here is mocked: these are real requests to real endpoints.
"""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from appointments.models import Appointment
from diet_plans.models import DietPlan
from notifications.models import Notification
from products.models import Product
from subscriptions.models import Entitlement
from tracking.models import CalorieEntry, WaterEntry
from videos.models import PersonalizedVideo, Video

User = get_user_model()


class SecurityFixture(APITestCase):
    def setUp(self):
        from django.core.cache import cache

        # Throttle counters live in the cache, so without this a test that
        # registers users inherits the previous test's budget.
        cache.clear()
        self.addCleanup(cache.clear)

        self.victim = User.objects.create_user(
            username="victim",
            email="victim@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

        self.attacker = User.objects.create_user(
            username="attacker",
            email="attacker@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

        self.dietician = User.objects.create_user(
            username="doc",
            email="doc@example.com",
            password="password123",
            role=User.Role.DIETICIAN,
        )

        # Everything below belongs to the victim.
        self.plan = DietPlan.objects.create(
            customer=self.victim,
            created_by=self.dietician,
            title="Victim's plan",
        )

        self.appointment = Appointment.objects.create(
            customer=self.victim,
            reason="Victim's appointment",
        )

        self.notification = Notification.objects.create(
            user=self.victim,
            title="Victim's notification",
        )

        self.calorie_entry = CalorieEntry.objects.create(
            customer=self.victim,
            date=timezone.now().date(),
            meal_type="BREAKFAST",
            food_name="Victim's oats",
            calories=300,
        )

        self.water_entry = WaterEntry.objects.create(
            customer=self.victim,
            date=timezone.now().date(),
            amount_ml=250,
        )

        video = Video.objects.create(
            title="Private video",
            video_url="https://youtu.be/x",
            is_public=False,
        )

        self.personalized_video = PersonalizedVideo.objects.create(
            customer=self.victim,
            video=video,
        )

        self.product = Product.objects.create(
            code="PERSONALIZED_VIDEOS",
            name="Personalized Videos",
            status="ACTIVE",
        )

        self.entitlement = Entitlement.objects.create(
            customer=self.victim,
            product=self.product,
            status=Entitlement.Status.ACTIVE,
            starts_at=timezone.now(),
        )

    def as_attacker(self):
        self.client.force_authenticate(user=self.attacker)

    def as_dietician(self):
        self.client.force_authenticate(user=self.dietician)


class AnonymousAccessTests(SecurityFixture):
    """Nothing private may be reachable without logging in."""

    def test_private_endpoints_all_require_a_login(self):
        private = [
            reverse("my-customer-profile"),
            reverse("customer-appointments"),
            reverse("notification-list"),
            reverse("my-exercise-recommendations"),
            reverse("my-personalized-videos"),
            reverse("customer-diet-plans"),
            reverse("dietician-customer-list"),
            reverse("dietician-appointments"),
            reverse("exercise-library"),
            reverse("dietician-video-library"),
            reverse("dietician-content-list-create"),
        ]

        for url in private:
            with self.subTest(url=url):
                response = self.client.get(url)

                self.assertEqual(
                    response.status_code,
                    401,
                    f"{url} was reachable without a login",
                )

    def test_public_endpoints_stay_public(self):
        for url in [
            reverse("health-check"),
            reverse("public-content-list"),
            reverse("public-videos"),
        ]:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_private_videos_are_not_in_the_public_list(self):
        response = self.client.get(reverse("public-videos"))

        titles = [item["title"] for item in response.data]

        self.assertNotIn("Private video", titles)


class CustomerCannotReachAdminTests(SecurityFixture):
    """11D — a customer must not reach the dietician's side."""

    def test_admin_endpoints_are_closed_to_customers(self):
        self.as_attacker()

        admin_urls = [
            reverse("dietician-customer-list"),
            reverse("dietician-appointments"),
            reverse("dietician-diet-plans"),
            reverse("exercise-library"),
            reverse("exercise-recommendations-manage"),
            reverse("dietician-video-library"),
            reverse("dietician-personalized-videos"),
            reverse("dietician-content-list-create"),
            reverse("dietician-entitlements"),
        ]

        for url in admin_urls:
            with self.subTest(url=url):
                response = self.client.get(url)

                self.assertEqual(
                    response.status_code,
                    403,
                    f"{url} was reachable by a customer",
                )

    def test_customer_cannot_read_another_customers_record(self):
        self.as_attacker()

        response = self.client.get(
            reverse(
                "dietician-customer-detail",
                kwargs={"pk": self.victim.pk},
            )
        )

        self.assertEqual(response.status_code, 403)

    def test_customer_cannot_grant_themselves_an_entitlement(self):
        self.as_attacker()

        response = self.client.post(
            reverse("dietician-entitlements"),
            {
                "customer": self.attacker.pk,
                "product": self.product.pk,
                "starts_at": timezone.now().isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(
            Entitlement.objects.filter(customer=self.attacker).exists()
        )


class CustomerCannotReachAnotherCustomerTests(SecurityFixture):
    """11E — object-level checks, one resource at a time."""

    def test_diet_plans(self):
        self.as_attacker()

        response = self.client.get(reverse("customer-diet-plans"))

        titles = [item["title"] for item in response.data]

        self.assertNotIn("Victim's plan", titles)

    def test_appointments(self):
        self.as_attacker()

        response = self.client.get(reverse("customer-appointments"))

        reasons = [item["reason"] for item in response.data]

        self.assertNotIn("Victim's appointment", reasons)

    def test_cannot_confirm_another_customers_appointment(self):
        self.as_attacker()

        response = self.client.post(
            reverse(
                "customer-appointment-confirm",
                kwargs={"pk": self.appointment.pk},
            ),
            {"event_uri": "https://api.calendly.com/scheduled_events/EV1"},
            format="json",
        )

        self.assertEqual(response.status_code, 404)

    def test_notifications(self):
        self.as_attacker()

        response = self.client.get(reverse("notification-list"))

        titles = [
            item["title"] for item in response.data["results"]
        ]

        self.assertNotIn("Victim's notification", titles)

    def test_cannot_mark_another_customers_notification_read(self):
        self.as_attacker()

        response = self.client.post(
            reverse(
                "notification-mark-read",
                kwargs={"pk": self.notification.pk},
            )
        )

        self.assertEqual(response.status_code, 404)

        self.notification.refresh_from_db()
        self.assertFalse(self.notification.is_read)

    def test_calorie_entries(self):
        self.as_attacker()

        response = self.client.get(reverse("my-calorie-entries"))

        names = [item["food_name"] for item in response.data]

        self.assertNotIn("Victim's oats", names)

    def test_cannot_edit_another_customers_calorie_entry(self):
        self.as_attacker()

        response = self.client.patch(
            reverse(
                "my-calorie-entry-detail",
                kwargs={"pk": self.calorie_entry.pk},
            ),
            {"calories": 1},
            format="json",
        )

        self.assertEqual(response.status_code, 404)

        self.calorie_entry.refresh_from_db()
        self.assertEqual(self.calorie_entry.calories, 300)

    def test_cannot_delete_another_customers_water_entry(self):
        self.as_attacker()

        response = self.client.delete(
            reverse(
                "my-water-entry-detail",
                kwargs={"pk": self.water_entry.pk},
            )
        )

        self.assertEqual(response.status_code, 404)
        self.assertTrue(
            WaterEntry.objects.filter(pk=self.water_entry.pk).exists()
        )

    def test_water_summary_is_the_callers_own(self):
        self.as_attacker()

        response = self.client.get(reverse("my-water-summary"))

        self.assertEqual(response.data["total_water_ml"], 0)

    def test_calorie_summary_is_the_callers_own(self):
        self.as_attacker()

        response = self.client.get(reverse("my-calorie-summary"))

        self.assertEqual(response.data["calories_consumed"], 0)

    def test_profile_is_the_callers_own(self):
        self.as_attacker()

        response = self.client.get(reverse("my-customer-profile"))

        self.assertEqual(response.status_code, 200)

        # A fresh, empty profile for the attacker, not the victim's.
        self.assertEqual(response.data["phone_number"], "")

    def test_entitlements_are_the_callers_own(self):
        self.as_attacker()

        response = self.client.get(reverse("my-entitlements"))

        self.assertEqual(len(response.data), 0)

    def test_personalized_videos_need_the_callers_own_entitlement(self):
        """The victim's entitlement must not unlock the attacker's account."""

        self.as_attacker()

        response = self.client.get(reverse("my-personalized-videos"))

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json()["error"]["code"], "entitlement_required"
        )


class DieticianCannotBeImpersonatedTests(SecurityFixture):
    """A customer must not be able to promote themselves."""

    @patch("notifications.email.service.client.send", return_value="msg_1")
    def test_role_cannot_be_set_at_registration(self, mocked_send):
        # Sign-up is two steps, so the attempt is made at BOTH: once in
        # the details held for verification, and again when the code is
        # redeemed. Neither may produce a dietician.
        start = self.client.post(
            reverse("register"),
            {
                "username": "sneaky",
                "email": "sneaky@example.com",
                "password": "password123",
                "role": "DIETICIAN",
            },
            format="json",
        )

        self.assertEqual(start.status_code, 202)
        self.assertFalse(User.objects.filter(username="sneaky").exists())

        text = mocked_send.call_args.kwargs["text"]
        code = next(
            token
            for token in text.replace("\n", " ").split()
            if token.isdigit() and len(token) == 6
        )

        response = self.client.post(
            reverse("verify-email"),
            {
                "email": "sneaky@example.com",
                "code": code,
                "role": "DIETICIAN",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        self.assertEqual(
            User.objects.get(username="sneaky").role,
            User.Role.CUSTOMER,
        )

    def test_role_is_read_only_on_the_profile_endpoint(self):
        self.as_attacker()

        self.client.patch(
            reverse("my-customer-profile"),
            {"role": "DIETICIAN"},
            format="json",
        )

        self.attacker.refresh_from_db()
        self.assertEqual(self.attacker.role, User.Role.CUSTOMER)


class DieticianAccessTests(SecurityFixture):
    """The dietician's own access must keep working."""

    def test_dietician_can_read_customers(self):
        self.as_dietician()

        response = self.client.get(reverse("dietician-customer-list"))

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 2)

    def test_dietician_cannot_use_customer_endpoints(self):
        self.as_dietician()

        for url in [
            reverse("my-customer-profile"),
            reverse("my-calorie-entries"),
            reverse("my-water-entries"),
            reverse("my-exercise-recommendations"),
        ]:
            with self.subTest(url=url):
                self.assertEqual(
                    self.client.get(url).status_code,
                    403,
                    f"{url} should be customer-only",
                )


class TokenSecurityTests(SecurityFixture):
    """11C — token behaviour."""

    def test_token_from_one_user_cannot_act_as_another(self):
        from rest_framework_simplejwt.tokens import AccessToken

        token = AccessToken.for_user(self.attacker)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.get(reverse("notification-list"))

        titles = [
            item["title"] for item in response.data["results"]
        ]

        self.assertNotIn("Victim's notification", titles)

    def test_a_tampered_token_is_rejected(self):
        from rest_framework_simplejwt.tokens import AccessToken

        token = str(AccessToken.for_user(self.attacker))

        head, payload, signature = token.split(".")

        tampered = f"{head}.{payload}.{signature[:-4]}AAAA"

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tampered}")

        response = self.client.get(reverse("notification-list"))

        self.assertEqual(response.status_code, 401)

    def test_rotated_refresh_tokens_are_blacklisted(self):
        """
        BLACKLIST_AFTER_ROTATION only works when the token_blacklist app is
        installed. It was configured but not installed, so an old refresh
        token stayed valid for its full 7 days after rotation.
        """

        login = self.client.post(
            reverse("login"),
            {"username": "attacker", "password": "password123"},
            format="json",
        )

        old_refresh = login.data["refresh"]

        first = self.client.post(
            reverse("refresh"),
            {"refresh": old_refresh},
            format="json",
        )

        self.assertEqual(first.status_code, 200)

        # Replaying the now-rotated token must fail.
        replay = self.client.post(
            reverse("refresh"),
            {"refresh": old_refresh},
            format="json",
        )

        self.assertEqual(
            replay.status_code,
            401,
            "an old refresh token was still accepted after rotation",
        )


class ThrottlingTests(APITestCase):
    """
    11H — password guessing must not be unlimited.

    These run against the REAL configured rates rather than overridden
    ones, so the test fails if the production limits are ever removed.
    """

    def setUp(self):
        from django.core.cache import cache

        # Throttle counters live in the cache and would otherwise leak
        # between tests.
        cache.clear()

        self.addCleanup(cache.clear)

        User.objects.create_user(
            username="target",
            email="target@example.com",
            password="password123",
            role=User.Role.CUSTOMER,
        )

    def login_rate_limit(self) -> int:
        from rest_framework.settings import api_settings

        rate = api_settings.DEFAULT_THROTTLE_RATES["login"]

        return int(rate.split("/")[0])

    def test_repeated_login_attempts_are_blocked(self):
        limit = self.login_rate_limit()

        statuses = []

        for _ in range(limit + 2):
            response = self.client.post(
                reverse("login"),
                {"username": "target", "password": "wrong"},
                format="json",
            )

            statuses.append(response.status_code)

        self.assertIn(
            429,
            statuses,
            f"login was never throttled after {limit + 2} attempts",
        )

    def test_the_throttled_response_uses_the_standard_shape(self):
        limit = self.login_rate_limit()

        for _ in range(limit + 2):
            response = self.client.post(
                reverse("login"),
                {"username": "target", "password": "wrong"},
                format="json",
            )

            if response.status_code == 429:
                body = response.json()

                self.assertEqual(body["error"]["code"], "throttled")
                self.assertEqual(body["error"]["status"], 429)
                return

        self.fail("login was never throttled")

    def test_throttling_does_not_block_a_correct_password(self):
        """A few wrong tries must not lock out the real user."""

        for _ in range(3):
            self.client.post(
                reverse("login"),
                {"username": "target", "password": "wrong"},
                format="json",
            )

        response = self.client.post(
            reverse("login"),
            {"username": "target", "password": "password123"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)

    def test_registration_is_rate_limited(self):
        from rest_framework.settings import api_settings

        limit = int(
            api_settings.DEFAULT_THROTTLE_RATES["register"].split("/")[0]
        )

        statuses = []

        for index in range(limit + 2):
            response = self.client.post(
                reverse("register"),
                {
                    "username": f"spam{index}",
                    "email": f"spam{index}@example.com",
                    "password": "password123",
                },
                format="json",
            )

            statuses.append(response.status_code)

        self.assertIn(
            429,
            statuses,
            f"registration was never throttled: {statuses}",
        )


class SecretsConfigurationTests(TestCase):
    """11G — configuration mistakes that should fail loudly."""

    def test_calendly_sync_rejects_a_wrong_secret(self):
        response = self.client.post(
            reverse("sync-calendly"),
            HTTP_X_CALENDLY_SYNC_SECRET="wrong",
        )

        self.assertEqual(response.status_code, 401)

    def test_calendly_sync_rejects_a_missing_secret(self):
        response = self.client.post(reverse("sync-calendly"))

        self.assertEqual(response.status_code, 401)

    def test_an_unset_server_secret_does_not_allow_everyone_in(self):
        from unittest.mock import patch

        with patch("appointments.views.config", return_value=""):
            response = self.client.post(
                reverse("sync-calendly"),
                HTTP_X_CALENDLY_SYNC_SECRET="",
            )

        self.assertEqual(response.status_code, 401)
