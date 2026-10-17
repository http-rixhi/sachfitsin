from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone


class User(AbstractUser):
    class Role(models.TextChoices):
        CUSTOMER = "CUSTOMER", "Customer"
        DIETICIAN = "DIETICIAN", "Dietician"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CUSTOMER,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta(AbstractUser.Meta):
        constraints = [
            # One account per address, ignoring case: Gmail treats
            # Rishi@ and rishi@ as the same inbox, so the database should
            # too. Blank is excluded because createsuperuser allows an
            # empty email, and several blanks must not collide.
            models.UniqueConstraint(
                Lower("email"),
                condition=~models.Q(email=""),
                name="unique_user_email_ci",
            ),
        ]

    def __str__(self):
        return self.username


class PendingSignup(models.Model):
    """
    A sign-up that has been started but not yet proved by email.

    The real ``User`` row is created only once the code is verified, so an
    abandoned sign-up never leaves an account behind and never squats a
    username.

    Neither the password nor the code is stored in the clear. Both are
    hashed, so a copy of this table is useless to whoever takes it.
    """

    username = models.CharField(max_length=150)
    email = models.EmailField()
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)

    # Already run through Django's hasher before it arrives here.
    password = models.CharField(max_length=128)

    code_hash = models.CharField(max_length=128)

    # Wrong guesses so far. The row is thrown away once this hits the
    # limit, so a six digit code cannot be walked through.
    attempts = models.PositiveSmallIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    # Used for the resend cooldown.
    last_sent_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            # Asking again for the same address replaces the previous
            # attempt rather than piling up rows.
            models.UniqueConstraint(
                Lower("email"),
                name="unique_pending_signup_email_ci",
            ),
        ]

    def __str__(self):
        return f"Pending signup - {self.email}"

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at
