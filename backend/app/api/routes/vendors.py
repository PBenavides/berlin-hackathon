from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.vendors import Vendor
from app.models.vendor_cases import VendorCase
from app.models.building_vendors import BuildingVendor
from app.schemas.vendors import VendorOut, VendorCaseOut

router = APIRouter()


def _enrich(vendor: Vendor, db: Session, include_cases: bool = False) -> VendorOut:
    building_ids = [
        row.building_id
        for row in db.query(BuildingVendor)
        .filter(BuildingVendor.vendor_id == vendor.id)
        .all()
    ]
    out = VendorOut.model_validate(vendor)
    out.buildings = building_ids
    if include_cases:
        cases = (
            db.query(VendorCase)
            .filter(VendorCase.vendor_id == vendor.id)
            .order_by(VendorCase.created_at.desc())
            .all()
        )
        out.cases = [VendorCaseOut.model_validate(c) for c in cases]
    return out


@router.get("/vendors", response_model=List[VendorOut])
def list_vendors(
    building_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all vendors, optionally filtered by building."""
    query = db.query(Vendor)
    if building_id:
        vendor_ids = [
            row.vendor_id
            for row in db.query(BuildingVendor)
            .filter(BuildingVendor.building_id == building_id)
            .all()
        ]
        query = query.filter(Vendor.id.in_(vendor_ids))
    vendors = query.order_by(Vendor.name).all()
    return [_enrich(v, db) for v in vendors]


@router.get("/vendors/{vendor_id}", response_model=VendorOut)
def get_vendor(vendor_id: str, db: Session = Depends(get_db)):
    """Get vendor detail including job case history."""
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return _enrich(vendor, db, include_cases=True)
