import sqlalchemy as sa
from app.database import Base


class Ticket(Base):
    __tablename__ = "tickets"

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
    source = sa.Column(sa.Text, nullable=False)
    external_id = sa.Column(sa.Text, nullable=True)
    raised_by = sa.Column(sa.Text, nullable=False)
    subject = sa.Column(sa.Text, nullable=False)
    body = sa.Column(sa.Text, nullable=False)
    status = sa.Column(sa.Text, nullable=False, default="open", server_default="open")
    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
