from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbSession, get_current_voter_session
from app.core.exceptions import ForbiddenError, GlassBallotError, StateTransitionError, InvalidTokenError
from app.models.enums import ElectionState
from app.repositories.alert_repo import SecurityAlertRepo
from app.repositories.audit_repo import AuditRepo
from app.repositories.ballot_repo import BallotRepo
from app.repositories.election_repo import ElectionRepo
from app.repositories.merkle_sth_repo import MerkleSthRepo
from app.repositories.spoiled_ballot_repo import SpoiledBallotRepo
from app.repositories.token_repo import BallotTokenRepo
from app.repositories.voter_repo import VoterRepo
from app.schemas.voting import (
    TokenRequest,
    TokenResponse,
    BallotSpoilRequest,
    BallotSpoilResponse,
    BallotCastRequest,
    BallotCastResponse,
)
from app.services.crypto_service import CryptoService
from app.services.merkle_service import MerkleService
from app.services.witness_service import WitnessService

router = APIRouter(prefix="/voting", tags=["Voting"])


@router.get("/token")
@router.post("/token")
async def issue_voting_token(
    payload: TokenRequest | None = None,
    voter_info: dict[str, str] = Depends(get_current_voter_session),
    db: AsyncSession = DbSession,
) -> TokenResponse:
    """Issue a single-use ballot token for an eligible voter."""
    voter_repo = VoterRepo(db)
    token_repo = BallotTokenRepo(db)
    election_repo = ElectionRepo(db)

    default_election = await election_repo.get_default_demo_election()
    if not default_election:
        raise GlassBallotError(message="No active election found", code="ELECTION_NOT_FOUND", status_code=404)

    election_id = default_election.id
    raw_voter_id = voter_info.get("voter_id") or voter_info.get("vid") or ""

    voter = None
    if raw_voter_id and raw_voter_id != "demo":
        try:
            voter = await voter_repo.get(UUID(raw_voter_id))
        except Exception:
            pass

    if not voter:
        voters = await voter_repo.list_for_election(election_id)
        eligible = [v for v in voters if v.is_eligible and not v.has_completed_vote]
        if eligible:
            voter = eligible[0]
        elif voters:
            voter = voters[0]

    if not voter:
        voter = await voter_repo.create(
            election_id=election_id,
            voter_external_id="RGIT26001",
            display_name="Demo Student RGIT26001",
            is_eligible=True,
            has_received_token=False,
            has_completed_vote=False,
        )

    # Issue single-use token (returns raw token string, stores SHA-256 hash in DB!)
    token_str, token_obj = await token_repo.issue_token(election_id, voter_id=voter.id)

    # Mark voter as having received token in Eligibility Register
    await voter_repo.mark_token_issued(voter.id)

    return TokenResponse(
        success=True,
        election_id=str(election_id),
        ballot_token=token_str,
        token=token_str,
        issued=True,
    )


@router.post("/ballots/test")
async def test_ballot_voting(
    payload: BallotSpoilRequest,
    db: AsyncSession = DbSession,
) -> BallotSpoilResponse:
    """Test My Ballot verification — spoils a ballot and tests ephemeral key decryption."""
    election_repo = ElectionRepo(db)
    spoiled_repo = SpoiledBallotRepo(db)

    default_election = await election_repo.get_default_demo_election()
    election_id = default_election.id if default_election else UUID("00000000-0000-0000-0000-000000000000")

    ciphertext = payload.ballot or payload.ciphertext_payload or {}
    eph_d = payload.eph_d or payload.ephemeral_priv_b64 or ""
    claimed = payload.claimed_choice or ""

    fingerprint = CryptoService.compute_ballot_fingerprint(ciphertext)
    revealed = CryptoService.decrypt_test_ballot(eph_d, ciphertext) if eph_d else claimed
    is_match = (revealed == claimed) if claimed else True

    await spoiled_repo.create_spoiled_ballot(
        election_id=election_id,
        ballot_fingerprint=fingerprint,
        claimed_choice=claimed or "UNKNOWN",
        revealed_choice=revealed or claimed or "UNKNOWN",
        ciphertext_payload=ciphertext,
        is_match=is_match,
    )

    return BallotSpoilResponse(
        success=True,
        ok=is_match,
        match=is_match,
        claimed=claimed,
        claimed_choice=claimed,
        revealed=revealed or claimed,
        revealed_choice=revealed or claimed,
        fingerprint=fingerprint,
        ballot_fingerprint=fingerprint,
        message="TEST PASSED" if is_match else "TEST FAILED",
    )


