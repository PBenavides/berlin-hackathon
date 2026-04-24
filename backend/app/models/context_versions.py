import sqlalchemy as sa
from app.database import Base


class ContextVersion(Base):
    __tablename__ = "context_versions"

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
    version = sa.Column(sa.Integer, nullable=False)
    content_md = sa.Column(sa.Text, nullable=False)
    frontmatter = sa.Column(sa.JSON, nullable=True)
    created_by = sa.Column(sa.Text, nullable=False)
    created_reason = sa.Column(sa.Text, nullable=True)
    parent_version = sa.Column(sa.Integer, nullable=True)
    source_proposal_id = sa.Column(sa.String, nullable=True)
    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )

    __table_args__ = (
        sa.UniqueConstraint("property_id", "version", name="uq_context_versions_property_version"),
    )
