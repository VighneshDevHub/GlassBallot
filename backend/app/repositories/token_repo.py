from __future__ import annotations

from uuid import UUID

from sqlalchemy import and_, func, select, text

from app.models.entities import BallotToken
from app.models.enums import TokenStatus
from app.repositories.base import BaseRepo


class TokenRepo(BaseRepo[BallotToken]):
    model = BallotToken

    async def append(self, election_id: UUID, voter_id: UUID, token_hash: str) -> BallotToken:
        return await self.create(
            election_id=election_id,
            voter_id=voter_id,
            token_hash=token_hash,
            status=TokenStatus.ISSUED,
        )

    async def get_by_hash(self, token_hash: str, for_update: bool = False) -> BallotToken | None:
        stmt = select(BallotToken).where(BallotToken.token_hash == token_hash)
        if for_update:
            stmt = stmt.with_for_update()
        result = await self.session.execute(stmt.limit(1))
        return result.scalars().first()

    async def count_by_status(self, election_id: UUID, status: TokenStatus) -> int:
        stmt = select(func.count(BallotToken.id)).where(
            and_(BallotToken.election_id == election_id, BallotToken.status == status)
        )
        result = await self.session.execute(stmt)
        r = result.scalars().first()
        return int(r or 0)

    async def count_unique_hashes(self, election_id: UUID) -> int:
        stmt = select(func.count(func.distinct(BallotToken.token_hash))).where(
            BallotToken.election_id == election_id
        )
        result = await self.session.execute(stmt)
        r = result.scalars().first()
        return int(r or 0)

    async def void_remaining_issued(self, election_id: UUID) -> int:
        stmt = (
            select(BallotToken)
            .where(BallotToken.election_id == election_id)
            .where(BallotToken.status == TokenStatus.ISSUED)
        )
        result = await self.session.execute(stmt)
        tokens = list(result.scalars().all())
        for t in tokens:
            t.status = TokenStatus.VOID
            t.invalidated_reason = "election_closed"
        await self.session.flush()
        return len(tokens)

    async def issue_token(self, election_id: UUID, voter_id: UUID | None = None) -> tuple[str, BallotToken]:
        import secrets
        from app.services.crypto_service import CryptoService
        raw_token = f"gb_token_{secrets.token_hex(16)}"
        token_hash = CryptoService.sha256_hex(raw_token)
        token_obj = await self.create(
            election_id=election_id,
            voter_id=voter_id or UUID("00000000-0000-0000-0000-000000000000"),
            token_hash=token_hash,
            status=TokenStatus.ISSUED,
        )
        return raw_token, token_obj

    async def get_by_raw_token(self, raw_token: str) -> BallotToken | None:
        from app.services.crypto_service import CryptoService
        token_hash = CryptoService.sha256_hex(raw_token)
        return await self.get_by_hash(token_hash)

    async def get_by_raw_token_for_update(self, raw_token: str) -> BallotToken | None:
        from app.services.crypto_service import CryptoService
        token_hash = CryptoService.sha256_hex(raw_token)
        return await self.get_by_hash(token_hash, for_update=True)

    async def mark_used(self, token_id: UUID) -> BallotToken:
        token = await self.get(token_id)
        if token:
            token.status = TokenStatus.USED
            await self.session.flush()
        return token

    async def void_all_issued(self, election_id: UUID) -> int:
        return await self.void_remaining_issued(election_id)

    async def list_for_election(self, election_id: UUID) -> list[BallotToken]:
        stmt = select(BallotToken).where(BallotToken.election_id == election_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_used_without_eligibility(self, election_id: UUID) -> list[UUID]:
        from app.models.entities import Voter

        stmt = (
            select(BallotToken.id)
            .join(Voter, Voter.id == BallotToken.voter_id)
            .where(BallotToken.election_id == election_id)
            .where(BallotToken.status == TokenStatus.USED)
            .where(Voter.has_completed_vote.is_(False))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


BallotTokenRepo = TokenRepo

