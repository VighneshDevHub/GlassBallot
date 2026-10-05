from __future__ import annotations

from app.models.enums import WitnessStatus
from app.schemas.common import GBBaseModel, Timestamped


class WitnessOut(Timestamped):
    witness_code: str
    owner_name: str
    status: WitnessStatus
    last_accepted_size: int
    last_accepted_root: str | None = None
    last_signature_b64: str | None = None
    last_synced_at: str | None = None
    alarm_sticky: bool = False
    last_message: str | None = None


class WitnessSyncRequest(GBBaseModel):
    force: bool = False


class WitnessObservationOut(GBBaseModel):
    id: str
    witness_id: str
    observed_size: int
    observed_root: str
    status: WitnessStatus
    reason: str | None = None
    created_at: str


class SignedTreeHead(GBBaseModel):
    election: str
    size: int
    root: str
    ts: int
    sig: str


class ProofCard(GBBaseModel):
    election_id: str
    ledger_index: int
    entry_hash: str
    ballot_fingerprint: str
    tree_size: int
    merkle_root: str
    sth: SignedTreeHead
    verification_url: str
    timestamp: int
    inclusion_path: list[str] = []


class ProofResponse(GBBaseModel):
    success: bool = True
    election_id: str
    ledger_index: int
    ballot_fingerprint: str
    entry_hash: str
    previous_hash: str
    tree_size: int
    merkle_root: str
    sth_signature: str
    sth_timestamp: int
    inclusion_path: list[str] = []
    witnesses: list[dict] = []


class VerificationCheck(GBBaseModel):
    name: str
    passed: bool
    details: dict = {}


class VerificationResponse(GBBaseModel):
    success: bool = True
    status: str
    election_id: str
    ledger_index: int
    ballot_fingerprint: str
    entry_hash: str
    merkle_root: str
    tree_size: int
    inclusion_proof_valid: bool
    witnesses_synced: bool
    overall_integrity: str
    disclaimer: str


InclusionProofResponse = ProofResponse
