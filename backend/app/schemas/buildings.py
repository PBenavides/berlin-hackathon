from datetime import datetime
from typing import Optional, List, Any

from app.schemas.base import CamelModel


class BuildingOut(CamelModel):
    id: str
    name: str
    owner_id: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    year_built: Optional[int] = None
    units: Optional[int] = None          # computed from units_count
    systems: Optional[Any] = None
    notes: Optional[str] = None
    vendors: Optional[List[str]] = None  # list of vendor IDs
    created_at: datetime
