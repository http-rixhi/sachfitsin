from django.urls import path

from .views import (
    CustomerActiveDietPlanView,
    CustomerDietPlanListView,
    DieticianDietPlanDetailView,
    DieticianDietPlanListCreateView,
)


urlpatterns = [
    # Customer endpoints
    path(
        "my-plans/",
        CustomerDietPlanListView.as_view(),
        name="customer-diet-plans",
    ),
    path(
        "my-plans/active/",
        CustomerActiveDietPlanView.as_view(),
        name="customer-active-diet-plan",
    ),

    # Dietician endpoints
    path(
        "manage/",
        DieticianDietPlanListCreateView.as_view(),
        name="dietician-diet-plans",
    ),
    path(
        "manage/<int:pk>/",
        DieticianDietPlanDetailView.as_view(),
        name="dietician-diet-plan-detail",
    ),
]