"""
POST /api/chat — Hermes streaming chat endpoint.

text/event-stream with these event types:
  event: delta            — text token chunk
  event: tool_call        — agent invoked a read tool
  event: tool_result      — read tool returned
  event: action_proposal  — agent suggests a write the operator must confirm
  event: done             — final message id + scope-touch list + turn count

Body: {message, propertyId?, scope?: {layer, id}}
"""
import json
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.services import chat_engine

router = APIRouter()


class ChatScope(BaseModel):
    layer: Optional[str] = None
    id: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    property_id: Optional[str] = None
    scope: Optional[ChatScope] = None


def _sse(event: str, data: Dict[str, Any]) -> bytes:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n".encode("utf-8")


@router.post("/chat")
def chat(payload: ChatRequest):
    """Stream a Hermes reply: tokens + tool events + final 'done'."""
    def generator():
        db: Session = SessionLocal()
        try:
            scope_dict = payload.scope.model_dump() if payload.scope else None
            last_keepalive = time.time()
            for event_name, data in chat_engine.stream_events(
                db,
                message=payload.message,
                property_id=payload.property_id,
                scope=scope_dict,
            ):
                yield _sse(event_name, data)
                if time.time() - last_keepalive > 15:
                    yield b": keepalive\n\n"
                    last_keepalive = time.time()
        except Exception as e:
            yield _sse("error", {"message": f"{type(e).__name__}: {e}"})
        finally:
            db.close()

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
