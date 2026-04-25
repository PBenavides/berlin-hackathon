from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PropertyDocumentOut(BaseModel):
    """List/summary view — omits the extracted_text body to keep payloads small."""

    id: str
    property_id: str
    filename: str
    mime_type: str
    size_bytes: int
    sha256: str
    page_count: Optional[int] = None
    extraction_error: Optional[str] = None
    has_extracted_text: bool
    file_url: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PropertyDocumentDetail(PropertyDocumentOut):
    """Detail view — includes the full extracted_text."""

    extracted_text: Optional[str] = None
