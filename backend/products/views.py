from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import Product
from .permissions import IsDietician
from .serializers import AdminProductSerializer, ProductSerializer


class ProductListView(generics.ListAPIView):
    """
    The products a customer can buy.

    Inactive products are never returned, so a discontinued plan cannot be
    bought by anyone who kept the old id.
    """

    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Product.objects.filter(
            status=Product.Status.ACTIVE,
        ).order_by("price")

        code = self.request.query_params.get("code")

        if code:
            queryset = queryset.filter(code=code.upper())

        return queryset


class DieticianProductListCreateView(generics.ListCreateAPIView):
    """Every plan, including inactive ones, for the dietician."""

    serializer_class = AdminProductSerializer
    permission_classes = [IsDietician]

    def get_queryset(self):
        return Product.objects.all().order_by("-status", "price")


class DieticianProductDetailView(generics.RetrieveUpdateAPIView):
    """
    Edit a plan.

    Deliberately no delete: a product is referenced by payments and
    entitlements, so removing it would break the record of what people
    bought. Set the status to Inactive instead, which hides it from
    customers while leaving history intact.
    """

    serializer_class = AdminProductSerializer
    permission_classes = [IsDietician]
    queryset = Product.objects.all()
