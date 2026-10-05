from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import Witness, WitnessObservation
from app.models.enums import AlertSeverity, WitnessObservationStatus, WitnessStatus
from app.repositories.alert_repo import SecurityAlertRepo
from app.repositories.ballot_repo import BallotRepo
from app.repositories.evidence_bundle_repo import EvidenceBundleRepo
from app.repositories.merkle_sth_repo import MerkleSthRepo
from app.repositories.witness_repo import WitnessRepo
from app.services.crypto_service import CryptoService
from app.services.merkle_service import MerkleService


class WitnessService:
    """PostgreSQL-backed Witness Service enforcing sticky alarms & RFC 6962 consistency checks."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.witness_repo = WitnessRepo(session)
        self.sth_repo = MerkleSthRepo(session)
        self.ballot_repo = BallotRepo(session)
        self.alert_repo = SecurityAlertRepo(session)
        self.evidence_repo = EvidenceBundleRepo(session)

    async def sync_all(self, election_id: UUID, sth_pubkey_b64: str | None = None) -> list[Witness]:
        witnesses = await self.witness_repo.list_for_election(election_id)
        latest_sth = await self.sth_repo.get_latest(election_id)
        
        if not latest_sth:
            return witnesses

        entry_hashes = await self.ballot_repo.list_entry_hashes(election_id)

        synced_results = []
        for w in witnesses:
            result = await self._sync_witness(w, latest_sth, entry_hashes, sth_pubkey_b64)
            synced_results.append(result)

        return synced_results

    async def _sync_witness(
        self,
        witness: Witness,
        latest_sth: Any,
        entry_hashes: list[str],
        sth_pubkey_b64: str | None = None,
    ) -> Witness:
        now = datetime.now(timezone.utc)

        # Rule: Alarms are sticky
        if witness.alarm_sticky or witness.status == WitnessStatus.ALARM:
            witness.status = WitnessStatus.ALARM
            witness.alarm_sticky = True
            witness.last_synced_at = now
            await self.session.flush()
            return witness

        # Signature validation if pubkey provided
        if sth_pubkey_b64:
            msg_bytes = CryptoService.sth_message(
                str(witness.election_id),
                latest_sth.tree_size,
                latest_sth.root_hash,
                latest_sth.timestamp,
            )
            is_valid_sig = CryptoService.verify_tree_head_sig(
                sth_pubkey_b64, msg_bytes, latest_sth.signature_b64
            )
            if not is_valid_sig:
                return await self._trigger_alarm(
                    witness,
                    reason="Signed head has an INVALID signature.",
                    observed_size=latest_sth.tree_size,
                    observed_root=latest_sth.root_hash,
                    observed_sig=latest_sth.signature_b64,
                )

        m = witness.last_accepted_size or 0
        n = latest_sth.tree_size
        new_root = latest_sth.root_hash

        # First sync acceptance
        if m == 0 or not witness.last_accepted_root:
            witness.status = WitnessStatus.SYNCED
            witness.last_accepted_size = n
            witness.last_accepted_root = new_root
            witness.last_signature_b64 = latest_sth.signature_b64
            witness.last_synced_at = now
            await self.witness_repo.create_observation(
                witness_id=witness.id,
                election_id=witness.election_id,
                observed_size=n,
                observed_root=new_root,
                observed_sig=latest_sth.signature_b64,
                status=WitnessObservationStatus.ACCEPTED,
                notes=f"First head recorded (size {n}).",
            )
            await self.session.flush()
            return witness

        # Size check
        if n < m:
            return await self._trigger_alarm(
                witness,
                reason=f"ALARM: the log SHRANK from {m} to {n} entries.",
                observed_size=n,
                observed_root=new_root,
                observed_sig=latest_sth.signature_b64,
            )

        if n == m:
            if new_root != witness.last_accepted_root:
                return await self._trigger_alarm(
                    witness,
                    reason=f"ALARM: same size ({m}) but a different root. History was rewritten.",
                    observed_size=n,
                    observed_root=new_root,
                    observed_sig=latest_sth.signature_b64,
                )
            witness.status = WitnessStatus.SYNCED
            witness.last_synced_at = now
            await self.witness_repo.create_observation(
                witness_id=witness.id,
                election_id=witness.election_id,
                observed_size=n,
                observed_root=new_root,
                observed_sig=latest_sth.signature_b64,
                status=WitnessObservationStatus.ACCEPTED,
                notes=f"In sync at {m} entries.",
            )
            await self.session.flush()
            return witness

        # n > m: Consistency check
        path_hex = MerkleService.consistency_path_from_entry_hashes(m, entry_hashes[:n])
        path_bytes = [bytes.fromhex(p) for p in path_hex]
        is_consistent = MerkleService.verify_consistency(
            m,
            n,
            bytes.fromhex(witness.last_accepted_root),
            bytes.fromhex(new_root),
            path_bytes,
        )

        if not is_consistent:
            return await self._trigger_alarm(
                witness,
                reason=f"ALARM: the log at size {n} is NOT an extension of the head I saw at size {m}.",
                observed_size=n,
                observed_root=new_root,
                observed_sig=latest_sth.signature_b64,
            )

        # Consistency check passed
        witness.status = WitnessStatus.SYNCED
        witness.last_accepted_size = n
        witness.last_accepted_root = new_root
        witness.last_signature_b64 = latest_sth.signature_b64
        witness.last_synced_at = now

        await self.witness_repo.create_observation(
            witness_id=witness.id,
            election_id=witness.election_id,
            observed_size=n,
            observed_root=new_root,
            observed_sig=latest_sth.signature_b64,
            status=WitnessObservationStatus.ACCEPTED,
            notes=f"Consistent. Log grew from {m} to {n} entries.",
        )
        await self.session.flush()
        return witness

    async def _trigger_alarm(
        self,
        witness: Witness,
        reason: str,
        observed_size: int,
        observed_root: str,
        observed_sig: str,
    ) -> Witness:
        now = datetime.now(timezone.utc)
        witness.status = WitnessStatus.ALARM
        witness.alarm_sticky = True
        witness.last_synced_at = now

        # Record observation
        await self.witness_repo.create_observation(
            witness_id=witness.id,
            election_id=witness.election_id,
            observed_size=observed_size,
            observed_root=observed_root,
            observed_sig=observed_sig,
            status=WitnessObservationStatus.REJECTED,
            notes=reason,
        )

        # Create Security Alert
        await self.alert_repo.create_alert(
            election_id=witness.election_id,
            alert_type="WITNESS_ALARM",
            severity=AlertSeverity.HIGH,
            title=f"Witness Alarm: {witness.witness_code}",
            description=f"Candidate witness {witness.owner_name} ({witness.witness_code}) detected log tampering: {reason}",
            details_json={
                "witness_code": witness.witness_code,
                "owner_name": witness.owner_name,
                "last_accepted_size": witness.last_accepted_size,
                "last_accepted_root": witness.last_accepted_root,
                "observed_size": observed_size,
                "observed_root": observed_root,
                "reason": reason,
            },
        )

        # Create Evidence Bundle
        await self.evidence_repo.create_bundle(
            election_id=witness.election_id,
            bundle_type="WITNESS_ALARM",
            summary=f"Evidence bundle for witness alarm on {witness.witness_code}: {reason}",
            content_json={
                "witness_code": witness.witness_code,
                "owner_name": witness.owner_name,
                "last_accepted_size": witness.last_accepted_size,
                "last_accepted_root": witness.last_accepted_root,
                "observed_size": observed_size,
                "observed_root": observed_root,
                "reason": reason,
                "timestamp": now.isoformat(),
            },
        )

        await self.session.flush()
        return witness
