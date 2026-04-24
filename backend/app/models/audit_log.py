import sqlalchemy as sa
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = sa.Column(
        sa.String,
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    actor = sa.Column(sa.Text, nullable=False)
    action = sa.Column(sa.Text, nullable=False)
    property_id = sa.Column(sa.String, nullable=True)
    entity_type = sa.Column(sa.Text, nullable=False)
    entity_id = sa.Column(sa.String, nullable=True)
    metadata = sa.Column(sa.JSON, nullable=True)
    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
