from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.units import Unit
from app.models.properties import Property
from app.schemas.units import UnitOut

router = APIRouter()


@router.get("/properties/{property_id}/units", response_model=List[UnitOut])
def list_property_units(property_id: str, db: Session = Depends(get_db)):
    """List all units for a property."""
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return (
        db.query(Unit)
        .filter(Unit.property_id == property_id)
        .order_by(Unit.label)
        .all()
    )


@router.get("/units/{unit_id}", response_model=UnitOut)
def get_unit(unit_id: str, db: Session = Depends(get_db)):
    """Get a single unit by ID."""
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit
