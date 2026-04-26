import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from starlette.exceptions import HTTPException as StarletteHTTPException

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
    owners,
    buildings,
    vendors,
    units,
    escalations,
    chat,
    extract,
    agent_run,
    agent_queue,
)
from app.config import get_settings
from app.exceptions import StateConflictError, state_conflict_handler, _CODE_MAP

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
# Handlers delegate to app.exceptions which owns _CODE_MAP (single source of truth)
# ---------------------------------------------------------------------------

from app.exceptions import (  # noqa: E402 — after app init
    http_exception_handler as _http_handler,
    validation_exception_handler as _validation_handler,
    generic_exception_handler as _generic_handler,
)


@app.exception_handler(StateConflictError)
async def _state_conflict_handler(request: Request, exc: StateConflictError) -> JSONResponse:
    return await state_conflict_handler(request, exc)


# Register for both FastAPI HTTPException (raised in routes) and Starlette
# HTTPException (raised by the router itself for path-not-found 404s).
@app.exception_handler(StarletteHTTPException)
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return await _http_handler(request, exc)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return await _validation_handler(request, exc)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return await _generic_handler(request, exc)


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
    # Knowledge-layer routers (sprint 1)
    (owners.router, "owners"),
    (buildings.router, "buildings"),
    (vendors.router, "vendors"),
    (units.router, "units"),
    (escalations.router, "escalations"),
    (chat.router, "chat"),
    (extract.router, "extract"),
    # Sprint 2: agent action streaming + ticket escalation
    (agent_run.router, "agent-run"),
    # Sprint 3: autonomous queue + activity feed
    (agent_queue.router, "agent-queue"),
]

for _router, _tag in _routers:
    app.include_router(_router, prefix="/api", tags=[_tag])
    app.include_router(_router, prefix="/api/v1", tags=[f"{_tag}-v1"])


@app.get("/api/health", tags=["health"])
@app.get("/api/v1/health", tags=["health"])
def health_check():
    return JSONResponse({"status": "ok", "service": "buena-contextops"})


# ---------------------------------------------------------------------------
# Enable camelCase (by_alias) serialization on every response-model route.
# Must run AFTER all routers are included so all APIRoute objects exist.
# ---------------------------------------------------------------------------

for _route in app.routes:
    if isinstance(_route, APIRoute) and _route.response_model is not None:
        _route.response_model_by_alias = True
