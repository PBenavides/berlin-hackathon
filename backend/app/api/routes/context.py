from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.properties import Property
from app.models.context_versions import ContextVersion
from app.schemas.context_versions import ContextVersionOut, ContextVersionCreate, DiffOut
from app.services.audit_service import create_audit_entry
from app.services.context_service import compute_diff, create_context_chunks, get_next_version

router = APIRouter()


def _get_property_or_404(db: Session, property_id: str) -> Property:
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop


@router.get("/properties/{property_id}/context", response_model=ContextVersionOut)
def get_latest_context(property_id: str, db: Session = Depends(get_db)):
    """Get the latest context version for a property."""
    _get_property_or_404(db, property_id)

    cv = (
        db.query(ContextVersion)
        .filter(ContextVersion.property_id == property_id)
        .order_by(ContextVersion.version.desc())
        .first()
    )
    if not cv:
        raise HTTPException(status_code=404, detail="No context version found for this property")

    create_audit_entry(
        db,
        actor="api",
        action="context.read",
        entity_type="context_version",
        property_id=property_id,
        entity_id=cv.id,
        metadata={"version": cv.version},
    )
    db.commit()
    return cv


@router.get("/properties/{property_id}/context/versions", response_model=List[ContextVersionOut])
def list_context_versions(property_id: str, db: Session = Depends(get_db)):
    """List all context versions for a property."""
    _get_property_or_404(db, property_id)

    return (
        db.query(ContextVersion)
        .filter(ContextVersion.property_id == property_id)
        .order_by(ContextVersion.version.desc())
        .all()
    )


@router.get("/properties/{property_id}/context/versions/{version}", response_model=ContextVersionOut)
def get_context_version(property_id: str, version: int, db: Session = Depends(get_db)):
    """Get a specific context version."""
    _get_property_or_404(db, property_id)

    cv = (
        db.query(ContextVersion)
        .filter(
            ContextVersion.property_id == property_id,
            ContextVersion.version == version,
        )
        .first()
    )
    if not cv:
        raise HTTPException(status_code=404, detail=f"Context version {version} not found")

    create_audit_entry(
        db,
        actor="api",
        action="context.read",
        entity_type="context_version",
        property_id=property_id,
        entity_id=cv.id,
        metadata={"version": cv.version},
    )
    db.commit()
    return cv


@router.post("/properties/{property_id}/context", response_model=ContextVersionOut, status_code=201)
def create_context_version(
    property_id: str,
    payload: ContextVersionCreate,
    db: Session = Depends(get_db),
):
    """Create a new context version for a property."""
    _get_property_or_404(db, property_id)

    next_version = get_next_version(db, property_id)

    cv = ContextVersion(
        property_id=property_id,
        version=next_version,
        content_md=payload.content_md,
        frontmatter=payload.frontmatter,
        created_by=payload.created_by,
        created_reason=payload.created_reason,
        parent_version=payload.parent_version,
        source_proposal_id=payload.source_proposal_id,
    )
    db.add(cv)
    db.flush()

    # Auto-create chunks
    create_context_chunks(db, cv.id, property_id, payload.content_md)

    create_audit_entry(
        db,
        actor=payload.created_by,
        action="context.write",
        entity_type="context_version",
        property_id=property_id,
        entity_id=cv.id,
        metadata={"version": cv.version, "reason": payload.created_reason},
    )
    db.commit()
    db.refresh(cv)
    return cv


@router.get("/properties/{property_id}/context/diff", response_model=DiffOut)
def get_context_diff(
    property_id: str,
    from_version: int = Query(..., alias="from"),
    to_version: int = Query(..., alias="to"),
    db: Session = Depends(get_db),
):
    """Return unified diff between two context versions."""
    _get_property_or_404(db, property_id)

    cv_from = (
        db.query(ContextVersion)
        .filter(
            ContextVersion.property_id == property_id,
            ContextVersion.version == from_version,
        )
        .first()
    )
    cv_to = (
        db.query(ContextVersion)
        .filter(
            ContextVersion.property_id == property_id,
            ContextVersion.version == to_version,
        )
        .first()
    )

    if not cv_from:
        raise HTTPException(status_code=404, detail=f"Version {from_version} not found")
    if not cv_to:
        raise HTTPException(status_code=404, detail=f"Version {to_version} not found")

    diff = compute_diff(
        cv_from.content_md,
        cv_to.content_md,
        from_label=f"v{from_version}",
        to_label=f"v{to_version}",
    )

    return DiffOut(from_version=from_version, to_version=to_version, diff=diff)
