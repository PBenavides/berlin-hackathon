import sqlalchemy as sa
from app.database import Base


class Vendor(Base):
    __tablename__ = "vendors"

    id = sa.Column(sa.String, primary_key=True)
    name = sa.Column(sa.Text, nullable=False)
    trade = sa.Column(sa.Text, nullable=False)
    contact = sa.Column(sa.Text, nullable=True)
    phone = sa.Column(sa.Text, nullable=True)
    email = sa.Column(sa.Text, nullable=True)
    rating = sa.Column(sa.Numeric, nullable=True)
    preferred = sa.Column(sa.Boolean, nullable=False, server_default="false")
    sla_hours = sa.Column(sa.Integer, nullable=True)
    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
