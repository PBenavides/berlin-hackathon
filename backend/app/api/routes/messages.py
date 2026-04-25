import hashlib
import os
import uuid
from pathlib import PurePath
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.attachments import Attachment
from app.models.owner_messages import OwnerMessage
from app.models.properties import Property
from app.schemas.attachments import AttachmentOut
from app.schemas.messages import MessageDispatchResult, OwnerMessageOut
from app.services.audit_service import create_audit_entry
from app.services.concierge_dispatcher import dispatch as concierge_dispatch

router = APIRouter()


def _gcs_upload(bucket_name: str, blob_path: str, data: bytes, content_type: str) -> str:
    """Upload bytes to GCS, return gs:// URI."""
    from google.cloud import storage as gcs
    client = gcs.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)
    blob.upload_from_string(data, content_type=content_type)
    return f"gs://{bucket_name}/{blob_path}"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_filename(raw: Optional[str]) -> str:
    """Strip directory components and reject empty names."""
    if not raw:
        return f"upload-{uuid.uuid4().hex[:8]}"
    return PurePath(raw).name or f"upload-{uuid.uuid4().hex[:8]}"


def _attachment_url(attachment_id: str) -> str:
    return f"/api/v1/attachments/{attachment_id}"


def _to_attachment_out(att: Attachment) -> AttachmentOut:
    return AttachmentOut(
        id=att.id,
        owner_message_id=att.owner_message_id,
        filename=att.filename,
        mime_type=att.mime_type,
        size_bytes=att.size_bytes,
        sha256=att.sha256,
        vision_description=att.vision_description,
        url=_attachment_url(att.id),
        created_at=att.created_at,
    )


# ---------------------------------------------------------------------------
# POST /properties/{id}/messages — owner sends a message (text + images)
# ---------------------------------------------------------------------------


@router.post(
    "/properties/{property_id}/messages",
    response_model=MessageDispatchResult,
    status_code=201,
)
async def post_property_message(
    property_id: str,
    text: str = Form(...),
    images: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    """
    Owner sends a message (text + zero-or-more images) to the property's
    Hermes concierge. Persists the message and any image attachments, then
    dispatches to Hermes (stubbed in this phase) and returns the result.

    Errors:
      - 404 if the property does not exist
      - 503 if Hermes is disabled (HERMES_ENABLED=false)
      - 409 if the property has no provisioned Hermes profile (added in a
            later phase once the dispatcher exists)
    """
    settings = get_settings()

    if not settings.hermes_enabled:
        raise HTTPException(
            status_code=503,
            detail={"error": "hermes_disabled"},
        )

    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # 1) Persist the OwnerMessage row first so we have an id for storage paths.
    msg = OwnerMessage(property_id=property_id, text=text)
    db.add(msg)
    db.flush()  # populate msg.id

    # 2) Persist each uploaded image to disk and create Attachment rows.
    saved: List[Attachment] = []
    msg_dir = os.path.join(settings.attachments_dir, msg.id)
    if images:
        os.makedirs(msg_dir, exist_ok=True)

    for upload in images:
        raw = await upload.read()
        if not raw:
            continue
        sha = hashlib.sha256(raw).hexdigest()
        filename = _safe_filename(upload.filename)
        mime = upload.content_type or "application/octet-stream"

        if settings.gcs_bucket:
            blob_path = f"attachments/{msg.id}/{filename}"
            storage_path = _gcs_upload(settings.gcs_bucket, blob_path, raw, mime)
        else:
            storage_path = os.path.join(msg_dir, filename)
            with open(storage_path, "wb") as fh:
                fh.write(raw)

        att = Attachment(
            owner_message_id=msg.id,
            filename=filename,
            mime_type=mime,
            size_bytes=len(raw),
            sha256=sha,
            storage_path=storage_path,
            vision_description=None,  # filled by vision_service in a later phase
        )
        db.add(att)
        saved.append(att)

    db.flush()

    # 3) Dispatch to the concierge (direct OpenRouter today; Hermes later).
    result = concierge_dispatch(
        db=db,
        property_id=property_id,
        text=text,
        attachments=saved,
    )
    msg.agent_reply = result.agent_reply
    msg.agent_error = result.agent_error
    msg.dispatch_id = result.dispatch_id
    msg.latency_ms = result.latency_ms

    # 4) Audit the owner-message intake event.
    create_audit_entry(
        db,
        actor="api",
        action="owner_message.create",
        entity_type="owner_message",
        property_id=property_id,
        entity_id=msg.id,
        metadata={
            "text_length": len(text),
            "attachment_count": len(saved),
            "dispatch_id": result.dispatch_id,
            "latency_ms": result.latency_ms,
            "had_error": bool(result.agent_error),
        },
    )

    db.commit()
    db.refresh(msg)
    for att in saved:
        db.refresh(att)

    return MessageDispatchResult(
        message_id=msg.id,
        agent_reply=msg.agent_reply,
        agent_error=msg.agent_error,
        dispatch_id=msg.dispatch_id,
        actions_taken=[],  # populated once dispatch_id correlation is wired
        attachments=[_to_attachment_out(a) for a in saved],
        created_at=msg.created_at,
    )


# ---------------------------------------------------------------------------
# GET /properties/{id}/messages — list past messages for replay/debug
# ---------------------------------------------------------------------------


@router.get(
    "/properties/{property_id}/messages",
    response_model=List[OwnerMessageOut],
)
def list_property_messages(
    property_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    if limit < 1 or limit > 500:
        raise HTTPException(
            status_code=400,
            detail="limit must be between 1 and 500",
        )

    rows = (
        db.query(OwnerMessage)
        .filter(OwnerMessage.property_id == property_id)
        .order_by(OwnerMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    return rows


# ---------------------------------------------------------------------------
# GET /messages/{id} — single message with its attachments
# ---------------------------------------------------------------------------


@router.get(
    "/messages/{message_id}",
    response_model=MessageDispatchResult,
)
def get_message(message_id: str, db: Session = Depends(get_db)):
    msg = db.query(OwnerMessage).filter(OwnerMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    atts = (
        db.query(Attachment)
        .filter(Attachment.owner_message_id == message_id)
        .order_by(Attachment.created_at.asc())
        .all()
    )

    return MessageDispatchResult(
        message_id=msg.id,
        agent_reply=msg.agent_reply,
        agent_error=msg.agent_error,
        dispatch_id=msg.dispatch_id,
        actions_taken=[],
        attachments=[_to_attachment_out(a) for a in atts],
        created_at=msg.created_at,
    )
