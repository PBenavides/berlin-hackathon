from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.properties import Property
from app.schemas.properties import PropertyOut

router = APIRouter()


@router.get("/properties", response_model=List[PropertyOut])
def list_properties(db: Session = Depends(get_db)):
    """List all properties."""
    return db.query(Property).order_by(Property.created_at).all()


@router.get("/properties/{property_id}", response_model=PropertyOut)
def get_property(property_id: str, db: Session = Depends(get_db)):
    """Get a single property by ID."""
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop
