from django.urls import path

from .views import (
    CreatePaymentOrderView,
    MyPaymentsView,
    RazorpayWebhookView,
    VerifyPaymentView,
)


urlpatterns = [
    path(
        "create-order/",
        CreatePaymentOrderView.as_view(),
        name="create-payment-order",
    ),
    path(
        "verify/",
        VerifyPaymentView.as_view(),
        name="verify-payment",
    ),
    path(
        "my/",
        MyPaymentsView.as_view(),
        name="my-payments",
    ),
    path(
        "webhook/",
        RazorpayWebhookView.as_view(),
        name="razorpay-webhook",
    ),
]
