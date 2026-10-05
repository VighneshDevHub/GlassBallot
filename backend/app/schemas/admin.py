from __future__ import annotations

from datetime import datetime
from uuid import UUID

from app.models.enums import (
    ApprovalStatus,
    IntegrityStatus,
    TokenStatus,
    WitnessStatus,
)
from app.schemas.common import CheckResult, GBBaseModel, Timestamped


class ReconciliationResponse(GBBaseModel):
    ok: bool
    voters_marked: int
    ballots_recorded: int
    pending: int
    void: int
    problems: list[str] = []


class WitnessSummary(GBBaseModel):
    total: int
    synced: int
    alarmed: int
    waiting: int


class IntegrityResponse(GBBaseModel):
    status: IntegrityStatus
    checks: list[CheckResult] = []
    first_failed_check: str | None = None
    entries: int = 0
    merkle_root: str | None = None
    reconciliation: ReconciliationResponse | None = None
    witness_summary: WitnessSummary | None = None
    evidence_bundle_id: str | None = None
    frozen: bool = False
    executed_at: datetime | None = None


class AuditEventOut(GBBaseModel):
    id: str
    created_at: datetime
    actor_type: str
    actor_id: str | None = None
    action: str
    resource_type: str
    resource_id: str | None = None
    previous_hash: str
    event_hash: str


class AuditVerifyResponse(GBBaseModel):
    ok: bool
    first_bad_id: str | None = None
    total_events: int = 0


class SecurityAlertOut(Timestamped):
    severity: str
    kind: str
    summary: str
    details: dict = {}
    is_active: bool


class TrusteeOut(Timestamped):
    role_code: str
    display_name: str
    user_id: UUID | None = None
    threshold_group: str


class TallySessionOut(Timestamped):
    election_id: UUID
    status: ApprovalStatus
    approvals_required: int
    approvals_received: int
    completed_at: datetime | None = None


class TallyApprovalRequest(GBBaseModel):
    trustee_share: dict


class TallyResultOut(GBBaseModel):
    candidate_code: str
    candidate_name: str | None = None
    vote_total: int


class PublishedResults(GBBaseModel):
    published: bool
    election_id: str | None = None
    counts: dict[str, int] = {}
    total: int = 0
    ledger_entries: int = 0


class SeedVotesRequest(GBBaseModel):
    election_id: UUID
    count: int = 10


class AttackRequest(GBBaseModel):
    election_id: UUID
    scenario: str


class TallyApproveRequest(GBBaseModel):
    trustee_id: UUID
    share_b64: str

    matches_ledger: bool = False
    shuffled_choices: list[str] = []
    spoiled_count: int = 0
    failed_count: int = 0
    merkle_root: str | None = None
    witness_summary: WitnessSummary | None = None
    sth: dict | None = None


class AdminUserOut(GBBaseModel):
    user_id: str
    username: str
    email: str | None = None
    is_active: bool = True
    roles: list[str] = []
    created_at: str | None = None


class AdminUserListResponse(GBBaseModel):
    users: list[AdminUserOut] = []
    total: int = 0
    page: int = 1
    page_size: int = 50


class AdminUserPatchRolesRequest(GBBaseModel):
    roles: list[str] = []


class VoterRosterItem(GBBaseModel):
    voter_id: str
    voter_external_id: str
    display_name: str
    is_eligible: bool
    has_received_token: bool
    has_completed_vote: bool
    created_at: str


class VoterRosterResponse(GBBaseModel):
    election_id: str
    items: list[VoterRosterItem] = []
    total: int = 0
    eligible: int = 0
    received_token: int = 0
    voted: int = 0
    page: int = 1
    page_size: int = 50


class BallotLedgerItem(GBBaseModel):
    ledger_index: int
    entry_hash: str
    token_hash: str
    ballot_fingerprint: str
    is_test_ballot: bool
    created_at: str


class BallotLedgerResponse(GBBaseModel):
    election_id: str
    items: list[BallotLedgerItem] = []
    total: int = 0
    real_ballots: int = 0
    test_ballots: int = 0
    page: int = 1
    page_size: int = 50


class EvidenceBundleOut(GBBaseModel):
    bundle_id: str
    election_id: str
    storage_key: str
    content_type: str
    summary: str
    details: dict = {}
    created_at: str


class ReportsEvidenceResponse(GBBaseModel):
    election_id: str
    bundles: list[EvidenceBundleOut] = []
    latest_integrity_status: str | None = None
    latest_integrity_executed_at: str | None = None
    audit_event_count: int = 0
    active_alert_count: int = 0

