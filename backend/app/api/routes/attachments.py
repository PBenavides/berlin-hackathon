import datetime
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, RedirectResponse, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.attachments import Attachment

router = APIRouter()


def _gcs_download(storage_path: str) -> tuple[bytes, str]:
    """Download bytes from a gs:// URI. Returns (data, content_type)."""
    from google.cloud import storage as gcs
    # storage_path is "gs://bucket/blob"
    without_scheme = storage_path[5:]
    bucket_name, _, blob_path = without_scheme.partition("/")
    client = gcs.Client()
    blob = client.bucket(bucket_name).blob(blob_path)
    data = blob.download_as_bytes()
    return data, blob.content_type or "application/octet-stream"


@router.get("/attachments/{attachment_id}")
def get_attachment_file(attachment_id: str, db: Session = Depends(get_db)):
    """Serve the stored image bytes with the original mime type."""
    att = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if att.storage_path.startswith("gs://"):
        data, content_type = _gcs_download(att.storage_path)
        return Response(
            content=data,
            media_type=att.mime_type or content_type,
            headers={"Content-Disposition": f'inline; filename="{att.filename}"'},
        )

    if not os.path.isfile(att.storage_path):
        raise HTTPException(
            status_code=410,
            detail="Attachment file is missing from storage",
        )

    return FileResponse(
        path=att.storage_path,
        media_type=att.mime_type,
        filename=att.filename,
    )
