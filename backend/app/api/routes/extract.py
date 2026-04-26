"""
PDF Extract — async pipeline.

POST /api/extract  (multipart) → {extractionId, status: 'processing', pollUrl}
GET  /api/extract/{id}          → {extractionId, status, proposedDiffs[]}

The extraction runs as a FastAPI BackgroundTask. For a real production system
this would be a queue (Celery/Cloud Tasks); for the hackathon it's enough.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.extractions import Extraction
from app.schemas.extractions import ExtractionAccepted, ExtractionStatus
from app.services import extract_engine

router = APIRouter()


@router.post("/extract", response_model=ExtractionAccepted, status_code=202)
async def upload_for_extract(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    property_id: Optional[str] = Form(None, alias="propertyId"),
    layer: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Accept a document, persist an extractions row, queue background processing."""
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=422, detail="Uploaded file is empty")

    extraction_id = f"ext-{uuid.uuid4().hex[:10]}"
    row = Extraction(
        id=extraction_id,
        property_id=property_id,
        status="processing",
        filename=file.filename,
        layer=layer,
    )
    db.add(row)
    db.commit()

    background_tasks.add_task(
        extract_engine.run_extraction,
        extraction_id=extraction_id,
        property_id=property_id,
        layer_hint=layer,
        filename=file.filename or "upload",
        file_bytes=file_bytes,
    )

    return ExtractionAccepted(
        extraction_id=extraction_id,
        status="processing",
        poll_url=f"/api/extract/{extraction_id}",
    )


@router.get("/extract/{extraction_id}", response_model=ExtractionStatus)
def poll_extraction(extraction_id: str, db: Session = Depends(get_db)):
    """Return current status + proposed diffs when done."""
    row = db.query(Extraction).filter(Extraction.id == extraction_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail=f"Extraction '{extraction_id}' not found")

    return ExtractionStatus(
        extraction_id=row.id,
        status=row.status,
        proposed_diffs=row.proposed_diffs,
        error=row.error,
    )
