import sqlalchemy as sa
from app.database import Base


class Building(Base):
    __tablename__ = "buildings"

    id = sa.Column(sa.String, primary_key=True)
    name = sa.Column(sa.Text, nullable=False)
    owner_id = sa.Column(
        sa.String,
        sa.ForeignKey("owners.id", ondelete="SET NULL"),
        nullable=True,
    )
    address = sa.Column(sa.Text, nullable=True)
    city = sa.Column(sa.Text, nullable=True)
    year_built = sa.Column(sa.Integer, nullable=True)
    units_count = sa.Column(sa.Integer, nullable=False, server_default="0")
    # JSON column for building systems (hvac, heating, elevator, intercom, etc.)
    systems = sa.Column(sa.JSON, nullable=True)
    notes = sa.Column(sa.Text, nullable=True)
    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
