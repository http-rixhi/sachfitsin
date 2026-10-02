from django.contrib import admin

from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "billing_type",
        "price",
        "duration_days",
        "status",
    )
    list_filter = ("status", "billing_type")
    search_fields = ("code", "name", "description")
    readonly_fields = ("created_at", "updated_at")
