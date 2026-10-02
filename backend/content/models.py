from django.conf import settings
from django.db import models


class Content(models.Model):
    class ContentType(models.TextChoices):
        ARTICLE = "ARTICLE", "Article"
        EDUCATIONAL = "EDUCATIONAL", "Educational"
        GENERAL = "GENERAL", "General"

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)

    excerpt = models.TextField(blank=True)
    body = models.TextField()

    content_type = models.CharField(
        max_length=20,
        choices=ContentType.choices,
        default=ContentType.ARTICLE,
    )

    cover_image_url = models.URLField(blank=True)

    is_public = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    published_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_content",
        limit_choices_to={"role": "DIETICIAN"},
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-published_at", "-created_at"]

    def __str__(self):
        return self.title