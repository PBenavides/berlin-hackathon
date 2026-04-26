"""
agent_queue.py — REST + SSE routes for the auto-solve queue.

POST /api/agent-queue/start     — start autonomous ticket processing
POST /api/agent-queue/stop      — stop (finishes current ticket gracefully)
GET  /api/agent-queue/status    — JSON queue state
GET  /api/agent-queue/feed      — SSE stream of activity events (live)
GET  /api/agent-queue/feed/recent — last N activity entries (REST)

Sprint 4 (s4-f5): POST /start accepts optional speed: "slow" | "normal" | "fast"
"""
from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.agent_activity import AgentActivityEntry
from app.services import agent_queue_service

router = APIRouter()


class StartQueueRequest(BaseModel):
    speed: str = "normal"  # "slow" | "normal" | "fast"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sse(event: str, data: Dict[str, Any]) -> bytes:
    return (
        f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"
    ).encode("utf-8")


def _entry_to_dict(e: AgentActivityEntry) -> Dict[str, Any]:
    return {
        "id": e.id,
        "ticketId": e.ticket_id,
        "ticketNum": e.ticket_num,
        "eventType": e.event_type,
        "actionType": e.action_type,
        "description": e.description,
        "severity": e.severity,
        "createdAt": e.created_at.isoformat() if e.created_at else None,
    }


# ---------------------------------------------------------------------------
# Control endpoints
# ---------------------------------------------------------------------------

@router.post("/agent-queue/start")
def start_queue(body: Optional[StartQueueRequest] = None):
    """Activate autonomous ticket resolution. Accepts optional speed preset."""
    speed = (body.speed if body else None) or "normal"
    result = agent_queue_service.start_queue(speed=speed)
    return result


@router.post("/agent-queue/stop")
def stop_queue():
    """Stop the autonomous queue after the current ticket finishes."""
    result = agent_queue_service.stop_queue()
    return result


@router.get("/agent-queue/status")
def get_queue_status():
    """Return current queue state (running, current ticket, counts)."""
    return agent_queue_service.get_status()


# ---------------------------------------------------------------------------
# Activity feed — REST
# ---------------------------------------------------------------------------

@router.get("/agent-queue/feed/recent")
def recent_feed(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Return the most recent N activity feed entries."""
    entries = (
        db.query(AgentActivityEntry)
        .order_by(AgentActivityEntry.created_at.desc())
        .limit(limit)
        .all()
    )
    # Return newest-first so the UI can show them in reverse chronological order
    return [_entry_to_dict(e) for e in entries]


# ---------------------------------------------------------------------------
# Activity feed — SSE streaming
# ---------------------------------------------------------------------------

@router.get("/agent-queue/feed/stream")
def stream_feed():
    """
    SSE stream that pushes new activity events in real-time.
    The client receives activity_entry events as the agent works.
    Connection remains open; close it when done.
    """
    def generator():
        sub_id, q = agent_queue_service.subscribe_to_feed()
        last_keepalive = time.time()
        try:
            # Send current status on connect
            yield _sse("queue_status", agent_queue_service.get_status())

            while True:
                # Keepalive every 15s
                if time.time() - last_keepalive > 15:
                    yield b": keepalive\n\n"
                    last_keepalive = time.time()

                try:
                    event = q.get(timeout=1.0)
                    event_type = event.get("eventType", "activity_entry")
                    yield _sse(event_type, event)
                    last_keepalive = time.time()
                except Exception:
                    # Timeout — just loop to check keepalive
                    pass
        finally:
            agent_queue_service.unsubscribe_from_feed(sub_id)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
