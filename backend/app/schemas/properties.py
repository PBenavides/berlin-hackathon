from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class PropertyBase(BaseModel):
    name: str
    slack_channel: Optional[str] = None


class PropertyCreate(PropertyBase):
    pass


class PropertyOut(PropertyBase):
    id: str
    created_at: datetime

    model_config = {"from_attributes": True}
