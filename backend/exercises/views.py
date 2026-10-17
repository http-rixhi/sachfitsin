from rest_framework import generics

from notifications import events
from subscriptions.features import Feature
from subscriptions.permissions import HasEntitlement

from .models import Exercise, ExerciseRecommendation
from .permissions import IsCustomer, IsDietician
from .serializers import (
    ExerciseRecommendationSerializer,
    ExerciseSerializer,
)


class MyExerciseRecommendationListView(
    generics.ListAPIView
):
    serializer_class = ExerciseRecommendationSerializer

    permission_classes = [
        IsCustomer,
        HasEntitlement,
    ]

    required_feature = Feature.EXERCISE_ROUTINES

    def get_queryset(self):
        return (
            ExerciseRecommendation.objects
            .filter(
                customer=self.request.user,
                status=ExerciseRecommendation.Status.ACTIVE,
            )
            .select_related(
                "exercise",
                "customer",
                "recommended_by",
            )
            .order_by("-created_at")
        )





class DieticianExerciseRecommendationListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = ExerciseRecommendationSerializer
    permission_classes = [IsDietician]

    def get_queryset(self):
        queryset = (
            ExerciseRecommendation.objects
            .select_related(
                "exercise",
                "customer",
                "recommended_by",
            )
            .order_by("-created_at")
        )

        customer_id = self.request.query_params.get(
            "customer"
        )

        if customer_id:
            queryset = queryset.filter(
                customer_id=customer_id
            )

        return queryset

    def perform_create(self, serializer):
        recommendation = serializer.save(
            recommended_by=self.request.user
        )

        events.exercise_assigned(recommendation)


class DieticianExerciseRecommendationDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = ExerciseRecommendationSerializer
    permission_classes = [IsDietician]

    queryset = (
        ExerciseRecommendation.objects
        .select_related(
            "exercise",
            "customer",
            "recommended_by",
        )
    )


class ExerciseLibraryListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = ExerciseSerializer
    permission_classes = [IsDietician]

    def get_queryset(self):
        return Exercise.objects.order_by("name")

class ExerciseLibraryDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = ExerciseSerializer
    permission_classes = [IsDietician]

    queryset = Exercise.objects.all()