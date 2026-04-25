import os

from fastapi import FastAPI
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


@app.on_event("startup")
def _ensure_runtime_dirs() -> None:
    settings = get_settings()
    os.makedirs(settings.attachments_dir, exist_ok=True)
    os.makedirs(settings.documents_dir, exist_ok=True)


# Include routers
app.include_router(properties.router, prefix="/api/v1", tags=["properties"])
app.include_router(context.router, prefix="/api/v1", tags=["context"])
app.include_router(policies.router, prefix="/api/v1", tags=["policies"])
app.include_router(audit.router, prefix="/api/v1", tags=["audit"])
app.include_router(dev.router, prefix="/api/v1", tags=["dev"])
app.include_router(tickets.router, prefix="/api/v1", tags=["tickets"])
app.include_router(proposals.router, prefix="/api/v1", tags=["proposals"])
app.include_router(messages.router, prefix="/api/v1", tags=["messages"])
app.include_router(attachments.router, prefix="/api/v1", tags=["attachments"])
app.include_router(documents.router, prefix="/api/v1", tags=["documents"])


@app.get("/api/v1/health", tags=["health"])
def health_check():
    return JSONResponse({"status": "ok", "service": "buena-contextops"})
