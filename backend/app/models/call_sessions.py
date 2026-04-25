import sqlalchemy as sa
from app.database import Base


class CallSession(Base):
    """Voice call session linked to a ticket."""

    __tablename__ = "call_sessions"

    id = sa.Column(sa.String, primary_key=True)
    ticket_id = sa.Column(
        sa.String,
        sa.ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    duration = sa.Column(sa.Text, nullable=True)         # "1:27"
    caller_phone = sa.Column(sa.Text, nullable=True)
    summary = sa.Column(sa.Text, nullable=True)
    noise_reduction_db = sa.Column(sa.Integer, nullable=True)
    transcript = sa.Column(sa.JSON, nullable=True)       # list[{spk, t, text, en}]
    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
