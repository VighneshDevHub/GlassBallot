from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, Literal, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer

T = TypeVar("T")


class GBBaseModel(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        ser_json_timedelta="iso8601",
        extra="ignore",
    )


class SuccessResponse(GBBaseModel):
    ok: bool = True
    message: str | None = None


class Envelope(GBBaseModel, Generic[T]):
    data: T
    request_id: str | None = None
    meta: dict[str, Any] = Field(default_factory=dict)


class PaginationParams(GBBaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(50, ge=1, le=500)


class EntityRef(GBBaseModel):
    id: UUID

    @field_serializer("id")
    def _id(self, v: UUID) -> str:  # noqa: PLR6301
        return str(v)


class Timestamped(EntityRef):
    created_at: datetime
    updated_at: datetime | None = None


class IntegrityStatusEnum(str):
    VERIFIED = "VERIFIED"
    COMPROMISED = "COMPROMISED"
    PENDING = "PENDING"


class CheckResult(GBBaseModel):
    name: str
    passed: bool
    details: dict[str, Any] = Field(default_factory=dict)
