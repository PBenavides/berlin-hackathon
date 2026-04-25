from datetime import datetime
from typing import Optional, List, Any

from app.schemas.base import CamelModel


class OwnerOut(CamelModel):
    id: str
    name: str
    type: str
    contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    language: Optional[str] = None
    buildings_count: int = 0
    units_count: int = 0
    monthly_revenue_eur: Optional[float] = None
    policies: Optional[List[str]] = None
    decisions: Optional[List[Any]] = None
    notes: Optional[str] = None
    created_at: datetime
