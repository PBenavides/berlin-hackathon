from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Any, Dict

from app.schemas.attachments import AttachmentOut
from app.schemas.base import CamelModel


class ActionTaken(CamelModel):
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime


class OwnerMessageOut(CamelModel):
    id: str
    property_id: str
    text: str
    vision_text: Optional[str] = None
    agent_reply: Optional[str] = None
    agent_error: Optional[str] = None
    dispatch_id: Optional[str] = None
    latency_ms: Optional[int] = None
    created_at: datetime


class MessageDispatchResult(CamelModel):
    """Returned from POST /properties/{id}/messages — bundles message,
    reply, attachments, and the side-effects Hermes performed (if any)."""

    message_id: str
    agent_reply: Optional[str] = None
    agent_error: Optional[str] = None
    dispatch_id: Optional[str] = None
    actions_taken: List[ActionTaken] = []
    attachments: List[AttachmentOut] = []
    created_at: datetime
