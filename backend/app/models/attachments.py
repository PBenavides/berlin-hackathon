import sqlalchemy as sa
from app.database import Base


class Attachment(Base):
    __tablename__ = "attachments"

    id = sa.Column(
        sa.String,
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    owner_message_id = sa.Column(
        sa.String,
        sa.ForeignKey("owner_messages.id", ondelete="CASCADE"),
        nullable=False,
    )
    filename = sa.Column(sa.Text, nullable=False)
    mime_type = sa.Column(sa.Text, nullable=False)
    size_bytes = sa.Column(sa.Integer, nullable=False)
    sha256 = sa.Column(sa.Text, nullable=False, index=True)
    storage_path = sa.Column(sa.Text, nullable=False)
    vision_description = sa.Column(sa.Text, nullable=True)
    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
