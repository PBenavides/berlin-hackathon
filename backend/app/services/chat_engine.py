"""
chat_engine.py — Streaming chat orchestrator for POST /api/chat.

Yields text chunks as they arrive from the LLM. Falls back to a deterministic
stub generator when no API key is configured so the SSE wire still streams
in dev/demo without LLM credentials.
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, Iterator, List, Optional

from sqlalchemy.orm import Session

from app.models.context_versions import ContextVersion
from app.models.tickets import Ticket


_MODEL = "google/gemini-2.5-flash"
_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


# ---------------------------------------------------------------------------
# Context loaders
# ---------------------------------------------------------------------------


def _latest_context(db: Session, property_id: str) -> Optional[ContextVersion]:
    return (
        db.query(ContextVersion)
        .filter(ContextVersion.property_id == property_id)
        .order_by(ContextVersion.version.desc())
        .first()
    )


def _open_tickets_summary(db: Session, property_id: str, limit: int = 5) -> str:
    """Compact list of currently-open tickets for the LLM's working memory."""
    rows = (
        db.query(Ticket)
        .filter(
            Ticket.property_id == property_id,
            ~Ticket.status.in_(["resolved", "rejected"]),
        )
        .order_by(Ticket.created_at.desc())
        .limit(limit)
        .all()
    )
    if not rows:
        return "(no open tickets)"
    return "\n".join(
        f"- {t.num or t.id} [{t.status}, risk={t.risk or '-'}]: {t.subject}"
        for t in rows
    )


def _build_system_prompt(db: Session, property_id: Optional[str]) -> str:
    base = (
        "You are Hermes, a property-management assistant. "
        "Answer the operator concisely (2-4 sentences). Cite ticket numbers "
        "(e.g. GAR-118) when relevant. Never invent vendor names or costs."
    )
    if not property_id:
        return base
    cv = _latest_context(db, property_id)
    ctx = cv.content_md if cv else "(no context)"
    tickets = _open_tickets_summary(db, property_id)
    return (
        f"{base}\n\n"
        f"# Property context (v{cv.version if cv else '?'}):\n{ctx[:3000]}\n\n"
        f"# Open tickets:\n{tickets}"
    )


# ---------------------------------------------------------------------------
# Stub generator (no API key) — splits a canned reply into chunks
# ---------------------------------------------------------------------------


def _stub_stream(message: str, property_id: Optional[str], db: Session) -> Iterator[str]:
    open_tickets = _open_tickets_summary(db, property_id) if property_id else "(no property scope)"
    reply = (
        f"You asked: \"{message[:80]}\". "
        f"For this property, the open items are: {open_tickets}. "
        f"Approve the proposal in the ticket detail to dispatch the vendor."
    )
    # Word-by-word chunking to mimic streaming
    for word in reply.split(" "):
        yield word + " "


# ---------------------------------------------------------------------------
# OpenRouter streaming
# ---------------------------------------------------------------------------


def _openrouter_stream(
    api_key: str, system_prompt: str, user_message: str
) -> Iterator[str]:
    """Yield text deltas from OpenRouter's SSE-style /chat/completions stream."""
    import httpx

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Buena ContextOps",
    }
    body = {
        "model": _MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.4,
        "max_tokens": 512,
        "stream": True,
    }

    with httpx.stream("POST", _OPENROUTER_URL, json=body, headers=headers, timeout=60.0) as r:
        r.raise_for_status()
        for raw_line in r.iter_lines():
            if not raw_line:
                continue
            if not raw_line.startswith("data:"):
                continue
            payload = raw_line[5:].strip()
            if payload == "[DONE]":
                break
            try:
                obj = json.loads(payload)
            except json.JSONDecodeError:
                continue
            choices = obj.get("choices") or []
            if not choices:
                continue
            delta = choices[0].get("delta") or {}
            text = delta.get("content")
            if text:
                yield text


# ---------------------------------------------------------------------------
# Public: token iterator selected by env
# ---------------------------------------------------------------------------


def stream_reply(
    db: Session,
    message: str,
    property_id: Optional[str] = None,
    scope: Optional[Dict[str, Any]] = None,
) -> Iterator[str]:
    """
    Yields successive text chunks for the chat response. Caller wraps each
    chunk in an SSE `event: delta` envelope.
    """
    api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        yield from _stub_stream(message, property_id, db)
        return

    try:
        system_prompt = _build_system_prompt(db, property_id)
        yield from _openrouter_stream(api_key, system_prompt, message)
    except Exception as e:
        # Fall back gracefully — don't break the stream mid-conversation
        yield f"[chat-engine fallback: {type(e).__name__}] "
        yield from _stub_stream(message, property_id, db)
