from __future__ import annotations

from uuid import UUID

from app.models.entities import SpoiledTestBallot
from app.repositories.base import BaseRepo


class SpoiledBallotRepo(BaseRepo[SpoiledTestBallot]):
    model = SpoiledTestBallot

    async def append(
        self,
        election_id: UUID,
        ballot_fingerprint: str,
        claimed_choice: str,
        revealed_choice: str,
        verification_ok: bool,
        ciphertext_payload: dict | None = None,
    ) -> SpoiledTestBallot:
        return await self.create(
            election_id=election_id,
            ballot_fingerprint=ballot_fingerprint,
            claimed_choice=claimed_choice,
            revealed_choice=revealed_choice,
            verification_ok=verification_ok,
            ciphertext_payload=ciphertext_payload or {},
        )

    async def create_spoiled_ballot(
        self,
        election_id: UUID,
        ballot_fingerprint: str,
        claimed_choice: str,
        revealed_choice: str,
        verification_ok: bool | None = None,
        is_match: bool | None = None,
        ciphertext_payload: dict | None = None,
    ) -> SpoiledTestBallot:
        verification: bool
        if verification_ok is not None:
            verification = bool(verification_ok)
        elif is_match is not None:
            verification = bool(is_match)
        else:
            raise ValueError("Either verification_ok or is_match must be provided")
        return await self.create(
            election_id=election_id,
            ballot_fingerprint=ballot_fingerprint,
            claimed_choice=claimed_choice,
            revealed_choice=revealed_choice,
            verification_ok=verification,
            ciphertext_payload=ciphertext_payload or {},
        )

    async def list_for_election(self, election_id: UUID) -> list[SpoiledTestBallot]:
        from sqlalchemy import desc, select

        stmt = (
            select(SpoiledTestBallot)
            .where(SpoiledTestBallot.election_id == election_id)
            .order_by(desc(SpoiledTestBallot.created_at))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
