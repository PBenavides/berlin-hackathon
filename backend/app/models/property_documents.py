import sqlalchemy as sa
from app.database import Base


class PropertyDocument(Base):
    __tablename__ = "property_documents"

    id = sa.Column(
        sa.String,
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    property_id = sa.Column(
        sa.String,
        sa.ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename = sa.Column(sa.Text, nullable=False)
    mime_type = sa.Column(sa.Text, nullable=False)
    size_bytes = sa.Column(sa.Integer, nullable=False)
    sha256 = sa.Column(sa.Text, nullable=False, index=True)
    storage_path = sa.Column(sa.Text, nullable=False)
    page_count = sa.Column(sa.Integer, nullable=True)
    extracted_text = sa.Column(sa.Text, nullable=True)
    extraction_error = sa.Column(sa.Text, nullable=True)
    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
