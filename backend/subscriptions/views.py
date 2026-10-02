from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from notifications import events

from .models import Entitlement, Subscription
from .permissions import HasEntitlement, IsCustomer, IsDietician

from .serializers import (
    DieticianEntitlementCreateSerializer,
    DieticianEntitlementSerializer,
    EntitlementSerializer,
    SubscriptionSerializer,
)


class MyEntitlementListView(generics.ListAPIView):
    serializer_class = EntitlementSerializer
    permission_classes = [IsCustomer]

    def get_queryset(self):
        return (
            Entitlement.objects
            .filter(customer=self.request.user)
            .select_related("product")
            .order_by("-created_at")
        )


class MySubscriptionListView(generics.ListAPIView):
    serializer_class = SubscriptionSerializer
    permission_classes = [IsCustomer]

    def get_queryset(self):
        return (
            Subscription.objects
            .filter(customer=self.request.user)
            .select_related("product")
            .order_by("-created_at")
        )


class DieticianEntitlementListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsDietician]

    def get_queryset(self):
        queryset = (
            Entitlement.objects
            .select_related("customer", "product")
            .order_by("-created_at")
        )

        customer_id = self.request.query_params.get("customer")

        if customer_id:
            queryset = queryset.filter(
                customer_id=customer_id
            )

        return queryset

    def get_serializer_class(self):
        if self.request.method == "POST":
            return DieticianEntitlementCreateSerializer

        return DieticianEntitlementSerializer

    def perform_create(self, serializer):
        entitlement = serializer.save()

        events.entitlement_activated(entitlement)


class DieticianEntitlementDetailView(
    generics.RetrieveUpdateAPIView
):
    queryset = Entitlement.objects.select_related(
        "customer",
        "product",
    )
    permission_classes = [IsDietician]
    serializer_class = DieticianEntitlementSerializer


class DieticianEntitlementRevokeView(APIView):
    permission_classes = [IsDietician]

    def post(self, request, pk):
        try:
            entitlement = Entitlement.objects.get(pk=pk)
        except Entitlement.DoesNotExist:
            return Response(
                {"detail": "Entitlement not found."},
                status=404,
            )

        entitlement.status = Entitlement.Status.REVOKED
        entitlement.save(update_fields=["status", "updated_at"])

        return Response(
            {
                "status": "ok",
                "message": "Entitlement revoked successfully.",
            }
        )