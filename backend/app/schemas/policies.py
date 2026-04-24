from pydantic import BaseModel
from datetime import datetime
from typing import Any, Dict, Optional


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


class PolicyOut(PolicyBase):
    id: str
    property_id: str
    created_at: datetime

    model_config = {"from_attributes": True}
