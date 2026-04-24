from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any, Dict


class ContextVersionBase(BaseModel):
    content_md: str
    frontmatter: Optional[Dict[str, Any]] = None
    created_by: str
    created_reason: Optional[str] = None
    parent_version: Optional[int] = None
    source_proposal_id: Optional[str] = None


class ContextVersionCreate(ContextVersionBase):
    pass


class ContextVersionOut(ContextVersionBase):
    id: str
    property_id: str
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ContextChunkOut(BaseModel):
    id: str
    context_version_id: str
    property_id: str
    heading: str
    content: str

    model_config = {"from_attributes": True}


class DiffOut(BaseModel):
    from_version: int
    to_version: int
    diff: str
