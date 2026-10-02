from django.urls import path

from .views import (
    DieticianProductDetailView,
    DieticianProductListCreateView,
    ProductListView,
)


urlpatterns = [
    path(
        "",
        ProductListView.as_view(),
        name="product-list",
    ),
    path(
        "manage/",
        DieticianProductListCreateView.as_view(),
        name="dietician-products",
    ),
    path(
        "manage/<int:pk>/",
        DieticianProductDetailView.as_view(),
        name="dietician-product-detail",
    ),
]
