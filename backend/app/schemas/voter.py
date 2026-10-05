from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import Field

from app.schemas.common import GBBaseModel


class VoterRegisterRequest(GBBaseModel):
    election_id: UUID | None = None
    voter_external_id: str = Field(..., min_length=1, max_length=64)
    display_name: str = Field(..., min_length=1, max_length=255)
    course: str | None = Field(None, max_length=255)
    year: str | None = Field(None, max_length=64)
    email: str | None = Field(None, max_length=255)


class VoterProfileResponse(GBBaseModel):
    voter_id: str
    election_id: str
    voter_external_id: str
    display_name: str
    is_eligible: bool
    has_received_token: bool
    has_completed_vote: bool
    course: str | None = None
    year: str | None = None
    email: str | None = None
    created_at: str


class VoterProfileUpdate(GBBaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=255)
    course: str | None = Field(None, max_length=255)
    year: str | None = Field(None, max_length=64)
    email: str | None = Field(None, max_length=255)


class VoterSettingsResponse(GBBaseModel):
    email_notifications: bool = True
    sms_notifications: bool = False
    dark_mode: bool = False
    compact_view: bool = False
    accessibility_high_contrast: bool = False
    accessibility_reduced_motion: bool = False
    language: str = "en"


class VoterSettingsUpdate(GBBaseModel):
    email_notifications: bool | None = None
    sms_notifications: bool | None = None
    dark_mode: bool | None = None
    compact_view: bool | None = None
    accessibility_high_contrast: bool | None = None
    accessibility_reduced_motion: bool | None = None
    language: str | None = None


class ActivityItem(GBBaseModel):
    id: str
    timestamp: str
    action: str
    resource_type: str
    resource_id: str | None = None
    summary: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class ActivityListResponse(GBBaseModel):
    items: list[ActivityItem] = Field(default_factory=list)
    total: int = 0


class ReceiptItem(GBBaseModel):
    receipt_id: str
    kind: str
    election_id: str
    election_title: str
    issued_at: str
    fingerprint: str | None = None
    token_tail: str | None = None
    summary: str
    verified: bool = False
    details: dict[str, Any] = Field(default_factory=dict)


class ReceiptListResponse(GBBaseModel):
    items: list[ReceiptItem] = Field(default_factory=list)
    total: int = 0


class HourBucket(GBBaseModel):
    hour: str
    count: int


class ElectionStatsResponse(GBBaseModel):
    election_id: str
    eligible_voters: int = 0
    registered_voters: int = 0
    received_tokens: int = 0
    cast_ballots: int = 0
    total_cast: int = 0          # alias for cast_ballots, used by frontend
    spoiled_test_ballots: int = 0
    turnout_percent: float = 0.0
    integrity_pct: int = 0       # integrity check pass percentage (0–100)
    state: str
    opens_at: str | None = None
    closes_at: str | None = None
    tally_completed_at: str | None = None
    by_hour_last_7d: list[HourBucket] = Field(default_factory=list)


class MilestoneItem(GBBaseModel):
    key: str
    label: str
    status: str  # PENDING | CURRENT | DONE
    timestamp: str | None = None
    description: str | None = None


class MilestonesResponse(GBBaseModel):
    election_id: str
    items: list[MilestoneItem] = Field(default_factory=list)
