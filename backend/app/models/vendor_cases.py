import sqlalchemy as sa
from app.database import Base


class VendorCase(Base):
    """Historical job/case records for a vendor at a property."""

    __tablename__ = "vendor_cases"

    id = sa.Column(sa.String, primary_key=True)
    vendor_id = sa.Column(
        sa.String,
        sa.ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False,
    )
    property_id = sa.Column(
        sa.String,
        sa.ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
    )
    date = sa.Column(sa.Text, nullable=True)          # ISO date string "2025-11-04"
    description = sa.Column(sa.Text, nullable=True)
    cost_eur = sa.Column(sa.Numeric, nullable=True)
    sla_met = sa.Column(sa.Boolean, nullable=True)
    rating = sa.Column(sa.Integer, nullable=True)     # 1-5
    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
