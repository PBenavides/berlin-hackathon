"""
POST /api/chat — Hermes streaming chat endpoint.

Returns text/event-stream:
  event: delta
  data: {"text": "..."}
  ...
  event: done
  data: {"messageId": "msg-...", "appliedTo": []}

Body: {message, propertyId?, scope?: {layer, id}}
"""
import json
import time
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
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
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8")


@router.post("/chat")
def chat(payload: ChatRequest):
    """Stream a Hermes reply as SSE deltas + a final 'done' event."""
    message_id = f"msg-{uuid.uuid4().hex[:10]}"

    def generator():
        # Open a per-stream DB session so the connection isn't held by the
        # outer request lifecycle (which closes after the function returns).
        db: Session = SessionLocal()
        try:
            scope_dict = payload.scope.model_dump() if payload.scope else None
            last_keepalive = time.time()
            for chunk in chat_engine.stream_reply(
                db,
                message=payload.message,
                property_id=payload.property_id,
                scope=scope_dict,
            ):
                yield _sse("delta", {"text": chunk})
                # 15s keep-alive comment — browsers timeout silent SSE at ~30s
                if time.time() - last_keepalive > 15:
                    yield b": keepalive\n\n"
                    last_keepalive = time.time()
            yield _sse("done", {"messageId": message_id, "appliedTo": []})
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
