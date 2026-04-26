import sqlalchemy as sa
from app.database import Base


class BuildingVendor(Base):
    """M:N join table linking buildings to their assigned vendors."""

    __tablename__ = "building_vendors"

    building_id = sa.Column(
        sa.String,
        sa.ForeignKey("buildings.id", ondelete="CASCADE"),
        primary_key=True,
    )
    vendor_id = sa.Column(
        sa.String,
        sa.ForeignKey("vendors.id", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
