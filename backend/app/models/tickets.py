import sqlalchemy as sa
from app.database import Base

# 10-state ticket status (app-layer string enum, NOT a Postgres ENUM type
# so that adding new states never requires a DB migration)
VALID_TICKET_STATUSES = {
    "new",
    "triaged",
    "proposed",
    "approved",
    "awaiting_vendor",
    "scheduled",
    "in_progress",
    "completed",
    "resolved",
    "rejected",
}


class Ticket(Base):
    __tablename__ = "tickets"

    id = sa.Column(
        sa.String,
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    property_id = sa.Column(
        sa.String,
        sa.ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
    )
    source = sa.Column(sa.Text, nullable=False)
    external_id = sa.Column(sa.Text, nullable=True)
    raised_by = sa.Column(sa.Text, nullable=False)

    # Sprint-1 extensions
    num = sa.Column(sa.Text, nullable=True)           # e.g. "GAR-118"
    unit_id = sa.Column(
        sa.String,
        sa.ForeignKey("units.id", ondelete="SET NULL"),
        nullable=True,
    )
    risk = sa.Column(sa.Text, nullable=True)          # "low"|"medium"|"high"
    excerpt = sa.Column(sa.Text, nullable=True)       # short summary for list views
    raised_by_phone = sa.Column(sa.Text, nullable=True)
    confidence = sa.Column(sa.Numeric, nullable=True)

    subject = sa.Column(sa.Text, nullable=False)
    body = sa.Column(sa.Text, nullable=False)
    # Extended 10-state status (stored as text, validated in service layer)
    status = sa.Column(sa.Text, nullable=False, default="new", server_default="new")

    # Sprint 2: escalation fields — set when escalate_to_human action is confirmed
    escalation_reason = sa.Column(sa.Text, nullable=True)
    escalated_at = sa.Column(sa.DateTime(timezone=True), nullable=True)

    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
