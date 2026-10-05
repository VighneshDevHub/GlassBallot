from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.dialects.postgresql import insert

from app.models.entities import Witness, WitnessObservation
from app.models.enums import WitnessStatus
from app.repositories.base import BaseRepo


class WitnessRepo(BaseRepo[Witness]):
    model = Witness

    async def list_for_election(self, election_id: UUID) -> list[Witness]:
        stmt = (
            select(Witness)
            .where(Witness.election_id == election_id)
            .order_by(Witness.witness_code.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_code(self, election_id: UUID, witness_code: str) -> Witness | None:
        stmt = (
            select(Witness)
            .where(Witness.election_id == election_id)
            .where(Witness.witness_code == witness_code)
        )
        result = await self.session.execute(stmt.limit(1))
        return result.scalars().first()

    async def upsert_status(
        self,
        election_id: UUID,
        witness_code: str,
        owner_name: str,
        status: WitnessStatus,
        last_accepted_size: int | None = None,
        last_accepted_root: str | None = None,
        last_signature_b64: str | None = None,
        last_synced_at: datetime | None = None,
        alarm_sticky: bool | None = None,
    ) -> Witness:
        stmt = (
            insert(Witness)
            .values(
                election_id=election_id,
                witness_code=witness_code,
                owner_name=owner_name,
                status=status,
                last_accepted_size=last_accepted_size or 0,
                last_accepted_root=last_accepted_root,
                last_signature_b64=last_signature_b64,
                last_synced_at=last_synced_at,
                alarm_sticky=alarm_sticky if alarm_sticky is not None else False,
            )
            .on_conflict_do_update(
                index_elements=["election_id", "witness_code"],
                set_={
                    "status": status,
                    "last_accepted_size": last_accepted_size if last_accepted_size is not None else Witness.last_accepted_size,
                    "last_accepted_root": last_accepted_root if last_accepted_root is not None else Witness.last_accepted_root,
                    "last_signature_b64": last_signature_b64 if last_signature_b64 is not None else Witness.last_signature_b64,
                    "last_synced_at": last_synced_at if last_synced_at is not None else Witness.last_synced_at,
                    "alarm_sticky": Witness.alarm_sticky | (alarm_sticky if alarm_sticky is not None else False),
                    "updated_at": datetime.now(timezone.utc),
                },
            )
            .returning(Witness)
        )
        result = await self.session.execute(stmt)
        obj = result.scalars().first()
        assert obj is not None
        return obj

    async def set_alarm_sticky(
        self,
        witness_id: UUID,
        note: str | None = None,
    ) -> Witness:
        w = await self.get(witness_id)
        assert w is not None
        w.alarm_sticky = True
        w.status = WitnessStatus.ALARM
        w.last_synced_at = datetime.now(timezone.utc)
        await self.session.flush()
        return w

    async def any_alarm_sticky(self, election_id: UUID) -> bool:
        stmt = (
            select(Witness.id)
            .where(Witness.election_id == election_id)
            .where(Witness.alarm_sticky.is_(True))
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first() is not None

    async def summary_counts(self, election_id: UUID) -> dict[str, int]:
        items = await self.list_for_election(election_id)
        out = {"total": len(items), "synced": 0, "alarmed": 0, "waiting": 0}
        for w in items:
            if w.alarm_sticky or w.status == WitnessStatus.ALARM:
                out["alarmed"] += 1
            elif w.status == WitnessStatus.SYNCED:
                out["synced"] += 1
            else:
                out["waiting"] += 1
        return out

    async def create_observation(
        self,
        witness_id: UUID,
        election_id: UUID,
        observed_size: int = 0,
        observed_root: str = "",
        observed_signature_b64: str = "",
        status: WitnessStatus = WitnessStatus.SYNCED,
        reason: str | None = None,
        evidence_bundle_id: UUID | None = None,
        observed_sig: str | None = None,
        notes: str | None = None,
        **kwargs,
    ) -> WitnessObservation:
        sig = observed_sig or observed_signature_b64 or kwargs.get("sig", "")
        rsn = notes or reason or kwargs.get("reason", "")
        obs_repo = WitnessObservationRepo(self.session)
        return await obs_repo.append_observation(
            witness_id=witness_id,
            election_id=election_id,
            observed_size=observed_size,
            observed_root=observed_root,
            observed_signature_b64=sig,
            status=status,
            reason=rsn,
            evidence_bundle_id=evidence_bundle_id,
        )


class WitnessObservationRepo(BaseRepo[WitnessObservation]):
    model = WitnessObservation

    async def append_observation(
        self,
        witness_id: UUID,
        election_id: UUID,
        observed_size: int,
        observed_root: str,
        observed_signature_b64: str,
        status: WitnessStatus,
        reason: str | None = None,
        evidence_bundle_id: UUID | None = None,
    ) -> WitnessObservation:
        return await self.create(
            witness_id=witness_id,
            election_id=election_id,
            observed_size=observed_size,
            observed_root=observed_root,
            observed_signature_b64=observed_signature_b64,
            status=status,
            reason=reason,
            evidence_bundle_id=evidence_bundle_id,
        )
