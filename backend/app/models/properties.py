import sqlalchemy as sa
from app.database import Base


class Property(Base):
    __tablename__ = "properties"

    id = sa.Column(
        sa.String,
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    name = sa.Column(sa.Text, nullable=False)
    slack_channel = sa.Column(sa.Text, nullable=True)
    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
