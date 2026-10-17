from django.urls import path

from .views import (
    LoginView,
    MeView,
    RefreshTokenView,
    RegisterView,
    ResendCodeView,
    VerifyEmailView,
)


urlpatterns = [
    # Sign-up is two steps. register/ emails a code and creates nothing;
    # verify-email/ is what actually creates the account.
    path("register/", RegisterView.as_view(), name="register"),
    path(
        "verify-email/",
        VerifyEmailView.as_view(),
        name="verify-email",
    ),
    path(
        "resend-code/",
        ResendCodeView.as_view(),
        name="resend-code",
    ),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshTokenView.as_view(), name="refresh"),
    path("me/", MeView.as_view(), name="me"),
]
