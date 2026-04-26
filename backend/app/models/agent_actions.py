"""
agent_actions.py — Persisted record of every agent tool call / proposal on a ticket.

Each agent run on a ticket produces a sequence of AgentAction rows:
  - READ tools  → status="completed"  (context lookups, vendor lookups, etc.)
  - WRITE tools → status="proposed"   (email draft, tenant response, escalation, etc.)

Rows are created in real-time as the agent streams, allowing the ticket detail
UI to show a live narrative of agent reasoning.
"""
import sqlalchemy as sa
from app.database import Base


class AgentAction(Base):
    __tablename__ = "agent_actions"

    id = sa.Column(
        sa.String,
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    ticket_id = sa.Column(
        sa.String,
        sa.ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    # All actions from a single agent invocation share the same run_id
    run_id = sa.Column(sa.String, nullable=True)
    # Matches the LLM tool_call id so we can correlate tool_call → tool_result / action_proposal
    call_id = sa.Column(sa.String, nullable=True)

    # Action classification
    # "read" | "send_vendor_email" | "respond_to_tenant" | "send_owner_report"
    # | "escalate_to_human" | "approve_ticket" | "reject_ticket" | "save_memory" | etc.
    action_type = sa.Column(sa.Text, nullable=False)
    tool_name = sa.Column(sa.Text, nullable=True)

    # Human-readable label and description for the UI card
    label = sa.Column(sa.Text, nullable=True)
    description = sa.Column(sa.Text, nullable=True)

    # Status lifecycle: "thinking" → "completed" (reads) or "proposed" (writes)
    # After operator acts: "confirmed" | "rejected"
    status = sa.Column(
        sa.Text,
        nullable=False,
        default="completed",
        server_default="completed",
    )

    # Full event payload (args, result, proposal envelope, etc.)
    payload = sa.Column(sa.JSON, nullable=True)

    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
