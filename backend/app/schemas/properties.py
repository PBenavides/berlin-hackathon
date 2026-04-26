from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from app.schemas.base import CamelModel


class PropertyBase(BaseModel):
    name: str
    slack_channel: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class PropertyCreate(PropertyBase):
    building_id: Optional[str] = None
    owner_id: Optional[str] = None


class PropertyOut(CamelModel):
    id: str
    name: str
    slack_channel: Optional[str] = None
    building_id: Optional[str] = None
    owner_id: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    created_at: datetime

    # Computed fields populated by routes (not stored in DB)
    units: Optional[int] = None
    open_tickets: Optional[int] = None
    context_version: Optional[int] = None
