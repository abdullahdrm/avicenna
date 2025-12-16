from rest_framework.response import Response
from rest_framework import status


def ok(payload: dict, http_status: int = status.HTTP_200_OK):
    """
    Standard success response wrapper.
    """
    return Response({"status": "ok", **payload}, status=http_status)


def err(message: str, http_status: int = status.HTTP_400_BAD_REQUEST, extra: dict | None = None):
    """
    Standard error response wrapper.
    """
    body = {"status": "error", "error": message}
    if extra:
        body.update(extra)
    return Response(body, status=http_status)


def rejected(reason: str):
    """
    Standard rejection response for quality checks.
    """
    return Response({"status": "rejected", "reason": reason}, status=status.HTTP_200_OK)
