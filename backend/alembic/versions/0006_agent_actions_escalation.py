"""Add agent_actions table and ticket escalation fields

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-26 00:00:00.000000

Sprint 2 changes:
  - New table: agent_actions (streaming action cards per ticket)
  - Tickets gain: escalation_reason, escalated_at
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # agent_actions table — persisted streaming action cards per ticket
    # ------------------------------------------------------------------
    op.create_table(
        "agent_actions",
        sa.Column(
            "id",
            sa.String(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("ticket_id", sa.String(), nullable=False),
        sa.Column("run_id", sa.String(), nullable=True),
        sa.Column("call_id", sa.String(), nullable=True),
        sa.Column("action_type", sa.Text(), nullable=False),
        sa.Column("tool_name", sa.Text(), nullable=True),
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Text(),
            nullable=False,
            server_default="completed",
        ),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["ticket_id"],
            ["tickets.id"],
            ondelete="CASCADE",
            name="fk_agent_actions_ticket_id",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_actions_ticket_id", "agent_actions", ["ticket_id"])
    op.create_index("ix_agent_actions_run_id", "agent_actions", ["run_id"])

    # ------------------------------------------------------------------
    # tickets escalation extensions
    # ------------------------------------------------------------------
    op.add_column("tickets", sa.Column("escalation_reason", sa.Text(), nullable=True))
    op.add_column(
        "tickets",
        sa.Column("escalated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tickets", "escalated_at")
    op.drop_column("tickets", "escalation_reason")

    op.drop_index("ix_agent_actions_run_id", table_name="agent_actions")
    op.drop_index("ix_agent_actions_ticket_id", table_name="agent_actions")
    op.drop_table("agent_actions")
