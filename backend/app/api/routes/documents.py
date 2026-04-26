"""Property document upload + retrieval.

Each PDF uploaded here is associated with a single property (one property =
one Hermes-managed user, so property_id is the routing key). On upload we:
  1. Persist the file to {documents_dir}/{property_id}/{doc_id}_{filename}
  2. Run pdf_service.extract_text() synchronously
  3. Store the extracted text on the row so the Hermes dispatcher can later
     splice it into the agent's context without re-parsing.
"""
import hashlib
import os
import uuid
from pathlib import PurePath
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.properties import Property
from app.models.property_documents import PropertyDocument
from app.schemas.property_documents import (
    PropertyDocumentDetail,
    PropertyDocumentOut,
)
from app.services.audit_service import create_audit_entry
from app.services.pdf_service import extract_text

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_filename(raw: Optional[str]) -> str:
    if not raw:
        return f"upload-{uuid.uuid4().hex[:8]}.pdf"
    return PurePath(raw).name or f"upload-{uuid.uuid4().hex[:8]}.pdf"


def _file_url(document_id: str) -> str:
    return f"/api/documents/{document_id}/file"


def _to_summary(doc: PropertyDocument) -> PropertyDocumentOut:
    return PropertyDocumentOut(
        id=doc.id,
        property_id=doc.property_id,
        filename=doc.filename,
        mime_type=doc.mime_type,
        size_bytes=doc.size_bytes,
        sha256=doc.sha256,
        page_count=doc.page_count,
        extraction_error=doc.extraction_error,
        has_extracted_text=bool(doc.extracted_text),
        file_url=_file_url(doc.id),
        created_at=doc.created_at,
    )


def _to_detail(doc: PropertyDocument) -> PropertyDocumentDetail:
    summary = _to_summary(doc)
    return PropertyDocumentDetail(
        **summary.model_dump(),
        extracted_text=doc.extracted_text,
    )


def _is_pdf(upload: UploadFile, raw: bytes) -> bool:
    if (upload.content_type or "").lower() == "application/pdf":
        return True
    return raw.startswith(b"%PDF-")


# ---------------------------------------------------------------------------
# POST /properties/{property_id}/documents — upload + extract
# ---------------------------------------------------------------------------


@router.post(
    "/properties/{property_id}/documents",
    response_model=PropertyDocumentDetail,
    status_code=201,
)
async def upload_property_document(
    property_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    settings = get_settings()

    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file upload")

    if len(raw) > settings.max_document_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {settings.max_document_bytes} bytes",
        )

    if not _is_pdf(file, raw):
        raise HTTPException(
            status_code=415,
            detail="Only PDF uploads are supported",
        )

    sha = hashlib.sha256(raw).hexdigest()
    doc_id = uuid.uuid4().hex
    filename = _safe_filename(file.filename)

    prop_dir = os.path.join(settings.documents_dir, property_id)
    os.makedirs(prop_dir, exist_ok=True)
    storage_path = os.path.join(prop_dir, f"{doc_id}_{filename}")
    with open(storage_path, "wb") as fh:
        fh.write(raw)

    extraction = extract_text(storage_path)

    doc = PropertyDocument(
        id=doc_id,
        property_id=property_id,
        filename=filename,
        mime_type="application/pdf",
        size_bytes=len(raw),
        sha256=sha,
        storage_path=storage_path,
        page_count=extraction["page_count"] or None,
        extracted_text=extraction["full_text"] or None,
        extraction_error=extraction["error"],
    )
    db.add(doc)
    db.flush()

    create_audit_entry(
        db,
        actor="api",
        action="property_document.upload",
        entity_type="property_document",
        property_id=property_id,
        entity_id=doc.id,
        metadata={
            "filename": filename,
            "size_bytes": len(raw),
            "sha256": sha,
            "page_count": extraction["page_count"],
            "truncated": extraction["truncated"],
            "extraction_error": extraction["error"],
        },
    )

    db.commit()
    db.refresh(doc)
    return _to_detail(doc)


# ---------------------------------------------------------------------------
# GET /properties/{property_id}/documents — list
# ---------------------------------------------------------------------------


@router.get(
    "/properties/{property_id}/documents",
    response_model=List[PropertyDocumentOut],
)
def list_property_documents(
    property_id: str,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    if limit < 1 or limit > 500:
        raise HTTPException(
            status_code=400, detail="limit must be between 1 and 500"
        )

    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    rows = (
        db.query(PropertyDocument)
        .filter(PropertyDocument.property_id == property_id)
        .order_by(PropertyDocument.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_to_summary(r) for r in rows]


# ---------------------------------------------------------------------------
# GET /documents/{id} — detail (with extracted_text)
# ---------------------------------------------------------------------------


@router.get(
    "/documents/{document_id}",
    response_model=PropertyDocumentDetail,
)
def get_document(document_id: str, db: Session = Depends(get_db)):
    doc = (
        db.query(PropertyDocument)
        .filter(PropertyDocument.id == document_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return _to_detail(doc)


# ---------------------------------------------------------------------------
# GET /documents/{id}/file — download original PDF bytes
# ---------------------------------------------------------------------------


@router.get("/documents/{document_id}/file")
def get_document_file(document_id: str, db: Session = Depends(get_db)):
    doc = (
        db.query(PropertyDocument)
        .filter(PropertyDocument.id == document_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not os.path.isfile(doc.storage_path):
        raise HTTPException(
            status_code=410, detail="Document file is missing from storage"
        )

    return FileResponse(
        path=doc.storage_path,
        media_type=doc.mime_type,
        filename=doc.filename,
    )


# ---------------------------------------------------------------------------
# DELETE /documents/{id}
# ---------------------------------------------------------------------------


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(document_id: str, db: Session = Depends(get_db)):
    doc = (
        db.query(PropertyDocument)
        .filter(PropertyDocument.id == document_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    property_id = doc.property_id
    storage_path = doc.storage_path

    db.delete(doc)

    create_audit_entry(
        db,
        actor="api",
        action="property_document.delete",
        entity_type="property_document",
        property_id=property_id,
        entity_id=document_id,
        metadata={"filename": doc.filename, "sha256": doc.sha256},
    )

    db.commit()

    try:
        if os.path.isfile(storage_path):
            os.remove(storage_path)
    except OSError:
        # File cleanup is best-effort; the row is already gone.
        pass

    return None
