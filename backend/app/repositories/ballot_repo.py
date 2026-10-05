from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select

from app.models.entities import SealedBallot
from app.repositories.base import BaseRepo
from app.services.merkle_service import MerkleService


class BallotRepo(BaseRepo[SealedBallot]):
    model = SealedBallot

    async def append(
        self,
        election_id: UUID,
        ledger_index: int,
        previous_hash: str,
        entry_hash: str,
        token_hash: str,
        ballot_payload: dict,
        ballot_fingerprint: str,
        is_test_ballot: bool = False,
        token_id: UUID | None = None,
    ) -> SealedBallot:
        return await self.create(
            election_id=election_id,
            ledger_index=ledger_index,
            previous_hash=previous_hash,
            entry_hash=entry_hash,
            token_hash=token_hash,
            ballot_payload=ballot_payload,
            ballot_fingerprint=ballot_fingerprint,
            is_test_ballot=is_test_ballot,
            token_id=token_id,
        )

    async def list_by_election(self, election_id: UUID) -> list[SealedBallot]:
        stmt = (
            select(SealedBallot)
            .where(SealedBallot.election_id == election_id)
            .order_by(SealedBallot.ledger_index.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_for_election(self, election_id: UUID) -> int:
        stmt = select(func.count(SealedBallot.id)).where(SealedBallot.election_id == election_id)
        result = await self.session.execute(stmt)
        r = result.scalars().first()
        return int(r or 0)

    async def count_real_ballots(self, election_id: UUID) -> int:
        stmt = select(func.count(SealedBallot.id)).where(
            SealedBallot.election_id == election_id, SealedBallot.is_test_ballot.is_(False)
        )
        result = await self.session.execute(stmt)
        r = result.scalars().first()
        return int(r or 0)

    async def get_leaf_hashes(self, election_id: UUID) -> list[bytes]:
        ballots = await self.list_by_election(election_id)
        entry_hashes = [ballot.entry_hash for ballot in ballots]
        return MerkleService._leaf_hashes_from_entry_hashes(entry_hashes)

    async def append_ballot(
        self,
        election_id: UUID,
        ledger_index: int,
        token_hash: str,
        ballot_fingerprint: str,
        previous_hash: str,
        entry_hash: str,
        ciphertext_payload: dict,
    ) -> SealedBallot:
        return await self.append(
            election_id=election_id,
            ledger_index=ledger_index,
            previous_hash=previous_hash,
            entry_hash=entry_hash,
            token_hash=token_hash,
            ballot_payload=ciphertext_payload,
            ballot_fingerprint=ballot_fingerprint,
        )

    async def list_for_election(self, election_id: UUID) -> list[SealedBallot]:
        return await self.list_by_election(election_id)

    async def list_entry_hashes(self, election_id: UUID) -> list[str]:
        ballots = await self.list_by_election(election_id)
        return [b.entry_hash for b in ballots]

    async def get_latest_ballot(self, election_id: UUID) -> SealedBallot | None:
        stmt = (
            select(SealedBallot)
            .where(SealedBallot.election_id == election_id)
            .order_by(SealedBallot.ledger_index.desc())
        )
        result = await self.session.execute(stmt.limit(1))
        return result.scalars().first()

    async def get_by_entry_hash(self, entry_hash: str) -> SealedBallot | None:
        stmt = select(SealedBallot).where(SealedBallot.entry_hash == entry_hash)
        result = await self.session.execute(stmt.limit(1))
        return result.scalars().first()

    async def get_by_index(self, arg1: Any, arg2: int | None = None) -> SealedBallot | None:
        if arg2 is not None:
            election_id, index = arg1, arg2
            stmt = select(SealedBallot).where(
                SealedBallot.election_id == election_id, SealedBallot.ledger_index == index
            )
        else:
            index = int(arg1)
            stmt = select(SealedBallot).where(SealedBallot.ledger_index == index)
        result = await self.session.execute(stmt.limit(1))
        return result.scalars().first()

    async def get_by_fingerprint(self, fingerprint: str) -> SealedBallot | None:
        stmt = select(SealedBallot).where(SealedBallot.ballot_fingerprint == fingerprint)
        result = await self.session.execute(stmt.limit(1))
        return result.scalars().first()

    async def get_by_entry_hash_or_fingerprint(self, identifier: str) -> SealedBallot | None:
        stmt = select(SealedBallot).where(
            (SealedBallot.entry_hash == identifier) | (SealedBallot.ballot_fingerprint == identifier)
        )
        result = await self.session.execute(stmt.limit(1))
        return result.scalars().first()

    async def get_ledger_indexes_set(self, election_id: UUID) -> set[int]:
        stmt = select(SealedBallot.ledger_index).where(SealedBallot.election_id == election_id)
        result = await self.session.execute(stmt)
        return {int(i) for i in result.scalars().all()}

    async def delete_by_id(self, ballot_id: UUID) -> None:
        b = await self.get(ballot_id)
        if b is not None:
            await self.delete(b)

    async def swap_ledger_indexes(self, a_id: UUID, b_id: UUID) -> None:
        a = await self.get(a_id)
        b = await self.get(b_id)
        if a and b:
            a_idx = a.ledger_index
            a.ledger_index = b.ledger_index
            b.ledger_index = a_idx
            await self.session.flush()
