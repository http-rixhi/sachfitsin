from rest_framework import serializers

from .models import Video, PersonalizedVideo


class VideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Video
        fields = [
            "id",
            "title",
            "description",
            "category",
            "video_url",
            "thumbnail_url",
            "is_public",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class PersonalizedVideoSerializer(serializers.ModelSerializer):
    video_title = serializers.CharField(
        source="video.title",
        read_only=True,
    )
    video_url = serializers.URLField(
        source="video.video_url",
        read_only=True,
    )
    customer_username = serializers.CharField(
        source="customer.username",
        read_only=True,
    )

    class Meta:
        model = PersonalizedVideo
        fields = [
            "id",
            "customer",
            "customer_username",
            "video",
            "video_title",
            "video_url",
            "notes",
            "starts_at",
            "ends_at",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "customer_username",
            "video_title",
            "video_url",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        video = attrs.get("video")

        if video and not video.is_active:
            raise serializers.ValidationError(
                {"video": "This video is currently inactive."}
            )

        return attrs