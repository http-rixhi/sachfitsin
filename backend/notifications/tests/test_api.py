from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from notifications.models import Category, Notification

User = get_user_model()


class NotificationApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="rishi",
            email="rishi@example.com",
            password="password123",
        )

        self.other_user = User.objects.create_user(
            username="someone",
            email="someone@example.com",
            password="password123",
        )

        self.mine = Notification.objects.create(
            user=self.user,
            title="A new video for you",
            category=Category.VIDEO,
            link="/dashboard/videos",
        )

        self.read_one = Notification.objects.create(
            user=self.user,
            title="Welcome",
            category=Category.ACCOUNT,
            is_read=True,
        )

        self.theirs = Notification.objects.create(
            user=self.other_user,
            title="Not yours",
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.user)

    # -- security ---------------------------------------------------------

    def test_list_requires_authentication(self):
        response = self.client.get(reverse("notification-list"))

        self.assertEqual(response.status_code, 401)

    def test_list_only_returns_my_notifications(self):
        self.authenticate()

        response = self.client.get(reverse("notification-list"))

        titles = [item["title"] for item in response.data["results"]]

        self.assertIn("A new video for you", titles)
        self.assertNotIn("Not yours", titles)

    def test_cannot_read_another_users_notification(self):
        self.authenticate()

        response = self.client.post(
            reverse(
                "notification-mark-read",
                kwargs={"pk": self.theirs.pk},
            )
        )

        self.assertEqual(response.status_code, 404)

        self.theirs.refresh_from_db()
        self.assertFalse(self.theirs.is_read)

    def test_cannot_delete_another_users_notification(self):
        self.authenticate()

        response = self.client.delete(
            reverse(
                "notification-detail",
                kwargs={"pk": self.theirs.pk},
            )
        )

        self.assertEqual(response.status_code, 404)
        self.assertTrue(
            Notification.objects.filter(pk=self.theirs.pk).exists()
        )

    def test_mark_all_read_does_not_touch_other_users(self):
        self.authenticate()

        self.client.post(reverse("notification-read-all"))

        self.theirs.refresh_from_db()
        self.assertFalse(self.theirs.is_read)

    # -- behaviour --------------------------------------------------------

    def test_unread_count(self):
        self.authenticate()

        response = self.client.get(reverse("notification-unread-count"))

        self.assertEqual(response.data["unread_count"], 1)

    def test_unread_filter(self):
        self.authenticate()

        response = self.client.get(
            reverse("notification-list"), {"unread": "1"}
        )

        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(
            response.data["results"][0]["title"], "A new video for you"
        )

    def test_category_filter(self):
        self.authenticate()

        response = self.client.get(
            reverse("notification-list"), {"category": "video"}
        )

        self.assertEqual(len(response.data["results"]), 1)

    def test_mark_one_read(self):
        self.authenticate()

        response = self.client.post(
            reverse(
                "notification-mark-read", kwargs={"pk": self.mine.pk}
            )
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["notification"]["is_read"])
        self.assertEqual(response.data["unread_count"], 0)

        self.mine.refresh_from_db()
        self.assertTrue(self.mine.is_read)
        self.assertIsNotNone(self.mine.read_at)

    def test_mark_all_read(self):
        self.authenticate()

        response = self.client.post(reverse("notification-read-all"))

        self.assertEqual(response.data["updated"], 1)
        self.assertEqual(response.data["unread_count"], 0)

        self.assertFalse(
            Notification.objects.filter(
                user=self.user, is_read=False
            ).exists()
        )

    def test_limit_is_capped(self):
        Notification.objects.bulk_create(
            Notification(user=self.user, title=f"N{index}")
            for index in range(150)
        )

        self.authenticate()

        response = self.client.get(
            reverse("notification-list"), {"limit": "500"}
        )

        self.assertEqual(len(response.data["results"]), 100)

    def test_bad_limit_falls_back_to_default(self):
        self.authenticate()

        response = self.client.get(
            reverse("notification-list"), {"limit": "abc"}
        )

        self.assertEqual(response.status_code, 200)

    def test_delete_my_own_notification(self):
        self.authenticate()

        response = self.client.delete(
            reverse("notification-detail", kwargs={"pk": self.mine.pk})
        )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(
            Notification.objects.filter(pk=self.mine.pk).exists()
        )
