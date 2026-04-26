from datetime import datetime
from typing import Optional

from app.schemas.base import CamelModel


class UnitOut(CamelModel):
    id: str
    property_id: str
    label: str
    type: str
    area_qm: Optional[float] = None
    mea_permille: Optional[int] = None
    owner_name: Optional[str] = None
    owner_since: Optional[int] = None
    tenant: Optional[str] = None
    rent_eur: Optional[float] = None
    beirat: bool = False
    created_at: datetime
