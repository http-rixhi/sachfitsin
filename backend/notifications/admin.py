from django.contrib import admin

from .models import EmailLog, Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "user",
        "category",
        "is_read",
        "created_at",
    )
    list_filter = ("category", "is_read", "created_at")
    search_fields = ("title", "body", "user__username", "user__email")
    readonly_fields = ("created_at", "read_at")
    date_hierarchy = "created_at"


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = (
        "to_email",
        "subject",
        "template",
        "status",
        "created_at",
    )
    list_filter = ("status", "template", "created_at")
    search_fields = ("to_email", "subject", "dedupe_key", "provider_message_id")
    readonly_fields = tuple(
        field.name for field in EmailLog._meta.fields
    )
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
