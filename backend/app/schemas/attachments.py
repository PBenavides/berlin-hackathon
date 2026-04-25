from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class AttachmentOut(BaseModel):
    id: str
    owner_message_id: str
    filename: str
    mime_type: str
    size_bytes: int
    sha256: str
    vision_description: Optional[str] = None
    url: str
    created_at: datetime

    model_config = {"from_attributes": True}
