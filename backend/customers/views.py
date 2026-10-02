from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from customers.permissions import IsCustomer

from .models import CustomerProfile
from .serializers import CustomerProfileSerializer


class MyCustomerProfileView(APIView):
    # The role check used to be written by hand inside each method, which
    # returned a bare {"detail": ...} instead of the standard error shape.
    permission_classes = [IsAuthenticated, IsCustomer]

    def get(self, request):
        profile, _ = CustomerProfile.objects.get_or_create(
            user=request.user
        )

        serializer = CustomerProfileSerializer(profile)

        return Response(serializer.data)

    def put(self, request):
        return self._save_profile(request)

    def patch(self, request):
        return self._save_profile(request)

    def _save_profile(self, request):
        profile, _ = CustomerProfile.objects.get_or_create(
            user=request.user
        )

        serializer = CustomerProfileSerializer(
            profile,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)




from rest_framework import generics
from .permissions import IsDietician
from .serializers import (
    DieticianCustomerDetailSerializer,
    DieticianCustomerListSerializer,
)


class DieticianCustomerListView(generics.ListAPIView):
    serializer_class = DieticianCustomerListSerializer
    permission_classes = [IsDietician]

    def get_queryset(self):
        return (
            User.objects
            .filter(role=User.Role.CUSTOMER)
            .order_by("-created_at")
        )


class DieticianCustomerDetailView(generics.RetrieveAPIView):
    serializer_class = DieticianCustomerDetailSerializer
    permission_classes = [IsDietician]

    def get_queryset(self):
        return (
            User.objects
            .filter(role=User.Role.CUSTOMER)
            .select_related("customer_profile")
        )