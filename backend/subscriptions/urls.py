from django.urls import path

from .views import (
    DieticianEntitlementDetailView,
    DieticianEntitlementListCreateView,
    DieticianEntitlementRevokeView,
    MyEntitlementListView,
    MySubscriptionListView,
)


urlpatterns = [
    path(
        "my/entitlements/",
        MyEntitlementListView.as_view(),
        name="my-entitlements",
    ),
    path(
        "my/subscriptions/",
        MySubscriptionListView.as_view(),
        name="my-subscriptions",
    ),
    path(
        "manage/entitlements/",
        DieticianEntitlementListCreateView.as_view(),
        name="dietician-entitlements",
    ),
    path(
        "manage/entitlements/<int:pk>/",
        DieticianEntitlementDetailView.as_view(),
        name="dietician-entitlement-detail",
    ),
    path(
        "manage/entitlements/<int:pk>/revoke/",
        DieticianEntitlementRevokeView.as_view(),
        name="dietician-entitlement-revoke",
    ),
]