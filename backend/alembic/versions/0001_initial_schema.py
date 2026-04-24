"""Initial schema: all 8 tables

Revision ID: 0001
Revises:
Create Date: 2026-04-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable uuid-ossp extension for gen_random_uuid()
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    # properties
    op.create_table(
        "properties",
        sa.Column("id", sa.String(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("slack_channel", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # context_versions
    op.create_table(
        "context_versions",
        sa.Column("id", sa.String(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("property_id", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("content_md", sa.Text(), nullable=False),
        sa.Column("frontmatter", sa.JSON(), nullable=True),
        sa.Column("created_by", sa.Text(), nullable=False),
        sa.Column("created_reason", sa.Text(), nullable=True),
        sa.Column("parent_version", sa.Integer(), nullable=True),
        sa.Column("source_proposal_id", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("property_id", "version", name="uq_context_versions_property_version"),
    )

    # context_chunks
    op.create_table(
        "context_chunks",
        sa.Column("id", sa.String(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("context_version_id", sa.String(), nullable=False),
        sa.Column("property_id", sa.String(), nullable=False),
        sa.Column("heading", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["context_version_id"], ["context_versions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # property_policies
    op.create_table(
        "property_policies",
        sa.Column("id", sa.String(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("property_id", sa.String(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("rule_json", sa.JSON(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # context_sources
    op.create_table(
        "context_sources",
        sa.Column("id", sa.String(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("property_id", sa.String(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("uri", sa.Text(), nullable=False),
        sa.Column("sha256", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="allowed"),
        sa.Column("approved_by", sa.Text(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # tickets
    op.create_table(
        "tickets",
        sa.Column("id", sa.String(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("property_id", sa.String(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("external_id", sa.Text(), nullable=True),
        sa.Column("raised_by", sa.Text(), nullable=False),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="open"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # agent_proposals
    op.create_table(
        "agent_proposals",
        sa.Column("id", sa.String(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("ticket_id", sa.String(), nullable=False),
        sa.Column("context_version_id", sa.String(), nullable=True),
        sa.Column("proposed_external_action", sa.JSON(), nullable=False),
        sa.Column("context_delta", sa.JSON(), nullable=False),
        sa.Column("reasoning", sa.Text(), nullable=False),
        sa.Column("citations", sa.JSON(), nullable=False),
        sa.Column("policy_evaluation", sa.JSON(), nullable=True),
        sa.Column("risk_level", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Numeric(), nullable=True),
        sa.Column("action_status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("memory_status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("reviewed_by", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("final_external_action", sa.JSON(), nullable=True),
        sa.Column("final_context_update_md", sa.Text(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("slack_message_ts", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["context_version_id"], ["context_versions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # audit_log
    op.create_table(
        "audit_log",
        sa.Column("id", sa.String(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("actor", sa.Text(), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("property_id", sa.String(), nullable=True),
        sa.Column("entity_type", sa.Text(), nullable=False),
        sa.Column("entity_id", sa.String(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("agent_proposals")
    op.drop_table("tickets")
    op.drop_table("context_sources")
    op.drop_table("property_policies")
    op.drop_table("context_chunks")
    op.drop_table("context_versions")
    op.drop_table("properties")
