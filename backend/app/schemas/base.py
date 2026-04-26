"""Shared base model for all API response schemas.

All *Out / *Detail schemas should inherit CamelModel so that:
- JSON responses use camelCase field names (alias_generator=to_camel)
- Input bodies still accept snake_case (populate_by_name=True)
- ORM instances can be passed directly (from_attributes=True)
"""
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Response base model: camelCase aliases, ORM-friendly, snake_case input accepted."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
