from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ApprovalStatus, ElectionState, IntegrityStatus, TokenStatus, WitnessStatus

JSON_TYPE = JSONB().with_variant(JSON, "sqlite")


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Role(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))

    @property
    def role_code(self) -> str:
        return self.name


class UserRole(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id"),)

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_id: Mapped[UUID] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)


class Election(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "elections"

    public_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    college_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    state: Mapped[ElectionState] = mapped_column(
        Enum(ElectionState, name="election_state"),
        default=ElectionState.DRAFT,
        nullable=False,
        index=True,
    )
    opens_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    tally_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    election_public_key: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    election_public_key_b64: Mapped[str] = mapped_column(Text, nullable=False)
    sth_public_key_b64: Mapped[str] = mapped_column(Text, nullable=False, default="")
    metadata_json: Mapped[dict] = mapped_column(JSON_TYPE, default=dict, nullable=False)

    @property
    def is_frozen(self) -> bool:
        return self.state == ElectionState.FROZEN

    @is_frozen.setter
    def is_frozen(self, val: bool) -> None:
        if val:
            self.state = ElectionState.FROZEN


class ElectionCandidate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "election_candidates"
    __table_args__ = (UniqueConstraint("election_id", "candidate_code"),)

    election_id: Mapped[UUID] = mapped_column(ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_code: Mapped[str] = mapped_column(String(64), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    statement: Mapped[str | None] = mapped_column(Text)
    department: Mapped[str | None] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Voter(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "voters"
    __table_args__ = (UniqueConstraint("election_id", "voter_external_id"),)

    election_id: Mapped[UUID] = mapped_column(ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True)
    voter_external_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_eligible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    has_received_token: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_completed_vote: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSON_TYPE, default=dict, nullable=False)

    @property
    def has_voted(self) -> bool:
        return self.has_completed_vote


class OtpChallenge(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "otp_challenges"

    voter_id: Mapped[UUID] = mapped_column(ForeignKey("voters.id", ondelete="CASCADE"), nullable=False, index=True)
    otp_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class BallotToken(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ballot_tokens"
    __table_args__ = (
        UniqueConstraint("token_hash"),
        Index("ix_ballot_tokens_election_status_created", "election_id", "status", "created_at"),
    )

    election_id: Mapped[UUID] = mapped_column(ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True)
    voter_id: Mapped[UUID] = mapped_column(ForeignKey("voters.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[TokenStatus] = mapped_column(
        Enum(TokenStatus, name="token_status"),
        default=TokenStatus.ISSUED,
        nullable=False,
        index=True,
    )
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    invalidated_reason: Mapped[str | None] = mapped_column(String(255))


class SealedBallot(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "sealed_ballots"
    __table_args__ = (
        UniqueConstraint("election_id", "ledger_index"),
        UniqueConstraint("entry_hash"),
        Index("ix_sealed_ballots_election_created", "election_id", "created_at"),
    )

    election_id: Mapped[UUID] = mapped_column(ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True)
    token_id: Mapped[UUID | None] = mapped_column(ForeignKey("ballot_tokens.id", ondelete="SET NULL"), index=True)
    ledger_index: Mapped[int] = mapped_column(BigInteger, nullable=False)
    previous_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    entry_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    ballot_payload: Mapped[dict] = mapped_column(JSON_TYPE, nullable=False)
    ballot_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    is_test_ballot: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    @property
    def ciphertext_payload(self) -> dict:
        return self.ballot_payload or {}


class MerkleTreeHead(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "merkle_tree_heads"
    __table_args__ = (UniqueConstraint("election_id", "size"),)

    election_id: Mapped[UUID] = mapped_column(ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    root_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    signed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    signature_b64: Mapped[str] = mapped_column(Text, nullable=False)
    canonical_payload: Mapped[dict] = mapped_column(JSON_TYPE, nullable=False)

    @property
    def tree_size(self) -> int:
        return self.size

    @property
    def root(self) -> str:
        return self.root_hash

    @property
    def timestamp(self) -> int:
        if self.signed_at:
            return int(self.signed_at.timestamp())
        return 0


class Witness(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "witnesses"
    __table_args__ = (UniqueConstraint("election_id", "witness_code"),)

    election_id: Mapped[UUID] = mapped_column(ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True)
    witness_code: Mapped[str] = mapped_column(String(64), nullable=False)
    owner_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[WitnessStatus] = mapped_column(
        Enum(WitnessStatus, name="witness_status"),
        default=WitnessStatus.WAITING,
        nullable=False,
        index=True,
    )
    last_accepted_size: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    last_accepted_root: Mapped[str | None] = mapped_column(String(64))
    last_signature_b64: Mapped[str | None] = mapped_column(Text)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    alarm_sticky: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class WitnessObservation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "witness_observations"

    witness_id: Mapped[UUID] = mapped_column(ForeignKey("witnesses.id", ondelete="CASCADE"), nullable=False, index=True)
    election_id: Mapped[UUID] = mapped_column(ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True)
    observed_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    observed_root: Mapped[str] = mapped_column(String(64), nullable=False)
    observed_signature_b64: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[WitnessStatus] = mapped_column(Enum(WitnessStatus, name="witness_observation_status"), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    evidence_bundle_id: Mapped[UUID | None] = mapped_column(ForeignKey("evidence_bundles.id", ondelete="SET NULL"))


class SpoiledTestBallot(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "spoiled_test_ballots"

    election_id: Mapped[UUID] = mapped_column(ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True)
    ballot_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    claimed_choice: Mapped[str] = mapped_column(String(64), nullable=False)
    revealed_choice: Mapped[str] = mapped_column(String(64), nullable=False)
    verification_ok: Mapped[bool] = mapped_column(Boolean, nullable=False)
    ciphertext_payload: Mapped[dict] = mapped_column(JSON_TYPE, default=dict, nullable=False)


class Trustee(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "trustees"
    __table_args__ = (UniqueConstraint("election_id", "role_code"),)

    election_id: Mapped[UUID] = mapped_column(ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    role_code: Mapped[str] = mapped_column(String(64), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    threshold_group: Mapped[str] = mapped_column(String(64), default="2-of-3", nullable=False)


class TrusteeKeyShare(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "trustee_key_shares"

    trustee_id: Mapped[UUID] = mapped_column(ForeignKey("trustees.id", ondelete="CASCADE"), nullable=False, index=True)
    election_id: Mapped[UUID] = mapped_column(ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True)
    encrypted_share_ref: Mapped[str] = mapped_column(String(255), nullable=False)
    key_version: Mapped[str] = mapped_column(String(64), nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSON_TYPE, default=dict, nullable=False)


class TallySession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tally_sessions"

    election_id: Mapped[UUID] = mapped_column(ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    status: Mapped[ApprovalStatus] = mapped_column(
        Enum(ApprovalStatus, name="tally_session_status"),
        default=ApprovalStatus.PENDING,
        nullable=False,
        index=True,
    )
    approvals_required: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    approvals_received: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TallyResult(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tally_results"

    tally_session_id: Mapped[UUID] = mapped_column(ForeignKey("tally_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    election_id: Mapped[UUID] = mapped_column(ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_code: Mapped[str] = mapped_column(String(64), nullable=False)
    vote_total: Mapped[int] = mapped_column(Integer, nullable=False)
    published_metadata: Mapped[dict] = mapped_column(JSON_TYPE, default=dict, nullable=False)


class AuditEvent(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "audit_events"
    __table_args__ = (Index("ix_audit_events_created_action", "created_at", "action"),)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    actor_type: Mapped[str] = mapped_column(String(64), nullable=False)
    actor_id: Mapped[str | None] = mapped_column(String(128))
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(128), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(128))
    metadata_json: Mapped[dict] = mapped_column(JSON_TYPE, default=dict, nullable=False)
    previous_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    event_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)


class SecurityAlert(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "security_alerts"

    election_id: Mapped[UUID | None] = mapped_column(ForeignKey("elections.id", ondelete="SET NULL"), index=True)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    kind: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    summary: Mapped[str] = mapped_column(String(255), nullable=False)
    details_json: Mapped[dict] = mapped_column(JSON_TYPE, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class IntegrityCheck(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "integrity_checks"

    election_id: Mapped[UUID] = mapped_column(ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[IntegrityStatus] = mapped_column(
        Enum(IntegrityStatus, name="integrity_status"),
        default=IntegrityStatus.PENDING,
        nullable=False,
        index=True,
    )
    results_json: Mapped[dict] = mapped_column(JSON_TYPE, default=dict, nullable=False)
    first_failed_check: Mapped[str | None] = mapped_column(String(128))
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class EvidenceBundle(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "evidence_bundles"

    election_id: Mapped[UUID] = mapped_column(ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True)
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(64), nullable=False)
    summary: Mapped[str] = mapped_column(String(255), nullable=False)
    details_json: Mapped[dict] = mapped_column(JSON_TYPE, default=dict, nullable=False)



