from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from app.schemas.base import CamelModel


class AttachmentOut(CamelModel):
    id: str
    owner_message_id: str
    filename: str
    mime_type: str
    size_bytes: int
    sha256: str
    vision_description: Optional[str] = None
    url: str
    created_at: datetime
