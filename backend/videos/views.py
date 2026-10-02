from django.db.models import Q
from django.utils import timezone
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from notifications import events

from .models import Video, PersonalizedVideo
from .permissions import (
    IsCustomer,
    IsDietician,
    HasPersonalizedVideoEntitlement,
)
from .serializers import (
    VideoSerializer,
    PersonalizedVideoSerializer,
)


class PublicVideoListView(generics.ListAPIView):
    serializer_class = VideoSerializer
    permission_classes = []

    def get_queryset(self):
        return Video.objects.filter(
            is_public=True,
            is_active=True,
        ).order_by("-created_at")


class MyPersonalizedVideoListView(generics.ListAPIView):
    serializer_class = PersonalizedVideoSerializer
    permission_classes = [
        IsCustomer,
        HasPersonalizedVideoEntitlement,
    ]

    def get_queryset(self):
        now = timezone.now()

        return (
            PersonalizedVideo.objects
            .select_related("video", "customer")
            .filter(
                customer=self.request.user,
                status=PersonalizedVideo.Status.ACTIVE,
            )
            .filter(
                Q(starts_at__isnull=True) | Q(starts_at__lte=now)
            )
            .filter(
                Q(ends_at__isnull=True) | Q(ends_at__gte=now)
            )
            .order_by("-created_at")
        )


class DieticianVideoLibraryListCreateView(generics.ListCreateAPIView):
    serializer_class = VideoSerializer
    permission_classes = [IsAuthenticated, IsDietician]

    def get_queryset(self):
        return Video.objects.all().order_by("-created_at")


class DieticianVideoLibraryDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = VideoSerializer
    permission_classes = [IsAuthenticated, IsDietician]

    def get_queryset(self):
        return Video.objects.all()


class DieticianPersonalizedVideoListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = PersonalizedVideoSerializer
    permission_classes = [IsAuthenticated, IsDietician]

    def get_queryset(self):
        queryset = (
            PersonalizedVideo.objects
            .select_related("customer", "video")
            .all()
            .order_by("-created_at")
        )

        customer_id = self.request.query_params.get("customer")

        if customer_id:
            queryset = queryset.filter(
                customer_id=customer_id
            )

        return queryset

    def perform_create(self, serializer):
        assignment = serializer.save()

        events.personalized_video_assigned(assignment)


class DieticianPersonalizedVideoDetailView(
    generics.RetrieveUpdateAPIView
):
    serializer_class = PersonalizedVideoSerializer
    permission_classes = [IsAuthenticated, IsDietician]

    def get_queryset(self):
        return PersonalizedVideo.objects.select_related(
            "customer",
            "video",
        ).all()
