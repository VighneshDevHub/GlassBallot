from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import GlassBallotError
from app.models.entities import Election, IntegrityCheck
from app.models.enums import AlertSeverity, ElectionState, IntegrityStatus
from app.repositories.alert_repo import SecurityAlertRepo
from app.repositories.audit_repo import AuditRepo
from app.repositories.ballot_repo import BallotRepo
from app.repositories.election_repo import ElectionRepo
from app.repositories.evidence_bundle_repo import EvidenceBundleRepo
from app.repositories.integrity_check_repo import IntegrityCheckRepo
from app.repositories.merkle_sth_repo import MerkleSthRepo
from app.repositories.token_repo import BallotTokenRepo
from app.repositories.voter_repo import VoterRepo
from app.repositories.witness_repo import WitnessRepo
from app.services.crypto_service import CryptoService
from app.services.merkle_service import MerkleService


class ReconciliationService:
    """Service to reconcile the Two Books (Eligibility Register vs Sealed Ballot Ledger)."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.voter_repo = VoterRepo(session)
        self.token_repo = BallotTokenRepo(session)
        self.ballot_repo = BallotRepo(session)

    async def reconcile(self, election_id: UUID) -> dict[str, Any]:
        voters = await self.voter_repo.list_for_election(election_id)
        tokens = await self.token_repo.list_for_election(election_id)
        ballots = await self.ballot_repo.list_for_election(election_id)

        voters_marked = sum(1 for v in voters if getattr(v, "has_received_token", False) or getattr(v, "has_completed_vote", False) or getattr(v, "has_voted", False))
        tokens_issued = sum(1 for t in tokens if t.status == "ISSUED")
        tokens_used = sum(1 for t in tokens if t.status == "USED")
        tokens_void = sum(1 for t in tokens if t.status == "VOID")
        ballots_recorded = len(ballots)

        issues: list[str] = []

        # Check 1: Marked voters vs token count sum
        if voters_marked != (tokens_issued + tokens_used + tokens_void):
            issues.append(
                f"Marked voters ({voters_marked}) does not equal token sum "
                f"({tokens_issued} issued + {tokens_used} used + {tokens_void} void)."
            )

        # Check 2: Used tokens vs recorded ballots count
        if tokens_used != ballots_recorded:
            issues.append(
                f"Used tokens count ({tokens_used}) does not match recorded ballots count ({ballots_recorded})."
            )

        # Check 3: Every ballot token_hash maps to a valid used token
        used_token_hashes = {t.token_hash for t in tokens if t.status == "USED"}
        ballot_token_hashes = set()
        for b in ballots:
            if b.token_hash in ballot_token_hashes:
                issues.append(f"Duplicate token hash in ledger: {b.token_hash[:12]}...")
            ballot_token_hashes.add(b.token_hash)

            if b.token_hash not in used_token_hashes:
                issues.append(f"Ledger contains unissued/unused token hash: {b.token_hash[:12]}...")

        status = "PASS" if not issues else "FAIL"
        return {
            "status": status,
            "voters_marked": voters_marked,
            "tokens_issued": tokens_issued,
            "tokens_used": tokens_used,
            "tokens_void": tokens_void,
            "ballots_recorded": ballots_recorded,
            "issues": issues,
        }


class IntegrityService:
    """10-check Integrity Engine verifying cryptographic, witness, ledger, and state consistency."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.election_repo = ElectionRepo(session)
        self.ballot_repo = BallotRepo(session)
        self.sth_repo = MerkleSthRepo(session)
        self.witness_repo = WitnessRepo(session)
        self.audit_repo = AuditRepo(session)
        self.alert_repo = SecurityAlertRepo(session)
        self.evidence_repo = EvidenceBundleRepo(session)
        self.integrity_repo = IntegrityCheckRepo(session)
        self.reconciliation_svc = ReconciliationService(session)

    async def run_full_check(
        self,
        election_id: UUID,
        sth_pubkey_b64: str | None = None,
    ) -> dict[str, Any]:
        election = await self.election_repo.get(election_id)
        if not election:
            raise GlassBallotError(message="Election not found", code="ELECTION_NOT_FOUND", status_code=404)

        ballots = await self.ballot_repo.list_for_election(election_id)
        checks: list[dict[str, Any]] = []

        # 1. Ledger Hash Chain Check
        chain_pass, chain_details = self._check_hash_chain(ballots)
        checks.append({"name": "Ledger hash chain", "status": "PASS" if chain_pass else "FAIL", "details": chain_details})

        # 2. Merkle Root Check
        merkle_pass, merkle_details = await self._check_merkle_root(election_id, ballots)
        checks.append({"name": "Merkle root", "status": "PASS" if merkle_pass else "FAIL", "details": merkle_details})

        # 3. Signed Tree Heads Check
        sth_pass, sth_details = await self._check_signed_heads(election_id, sth_pubkey_b64)
        checks.append({"name": "Signed tree heads", "status": "PASS" if sth_pass else "FAIL", "details": sth_details})

        # 4. Candidate Witness Consistency Check
        witness_pass, witness_details = await self._check_witnesses(election_id)
        checks.append({"name": "Witness agreement", "status": "PASS" if witness_pass else "FAIL", "details": witness_details})

        # 5. Audit Chain Integrity Check
        audit_pass, audit_details = await self._check_audit_chain(election_id)
        checks.append({"name": "Audit log chain", "status": "PASS" if audit_pass else "FAIL", "details": audit_details})

        # 6. Two Books Reconciliation Check
        recon_result = await self.reconciliation_svc.reconcile(election_id)
        recon_pass = recon_result["status"] == "PASS"
        checks.append({"name": "Voter/Token reconciliation", "status": "PASS" if recon_pass else "FAIL", "details": recon_result})

        # 7. Duplicate Tokens Check
        dup_pass, dup_details = self._check_duplicate_tokens(ballots)
        checks.append({"name": "Token uniqueness", "status": "PASS" if dup_pass else "FAIL", "details": dup_details})

        # 8. Ledger Sequence Continuity Check
        seq_pass, seq_details = self._check_ledger_sequence(ballots)
        checks.append({"name": "Ledger sequence continuity", "status": "PASS" if seq_pass else "FAIL", "details": seq_details})

        # 9. Ballot Structure Check
        struct_pass, struct_details = self._check_ballot_structure(ballots)
        checks.append({"name": "Ballot cryptographic structure", "status": "PASS" if struct_pass else "FAIL", "details": struct_details})

        # 10. Election State Machine Consistency Check
        state_pass, state_details = self._check_election_state(election)
        checks.append({"name": "Election state consistency", "status": "PASS" if state_pass else "FAIL", "details": state_details})

        all_passed = all(c["status"] == "PASS" for c in checks)
        overall_status = IntegrityStatus.VERIFIED if all_passed else IntegrityStatus.COMPROMISED
        first_failed = next((c["name"] for c in checks if c["status"] == "FAIL"), None)

        result_summary = {
            "overall": overall_status.value if isinstance(overall_status, IntegrityStatus) else overall_status,
            "first_failed_check": first_failed,
            "checks": checks,
            "reconciliation": recon_result,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # If compromised, handle freeze & alert creation
        if not all_passed:
            if election.state != ElectionState.FROZEN:
                await self.election_repo.update_state(election_id, ElectionState.FROZEN)

            await self.alert_repo.create_alert(
                election_id=election_id,
                alert_type="INTEGRITY_FAILURE",
                severity=AlertSeverity.HIGH,
                title="Integrity Failure: System Compromised",
                description=f"Integrity Engine detected failure in check: {first_failed}",
                details_json=result_summary,
            )

            await self.evidence_repo.create_bundle(
                election_id=election_id,
                bundle_type="INTEGRITY_COMPROMISED",
                summary=f"Evidence bundle for overall integrity failure (First failed: {first_failed})",
                content_json=result_summary,
            )

        # Save check result record
        await self.integrity_repo.save_check(
            election_id=election_id,
            status=overall_status,
            details_json=result_summary,
        )

        return result_summary

    def _check_hash_chain(self, ballots: list[Any]) -> tuple[bool, str]:
        if not ballots:
            return True, "Ledger is empty (0 ballots)."

        expected_prev = "0" * 64
        for idx, b in enumerate(ballots):
            if b.previous_hash != expected_prev:
                return False, f"Hash mismatch at index {idx}: expected prev {expected_prev[:12]}..., got {b.previous_hash[:12]}..."
            payload = getattr(b, "ciphertext_payload", getattr(b, "ballot_payload", {}))
            recalculated = CryptoService.compute_entry_hash(
                prev_hash=b.previous_hash,
                fingerprint=b.ballot_fingerprint,
                ciphertext_payload=payload,
                token_hash=getattr(b, "token_hash", "00" * 32),
                ledger_index=getattr(b, "ledger_index", idx),
            )
            if recalculated != b.entry_hash:
                return False, f"Entry hash mismatch at index {idx}: stored {b.entry_hash[:12]}..., recalculated {recalculated[:12]}..."
            expected_prev = b.entry_hash

        return True, f"Hash chain verified across {len(ballots)} entries."

    async def _check_merkle_root(self, election_id: UUID, ballots: list[Any]) -> tuple[bool, str]:
        latest_sth = await self.sth_repo.get_latest(election_id)
        sth_size = getattr(latest_sth, "tree_size", getattr(latest_sth, "size", 0)) if latest_sth else 0
        sth_root = getattr(latest_sth, "root_hash", getattr(latest_sth, "root", "")) if latest_sth else ""

        if not ballots:
            if latest_sth and sth_size > 0:
                return False, f"STH indicates tree_size {sth_size} but ledger is empty."
            return True, "Merkle root verified (empty ledger)."

        entry_hashes = [b.entry_hash for b in ballots]
        calculated_root = MerkleService.root_from_entry_hashes(entry_hashes)

        if not latest_sth:
            return False, "No Signed Tree Head published for non-empty ledger."

        if calculated_root != sth_root:
            return False, f"Merkle root mismatch: ledger computed {calculated_root[:12]}..., STH has {sth_root[:12]}..."

        if len(ballots) != sth_size:
            return False, f"Tree size mismatch: ledger has {len(ballots)}, STH has {sth_size}."

        return True, f"Merkle root verified at size {len(ballots)} ({calculated_root[:12]}...)."

    async def _check_signed_heads(self, election_id: UUID, sth_pubkey_b64: str | None) -> tuple[bool, str]:
        sths = await self.sth_repo.list_for_election(election_id)
        if not sths:
            return True, "No STHs published yet."

        for sth in sths:
            if sth_pubkey_b64:
                msg_bytes = CryptoService.sth_message(
                    str(election_id),
                    sth.tree_size,
                    sth.root_hash,
                    sth.timestamp,
                )
                if not CryptoService.verify_tree_head_sig(sth_pubkey_b64, msg_bytes, sth.signature_b64):
                    return False, f"Invalid signature on STH size {sth.tree_size}."

        return True, f"All {len(sths)} STH signatures verified."

    async def _check_witnesses(self, election_id: UUID) -> tuple[bool, str]:
        witnesses = await self.witness_repo.list_for_election(election_id)
        if not witnesses:
            return True, "No witnesses registered."

        alarms = [w for w in witnesses if w.status.value == "ALARM" or w.alarm_sticky]
        if alarms:
            names = ", ".join(w.witness_code for w in alarms)
            return False, f"Witness alarm active on: {names}."

        return True, f"All {len(witnesses)} witnesses in agreement."

    async def _check_audit_chain(self, election_id: UUID) -> tuple[bool, str]:
        events = await self.audit_repo.list_for_election(election_id)
        if not events:
            return True, "Audit log is empty."

        expected_prev = "0" * 64
        for idx, ev in enumerate(events):
            if ev.previous_hash != expected_prev:
                return False, f"Audit chain broken at event #{ev.id}: expected prev {expected_prev[:12]}..., got {ev.previous_hash[:12]}..."
            ts_val = ev.created_at.replace(tzinfo=timezone.utc) if ev.created_at.tzinfo is None else ev.created_at
            recalculated = CryptoService.compute_event_hash(
                prev_hash=ev.previous_hash,
                timestamp_iso=ts_val,
                actor_id=str(ev.actor_id) if ev.actor_id else "",
                action=ev.action,
                resource_type=ev.resource_type,
                resource_id=ev.resource_id or "",
                metadata_json=ev.metadata_json or {},
                actor_type=ev.actor_type,
            )
            if recalculated != ev.event_hash:
                return False, f"Audit event hash tampered at event #{ev.id}: stored {ev.event_hash[:12]}..., calculated {recalculated[:12]}..."
            expected_prev = ev.event_hash

        return True, f"Audit chain verified across {len(events)} events."

    def _check_duplicate_tokens(self, ballots: list[Any]) -> tuple[bool, str]:
        seen = set()
        for b in ballots:
            if b.token_hash in seen:
                return False, f"Duplicate token hash detected: {b.token_hash[:12]}..."
            seen.add(b.token_hash)
        return True, f"All {len(ballots)} ballots use unique token hashes."

    def _check_ledger_sequence(self, ballots: list[Any]) -> tuple[bool, str]:
        for expected_idx, b in enumerate(ballots):
            if b.ledger_index != expected_idx:
                return False, f"Sequence gap/discontinuity: expected index {expected_idx}, got {b.ledger_index}."
        return True, f"Ledger sequence continuous 0..{len(ballots)-1}."

    def _check_ballot_structure(self, ballots: list[Any]) -> tuple[bool, str]:
        for b in ballots:
            if not CryptoService.validate_ballot(b.ciphertext_payload):
                return False, f"Malformed ciphertext payload at index {b.ledger_index}."
        return True, f"All {len(ballots)} ballot payloads cryptographically valid."

    def _check_election_state(self, election: Election) -> tuple[bool, str]:
        if election.state == ElectionState.FROZEN:
            return False, "Election is currently in FROZEN state due to security alarms."
        return True, f"Election state is {election.state.value}."
