from __future__ import annotations

from datetime import datetime
from uuid import UUID
from pydantic import Field

from app.models.enums import ElectionState
from app.schemas.common import GBBaseModel, Timestamped


class CandidateCreate(GBBaseModel):
    name: str
    party_or_tag: str = ""
    department: str | None = None
    avatar_url: str | None = None


class CandidateOut(GBBaseModel):
    id: UUID
    name: str
    party_or_tag: str = ""
    display_order: int = 0


class ElectionCreateRequest(GBBaseModel):
    public_id: str
    title: str
    description: str | None = None
    public_key_b64: str
    candidates: list[CandidateCreate] = Field(default_factory=list)


class ElectionResponse(GBBaseModel):
    id: UUID
    public_id: str
    title: str
    description: str | None = None
    state: ElectionState
    public_key_b64: str
    candidates: list[CandidateOut] = Field(default_factory=list)
    created_at: datetime


class ElectionBase(GBBaseModel):
    public_id: str
    title: str
    description: str | None = None


class ElectionSummary(ElectionBase):
    id: UUID
    state: ElectionState
    created_at: datetime


class ElectionUpdate(GBBaseModel):
    title: str | None = None
    description: str | None = None
    state: ElectionState | None = None


class ElectionConfigResponse(GBBaseModel):
    election: ElectionResponse | None = None
    state: ElectionState
    election_pub: str
    sth_pub: str


ElectionCreate = ElectionCreateRequest
ElectionOut = ElectionResponse
