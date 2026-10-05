from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, delete, select

from app.models.entities import OtpChallenge
from app.repositories.base import BaseRepo


class OtpRepo(BaseRepo[OtpChallenge]):
    model = OtpChallenge

    async def append_challenge(
        self,
        voter_id: UUID,
        otp_hash: str,
        ttl_minutes: int = 15,
    ) -> OtpChallenge:
        await self.session.execute(
            delete(OtpChallenge).where(OtpChallenge.voter_id == voter_id)
        )
        expires = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
        return await self.create(voter_id=voter_id, otp_hash=otp_hash, expires_at=expires, attempt_count=0)

    async def get_latest_for_voter(self, voter_id: UUID) -> OtpChallenge | None:
        stmt = (
            select(OtpChallenge)
            .where(OtpChallenge.voter_id == voter_id)
            .order_by(OtpChallenge.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_recent(self, voter_id: UUID, limit: int = 3) -> list[OtpChallenge]:
        stmt = (
            select(OtpChallenge)
            .where(OtpChallenge.voter_id == voter_id)
            .order_by(OtpChallenge.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_challenge(
        self,
        election_id: UUID | str | None = None,
        voter_id: UUID | str | None = None,
        otp_hash: str = "",
        ttl_seconds: int = 900,
        ttl_minutes: int = 15,
    ) -> OtpChallenge:
        minutes = max(1, ttl_seconds // 60) if ttl_seconds else ttl_minutes
        v_id = UUID(str(voter_id)) if isinstance(voter_id, str) else voter_id
        return await self.append_challenge(v_id, otp_hash, ttl_minutes=minutes)

    async def get_active_challenge(self, voter_id: UUID | str) -> OtpChallenge | None:
        v_id = UUID(str(voter_id)) if isinstance(voter_id, str) else voter_id
        c = await self.get_latest_for_voter(v_id)
        if c and not await self.is_expired(c):
            return c
        return None

    async def increment_attempts(self, challenge_id: UUID | str) -> OtpChallenge | None:
        c_id = UUID(str(challenge_id)) if isinstance(challenge_id, str) else challenge_id
        return await self.increment_attempt(c_id)

    async def mark_consumed(self, challenge_id: UUID | str) -> None:
        c_id = UUID(str(challenge_id)) if isinstance(challenge_id, str) else challenge_id
        await self.session.execute(
            delete(OtpChallenge).where(OtpChallenge.id == c_id)
        )
        await self.session.flush()

    async def increment_attempt(self, challenge_id: UUID) -> OtpChallenge | None:
        c = await self.get(challenge_id)
        if c is None:
            return None
        c.attempt_count += 1
        c.last_attempt_at = datetime.now(timezone.utc)
        await self.session.flush()
        return c

    async def is_expired(self, challenge: OtpChallenge) -> bool:
        if not challenge or not challenge.expires_at:
            return True
        exp = challenge.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        return now > exp

