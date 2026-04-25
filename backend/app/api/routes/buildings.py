from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.buildings import Building
from app.models.building_vendors import BuildingVendor
from app.models.units import Unit
from app.schemas.buildings import BuildingOut

router = APIRouter()


def _enrich(building: Building, db: Session) -> BuildingOut:
    """Attach computed fields to a Building ORM object."""
    vendor_ids = [
        row.vendor_id
        for row in db.query(BuildingVendor)
        .filter(BuildingVendor.building_id == building.id)
        .all()
    ]
    units_count = db.query(Unit).filter(Unit.property_id.in_(
        # Units belong to properties which belong to this building
        # For simplicity, use building.units_count directly
        []
    )).count()

    out = BuildingOut.model_validate(building)
    out.vendors = vendor_ids
    out.units = building.units_count
    return out


@router.get("/buildings", response_model=List[BuildingOut])
def list_buildings(db: Session = Depends(get_db)):
    """List all buildings."""
    buildings = db.query(Building).order_by(Building.created_at).all()
    return [_enrich(b, db) for b in buildings]


@router.get("/buildings/{building_id}", response_model=BuildingOut)
def get_building(building_id: str, db: Session = Depends(get_db)):
    """Get a single building by ID."""
    building = db.query(Building).filter(Building.id == building_id).first()
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")
    return _enrich(building, db)
