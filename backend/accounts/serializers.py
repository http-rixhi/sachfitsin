from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from rest_framework import serializers

from .models import PendingSignup


User = get_user_model()


def _username_taken(username: str) -> bool:
    return User.objects.filter(username__iexact=username).exists()


def _email_taken(email: str) -> bool:
    return User.objects.filter(email__iexact=email).exists()


class SignupRequestSerializer(serializers.Serializer):
    """
    Step one: check the details and hold them until the code is proved.

    Deliberately not a ``ModelSerializer``. Nothing here creates a User —
    the row only appears once the emailed code comes back, so an abandoned
    sign-up leaves nothing behind.
    """

    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True
    )
    last_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True
    )

    def validate_username(self, value):
        value = value.strip()

        if _username_taken(value):
            raise serializers.ValidationError(
                "That username is already taken."
            )

        return value

    def validate_email(self, value):
        value = value.strip().lower()

        if _email_taken(value):
            raise serializers.ValidationError(
                "An account already uses that email address."
            )

        return value


class VerifyCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=12)

    def validate_email(self, value):
        return value.strip().lower()

    def validate_code(self, value):
        return value.strip()


class ResendCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()


def create_user_from_pending(pending: PendingSignup):
    """
    Turn a proved sign-up into a real account.

    The username and email are checked again here, not only at step one:
    minutes can pass between the two steps, and somebody else may have
    taken either in between.
    """

    if _username_taken(pending.username):
        raise serializers.ValidationError(
            {"username": ["That username was taken while you were away."]}
        )

    if _email_taken(pending.email):
        raise serializers.ValidationError(
            {"email": ["An account already uses that email address."]}
        )

    user = User(
        username=pending.username,
        email=pending.email,
        first_name=pending.first_name,
        last_name=pending.last_name,
        role=User.Role.CUSTOMER,
    )

    # Already hashed when the sign-up started, so it is copied across
    # rather than set again.
    user.password = pending.password
    user.save()

    return user


def hash_password(raw: str) -> str:
    return make_password(raw)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
        ]
        read_only_fields = [
            "id",
            "username",
            "email",
            "role",
        ]
