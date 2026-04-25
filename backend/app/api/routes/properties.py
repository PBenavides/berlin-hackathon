from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.properties import Property
from app.models.tickets import Ticket
from app.models.units import Unit
from app.models.context_versions import ContextVersion
from app.schemas.properties import PropertyOut

router = APIRouter()


def _enrich(prop: Property, db: Session) -> PropertyOut:
    """Attach computed stats to a Property ORM object."""
    open_tickets = (
        db.query(Ticket)
        .filter(
            Ticket.property_id == prop.id,
            Ticket.status.notin_(["resolved", "rejected"]),
        )
        .count()
    )
    units = db.query(Unit).filter(Unit.property_id == prop.id).count()
    latest_ctx = (
        db.query(ContextVersion)
        .filter(ContextVersion.property_id == prop.id)
        .order_by(ContextVersion.version.desc())
        .first()
    )
    out = PropertyOut.model_validate(prop)
    out.open_tickets = open_tickets
    out.units = units
    out.context_version = latest_ctx.version if latest_ctx else None
    return out


@router.get("/properties", response_model=List[PropertyOut])
def list_properties(db: Session = Depends(get_db)):
    """List all properties with computed stats."""
    props = db.query(Property).order_by(Property.created_at).all()
    return [_enrich(p, db) for p in props]


@router.get("/properties/{property_id}", response_model=PropertyOut)
def get_property(property_id: str, db: Session = Depends(get_db)):
    """Get a single property by ID."""
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return _enrich(prop, db)
