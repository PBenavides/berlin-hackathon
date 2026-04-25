from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any, Dict

from app.schemas.base import CamelModel


class ContextVersionBase(BaseModel):
    content_md: str
    frontmatter: Optional[Dict[str, Any]] = None
    created_by: str
    created_reason: Optional[str] = None
    parent_version: Optional[int] = None
    source_proposal_id: Optional[str] = None


class ContextVersionCreate(ContextVersionBase):
    pass


class ContextVersionOut(CamelModel):
    id: str
    property_id: str
    version: int
    content_md: str
    frontmatter: Optional[Dict[str, Any]] = None
    created_by: str
    created_reason: Optional[str] = None
    parent_version: Optional[int] = None
    source_proposal_id: Optional[str] = None
    created_at: datetime


class ContextChunkOut(CamelModel):
    id: str
    context_version_id: str
    property_id: str
    heading: str
    content: str


class DiffOut(CamelModel):
    from_version: int
    to_version: int
    diff: str
