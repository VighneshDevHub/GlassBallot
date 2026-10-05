from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select

from app.models.entities import IntegrityCheck
from app.models.enums import IntegrityStatus
from app.repositories.base import BaseRepo


class IntegrityCheckRepo(BaseRepo[IntegrityCheck]):
    model = IntegrityCheck

    async def save_check(
        self,
        election_id: UUID,
        status: IntegrityStatus,
        details_json: dict,
        first_failed_check: str | None = None,
    ) -> IntegrityCheck:
        return await self.persist_results(
            election_id=election_id,
            status=status,
            results_json=details_json,
            first_failed_check=first_failed_check,
        )

    async def persist_results(
        self,
        election_id: UUID,
        status: IntegrityStatus,
        results_json: dict,
        first_failed_check: str | None = None,
    ) -> IntegrityCheck:
        return await self.create(
            election_id=election_id,
            status=status,
            results_json=results_json,
            first_failed_check=first_failed_check,
            executed_at=datetime.now(timezone.utc),
        )

    async def latest_for_election(self, election_id: UUID) -> IntegrityCheck | None:
        stmt = (
            select(IntegrityCheck)
            .where(IntegrityCheck.election_id == election_id)
            .order_by(IntegrityCheck.executed_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list_for_election(self, election_id: UUID) -> list[IntegrityCheck]:
        stmt = (
            select(IntegrityCheck)
            .where(IntegrityCheck.election_id == election_id)
            .order_by(IntegrityCheck.executed_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
