import sqlalchemy as sa
from app.database import Base


class Unit(Base):
    __tablename__ = "units"

    id = sa.Column(sa.String, primary_key=True)
    property_id = sa.Column(
        sa.String,
        sa.ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
    )
    label = sa.Column(sa.Text, nullable=False)         # e.g. "1A", "3B", "E1"
    type = sa.Column(sa.Text, nullable=False, server_default="residential")
    area_qm = sa.Column(sa.Numeric, nullable=True)
    mea_permille = sa.Column(sa.Integer, nullable=True)
    owner_name = sa.Column(sa.Text, nullable=True)
    owner_since = sa.Column(sa.Integer, nullable=True)  # year
    tenant = sa.Column(sa.Text, nullable=True)
    rent_eur = sa.Column(sa.Numeric, nullable=True)     # null = self-occupied
    beirat = sa.Column(sa.Boolean, nullable=False, server_default="false")
    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
