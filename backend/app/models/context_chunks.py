import sqlalchemy as sa
from app.database import Base


class ContextChunk(Base):
    __tablename__ = "context_chunks"

    id = sa.Column(
        sa.String,
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    context_version_id = sa.Column(
        sa.String,
        sa.ForeignKey("context_versions.id", ondelete="CASCADE"),
        nullable=False,
    )
    property_id = sa.Column(
        sa.String,
        sa.ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
    )
    heading = sa.Column(sa.Text, nullable=False)
    content = sa.Column(sa.Text, nullable=False)
    # embedding column skipped for now
