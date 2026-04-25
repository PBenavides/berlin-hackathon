"""Centralised exception types and handlers for the standardised error envelope.

Every error response follows this contract:
    {"error": "<human message>", "code": "<SCREAMING_SNAKE>", "status": <http_int>}

No stack traces are ever included in responses.
"""
from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


# ---------------------------------------------------------------------------
# Custom exception types
# ---------------------------------------------------------------------------


class StateConflictError(Exception):
    """Raised when a state-machine transition is invalid (e.g. double-approve).

    Maps to HTTP 409 / code CONFLICT in the error envelope.
    """

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


# ---------------------------------------------------------------------------
# HTTP status → error code mapping
# ---------------------------------------------------------------------------

_CODE_MAP: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    410: "GONE",
    413: "PAYLOAD_TOO_LARGE",
    415: "UNSUPPORTED_MEDIA_TYPE",
    422: "VALIDATION_ERROR",
    500: "INTERNAL_ERROR",
    503: "SERVICE_UNAVAILABLE",
}


def _envelope(status: int, code: str, error: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": error, "code": code, "status": status},
    )


# ---------------------------------------------------------------------------
# Exception handlers (register on the FastAPI app)
# ---------------------------------------------------------------------------


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    code = _CODE_MAP.get(exc.status_code, "ERROR")
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return _envelope(exc.status_code, code, detail)


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = exc.errors()
    if errors:
        first = errors[0]
        loc = " → ".join(str(p) for p in first.get("loc", []))
        msg = first.get("msg", "Validation error")
        error_msg = f"{loc}: {msg}" if loc else msg
    else:
        error_msg = "Invalid request body"
    return _envelope(422, "VALIDATION_ERROR", error_msg)


async def state_conflict_handler(
    request: Request, exc: StateConflictError
) -> JSONResponse:
    return _envelope(409, "CONFLICT", exc.message)


async def generic_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Catch-all: never expose internals in production."""
    return _envelope(500, "INTERNAL_ERROR", "An unexpected error occurred")
