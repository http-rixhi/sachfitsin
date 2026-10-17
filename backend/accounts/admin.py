from django.contrib import admin

from .models import PendingSignup


@admin.register(PendingSignup)
class PendingSignupAdmin(admin.ModelAdmin):
    """
    Sign-ups waiting on their emailed code.

    Read only on purpose. Editing a row here cannot help anyone: the
    password and the code are both stored hashed, so there is nothing
    useful to change, and an edit could only break a sign-up in progress.
    Rows disappear by themselves once verified or expired.
    """

    list_display = (
        "email",
        "username",
        "attempts",
        "created_at",
        "expires_at",
        "is_expired",
    )
    search_fields = ("email", "username")
    ordering = ("-created_at",)

    readonly_fields = (
        "username",
        "email",
        "first_name",
        "last_name",
        "attempts",
        "created_at",
        "expires_at",
        "last_sent_at",
    )

    # Neither hash is listed above, so they never reach a browser.
    fields = readonly_fields

    @admin.display(boolean=True, description="Expired")
    def is_expired(self, obj):
        return obj.is_expired

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
