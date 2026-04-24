import sqlalchemy as sa
from app.database import Base


class PropertyPolicy(Base):
    __tablename__ = "property_policies"

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
    rule_json = sa.Column(sa.JSON, nullable=False)
    description = sa.Column(sa.Text, nullable=False)
    active = sa.Column(sa.Boolean, nullable=False, default=True, server_default=sa.text("true"))
    created_at = sa.Column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
