"""
Concierge dispatcher — sends an owner's message (text + images) to an LLM
and returns the assistant reply.

The interface is intentionally narrow so we can swap implementations later:
- v1 (this file): direct OpenRouter Chat Completions with Gemini Flash.
- v2 (planned):   real Hermes via its OpenAI-compatible gateway
                  (POST http://hermes:8642/v1/chat/completions, with
                  X-Hermes-Session-Id for per-property session continuity).

The route layer doesn't care which implementation runs — it calls
`dispatch(...)` and gets back a `DispatchResult`.
"""

from __future__ import annotations

import base64
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import List, Optional

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.attachments import Attachment
from app.models.context_versions import ContextVersion
from app.models.owner_messages import OwnerMessage
from app.models.properties import Property
from app.models.property_policies import PropertyPolicy

logger = logging.getLogger(__name__)


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "google/gemini-3.1-flash-lite-preview"


@dataclass
class DispatchResult:
    agent_reply: Optional[str] = None
    agent_error: Optional[str] = None
    dispatch_id: Optional[str] = None
    latency_ms: int = 0
    actions: list = field(default_factory=list)


# ---------------------------------------------------------------------------
# Context loading — give the agent enough about the property to be useful.
# ---------------------------------------------------------------------------


def _load_property_context(db: Session, property_id: str) -> dict:
    """Pull the latest context version + active policies + recent message history.
    Best-effort: missing pieces just become empty strings so the dispatch
    still succeeds with whatever we have."""
    prop = db.query(Property).filter(Property.id == property_id).first()
    name = prop.name if prop else "(unknown property)"

    ctx = (
        db.query(ContextVersion)
        .filter(ContextVersion.property_id == property_id)
        .order_by(ContextVersion.version.desc())
        .first()
    )
    context_md = ctx.content_md if ctx else "(no saved context yet)"

    policies = (
        db.query(PropertyPolicy)
        .filter(
            PropertyPolicy.property_id == property_id,
            PropertyPolicy.active.is_(True),
        )
        .order_by(PropertyPolicy.created_at.asc())
        .all()
    )
    policy_lines = [
        f"- [{p.kind}] {p.description}" for p in policies
    ] or ["(no active policies)"]

    # Recent owner messages (excluding the one we're about to dispatch)
    history = (
        db.query(OwnerMessage)
        .filter(OwnerMessage.property_id == property_id)
        .order_by(OwnerMessage.created_at.desc())
        .limit(8)
        .all()
    )
    history.reverse()

    return {
        "name": name,
        "context_md": context_md,
        "policies": "\n".join(policy_lines),
        "history": history,
    }


# ---------------------------------------------------------------------------
# Prompt assembly
# ---------------------------------------------------------------------------


def _system_prompt(prop_name: str, context_md: str, policies: str) -> str:
    return f"""You are the AI concierge for the property "{prop_name}".

You help the property owner triage incoming issues from tenants and surface
what the property's living context document already knows. You are friendly,
concise, and practical.

When you reply:
- Acknowledge the issue in one short sentence.
- If the context document already mentions a related issue, say so and quote
  the relevant heading.
- If a policy applies, name it.
- If the message looks actionable (e.g. damage, leak, lockout, complaint),
  suggest creating a ticket and what its subject + body should be — but do
  NOT actually create the ticket; the owner does that in the dashboard.
- If an image is attached, describe what you see in it briefly and how it
  relates to the issue.
- Keep replies under 150 words. Use plain prose, no markdown headings.

PROPERTY CONTEXT (latest version):
---
{context_md[:6000]}
---

ACTIVE POLICIES:
{policies}
"""


