import sqlalchemy as sa
from app.database import Base


class Extraction(Base):
    """PDF/document extraction task producing proposed diffs."""

    __tablename__ = "extractions"

    id = sa.Column(sa.String, primary_key=True)
    property_id = sa.Column(
        sa.String,
        sa.ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=True,
    )
    status = sa.Column(
        sa.Text,
        nullable=False,
        server_default="processing",
    )  # "processing" | "done" | "failed"
    filename = sa.Column(sa.Text, nullable=True)
    layer = sa.Column(sa.Text, nullable=True)  # "vendor"|"owner"|"building"|"property"
    proposed_diffs = sa.Column(sa.JSON, nullable=True)
    error = sa.Column(sa.Text, nullable=True)
    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
