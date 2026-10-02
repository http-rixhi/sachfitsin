"""
One place that turns any exception into the standard error body.

Wired up through ``REST_FRAMEWORK["EXCEPTION_HANDLER"]``, so every DRF view
goes through it without any per-view code.

Two rules:

1. Nothing internal reaches the customer. 5xx responses always use a fixed
   generic sentence; the real cause goes to the log instead.
2. Every response has the same shape. See ``api/errors.py``.
"""

import logging

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.http import Http404
from rest_framework import exceptions as drf_exceptions
from rest_framework import status as http_status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from api.errors import DEFAULT_MESSAGES, ErrorCode, build_error

logger = logging.getLogger("api.errors")


class SafeMessageAPIException(drf_exceptions.APIException):
    """
    An error we raise on purpose, whose message is written for the user.

    Marked so the handler keeps the wording even on a 5xx, where an
    unexpected crash would otherwise be flattened to a generic sentence.
    """


class CalendlyUnavailable(SafeMessageAPIException):
    """
    Calendly refused or could not be reached, so nothing was changed here.

    Deliberately NOT a 500: the request was fine, our database is fine, and
    the caller can usefully retry. Telling them what actually happened
    matters, because the alternative is a dietician believing they have
    cancelled a session that is still in the customer's calendar.
    """

    status_code = http_status.HTTP_502_BAD_GATEWAY
    default_detail = DEFAULT_MESSAGES[ErrorCode.UPSTREAM_ERROR]
    default_code = ErrorCode.UPSTREAM_ERROR


class EntitlementRequired(drf_exceptions.APIException):
    """
    The customer is logged in and is a customer, but their plan does not
    include this feature.

    Kept separate from a plain 403 so the front end can offer an upgrade
    instead of a flat "access denied".
    """

    status_code = http_status.HTTP_403_FORBIDDEN
    default_detail = DEFAULT_MESSAGES[ErrorCode.ENTITLEMENT_REQUIRED]
    default_code = ErrorCode.ENTITLEMENT_REQUIRED


# Exception class -> our code. Order matters: the first match wins, so
# subclasses must be listed before their parents.
EXCEPTION_CODES = [
    (EntitlementRequired, ErrorCode.ENTITLEMENT_REQUIRED),
    (CalendlyUnavailable, ErrorCode.UPSTREAM_ERROR),
    (drf_exceptions.NotAuthenticated, ErrorCode.AUTHENTICATION_REQUIRED),
    ((InvalidToken, TokenError), ErrorCode.INVALID_TOKEN),
    (drf_exceptions.AuthenticationFailed, ErrorCode.INVALID_CREDENTIALS),
    (drf_exceptions.PermissionDenied, ErrorCode.PERMISSION_DENIED),
    (drf_exceptions.NotFound, ErrorCode.NOT_FOUND),
    (drf_exceptions.MethodNotAllowed, ErrorCode.METHOD_NOT_ALLOWED),
    (
        drf_exceptions.UnsupportedMediaType,
        ErrorCode.UNSUPPORTED_MEDIA_TYPE,
    ),
    (drf_exceptions.Throttled, ErrorCode.THROTTLED),
    (drf_exceptions.ValidationError, ErrorCode.VALIDATION_ERROR),
    (drf_exceptions.ParseError, ErrorCode.VALIDATION_ERROR),
]


def _flatten_validation_detail(detail, prefix="") -> dict:
    """
    Turn DRF's nested validation detail into a flat {field: [messages]}.

    DRF gives back dicts, lists, nested dicts and bare strings depending on
    where the error was raised. The front end should not have to care, so
    everything is flattened to one level with dotted keys.
    """

    fields: dict[str, list[str]] = {}

    if isinstance(detail, dict):
        for key, value in detail.items():
            nested_key = f"{prefix}.{key}" if prefix else str(key)
            fields.update(_flatten_validation_detail(value, nested_key))

        return fields

    if isinstance(detail, list):
        # A list of plain messages for this field.
        if all(not isinstance(item, (dict, list)) for item in detail):
            key = prefix or "non_field_errors"
            fields[key] = [str(item) for item in detail]

            return fields

        # A list of nested objects, e.g. a many=True serializer.
        for index, item in enumerate(detail):
            nested_key = f"{prefix}[{index}]" if prefix else f"[{index}]"
            fields.update(_flatten_validation_detail(item, nested_key))

        return fields

    key = prefix or "non_field_errors"
    fields[key] = [str(detail)]

    return fields


def _first_message(fields: dict) -> str:
    """The first field message, used as the headline sentence."""

    for key in ("non_field_errors", "detail"):
        if fields.get(key):
            return fields[key][0]

    for messages in fields.values():
        if messages:
            return messages[0]

    return ""


def _code_for(exc, context=None) -> str:
    for exception_class, code in EXCEPTION_CODES:
        if isinstance(exc, exception_class):
            if code == ErrorCode.INVALID_CREDENTIALS:
                return _refine_auth_failure(context)

            return code

    return ErrorCode.SERVER_ERROR


