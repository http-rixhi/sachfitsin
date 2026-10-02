from django.contrib import admin
from django.urls import include, path


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("api.urls")),
]

# Keep API responses as JSON even when Django, not DRF, handles the error.
handler404 = "api.handlers.not_found"
handler500 = "api.handlers.server_error"
