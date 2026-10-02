from django.urls import path

from .views import (
    PublicVideoListView,
    MyPersonalizedVideoListView,
    DieticianVideoLibraryListCreateView,
    DieticianVideoLibraryDetailView,
    DieticianPersonalizedVideoListCreateView,
    DieticianPersonalizedVideoDetailView,
)

urlpatterns = [
    # Customer
    path(
        "public/",
        PublicVideoListView.as_view(),
        name="public-videos",
    ),
    path(
        "my/",
        MyPersonalizedVideoListView.as_view(),
        name="my-personalized-videos",
    ),

    # Dietician - video library
    path(
        "manage/library/",
        DieticianVideoLibraryListCreateView.as_view(),
        name="dietician-video-library",
    ),
    path(
        "manage/library/<int:pk>/",
        DieticianVideoLibraryDetailView.as_view(),
        name="dietician-video-library-detail",
    ),

    # Dietician - personalized videos
    path(
        "manage/personalized/",
        DieticianPersonalizedVideoListCreateView.as_view(),
        name="dietician-personalized-videos",
    ),
    path(
        "manage/personalized/<int:pk>/",
        DieticianPersonalizedVideoDetailView.as_view(),
        name="dietician-personalized-video-detail",
    ),
]