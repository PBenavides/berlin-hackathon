"""Knowledge-layer schema: owners, buildings, building_vendors, vendors,
vendor_cases, units, call_sessions, vendor_jobs, extractions,
property_ticket_counters

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-26 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # owners
    # ------------------------------------------------------------------
    op.create_table(
        "owners",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("type", sa.Text(), nullable=False, server_default="individual"),
        sa.Column("contact", sa.Text(), nullable=True),
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column("phone", sa.Text(), nullable=True),
        sa.Column("language", sa.Text(), nullable=True, server_default="de"),
        sa.Column("buildings_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("units_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("monthly_revenue_eur", sa.Numeric(), nullable=True),
        sa.Column("policies", sa.JSON(), nullable=True),
        sa.Column("decisions", sa.JSON(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # ------------------------------------------------------------------
    # buildings
    # ------------------------------------------------------------------
    op.create_table(
        "buildings",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("owner_id", sa.String(), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("city", sa.Text(), nullable=True),
        sa.Column("year_built", sa.Integer(), nullable=True),
        sa.Column("units_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("systems", sa.JSON(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["owners.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_buildings_owner_id", "buildings", ["owner_id"])

    # ------------------------------------------------------------------
    # vendors
    # ------------------------------------------------------------------
    op.create_table(
        "vendors",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("trade", sa.Text(), nullable=False),
        sa.Column("contact", sa.Text(), nullable=True),
        sa.Column("phone", sa.Text(), nullable=True),
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column("rating", sa.Numeric(), nullable=True),
        sa.Column("preferred", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("sla_hours", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # ------------------------------------------------------------------
    # building_vendors  (M:N)
    # ------------------------------------------------------------------
    op.create_table(
        "building_vendors",
        sa.Column("building_id", sa.String(), nullable=False),
        sa.Column("vendor_id", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["building_id"], ["buildings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("building_id", "vendor_id"),
    )

    # ------------------------------------------------------------------
    # vendor_cases
    # ------------------------------------------------------------------
    op.create_table(
        "vendor_cases",
        sa.Column(
            "id",
            sa.String(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("vendor_id", sa.String(), nullable=False),
        sa.Column("property_id", sa.String(), nullable=False),
        sa.Column("date", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cost_eur", sa.Numeric(), nullable=True),
        sa.Column("sla_met", sa.Boolean(), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vendor_cases_vendor_id", "vendor_cases", ["vendor_id"])
    op.create_index("ix_vendor_cases_property_id", "vendor_cases", ["property_id"])

    # ------------------------------------------------------------------
    # units
    # ------------------------------------------------------------------
    op.create_table(
        "units",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("property_id", sa.String(), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("type", sa.Text(), nullable=False, server_default="residential"),
        sa.Column("area_qm", sa.Numeric(), nullable=True),
        sa.Column("mea_permille", sa.Integer(), nullable=True),
        sa.Column("owner_name", sa.Text(), nullable=True),
        sa.Column("owner_since", sa.Integer(), nullable=True),
        sa.Column("tenant", sa.Text(), nullable=True),
        sa.Column("rent_eur", sa.Numeric(), nullable=True),
        sa.Column("beirat", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_units_property_id", "units", ["property_id"])

    # ------------------------------------------------------------------
    # call_sessions
    # ------------------------------------------------------------------
    op.create_table(
        "call_sessions",
        sa.Column(
            "id",
            sa.String(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("ticket_id", sa.String(), nullable=False),
        sa.Column("duration", sa.Text(), nullable=True),
        sa.Column("caller_phone", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("noise_reduction_db", sa.Integer(), nullable=True),
        sa.Column("transcript", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_call_sessions_ticket_id", "call_sessions", ["ticket_id"])

    # ------------------------------------------------------------------
    # vendor_jobs
    # ------------------------------------------------------------------
    op.create_table(
        "vendor_jobs",
        sa.Column(
            "id",
            sa.String(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("ticket_id", sa.String(), nullable=False),
        sa.Column("vendor_id", sa.String(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted", sa.Boolean(), nullable=True),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("final_cost_eur", sa.Numeric(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vendor_jobs_ticket_id", "vendor_jobs", ["ticket_id"])
    op.create_index("ix_vendor_jobs_completed_at", "vendor_jobs", ["completed_at"])

    # ------------------------------------------------------------------
    # extractions
    # ------------------------------------------------------------------
    op.create_table(
        "extractions",
        sa.Column(
            "id",
            sa.String(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("property_id", sa.String(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="processing"),
        sa.Column("filename", sa.Text(), nullable=True),
        sa.Column("layer", sa.Text(), nullable=True),
        sa.Column("proposed_diffs", sa.JSON(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    # Composite index on (status, created_at) for polling queries
    op.create_index(
        "ix_extractions_status_created_at",
        "extractions",
        ["status", "created_at"],
    )

    # ------------------------------------------------------------------
    # property_ticket_counters
    # ------------------------------------------------------------------
    op.create_table(
        "property_ticket_counters",
        sa.Column("property_id", sa.String(), nullable=False),
        sa.Column("prefix", sa.Text(), nullable=False),
        sa.Column("last_num", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(
            ["property_id"], ["properties.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("property_id"),
    )


def downgrade() -> None:
    op.drop_table("property_ticket_counters")
    op.drop_index("ix_extractions_status_created_at", table_name="extractions")
    op.drop_table("extractions")
    op.drop_index("ix_vendor_jobs_completed_at", table_name="vendor_jobs")
    op.drop_index("ix_vendor_jobs_ticket_id", table_name="vendor_jobs")
    op.drop_table("vendor_jobs")
    op.drop_index("ix_call_sessions_ticket_id", table_name="call_sessions")
    op.drop_table("call_sessions")
    op.drop_index("ix_units_property_id", table_name="units")
    op.drop_table("units")
    op.drop_index("ix_vendor_cases_property_id", table_name="vendor_cases")
    op.drop_index("ix_vendor_cases_vendor_id", table_name="vendor_cases")
    op.drop_table("vendor_cases")
    op.drop_table("building_vendors")
    op.drop_table("vendors")
    op.drop_index("ix_buildings_owner_id", table_name="buildings")
    op.drop_table("buildings")
    op.drop_table("owners")
