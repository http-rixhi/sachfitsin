"""
Project-level 404 and 500 handlers.

DRF's exception handler only covers requests that reach a DRF view. A URL
that matches nothing, or an error raised before the view runs, is handled
by Django itself and would return an HTML page. For anything under /api/
that would break the contract, so these return the same JSON shape.
"""

import logging

from django.http import JsonResponse

from api.errors import ErrorCode, build_error

logger = logging.getLogger("api.errors")


def _is_api_request(request) -> bool:
    return request.path.startswith("/api/")


def not_found(request, exception=None):
    if not _is_api_request(request):
        from django.views.defaults import page_not_found

        return page_not_found(request, exception)

    logger.info("not_found (404) on %s %s", request.method, request.path)

    return JsonResponse(
        build_error(code=ErrorCode.NOT_FOUND, status=404),
        status=404,
    )


def server_error(request):
    if not _is_api_request(request):
        from django.views.defaults import server_error as django_server_error

        return django_server_error(request)

    # Django has already logged the traceback on django.request.
    logger.error("server_error (500) on %s %s", request.method, request.path)

    return JsonResponse(
        build_error(code=ErrorCode.SERVER_ERROR, status=500),
        status=500,
    )
