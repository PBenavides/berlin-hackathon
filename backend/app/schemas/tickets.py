from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class TicketBase(BaseModel):
    source: str
    external_id: Optional[str] = None
    raised_by: str
    subject: str
    body: str
    status: str = "open"


class TicketCreate(TicketBase):
    property_id: str


class TicketOut(TicketBase):
    id: str
    property_id: str
    created_at: datetime

    model_config = {"from_attributes": True}