def _refine_auth_failure(context) -> str:
    """
    Tell "wrong password" apart from "bad token".

    Both arrive as AuthenticationFailed. The difference that matters to the
    customer is whether they typed something wrong (retry the form) or their
    session died (log in again). A request carrying an Authorization header
    was authenticating with a token, so it is the second kind.
    """

    request = context.get("request") if context else None

    if request is None:
        return ErrorCode.INVALID_CREDENTIALS

    if request.META.get("HTTP_AUTHORIZATION"):
        return ErrorCode.INVALID_TOKEN

    return ErrorCode.INVALID_CREDENTIALS


def _looks_expired(exc) -> bool:
    """simplejwt reports an expired token as a plain authentication failure."""

    text = str(getattr(exc, "detail", "")).lower()

    return "expired" in text


def _safe_detail(exc) -> str:
    """
    The exception's own message, when it says more than ours would.

    A permission class sets a useful message ("Only dieticians can access
    this endpoint") and that is worth showing. DRF's own placeholder
    ("Not found.") is not, so when the detail is just the class default it
    is dropped and the friendlier sentence from DEFAULT_MESSAGES is used.
    """

    detail = getattr(exc, "detail", None)

    if detail is None:
        return ""

    if isinstance(detail, (list, dict)):
        return ""

    text = str(detail)

    class_default = str(getattr(exc, "default_detail", "") or "")

    if text == class_default:
        return ""

    return text


def _describe_request(context) -> str:
    request = context.get("request") if context else None

    if request is None:
        return "no request"

    user = getattr(request, "user", None)

    if user is not None and getattr(user, "is_authenticated", False):
        who = f"user={user.pk}"
    else:
        who = "anonymous"

    return f"{request.method} {request.get_full_path()} ({who})"


def custom_exception_handler(exc, context):
    # Django's own exceptions are not APIException subclasses. Convert them
    # first so the rest of this function has one kind of thing to deal with.
    if isinstance(exc, Http404):
        exc = drf_exceptions.NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = drf_exceptions.PermissionDenied()
    elif isinstance(exc, DjangoValidationError):
        exc = drf_exceptions.ValidationError(
            getattr(exc, "message_dict", None) or list(exc.messages)
        )

    response = drf_exception_handler(exc, context)

    # ---- Unhandled: a real bug, or the database refusing something -------
    if response is None:
        if isinstance(exc, IntegrityError):
            logger.warning(
                "Database integrity error on %s: %s",
                _describe_request(context),
                exc,
            )

            return Response(
                build_error(
                    code=ErrorCode.CONFLICT,
                    status=http_status.HTTP_409_CONFLICT,
                ),
                status=http_status.HTTP_409_CONFLICT,
            )

        # Log the whole traceback, tell the customer nothing.
        logger.exception(
            "Unhandled error on %s", _describe_request(context)
        )

        return Response(
            build_error(
                code=ErrorCode.SERVER_ERROR,
                status=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            ),
            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # ---- Handled by DRF: reshape it --------------------------------------
    code = _code_for(exc, context)
    fields = None
    message = ""

    if code == ErrorCode.VALIDATION_ERROR:
        fields = _flatten_validation_detail(
            getattr(exc, "detail", "Invalid input.")
        )
        message = _first_message(fields) or DEFAULT_MESSAGES[code]

        # A single unnamed message reads better as the headline alone.
        if set(fields) == {"non_field_errors"} and len(
            fields["non_field_errors"]
        ) == 1:
            fields = None

    elif code in (ErrorCode.INVALID_TOKEN, ErrorCode.INVALID_CREDENTIALS):
        if code == ErrorCode.INVALID_TOKEN and _looks_expired(exc):
            code = ErrorCode.TOKEN_EXPIRED

        # Always the fixed sentence: the provider's wording ("No active
        # account found with the given credentials") tells an attacker
        # whether the username exists.
        message = DEFAULT_MESSAGES[code]

    else:
        message = _safe_detail(exc) or DEFAULT_MESSAGES.get(
            code, DEFAULT_MESSAGES[ErrorCode.SERVER_ERROR]
        )

    status_code = response.status_code

    if status_code >= 500 and not isinstance(exc, SafeMessageAPIException):
        # DRF handles a few 5xx cases itself, e.g. 503 from a throttle.
        logger.error(
            "Server-side error (%s) on %s",
            status_code,
            _describe_request(context),
        )

        code = (
            ErrorCode.SERVICE_UNAVAILABLE
            if status_code == 503
            else ErrorCode.SERVER_ERROR
        )
        message = DEFAULT_MESSAGES[code]
        fields = None
    elif status_code >= 500:
        logger.warning(
            "%s (%s) on %s", code, status_code, _describe_request(context)
        )
    else:
        logger.info(
            "%s (%s) on %s",
            code,
            status_code,
            _describe_request(context),
        )

    response.data = build_error(
        code=code,
        status=status_code,
        message=message,
        fields=fields,
    )

    return response
