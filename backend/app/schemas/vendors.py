from datetime import datetime
from typing import Optional, List

from app.schemas.base import CamelModel


class VendorCaseOut(CamelModel):
    id: str
    property_id: str
    date: Optional[str] = None
    description: Optional[str] = None
    cost_eur: Optional[float] = None
    sla_met: Optional[bool] = None
    rating: Optional[int] = None


class VendorOut(CamelModel):
    id: str
    name: str
    trade: str
    contact: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    rating: Optional[float] = None
    preferred: bool = False
    sla_hours: Optional[int] = None
    buildings: Optional[List[str]] = None    # list of building IDs
    cases: Optional[List[VendorCaseOut]] = None
    created_at: datetime
