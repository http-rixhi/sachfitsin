from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer
from .services import mark_all_read, unread_count

# Hard cap so a long-lived account cannot return thousands of rows at once.
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 20


class NotificationQuerysetMixin:
    """
    Every view here is scoped to ``request.user``.

    This is the only thing standing between one customer and another
    customer's notifications, so it lives in one place rather than being
    repeated per view.
    """

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class NotificationListView(NotificationQuerysetMixin, generics.ListAPIView):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        unread_only = self.request.query_params.get("unread")

        if unread_only in ("1", "true", "True"):
            queryset = queryset.filter(is_read=False)

        category = self.request.query_params.get("category")

        if category:
            queryset = queryset.filter(category=category.upper())

        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()

        try:
            limit = int(request.query_params.get("limit", DEFAULT_PAGE_SIZE))
        except (TypeError, ValueError):
            limit = DEFAULT_PAGE_SIZE

        limit = max(1, min(limit, MAX_PAGE_SIZE))

        serializer = self.get_serializer(queryset[:limit], many=True)

        return Response(
            {
                "results": serializer.data,
                "unread_count": unread_count(request.user),
                "total": queryset.count(),
            }
        )


class NotificationDetailView(
    NotificationQuerysetMixin,
    generics.RetrieveDestroyAPIView,
):
    serializer_class = NotificationSerializer


class UnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"unread_count": unread_count(request.user)})


class MarkNotificationReadView(NotificationQuerysetMixin, APIView):
    def post(self, request, pk):
        notification = self.get_queryset().filter(pk=pk).first()

        if not notification:
            return Response(
                {"detail": "Notification not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        notification.mark_read()

        return Response(
            {
                "notification": NotificationSerializer(notification).data,
                "unread_count": unread_count(request.user),
            }
        )


class MarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated = mark_all_read(request.user)

        return Response({"updated": updated, "unread_count": 0})
