import sqlalchemy as sa
from app.database import Base


class AgentProposal(Base):
    __tablename__ = "agent_proposals"

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
    context_version_id = sa.Column(
        sa.String,
        sa.ForeignKey("context_versions.id", ondelete="SET NULL"),
        nullable=True,
    )
    proposed_external_action = sa.Column(sa.JSON, nullable=False)
    context_delta = sa.Column(sa.JSON, nullable=False)
    reasoning = sa.Column(sa.Text, nullable=False)
    citations = sa.Column(sa.JSON, nullable=False)
    policy_evaluation = sa.Column(sa.JSON, nullable=True)
    risk_level = sa.Column(sa.Text, nullable=False)
    confidence = sa.Column(sa.Numeric, nullable=True)
    action_status = sa.Column(sa.Text, nullable=False, default="pending", server_default="pending")
    memory_status = sa.Column(sa.Text, nullable=False, default="pending", server_default="pending")
    reviewed_by = sa.Column(sa.Text, nullable=True)
    reviewed_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
    final_external_action = sa.Column(sa.JSON, nullable=True)
    final_context_update_md = sa.Column(sa.Text, nullable=True)
    rejection_reason = sa.Column(sa.Text, nullable=True)
    slack_message_ts = sa.Column(sa.Text, nullable=True)
    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
