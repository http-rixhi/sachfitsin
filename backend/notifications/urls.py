from django.urls import path

from .views import (
    MarkAllReadView,
    MarkNotificationReadView,
    NotificationDetailView,
    NotificationListView,
    UnreadCountView,
)


urlpatterns = [
    path(
        "",
        NotificationListView.as_view(),
        name="notification-list",
    ),
    path(
        "unread-count/",
        UnreadCountView.as_view(),
        name="notification-unread-count",
    ),
    path(
        "read-all/",
        MarkAllReadView.as_view(),
        name="notification-read-all",
    ),
    path(
        "<int:pk>/",
        NotificationDetailView.as_view(),
        name="notification-detail",
    ),
    path(
        "<int:pk>/read/",
        MarkNotificationReadView.as_view(),
        name="notification-mark-read",
    ),
]
