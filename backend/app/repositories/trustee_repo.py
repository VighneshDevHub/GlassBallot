from __future__ import annotations

from uuid import UUID

from sqlalchemy import select

from app.models.entities import Trustee, TrusteeKeyShare
from app.repositories.base import BaseRepo


class TrusteeRepo(BaseRepo[Trustee]):
    model = Trustee

    async def list_for_election(self, election_id: UUID) -> list[Trustee]:
        stmt = (
            select(Trustee)
            .where(Trustee.election_id == election_id)
            .order_by(Trustee.role_code.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_role_code(self, election_id: UUID, role_code: str) -> Trustee | None:
        stmt = (
            select(Trustee)
            .where(Trustee.election_id == election_id)
            .where(Trustee.role_code == role_code)
        )
        result = await self.session.execute(stmt.limit(1))
        return result.scalars().first()


class KeyShareRepo(BaseRepo[TrusteeKeyShare]):
    model = TrusteeKeyShare

    async def list_for_trustee(self, trustee_id: UUID) -> list[TrusteeKeyShare]:
        stmt = select(TrusteeKeyShare).where(TrusteeKeyShare.trustee_id == trustee_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_for_election(self, election_id: UUID) -> list[TrusteeKeyShare]:
        stmt = select(TrusteeKeyShare).where(TrusteeKeyShare.election_id == election_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
