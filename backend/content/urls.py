from django.urls import path

from .views import (
    PublicContentListView,
    PublicContentDetailView,
    DieticianContentListCreateView,
    DieticianContentDetailView,
)


urlpatterns = [
    path(
        "public/",
        PublicContentListView.as_view(),
        name="public-content-list",
    ),
    path(
        "public/<slug:slug>/",
        PublicContentDetailView.as_view(),
        name="public-content-detail",
    ),
    path(
        "manage/",
        DieticianContentListCreateView.as_view(),
        name="dietician-content-list-create",
    ),
    path(
        "manage/<int:pk>/",
        DieticianContentDetailView.as_view(),
        name="dietician-content-detail",
    ),
]
