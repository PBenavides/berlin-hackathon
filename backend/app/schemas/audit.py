from pydantic import BaseModel
from datetime import datetime
from typing import Any, Dict, Optional

from app.schemas.base import CamelModel


class AuditLogOut(CamelModel):
    id: str
    actor: str
    action: str
    property_id: Optional[str] = None
    entity_type: str
    entity_id: Optional[str] = None
    event_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime


class AuditListOut(CamelModel):
    items: list[AuditLogOut]
    total: int
    limit: int
    offset: int
