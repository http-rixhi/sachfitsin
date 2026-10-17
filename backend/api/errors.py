"""
The one shape every API error comes back in.

    {
      "error": {
        "code":    "validation_error",
        "message": "Please check the highlighted fields and try again.",
        "status":  400,
        "fields":  {"email": ["Enter a valid email address."]}
      }
    }

``code``    a stable string the front end can branch on. Never changes
            wording, so it is safe to compare against.
``message`` one plain sentence that is safe to show a customer. Never
            contains a stack trace, SQL, a file path or a setting value.
``status``  the HTTP status, repeated here so the body is self-contained.
``fields``  only present on validation errors.
"""


class ErrorCode:
    VALIDATION_ERROR = "validation_error"
    AUTHENTICATION_REQUIRED = "authentication_required"
    INVALID_TOKEN = "invalid_token"
    TOKEN_EXPIRED = "token_expired"
    INVALID_CREDENTIALS = "invalid_credentials"
    INVALID_CODE = "invalid_code"
    PERMISSION_DENIED = "permission_denied"
    ENTITLEMENT_REQUIRED = "entitlement_required"
    NOT_FOUND = "not_found"
    METHOD_NOT_ALLOWED = "method_not_allowed"
    UNSUPPORTED_MEDIA_TYPE = "unsupported_media_type"
    THROTTLED = "throttled"
    CONFLICT = "conflict"
    UPSTREAM_ERROR = "upstream_error"
    SERVER_ERROR = "server_error"
    SERVICE_UNAVAILABLE = "service_unavailable"


# What the customer reads. Deliberately vague for 5xx.
DEFAULT_MESSAGES = {
    ErrorCode.VALIDATION_ERROR: (
        "Please check the highlighted fields and try again."
    ),
    ErrorCode.AUTHENTICATION_REQUIRED: (
        "Please log in to continue."
    ),
    ErrorCode.INVALID_TOKEN: (
        "Your session is no longer valid. Please log in again."
    ),
    ErrorCode.TOKEN_EXPIRED: (
        "Your session has expired. Please log in again."
    ),
    ErrorCode.INVALID_CREDENTIALS: (
        "Invalid username or password."
    ),
    ErrorCode.INVALID_CODE: (
        "That code is not valid. It may have expired."
    ),
    ErrorCode.PERMISSION_DENIED: (
        "You do not have permission to do this."
    ),
    ErrorCode.ENTITLEMENT_REQUIRED: (
        "This feature is not included in your plan."
    ),
    ErrorCode.NOT_FOUND: (
        "We could not find what you were looking for."
    ),
    ErrorCode.METHOD_NOT_ALLOWED: (
        "That action is not allowed here."
    ),
    ErrorCode.UNSUPPORTED_MEDIA_TYPE: (
        "That file type is not supported."
    ),
    ErrorCode.THROTTLED: (
        "Too many requests. Please wait a moment and try again."
    ),
    ErrorCode.CONFLICT: (
        "That change clashes with something that already exists."
    ),
    ErrorCode.UPSTREAM_ERROR: (
        "An external service did not respond. Nothing was changed."
    ),
    ErrorCode.SERVER_ERROR: (
        "Something went wrong on our side. Please try again."
    ),
    ErrorCode.SERVICE_UNAVAILABLE: (
        "The service is busy right now. Please try again shortly."
    ),
}


def build_error(
    *,
    code: str,
    status: int,
    message: str = "",
    fields: dict | None = None,
) -> dict:
    """Build the response body. This is the only place that shape is made."""

    error = {
        "code": code,
        "message": message or DEFAULT_MESSAGES.get(
            code, DEFAULT_MESSAGES[ErrorCode.SERVER_ERROR]
        ),
        "status": status,
    }

    if fields:
        error["fields"] = fields

    return {"error": error}
