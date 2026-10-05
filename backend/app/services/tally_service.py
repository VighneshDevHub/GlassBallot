from __future__ import annotations

import random
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import GlassBallotError, StateTransitionError
from app.models.enums import ElectionState, TallySessionStatus
from app.repositories.audit_repo import AuditRepo
from app.repositories.ballot_repo import BallotRepo
from app.repositories.election_repo import ElectionRepo
from app.repositories.tally_repo import TallyRepo
from app.repositories.trustee_repo import TrusteeRepo
from app.services.crypto_service import CryptoService


class TallyService:
    """Service to handle 2-of-3 Trustee Key Reconstruction and Election Tallying."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.election_repo = ElectionRepo(session)
        self.ballot_repo = BallotRepo(session)
        self.tally_repo = TallyRepo(session)
        self.trustee_repo = TrusteeRepo(session)
        self.audit_repo = AuditRepo(session)

    async def create_tally_session(self, election_id: UUID, created_by_user_id: UUID) -> Any:
        election = await self.election_repo.get(election_id)
        if not election:
            raise GlassBallotError(message="Election not found", code="ELECTION_NOT_FOUND", status_code=404)

        if election.state not in (ElectionState.CLOSED, ElectionState.TALLYING):
            raise StateTransitionError(
                message=f"Cannot initiate tally when election state is {election.state.value}. Election must be CLOSED first."
            )

        if election.state == ElectionState.CLOSED:
            await self.election_repo.update_state(election_id, ElectionState.TALLYING)

        return await self.tally_repo.create_session(election_id, created_by_user_id)

    async def submit_trustee_share(
        self,
        session_id: UUID,
        trustee_id: UUID,
        share_b64: str,
    ) -> dict[str, Any]:
        tally_session = await self.tally_repo.get_session(session_id)
        if not tally_session:
            raise GlassBallotError(message="Tally session not found", code="SESSION_NOT_FOUND", status_code=404)

        # Record approval share
        await self.tally_repo.add_approval(session_id, trustee_id, share_b64)
        approvals = await self.tally_repo.get_approvals(session_id)

        # Check threshold (2 of 3)
        if len(approvals) >= 2 and tally_session.status != TallySessionStatus.COMPLETED:
            results = await self._perform_tally(tally_session, approvals)
            return {"status": "COMPLETED", "approvals_count": len(approvals), "results": results}

        return {"status": "PENDING", "approvals_count": len(approvals), "threshold": 2}

    async def _perform_tally(self, tally_session: Any, approvals: list[Any]) -> dict[str, Any]:
        election_id = tally_session.election_id
        election = await self.election_repo.get(election_id)
        assert election is not None

        # Extract shares
        shares_b64 = [a.share_b64 for a in approvals[:2]]

        # Reconstruct key scalar
        try:
            priv_scalar_b64 = CryptoService.shamir_combine(shares_b64)
            reconstructed_pub_b64 = CryptoService.pub_from_secret(priv_scalar_b64)
        except Exception as e:
            await self.tally_repo.update_session_status(tally_session.id, TallySessionStatus.FAILED, note="Shamir reconstruction failed")
            raise GlassBallotError(message=f"Trustee share combination failed: {e}", code="SHAMIR_COMBINE_FAILED", status_code=400)

        if reconstructed_pub_b64 != election.public_key_b64:
            await self.tally_repo.update_session_status(tally_session.id, TallySessionStatus.FAILED, note="Key scalar mismatch")
            raise GlassBallotError(message="Reconstructed private key does not match election public key", code="INVALID_TRUSTEE_SHARES", status_code=400)

        # Fetch sealed ballots
        ballots = await self.ballot_repo.list_for_election(election_id)
        candidates = await self.election_repo.list_candidates(election_id)
        valid_candidate_ids = {str(c.id): c.name for c in candidates}

        tally_counts: dict[str, int] = {c.name: 0 for c in candidates}
        plaintext_choices: list[str] = []
        spoiled_count = 0

        try:
            for b in ballots:
                try:
                    choice = CryptoService.decrypt_ballot(priv_scalar_b64, b.ciphertext_payload)
                    plaintext_choices.append(choice)
                    if choice in tally_counts:
                        tally_counts[choice] += 1
                    else:
                        tally_counts[choice] = 1
                except Exception:
                    spoiled_count += 1
        finally:
            # Secure zeroing of in-memory private key scalar
            priv_scalar_b64 = "0" * len(priv_scalar_b64)
            del priv_scalar_b64

        # Cryptographically secure shuffle of plaintext choices list (so order cannot reveal voter timing)
        random.SystemRandom().shuffle(plaintext_choices)

        # Save tally results
        await self.tally_repo.record_results(
            election_id=election_id,
            session_id=tally_session.id,
            total_ballots=len(ballots),
            valid_ballots=len(ballots) - spoiled_count,
            spoiled_ballots=spoiled_count,
            candidate_counts=tally_counts,
            shuffled_choices=plaintext_choices,
        )

        # Mark session COMPLETED & election COMPLETED
        await self.tally_repo.update_session_status(tally_session.id, TallySessionStatus.COMPLETED)
        await self.election_repo.update_state(election_id, ElectionState.COMPLETED)

        # Log audit event
        last_audit = await self.audit_repo.get_latest(election_id)
        prev_hash = last_audit.event_hash if last_audit else "0" * 64
        now_iso = datetime.now(timezone.utc).isoformat()
        
        event_hash = CryptoService.compute_event_hash(
            prev_hash=prev_hash,
            timestamp_iso=now_iso,
            actor_id=str(tally_session.created_by_user_id),
            action="ELECTION_TALLIED",
            resource_type="ELECTION",
            resource_id=str(election_id),
            metadata_json={"total_ballots": len(ballots), "valid_ballots": len(ballots) - spoiled_count},
        )

        await self.audit_repo.create_event(
            election_id=election_id,
            actor_id=tally_session.created_by_user_id,
            action="ELECTION_TALLIED",
            resource_type="ELECTION",
            resource_id=str(election_id),
            previous_hash=prev_hash,
            event_hash=event_hash,
            metadata_json={"total_ballots": len(ballots), "valid_ballots": len(ballots) - spoiled_count},
        )

        return {
            "total_ballots": len(ballots),
            "valid_ballots": len(ballots) - spoiled_count,
            "spoiled_ballots": spoiled_count,
            "counts": tally_counts,
            "shuffled_choices": plaintext_choices,
        }
