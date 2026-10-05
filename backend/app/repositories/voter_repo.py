from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select

from app.models.entities import Voter
from app.repositories.base import BaseRepo


class VoterRepo(BaseRepo[Voter]):
    model = Voter

    async def get_by_external_id(self, election_id: UUID, external_id: str) -> Voter | None:
        stmt = (
            select(Voter)
            .where(Voter.election_id == election_id)
            .where(Voter.voter_external_id == external_id)
        )
        result = await self.session.execute(stmt.limit(1))
        return result.scalars().first()

    async def list_for_election(self, election_id: UUID) -> list[Voter]:
        stmt = select(Voter).where(Voter.election_id == election_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_eligible(self, election_id: UUID) -> int:
        stmt = select(Voter).where(Voter.election_id == election_id).where(Voter.is_eligible.is_(True))
        result = await self.session.execute(select(self.model.id).select_from(stmt.subquery()))
        return len(list(result.scalars().all()))

    async def count_completed_vote(self, election_id: UUID) -> int:
        stmt = select(Voter).where(Voter.election_id == election_id).where(Voter.has_completed_vote.is_(True))
        result = await self.session.execute(select(self.model.id).select_from(stmt.subquery()))
        return len(list(result.scalars().all()))

    async def mark_token_issued(self, voter_id: UUID) -> Voter | None:
        voter = await self.get(voter_id)
        if voter:
            voter.has_received_token = True
            await self.session.flush()
        return voter

    async def mark_completed_vote(self, voter_id: UUID) -> Voter | None:
        voter = await self.get(voter_id)
        if voter:
            voter.has_completed_vote = True
            await self.session.flush()
        return voter
