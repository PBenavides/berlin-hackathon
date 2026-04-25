import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import (
    properties,
    context,
    policies,
    audit,
    dev,
    tickets,
    proposals,
    messages,
    attachments,
    documents,
)
from app.config import get_settings

app = FastAPI(
    title="Buena ContextOps API",
    description="Human-in-the-loop property management context system",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Standardised error envelope  {error, code, status}
# ---------------------------------------------------------------------------

_STATUS_CODES: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    500: "INTERNAL_ERROR",
}


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    code = _STATUS_CODES.get(exc.status_code, "ERROR")
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": detail, "code": code, "status": exc.status_code},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = exc.errors()
    messages_list = [
        f"{' -> '.join(str(loc) for loc in e['loc'])}: {e['msg']}" for e in errors
    ]
    error_msg = "; ".join(messages_list) if messages_list else "Validation error"
    return JSONResponse(
        status_code=422,
        content={"error": error_msg, "code": "VALIDATION_ERROR", "status": 422},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "error": "An unexpected error occurred",
            "code": "INTERNAL_ERROR",
            "status": 500,
        },
    )


@app.on_event("startup")
def _ensure_runtime_dirs() -> None:
    settings = get_settings()
    os.makedirs(settings.attachments_dir, exist_ok=True)
    os.makedirs(settings.documents_dir, exist_ok=True)


# ---------------------------------------------------------------------------
# Routers — mounted at both /api (primary) and /api/v1 (backward compat)
# ---------------------------------------------------------------------------

_routers = [
    (properties.router, "properties"),
    (context.router, "context"),
    (policies.router, "policies"),
    (audit.router, "audit"),
    (dev.router, "dev"),
    (tickets.router, "tickets"),
    (proposals.router, "proposals"),
    (messages.router, "messages"),
    (attachments.router, "attachments"),
    (documents.router, "documents"),
]

for _router, _tag in _routers:
    app.include_router(_router, prefix="/api", tags=[_tag])
    app.include_router(_router, prefix="/api/v1", tags=[f"{_tag}-v1"])


@app.get("/api/health", tags=["health"])
@app.get("/api/v1/health", tags=["health"])
def health_check():
    return JSONResponse({"status": "ok", "service": "buena-contextops"})
