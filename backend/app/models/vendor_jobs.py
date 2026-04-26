import sqlalchemy as sa
from app.database import Base


class VendorJob(Base):
    """Vendor dispatch job created when a ticket proposal is approved."""

    __tablename__ = "vendor_jobs"

    id = sa.Column(sa.String, primary_key=True)
    ticket_id = sa.Column(
        sa.String,
        sa.ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    vendor_id = sa.Column(
        sa.String,
        sa.ForeignKey("vendors.id", ondelete="SET NULL"),
        nullable=True,
    )
    sent_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
    accepted = sa.Column(sa.Boolean, nullable=True)
    scheduled_for = sa.Column(sa.DateTime(timezone=True), nullable=True)
    completed_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
    final_cost_eur = sa.Column(sa.Numeric, nullable=True)
    notes = sa.Column(sa.Text, nullable=True)
    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
