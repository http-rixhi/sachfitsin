from django.urls import include, path

from api.views import health_check


urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("auth/", include("accounts.urls")),
    path("customers/", include("customers.urls")),
    path("diet-plans/", include("diet_plans.urls")),
    path("appointments/", include("appointments.urls")),
    path("subscriptions/", include("subscriptions.urls")),
    path("exercises/", include("exercises.urls")),
    path("videos/", include("videos.urls")),
    path("tracking/", include("tracking.urls")),
    path("content/", include("content.urls")),
    path("notifications/", include("notifications.urls")),
    path("products/", include("products.urls")),
    path("payments/", include("payments.urls")),
]