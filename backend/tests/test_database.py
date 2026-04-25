"""Validate database connectivity and Alembic migration state."""
import os
import pytest
import sqlalchemy as sa
from alembic.config import Config as AlembicConfig
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory


def _get_engine():
    url = os.environ.get("DATABASE_URL", "postgresql://buena:buena@localhost:5432/buena")
    return sa.create_engine(url)


def test_db_connect():
    """Raw engine can connect and run a trivial query."""
    engine = _get_engine()
    with engine.connect() as conn:
        result = conn.execute(sa.text("SELECT 1")).scalar()
    assert result == 1


def test_alembic_at_head():
    """Current Alembic revision matches the head of the migration scripts."""
    engine = _get_engine()
    backend_dir = os.path.join(os.path.dirname(__file__), "..")

    alembic_cfg = AlembicConfig(os.path.join(backend_dir, "alembic.ini"))
    alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))

    script = ScriptDirectory.from_config(alembic_cfg)
    head_revisions = {s.revision for s in script.get_revisions("head")}

    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        current = ctx.get_current_heads()

    assert set(current) == head_revisions, (
        f"DB is at {current!r}, but migration head is {head_revisions!r}. "
        "Run: alembic upgrade head"
    )


def test_expected_tables_exist():
    """All 10 expected tables are present after migrations."""
    expected = {
        "properties", "context_versions", "context_chunks",
        "property_policies", "context_sources", "tickets",
        "agent_proposals", "audit_log", "owner_messages", "attachments",
    }
    engine = _get_engine()
    inspector = sa.inspect(engine)
    existing = set(inspector.get_table_names())
    missing = expected - existing
    assert not missing, f"Missing tables after migrations: {missing}"
