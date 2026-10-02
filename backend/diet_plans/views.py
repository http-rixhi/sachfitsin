from rest_framework import generics

from rest_framework.permissions import IsAuthenticated

from .models import DietPlan
from .permissions import IsDietician
from .serializers import DietPlanSerializer

from accounts.models import User
from notifications import events


class CustomerDietPlanListView(generics.ListAPIView):
    serializer_class = DietPlanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role != User.Role.CUSTOMER:
            return DietPlan.objects.none()

        return (
            DietPlan.objects
            .filter(customer=self.request.user)
            .select_related("customer", "created_by")
            .order_by("-created_at")
        )


class CustomerActiveDietPlanView(generics.RetrieveAPIView):
    serializer_class = DietPlanSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return (
            DietPlan.objects
            .filter(
                customer=self.request.user,
                status=DietPlan.Status.ACTIVE,
            )
            .select_related("customer", "created_by")
            .first()
        )

    def get(self, request, *args, **kwargs):
        plan = self.get_object()

        if not plan:
            from rest_framework.response import Response

            return Response(
                {"detail": "No active diet plan found."},
                status=404,
            )

        serializer = self.get_serializer(plan)

        return Response(serializer.data)


class DieticianDietPlanListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = DietPlanSerializer
    permission_classes = [IsDietician]

    def get_queryset(self):
        return (
            DietPlan.objects
            .filter(created_by=self.request.user)
            .select_related("customer", "created_by")
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        plan = serializer.save(created_by=self.request.user)

        events.diet_plan_created(plan)


class DieticianDietPlanDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = DietPlanSerializer
    permission_classes = [IsDietician]

    def perform_update(self, serializer):
        plan = serializer.save()

        events.diet_plan_updated(plan)

    def get_queryset(self):
        return (
            DietPlan.objects
            .filter(created_by=self.request.user)
            .select_related("customer", "created_by")
        )