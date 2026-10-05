from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.models.entities import Election, ElectionCandidate
from app.models.enums import ElectionState
from app.repositories.base import BaseRepo


class ElectionRepo(BaseRepo[Election]):
    model = Election

    async def get_default_demo_election(self) -> Election | None:
        """Return the latest OPEN election, falling back to the most recently created election."""
        # Prefer the most recent OPEN election
        stmt_open = (
            select(Election)
            .where(Election.state == ElectionState.OPEN)
            .order_by(Election.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt_open)
        election = result.scalars().first()
        if election:
            return election
        # Fall back: any election, newest first
        stmt_any = select(Election).order_by(Election.created_at.desc()).limit(1)
        result = await self.session.execute(stmt_any)
        return result.scalars().first()

    async def list_all(self) -> list[Election]:
        """Return all elections ordered newest first."""
        stmt = select(Election).order_by(Election.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_election(
        self,
        public_id: str,
        title: str,
        description: str | None = None,
        public_key_b64: str = "",
    ) -> Election:
        return await self.create(
            public_id=public_id,
            title=title,
            description=description or "",
            college_name="RGIT Mumbai",
            election_public_key=bytes.fromhex("04" + "00" * 64) if not public_key_b64 else bytes.fromhex("04" + "00" * 64),
            election_public_key_b64=public_key_b64,
            sth_public_key_b64="sth_pubkey_placeholder",
            state=ElectionState.OPEN,
        )

    async def update_state(self, election_id: UUID, state: ElectionState) -> Election:
        election = await self.get(election_id)
        if election:
            election.state = state
            await self.session.flush()
        return election

    async def set_state(self, election_id: UUID, state: ElectionState) -> Election:
        return await self.update_state(election_id, state)

    async def list_candidates(self, election_id: UUID) -> list[ElectionCandidate]:
        candidate_repo = ElectionCandidateRepo(self.session)
        return await candidate_repo.list_for_election(election_id)

    async def add_candidate(
        self,
        election_id: UUID,
        name: str,
        party_or_tag: str = "",
        display_order: int = 0,
        department: str | None = None,
        avatar_url: str | None = None,
    ) -> ElectionCandidate:
        candidate_repo = ElectionCandidateRepo(self.session)
        return await candidate_repo.create(
            election_id=election_id,
            candidate_code=f"cand_{display_order}",
            display_name=name,
            statement=party_or_tag,
            department=department,
            avatar_url=avatar_url,
            sort_order=display_order,
        )


class ElectionCandidateRepo(BaseRepo[ElectionCandidate]):
    model = ElectionCandidate

    async def list_for_election(self, election_id: UUID) -> list[ElectionCandidate]:
        stmt = (
            select(ElectionCandidate)
            .where(ElectionCandidate.election_id == election_id)
            .order_by(ElectionCandidate.sort_order.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