def _build_messages(
    *,
    system: str,
    history: List[OwnerMessage],
    user_text: str,
    image_data_urls: List[str],
) -> list:
    """OpenAI-compatible messages array including multimodal content for images."""
    msgs: list = [{"role": "system", "content": system}]

    # Recent history as alternating user/assistant turns
    for h in history:
        if h.text:
            msgs.append({"role": "user", "content": h.text})
        if h.agent_reply:
            msgs.append({"role": "assistant", "content": h.agent_reply})

    # Current turn — multimodal if images are present
    if image_data_urls:
        content: list = [{"type": "text", "text": user_text}]
        for url in image_data_urls:
            content.append({"type": "image_url", "image_url": {"url": url}})
        msgs.append({"role": "user", "content": content})
    else:
        msgs.append({"role": "user", "content": user_text})

    return msgs


def _attachment_to_data_url(att: Attachment) -> Optional[str]:
    """Encode an image attachment as a data URL for OpenAI-style multimodal input."""
    try:
        # Read from local disk; gs:// uploads are out-of-scope for v1 dispatcher.
        if att.storage_path.startswith("gs://"):
            logger.info(
                "concierge: skipping GCS-only attachment %s for vision (no local copy)",
                att.id,
            )
            return None
        with open(att.storage_path, "rb") as fh:
            raw = fh.read()
    except OSError as exc:
        logger.warning("concierge: failed to read %s: %s", att.storage_path, exc)
        return None

    mime = att.mime_type or "image/jpeg"
    if not mime.startswith("image/"):
        return None
    b64 = base64.b64encode(raw).decode("ascii")
    return f"data:{mime};base64,{b64}"


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def dispatch(
    *,
    db: Session,
    property_id: str,
    text: str,
    attachments: List[Attachment],
) -> DispatchResult:
    """Send an owner message to the concierge LLM and return its reply.

    On any failure we return a DispatchResult with `agent_error` populated;
    the route persists this to the OwnerMessage row so the user sees a clear
    failure rather than nothing.
    """
    settings = get_settings()
    started_at = time.monotonic()
    dispatch_id = str(uuid.uuid4())

    if not settings.openrouter_api_key:
        return DispatchResult(
            agent_error=(
                "OpenRouter API key not configured. Set OPENROUTER_API_KEY "
                "in backend/.env."
            ),
            dispatch_id=dispatch_id,
            latency_ms=0,
        )

    ctx = _load_property_context(db, property_id)
    image_urls = [
        url for url in (_attachment_to_data_url(a) for a in attachments) if url
    ]

    messages = _build_messages(
        system=_system_prompt(ctx["name"], ctx["context_md"], ctx["policies"]),
        history=ctx["history"],
        user_text=text or "(no text — image only)",
        image_data_urls=image_urls,
    )

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.app_base_url,
        "X-Title": "Buena Concierge",
    }

    body = {
        "model": settings.vision_model or DEFAULT_MODEL,
        "messages": messages,
        "temperature": 0.4,
        "max_tokens": 600,
    }

    try:
        resp = httpx.post(
            OPENROUTER_URL,
            json=body,
            headers=headers,
            timeout=settings.hermes_timeout_s,
        )
        resp.raise_for_status()
        payload = resp.json()
        reply = payload["choices"][0]["message"]["content"].strip()
        latency_ms = int((time.monotonic() - started_at) * 1000)
        return DispatchResult(
            agent_reply=reply,
            dispatch_id=dispatch_id,
            latency_ms=latency_ms,
        )
    except httpx.HTTPStatusError as exc:
        body_snippet = exc.response.text[:200]
        logger.exception("concierge: openrouter %s: %s", exc.response.status_code, body_snippet)
        return DispatchResult(
            agent_error=f"LLM upstream {exc.response.status_code}: {body_snippet}",
            dispatch_id=dispatch_id,
            latency_ms=int((time.monotonic() - started_at) * 1000),
        )
    except Exception as exc:
        logger.exception("concierge: dispatch failed")
        return DispatchResult(
            agent_error=f"Dispatch failed: {exc.__class__.__name__}: {exc}",
            dispatch_id=dispatch_id,
            latency_ms=int((time.monotonic() - started_at) * 1000),
        )
