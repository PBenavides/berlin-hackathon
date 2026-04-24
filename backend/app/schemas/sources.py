from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ContextSourceBase(BaseModel):
    kind: str
    uri: str
    sha256: Optional[str] = None
    status: str = "allowed"
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None


class ContextSourceCreate(ContextSourceBase):
    pass


class ContextSourceOut(ContextSourceBase):
    id: str
    property_id: str

    model_config = {"from_attributes": True}
