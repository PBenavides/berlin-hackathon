import sqlalchemy as sa
from app.database import Base


class OwnerMessage(Base):
    __tablename__ = "owner_messages"

    id = sa.Column(
        sa.String,
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    property_id = sa.Column(
        sa.String,
        sa.ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
    )
    text = sa.Column(sa.Text, nullable=False)
    vision_text = sa.Column(sa.Text, nullable=True)
    agent_reply = sa.Column(sa.Text, nullable=True)
    agent_error = sa.Column(sa.Text, nullable=True)
    dispatch_id = sa.Column(sa.String, nullable=True)
    latency_ms = sa.Column(sa.Integer, nullable=True)
    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
