from pydantic import BaseModel
from datetime import datetime
from typing import Any, Dict, Optional


class AuditLogOut(BaseModel):
    id: str
    actor: str
    action: str
    property_id: Optional[str] = None
    entity_type: str
    entity_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditListOut(BaseModel):
    items: list[AuditLogOut]
    total: int
    limit: int
    offset: int
