from django.db import transaction
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from api.exceptions import (
    InvalidSignupCode,
    ResendTooSoon,
    SignupNotStarted,
    VerificationEmailFailed,
)
from notifications import events

from . import otp, services
from .models import PendingSignup
from .serializers import (
    ResendCodeSerializer,
    SignupRequestSerializer,
    UserSerializer,
    VerifyCodeSerializer,
    create_user_from_pending,
    hash_password,
)


class RegisterView(APIView):
    """
    Step one of sign-up: hold the details and email a code.

    No account exists after this call. ``POST /auth/verify-email/`` with
    the code is what creates it.
    """

    permission_classes = [AllowAny]

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

    def post(self, request):
        serializer = SignupRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        pending, code = services.start_signup(
            username=data["username"],
            email=data["email"],
            password_hash=hash_password(data["password"]),
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
        )

        if not services.send_signup_code(pending, code):
            # Nothing to type in, so do not leave a half-finished attempt
            # behind blocking a retry with the same address.
            pending.delete()
            raise VerificationEmailFailed

        return Response(
            {
                "detail": "We sent a code to your email.",
                "email": pending.email,
                "expires_in": otp.ttl_seconds(),
            },
            status=status.HTTP_202_ACCEPTED,
        )


class VerifyEmailView(APIView):
    """Step two: prove the address, and the account is created."""

    permission_classes = [AllowAny]

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "verify_email"

    def post(self, request):
        serializer = VerifyCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = self._consume_code(data["email"], data["code"])

        if user is None:
            # Raised OUT here, never inside _consume_code. Raising inside
            # an atomic block rolls it back, which would have thrown away
            # the attempts counter it had just incremented - so the five
            # guess limit would never have applied.
            raise InvalidSignupCode

        # The account is saved and committed by this point, and events
        # never raises, so a mail problem cannot undo the sign-up.
        events.user_registered(user)

        return Response(
            {
                "detail": "Your email is verified. You can log in now.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    @transaction.atomic
    def _consume_code(email, code):
        """
        Check one code and spend it.

        Returns the new user, or ``None`` when the code was wrong,
        expired, or the attempt had already been burned. Returning
        instead of raising is what lets the counter survive.
        """

        pending = (
            PendingSignup.objects.select_for_update()
            .filter(email__iexact=email)
            .first()
        )

        if pending is None:
            return None

        if pending.is_expired:
            pending.delete()
            return None

        if not otp.code_matches(code, pending.code_hash):
            pending.attempts += 1

            if pending.attempts >= otp.max_attempts():
                # Burn the whole attempt rather than letting a six digit
                # code be walked through one guess at a time.
                pending.delete()
            else:
                pending.save(update_fields=["attempts"])

            return None

        user = create_user_from_pending(pending)
        pending.delete()

        return user


class ResendCodeView(APIView):
    """A fresh code for an attempt already started."""

    permission_classes = [AllowAny]

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "verify_email"

    def post(self, request):
        serializer = ResendCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        pending = PendingSignup.objects.filter(email__iexact=email).first()

        if pending is None or pending.is_expired:
            if pending is not None:
                pending.delete()

            raise SignupNotStarted

        wait = otp.seconds_until_resend_allowed(pending.last_sent_at)

        if wait > 0:
            raise ResendTooSoon(
                f"Please wait {wait} more seconds before asking for "
                "another code."
            )

        code = services.reissue_code(pending)

        if not services.send_signup_code(pending, code):
            raise VerificationEmailFailed

        return Response(
            {
                "detail": "We sent a new code to your email.",
                "expires_in": otp.ttl_seconds(),
            },
            status=status.HTTP_202_ACCEPTED,
        )


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]

    # Without this, passwords can be guessed as fast as the network allows.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class RefreshTokenView(TokenRefreshView):
    permission_classes = [AllowAny]

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
