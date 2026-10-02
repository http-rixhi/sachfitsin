from django.utils import timezone

from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import Content
from .permissions import IsDietician
from .serializers import (
    PublicContentSerializer,
    DieticianContentSerializer,
)


class PublicContentListView(generics.ListAPIView):
    serializer_class = PublicContentSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Content.objects.filter(
            is_public=True,
            is_active=True,
        ).order_by("-published_at", "-created_at")


class PublicContentDetailView(generics.RetrieveAPIView):
    serializer_class = PublicContentSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return Content.objects.filter(
            is_public=True,
            is_active=True,
        )


class DieticianContentListCreateView(generics.ListCreateAPIView):
    serializer_class = DieticianContentSerializer
    permission_classes = [IsAuthenticated, IsDietician]

    def get_queryset(self):
        queryset = Content.objects.select_related("created_by").all()

        content_type = self.request.query_params.get("content_type")
        is_active = self.request.query_params.get("is_active")
        is_public = self.request.query_params.get("is_public")

        if content_type:
            queryset = queryset.filter(content_type=content_type)

        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")

        if is_public is not None:
            queryset = queryset.filter(is_public=is_public.lower() == "true")

        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            published_at=timezone.now(),
        )


class DieticianContentDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = DieticianContentSerializer
    permission_classes = [IsAuthenticated, IsDietician]

    def get_queryset(self):
        return Content.objects.select_related("created_by").all()