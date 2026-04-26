from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from app.schemas.base import CamelModel


class ContextSourceBase(BaseModel):
    kind: str
    uri: str
    sha256: Optional[str] = None
    status: str = "allowed"
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None


class ContextSourceCreate(ContextSourceBase):
    pass


class ContextSourceOut(CamelModel):
    id: str
    property_id: str
    kind: str
    uri: str
    sha256: Optional[str] = None
    status: str
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
