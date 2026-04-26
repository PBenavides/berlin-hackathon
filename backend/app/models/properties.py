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

    # Sprint-1 extensions
    building_id = sa.Column(
        sa.String,
        sa.ForeignKey("buildings.id", ondelete="SET NULL"),
        nullable=True,
    )
    owner_id = sa.Column(
        sa.String,
        sa.ForeignKey("owners.id", ondelete="SET NULL"),
        nullable=True,
    )
    city = sa.Column(sa.Text, nullable=True)
    phone = sa.Column(sa.Text, nullable=True)
    email = sa.Column(sa.Text, nullable=True)

    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
