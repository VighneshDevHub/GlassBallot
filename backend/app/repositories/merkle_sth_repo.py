from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import desc, select

from app.models.entities import MerkleTreeHead
from app.repositories.base import BaseRepo


class MerkleSthRepo(BaseRepo[MerkleTreeHead]):
    model = MerkleTreeHead

    async def append(
        self,
        election_id: UUID,
        size: int,
        root_hash: str,
        signature_b64: str,
        canonical_payload: dict,
    ) -> MerkleTreeHead:
        return await self.create(
            election_id=election_id,
            size=size,
            root_hash=root_hash,
            signed_at=datetime.now(timezone.utc),
            signature_b64=signature_b64,
            canonical_payload=canonical_payload,
        )

    async def publish_sth(
        self,
        election_id: UUID,
        size: int | None = None,
        root_hash: str = "",
        signature_b64: str = "",
        canonical_payload: dict | None = None,
        tree_size: int | None = None,
    ) -> MerkleTreeHead:
        effective_size = tree_size if tree_size is not None else (size or 0)
        if canonical_payload is None:
            now_ts = int(datetime.now(timezone.utc).timestamp())
            canonical_payload = {
                "v": 1,
                "election": str(election_id),
                "size": effective_size,
                "root": root_hash,
                "ts": now_ts,
            }

        # Upsert: if a tree head for this (election_id, size) already exists,
        # update it rather than raising a UNIQUE constraint violation.
        existing = await self.get_by_size(election_id, effective_size)
        if existing:
            existing.root_hash = root_hash
            existing.signature_b64 = signature_b64
            existing.canonical_payload = canonical_payload
            existing.signed_at = datetime.now(timezone.utc)
            await self.session.flush()
            return existing

        return await self.append(
            election_id=election_id,
            size=effective_size,
            root_hash=root_hash,
            signature_b64=signature_b64,
            canonical_payload=canonical_payload,
        )

    async def get_by_size(self, election_id: UUID, size: int) -> MerkleTreeHead | None:
        stmt = (
            select(MerkleTreeHead)
            .where(MerkleTreeHead.election_id == election_id)
            .where(MerkleTreeHead.size == size)
        )
        result = await self.session.execute(stmt.limit(1))
        return result.scalars().first()

    async def get_latest(self, election_id: UUID) -> MerkleTreeHead | None:
        stmt = (
            select(MerkleTreeHead)
            .where(MerkleTreeHead.election_id == election_id)
            .order_by(desc(MerkleTreeHead.size))
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list_all(self, election_id: UUID) -> list[MerkleTreeHead]:
        stmt = (
            select(MerkleTreeHead)
            .where(MerkleTreeHead.election_id == election_id)
            .order_by(MerkleTreeHead.size.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_for_election(self, election_id: UUID) -> list[MerkleTreeHead]:
        return await self.list_all(election_id)
