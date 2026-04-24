from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.audit_log import AuditLog
from app.schemas.audit import AuditListOut

router = APIRouter()


@router.get("/audit", response_model=AuditListOut)
def list_audit_entries(
    property_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None, description="Filter by action type (e.g. context.write)"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List audit log entries, optionally filtered by property_id and/or action type."""
    query = db.query(AuditLog)
    if property_id:
        query = query.filter(AuditLog.property_id == property_id)
    if action:
        query = query.filter(AuditLog.action == action)

    total = query.count()
    items = (
        query.order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return AuditListOut(items=items, total=total, limit=limit, offset=offset)
