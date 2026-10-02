from rest_framework import serializers

from .models import Content


class PublicContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Content
        fields = [
            "id",
            "title",
            "slug",
            "excerpt",
            "body",
            "content_type",
            "cover_image_url",
            "published_at",
            "created_at",
            "updated_at",
        ]


class DieticianContentSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True,
    )

    class Meta:
        model = Content
        fields = [
            "id",
            "title",
            "slug",
            "excerpt",
            "body",
            "content_type",
            "cover_image_url",
            "is_public",
            "is_active",
            "published_at",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        ]

    def validate_slug(self, value):
        queryset = Content.objects.filter(slug=value)

        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError(
                "A content item with this slug already exists."
            )

        return value