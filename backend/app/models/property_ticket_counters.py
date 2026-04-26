import sqlalchemy as sa
from app.database import Base


class PropertyTicketCounter(Base):
    """
    Per-property monotonic counter for ticket numbering (e.g. GAR-118).
    Atomic increments via UPDATE…RETURNING to avoid race conditions.
    """

    __tablename__ = "property_ticket_counters"

    property_id = sa.Column(
        sa.String,
        sa.ForeignKey("properties.id", ondelete="CASCADE"),
        primary_key=True,
    )
    prefix = sa.Column(sa.Text, nullable=False)   # e.g. "GAR"
    last_num = sa.Column(sa.Integer, nullable=False, server_default="0")
