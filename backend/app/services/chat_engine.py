"""
chat_engine.py — Streaming chat orchestrator for POST /api/chat.

Thin wrapper that delegates to the Hermes agent runtime. Yields
(event_name, data_dict) tuples so the SSE route can serialise them
without knowing anything about tool calls or proposed actions.
"""
from __future__ import annotations

from typing import Any, Dict, Generator, Optional, Tuple

from sqlalchemy.orm import Session

from app.services import agent_runtime


def stream_events(
    db: Session,
    message: str,
    property_id: Optional[str] = None,
    scope: Optional[Dict[str, Any]] = None,
) -> Generator[Tuple[str, Dict[str, Any]], None, None]:
    """
    Yields (event_name, data) tuples for the SSE response.
    Event names: delta | tool_call | tool_result | action_proposal | done.
    """
    yield from agent_runtime.stream_agent(
        db=db,
        user_message=message,
        property_id=property_id,
        scope=scope,
    )
