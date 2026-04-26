"""Add agent_activity_feed table for auto-solve queue events

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-26 00:00:00.000000

Sprint 3 changes:
  - New table: agent_activity_feed (global activity feed for the auto-solve queue)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_activity_feed",
        sa.Column(
            "id",
            sa.String(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("ticket_id", sa.String(), nullable=True),
        sa.Column("ticket_num", sa.Text(), nullable=True),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("action_type", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "severity",
            sa.Text(),
            nullable=False,
            server_default="info",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["ticket_id"],
            ["tickets.id"],
            ondelete="SET NULL",
            name="fk_agent_activity_ticket_id",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_agent_activity_created_at",
        "agent_activity_feed",
        ["created_at"],
    )
    op.create_index(
        "ix_agent_activity_ticket_id",
        "agent_activity_feed",
        ["ticket_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_agent_activity_ticket_id", table_name="agent_activity_feed")
    op.drop_index("ix_agent_activity_created_at", table_name="agent_activity_feed")
    op.drop_table("agent_activity_feed")
