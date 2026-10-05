from __future__ import annotations

from uuid import UUID

from app.models.entities import EvidenceBundle
from app.repositories.base import BaseRepo


class EvidenceBundleRepo(BaseRepo[EvidenceBundle]):
    model = EvidenceBundle

    async def create_bundle(
        self,
        election_id: UUID,
        bundle_type: str = "EVIDENCE",
        summary: str = "",
        content_json: dict | None = None,
        storage_key: str | None = None,
    ) -> EvidenceBundle:
        key = storage_key or f"evidence_{election_id}_{bundle_type}.json"
        return await self.create(
            election_id=election_id,
            storage_key=key,
            content_type="application/json",
            summary=summary,
            details_json=content_json or {},
        )

    async def persist_bundle(
        self,
        election_id: UUID,
        storage_key: str,
        summary: str,
        content_type: str = "application/json",
        details_json: dict | None = None,
    ) -> EvidenceBundle:
        return await self.create(
            election_id=election_id,
            storage_key=storage_key,
            content_type=content_type,
            summary=summary,
            details_json=details_json or {},
        )

    async def list_for_election(self, election_id: UUID) -> list[EvidenceBundle]:
        from sqlalchemy import desc, select

        stmt = (
            select(EvidenceBundle)
            .where(EvidenceBundle.election_id == election_id)
            .order_by(desc(EvidenceBundle.created_at))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
