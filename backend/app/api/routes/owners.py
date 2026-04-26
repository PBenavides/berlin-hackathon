from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.owners import Owner
from app.schemas.owners import OwnerOut

router = APIRouter()


@router.get("/owners", response_model=List[OwnerOut])
def list_owners(db: Session = Depends(get_db)):
    """List all owners."""
    return db.query(Owner).order_by(Owner.created_at).all()


@router.get("/owners/{owner_id}", response_model=OwnerOut)
def get_owner(owner_id: str, db: Session = Depends(get_db)):
    """Get a single owner by ID."""
    owner = db.query(Owner).filter(Owner.id == owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")
    return owner
