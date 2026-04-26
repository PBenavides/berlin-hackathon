from typing import Any, Dict, List, Optional

from app.schemas.base import CamelModel


class ExtractionAccepted(CamelModel):
    """Returned by POST /api/extract — the upload was accepted, work queued."""
    extraction_id: str
    status: str
    poll_url: str


class ExtractionStatus(CamelModel):
    """Returned by GET /api/extract/{id} — current state plus diffs when done."""
    extraction_id: str
    status: str  # "processing" | "done" | "failed"
    proposed_diffs: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None
