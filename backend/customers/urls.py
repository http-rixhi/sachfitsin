from django.urls import path

from .views import (
    DieticianCustomerDetailView,
    DieticianCustomerListView,
    MyCustomerProfileView,
)


urlpatterns = [
    path(
        "me/",
        MyCustomerProfileView.as_view(),
        name="my-customer-profile",
    ),
    path(
        "manage/",
        DieticianCustomerListView.as_view(),
        name="dietician-customer-list",
    ),
    path(
        "manage/<int:pk>/",
        DieticianCustomerDetailView.as_view(),
        name="dietician-customer-detail",
    ),
]