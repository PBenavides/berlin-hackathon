"""
agent_activity.py — Global activity feed for the background agent queue.

Each row represents one meaningful event the auto-solve agent performed or
observed.  The feed is intentionally lightweight — it's only used for the
demo display panel, not for audit purposes (AgentAction owns the full audit
trail per ticket).
"""
import sqlalchemy as sa
from app.database import Base


class AgentActivityEntry(Base):
    __tablename__ = "agent_activity_feed"

    id = sa.Column(
        sa.String,
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    # Optional ticket linkage — NULL entries represent queue-level events
    ticket_id = sa.Column(
        sa.String,
        sa.ForeignKey("tickets.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Human-readable ticket reference (e.g. "GAR-118") — stored redundantly
    # so the feed is readable even if the ticket is later deleted.
    ticket_num = sa.Column(sa.Text, nullable=True)

    # Type of event: "queue_started" | "queue_stopped" | "ticket_started" |
    # "ticket_completed" | "ticket_skipped" | "ticket_error" |
    # "action_read" | "action_proposed" | "action_confirmed" | "action_escalated"
    event_type = sa.Column(sa.Text, nullable=False)

    # The specific agent tool or action name (e.g. "send_vendor_email")
    action_type = sa.Column(sa.Text, nullable=True)

    # Human-readable description for the feed card
    description = sa.Column(sa.Text, nullable=False)

    # Visual severity: "info" | "success" | "warning" | "error"
    severity = sa.Column(sa.Text, nullable=False, default="info", server_default="info")

    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
