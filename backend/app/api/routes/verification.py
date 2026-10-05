from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbSession
from app.core.exceptions import GlassBallotError
from app.repositories.ballot_repo import BallotRepo
from app.repositories.election_repo import ElectionRepo
from app.repositories.merkle_sth_repo import MerkleSthRepo
from app.repositories.witness_repo import WitnessRepo
from app.services.integrity_service import IntegrityService
from app.services.merkle_service import MerkleService
from app.schemas.verification import ProofResponse, VerificationResponse

router = APIRouter(prefix="/verification", tags=["Verification"])


@router.get("/proof/{identifier}")
async def get_ballot_proof(
    identifier: str,
    db: AsyncSession = DbSession,
) -> ProofResponse:
    """Get inclusion proof and STH metadata for a Proof Card."""
    ballot_repo = BallotRepo(db)
    sth_repo = MerkleSthRepo(db)
    witness_repo = WitnessRepo(db)
    election_repo = ElectionRepo(db)

    default_election = await election_repo.get_default_demo_election()
    election_id = default_election.id if default_election else None

    ballot = None
    if identifier.isdigit():
        idx = int(identifier)
        if election_id:
            ballot = await ballot_repo.get_by_index(idx)
        if not ballot and idx == 0 and election_id:
            # Fallback to first available ballot in ledger if index 0 requested
            all_b = await ballot_repo.list_for_election(election_id)
            if all_b:
                ballot = all_b[0]
    else:
        # Try entry_hash first, then ballot_fingerprint
        ballot = await ballot_repo.get_by_entry_hash(identifier)
        if not ballot:
            ballot = await ballot_repo.get_by_fingerprint(identifier)
        if not ballot:
            # Also try the combined lookup (entry_hash OR fingerprint)
            ballot = await ballot_repo.get_by_entry_hash_or_fingerprint(identifier)

    if not ballot:
        raise GlassBallotError(message="Ballot not found in sealed ledger.", code="BALLOT_NOT_FOUND", status_code=404)

    all_entry_hashes = await ballot_repo.list_entry_hashes(ballot.election_id)
    inclusion_path = MerkleService.inclusion_path_from_entry_hashes(ballot.ledger_index, all_entry_hashes)

    latest_sth = await sth_repo.get_latest(ballot.election_id)
    witnesses = await witness_repo.list_for_election(ballot.election_id)

    return ProofResponse(
        success=True,
        election_id=str(ballot.election_id),
        ledger_index=ballot.ledger_index,
        ballot_fingerprint=ballot.ballot_fingerprint,
        entry_hash=ballot.entry_hash,
        previous_hash=ballot.previous_hash,
        tree_size=len(all_entry_hashes),
        merkle_root=latest_sth.root_hash if latest_sth else "",
        sth_signature=latest_sth.signature_b64 if latest_sth else "",
        sth_timestamp=latest_sth.timestamp if latest_sth else 0,
        inclusion_path=inclusion_path,
        witnesses=[
            {
                "witness_code": w.witness_code,
                "owner_name": w.owner_name,
                "status": w.status.value,
                "last_accepted_size": w.last_accepted_size,
                "last_accepted_root": w.last_accepted_root or "",
            }
            for w in witnesses
        ],
    )


@router.get("/verify")
@router.get("/{identifier}/verify")
async def verify_ballot(
    identifier: str | None = None,
    index: int | None = None,
    fingerprint: str | None = None,
    db: AsyncSession = DbSession,
) -> VerificationResponse:
    """Public verification endpoint (AC14)."""
    target_id = identifier or (str(index) if index is not None else fingerprint) or "0"

    try:
        proof = await get_ballot_proof(target_id, db)
    except GlassBallotError as err:
        if err.status_code == 404:
            return VerificationResponse(
                success=True,
                status="UNVERIFIED",
                election_id="",
                ledger_index=index or 0,
                ballot_fingerprint=fingerprint or "",
                entry_hash="",
                merkle_root="",
                tree_size=0,
                inclusion_proof_valid=False,
                witnesses_synced=False,
                overall_integrity="UNVERIFIED",
                disclaimer="Ballot not found in sealed ledger. Cast a ballot to generate proof card.",
            )
        raise err

    # Re-verify inclusion proof
    leaf_hash = MerkleService.leaf_hash(bytes.fromhex(proof.entry_hash))
    path_bytes = [bytes.fromhex(p) for p in proof.inclusion_path]
    root_bytes = bytes.fromhex(proof.merkle_root) if proof.merkle_root else b""

    inclusion_valid = False
    if root_bytes:
        inclusion_valid = MerkleService.verify_inclusion(
            leaf_hash=leaf_hash,
            leaf_index=proof.ledger_index,
            tree_size=proof.tree_size,
            path=path_bytes,
            root=root_bytes,
        )

    # Check witness status
    witness_alarm = any(w["status"] == "ALARM" for w in proof.witnesses)

    # A ballot is VERIFIED if the four core checks pass:
    # 1. ballot exists (always true here since proof was fetched)
    # 2. inclusion proof is mathematically valid
    # 3. there is a Merkle root (signed tree head published)
    # 4. no witness alarms
    # We intentionally do NOT run the full integrity engine here — that would
    # cause side-effects (freeze, alerts) and is too heavyweight per-ballot.
    is_verified = inclusion_valid and not witness_alarm and bool(proof.merkle_root)

    return VerificationResponse(
        success=True,
        status="VERIFIED" if is_verified else "UNVERIFIED",
        election_id=proof.election_id,
        ledger_index=proof.ledger_index,
        ballot_fingerprint=proof.ballot_fingerprint,
        entry_hash=proof.entry_hash,
        merkle_root=proof.merkle_root,
        tree_size=proof.tree_size,
        inclusion_proof_valid=inclusion_valid,
        witnesses_synced=not witness_alarm,
        overall_integrity="VERIFIED" if is_verified else "UNVERIFIED",
        disclaimer="This proof verifies ballot existence, ledger placement, and cryptographic integrity. It does NOT reveal candidate choice.",
    )