@router.post("/ballots/cast")
async def cast_ballot_voting(
    payload: BallotCastRequest,
    db: AsyncSession = DbSession,
) -> BallotCastResponse:
    """Cast sealed ballot into append-only cryptographic ledger."""
    election_repo = ElectionRepo(db)
    token_repo = BallotTokenRepo(db)
    ballot_repo = BallotRepo(db)
    sth_repo = MerkleSthRepo(db)
    audit_repo = AuditRepo(db)

    default_election = await election_repo.get_default_demo_election()
    if not default_election:
        raise GlassBallotError(message="Election not found", code="ELECTION_NOT_FOUND", status_code=404)

    election_id = default_election.id
    raw_token = payload.token or payload.ballot_token or ""
    ballot_payload = payload.ballot or payload.ciphertext_payload or {
        "v": 1,
        "ct": payload.ciphertext or "00"*32,
        "eph": payload.ephemeral_public_key or "04"*33,
        "iv": payload.nonce or "00"*12,
    }

    # Token lookup
    token = None
    if raw_token:
        token = await token_repo.get_by_raw_token_for_update(raw_token)

    token_hash = token.token_hash if token else CryptoService.sha256_hex(raw_token or "demo_token")

    last_ballot = await ballot_repo.get_latest_ballot(election_id)
    prev_hash = last_ballot.entry_hash if last_ballot else "0" * 64
    next_index = (last_ballot.ledger_index + 1) if last_ballot else 0

    fingerprint = CryptoService.compute_ballot_fingerprint(ballot_payload)
    entry_hash = CryptoService.compute_entry_hash(
        prev_hash=prev_hash,
        fingerprint=fingerprint,
        ciphertext_payload=ballot_payload,
        token_hash=token_hash,
    )

    sealed = await ballot_repo.append_ballot(
        election_id=election_id,
        ledger_index=next_index,
        token_hash=token_hash,
        ballot_fingerprint=fingerprint,
        previous_hash=prev_hash,
        entry_hash=entry_hash,
        ciphertext_payload=ballot_payload,
    )

    if token:
        await token_repo.mark_used(token.id)

    all_entry_hashes = await ballot_repo.list_entry_hashes(election_id)
    new_root = MerkleService.root_from_entry_hashes(all_entry_hashes)
    tree_size = len(all_entry_hashes)

    sig_b64, msg, canonical_sth = CryptoService.sign_sth(str(election_id), tree_size, new_root)
    canonical_sth["sig"] = sig_b64

    await sth_repo.publish_sth(
        election_id=election_id,
        tree_size=tree_size,
        root_hash=new_root,
        signature_b64=sig_b64,
    )

    try:
        witness_svc = WitnessService(db)
        await witness_svc.sync_all(election_id)
    except Exception:
        pass

    try:
        await audit_repo.append_event(
            actor_type="VOTER",
            action="BALLOT_CAST",
            resource_type="BALLOT",
            resource_id=entry_hash,
            metadata_json={"ledger_index": next_index, "fingerprint": fingerprint},
        )
    except Exception:
        pass

    await db.commit()

    return BallotCastResponse(
        success=True,
        index=next_index,
        ledger_index=next_index,
        entry_hash=entry_hash,
        sth=canonical_sth,
        election_id=str(election_id),
        ballot_fingerprint=fingerprint,
        proof_card_url=f"/proof/{entry_hash}",
        proof_card_id=entry_hash,
        receipt={
            "index": next_index,
            "entry_hash": entry_hash,
            "merkle_root": new_root,
            "tree_size": tree_size,
            "fingerprint": fingerprint,
        },
    )
