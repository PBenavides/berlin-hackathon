from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from app.schemas.base import CamelModel


class TicketBase(BaseModel):
    source: str
    external_id: Optional[str] = None
    raised_by: str
    subject: str
    body: str
    status: str = "new"
    risk: Optional[str] = None
    excerpt: Optional[str] = None
    raised_by_phone: Optional[str] = None
    confidence: Optional[float] = None


class TicketCreate(TicketBase):
    property_id: str
    unit_id: Optional[str] = None


class TicketOut(CamelModel):
    id: str
    num: Optional[str] = None
    property_id: str
    unit_id: Optional[str] = None
    source: str
    external_id: Optional[str] = None
    raised_by: str
    raised_by_phone: Optional[str] = None
    subject: str
    body: str
    status: str
    risk: Optional[str] = None
    excerpt: Optional[str] = None
    confidence: Optional[float] = None
    created_at: datetime
