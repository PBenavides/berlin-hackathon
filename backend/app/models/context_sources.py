import sqlalchemy as sa
from app.database import Base


class ContextSource(Base):
    __tablename__ = "context_sources"

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
    kind = sa.Column(sa.Text, nullable=False)
    uri = sa.Column(sa.Text, nullable=False)
    sha256 = sa.Column(sa.Text, nullable=True)
    status = sa.Column(sa.Text, nullable=False, default="allowed", server_default="allowed")
    approved_by = sa.Column(sa.Text, nullable=True)
    approved_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
