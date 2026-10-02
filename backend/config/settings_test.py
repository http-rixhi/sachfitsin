"""
Settings for running the test suite.

Overrides the database with an in-memory SQLite one so tests never touch
the real PostgreSQL database, and switches email off so no test can send a
real message.

    python manage.py test --settings=config.settings_test
"""

from config.settings import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

EMAIL_ENABLED = False
RESEND_API_KEY = ""

FRONTEND_URL = "http://localhost:5173"

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "null": {"class": "logging.NullHandler"},
    },
    "root": {"handlers": ["null"], "level": "CRITICAL"},
}
