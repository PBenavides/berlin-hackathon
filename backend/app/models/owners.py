import sqlalchemy as sa
from app.database import Base


class Owner(Base):
    __tablename__ = "owners"

    id = sa.Column(sa.String, primary_key=True)
    name = sa.Column(sa.Text, nullable=False)
    type = sa.Column(sa.Text, nullable=False, server_default="individual")
    contact = sa.Column(sa.Text, nullable=True)
    email = sa.Column(sa.Text, nullable=True)
    phone = sa.Column(sa.Text, nullable=True)
    language = sa.Column(sa.Text, nullable=True, server_default="de")
    buildings_count = sa.Column(sa.Integer, nullable=False, server_default="0")
    units_count = sa.Column(sa.Integer, nullable=False, server_default="0")
    monthly_revenue_eur = sa.Column(sa.Numeric, nullable=True)
    # JSON columns for flexible owner-specific data
    policies = sa.Column(sa.JSON, nullable=True)    # list[str]
    decisions = sa.Column(sa.JSON, nullable=True)   # list[{date, text}]
    notes = sa.Column(sa.Text, nullable=True)
    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
