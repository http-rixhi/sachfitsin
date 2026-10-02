from django.urls import path

from .views import (
    DieticianExerciseRecommendationDetailView,
    DieticianExerciseRecommendationListCreateView,
    ExerciseLibraryDetailView,
    ExerciseLibraryListCreateView,
    MyExerciseRecommendationListView,
)


urlpatterns = [
    path(
        "my/",
        MyExerciseRecommendationListView.as_view(),
        name="my-exercise-recommendations",
    ),

    path(
        "manage/library/",
        ExerciseLibraryListCreateView.as_view(),
        name="exercise-library",
    ),

    path(
        "manage/library/<int:pk>/",
        ExerciseLibraryDetailView.as_view(),
        name="exercise-library-detail",
    ),

    path(
        "manage/recommendations/",
        DieticianExerciseRecommendationListCreateView.as_view(),
        name="exercise-recommendations-manage",
    ),

    path(
        "manage/recommendations/<int:pk>/",
        DieticianExerciseRecommendationDetailView.as_view(),
        name="exercise-recommendation-detail",
    ),
]