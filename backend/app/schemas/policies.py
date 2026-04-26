from pydantic import BaseModel
from datetime import datetime
from typing import Any, Dict, Optional

from app.schemas.base import CamelModel


class PolicyBase(BaseModel):
    kind: str
    rule_json: Dict[str, Any]
    description: str
    active: bool = True


class PolicyCreate(PolicyBase):
    pass


class PolicyUpdate(BaseModel):
    kind: Optional[str] = None
    rule_json: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    active: Optional[bool] = None


class PolicyOut(CamelModel):
    id: str
    property_id: str
    kind: str
    rule_json: Dict[str, Any]
    description: str
    active: bool
    created_at: datetime
