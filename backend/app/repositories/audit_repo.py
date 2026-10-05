from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select

from app.models.entities import AuditEvent
from app.repositories.base import BaseRepo


class AuditRepo(BaseRepo[AuditEvent]):
    model = AuditEvent

    async def get_last_hash(self) -> str:
        stmt = select(AuditEvent.event_hash).order_by(AuditEvent.created_at.desc()).limit(1)
        result = await self.session.execute(stmt)
        r = result.scalars().first()
        return r or "0" * 64

    async def get_latest(self, election_id: UUID | str | None = None) -> AuditEvent | None:
        """Return the most recent audit event (optionally scoped to a resource_id)."""
        stmt = select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(1)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def create_event(
        self,
        election_id: UUID | None = None,
        actor_id: UUID | str | None = None,
        action: str = "",
        resource_type: str = "ELECTION",
        resource_id: str | None = None,
        previous_hash: str = "0" * 64,
        event_hash: str = "",
        metadata_json: dict | None = None,
        actor_type: str = "admin",
    ) -> AuditEvent:
        """Create an audit event with pre-computed hashes (used by close_election)."""
        from datetime import datetime, timezone
        evt = self.model(
            created_at=datetime.now(timezone.utc),
            actor_type=actor_type,
            actor_id=str(actor_id) if actor_id else None,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata_json=metadata_json or {},
            previous_hash=previous_hash,
            event_hash=event_hash,
        )
        self.session.add(evt)
        await self.session.flush()
        return evt

    async def append_event(
        self,
        actor_type: str,
        action: str,
        resource_type: str,
        actor_id: str | None = None,
        resource_id: str | None = None,
        metadata_json: dict | None = None,
        prev_hash: str | None = None,
    ) -> AuditEvent:
        from app.services.crypto_service import CryptoService

        if prev_hash is None:
            prev_hash = await self.get_last_hash()
        now = datetime.now(timezone.utc)
        obj_raw = {
            "actor_type": actor_type,
            "actor_id": actor_id or "",
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id or "",
            "meta": metadata_json or {},
            "prev_hash": prev_hash,
            "ts": int(now.timestamp()),
        }
        canonical_str = CryptoService.canonical(obj_raw)
        event_hash = CryptoService.sha256_hex(canonical_str.encode())
        evt = self.model(
            created_at=now,
            actor_type=actor_type,
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata_json=metadata_json or {},
            previous_hash=prev_hash,
            event_hash=event_hash,
        )
        self.session.add(evt)
        await self.session.flush()
        return evt

    async def list_ordered(self) -> list[AuditEvent]:
        stmt = select(AuditEvent).order_by(AuditEvent.created_at.asc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_for_election(self, election_id: UUID | str | None = None, limit: int = 1000) -> list[AuditEvent]:
        stmt = select(AuditEvent).order_by(AuditEvent.created_at.asc()).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_for_resource(self, resource_type: str, resource_id: str | None = None) -> list[AuditEvent]:
        stmt = select(AuditEvent).where(AuditEvent.resource_type == resource_type)
        if resource_id:
            stmt = stmt.where(AuditEvent.resource_id == resource_id)
        stmt = stmt.order_by(AuditEvent.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def recompute_event_hash(self, evt: AuditEvent) -> str:
        from app.services.crypto_service import CryptoService

        obj_raw = {
            "actor_type": evt.actor_type,
            "actor_id": evt.actor_id or "",
            "action": evt.action,
            "resource_type": evt.resource_type,
            "resource_id": evt.resource_id or "",
            "meta": evt.metadata_json or {},
            "prev_hash": evt.previous_hash,
            "ts": int(evt.created_at.timestamp()),
        }
        canonical_str = CryptoService.canonical(obj_raw)
        return CryptoService.sha256_hex(canonical_str.encode())
