from django.urls import path

from .views import (
    CalendlySyncView,
    DieticianAppointmentCancelView,
    CustomerAppointmentConfirmView,
    CustomerAppointmentListCreateView,
    DieticianAppointmentDetailView,
    DieticianAppointmentListView,
    CalendlyWebhookView,
)


urlpatterns = [
    path(
        "my/",
        CustomerAppointmentListCreateView.as_view(),
        name="customer-appointments",
    ),
    path(
        "my/<int:pk>/confirm/",
        CustomerAppointmentConfirmView.as_view(),
        name="customer-appointment-confirm",
    ),
    path(
        "manage/",
        DieticianAppointmentListView.as_view(),
        name="dietician-appointments",
    ),
    path(
        "manage/<int:pk>/",
        DieticianAppointmentDetailView.as_view(),
        name="dietician-appointment-detail",
    ),
    path(
        "manage/<int:pk>/cancel/",
        DieticianAppointmentCancelView.as_view(),
        name="dietician-appointment-cancel",
    ),
    path(
        "webhooks/calendly/",
        CalendlyWebhookView.as_view(),
        name="calendly-webhook",
    ),
    path(
        "sync-calendly/",
        CalendlySyncView.as_view(),
        name="sync-calendly",
    ),
]