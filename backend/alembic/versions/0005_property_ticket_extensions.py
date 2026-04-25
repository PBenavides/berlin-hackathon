"""Property and Ticket model extensions

Properties gain: building_id, owner_id, city, phone, email
Tickets gain: num, unit_id, risk, excerpt, raised_by_phone, confidence
Tickets: migrate status 'open' -> 'new', update default to 'new'

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-26 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # properties extensions
    # ------------------------------------------------------------------
    op.add_column("properties", sa.Column("building_id", sa.String(), nullable=True))
    op.add_column("properties", sa.Column("owner_id", sa.String(), nullable=True))
    op.add_column("properties", sa.Column("city", sa.Text(), nullable=True))
    op.add_column("properties", sa.Column("phone", sa.Text(), nullable=True))
    op.add_column("properties", sa.Column("email", sa.Text(), nullable=True))

    op.create_foreign_key(
        "fk_properties_building_id",
        "properties",
        "buildings",
        ["building_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_properties_owner_id",
        "properties",
        "owners",
        ["owner_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # ------------------------------------------------------------------
    # tickets extensions
    # ------------------------------------------------------------------
    op.add_column("tickets", sa.Column("num", sa.Text(), nullable=True))
    op.add_column("tickets", sa.Column("unit_id", sa.String(), nullable=True))
    op.add_column("tickets", sa.Column("risk", sa.Text(), nullable=True))
    op.add_column("tickets", sa.Column("excerpt", sa.Text(), nullable=True))
    op.add_column("tickets", sa.Column("raised_by_phone", sa.Text(), nullable=True))
    op.add_column("tickets", sa.Column("confidence", sa.Numeric(), nullable=True))

    op.create_foreign_key(
        "fk_tickets_unit_id",
        "tickets",
        "units",
        ["unit_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Migrate old 'open' status to 'new'
    op.execute("UPDATE tickets SET status = 'new' WHERE status = 'open'")

    # Update the server default for new tickets
    op.alter_column(
        "tickets",
        "status",
        server_default="new",
        existing_type=sa.Text(),
        existing_nullable=False,
    )

    # Index for fast lookup by num
    op.create_index("ix_tickets_num", "tickets", ["num"])
    op.create_index("ix_tickets_property_num", "tickets", ["property_id", "num"])


def downgrade() -> None:
    op.drop_index("ix_tickets_property_num", table_name="tickets")
    op.drop_index("ix_tickets_num", table_name="tickets")

    op.drop_constraint("fk_tickets_unit_id", "tickets", type_="foreignkey")
    op.drop_column("tickets", "confidence")
    op.drop_column("tickets", "raised_by_phone")
    op.drop_column("tickets", "excerpt")
    op.drop_column("tickets", "risk")
    op.drop_column("tickets", "unit_id")
    op.drop_column("tickets", "num")

    op.drop_constraint("fk_properties_owner_id", "properties", type_="foreignkey")
    op.drop_constraint("fk_properties_building_id", "properties", type_="foreignkey")
    op.drop_column("properties", "email")
    op.drop_column("properties", "phone")
    op.drop_column("properties", "city")
    op.drop_column("properties", "owner_id")
    op.drop_column("properties", "building_id")

    # Revert status default and migrate 'new' back to 'open'
    op.execute("UPDATE tickets SET status = 'open' WHERE status = 'new'")
    op.alter_column(
        "tickets",
        "status",
        server_default="open",
        existing_type=sa.Text(),
        existing_nullable=False,
    )
