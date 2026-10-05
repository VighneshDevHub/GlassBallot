from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import desc, select

from app.models.entities import SecurityAlert
from app.repositories.base import BaseRepo


class AlertRepo(BaseRepo[SecurityAlert]):
    model = SecurityAlert

    async def create_alert(
        self,
        alert_type: str | None = None,
        severity: Any = "HIGH",
        title: str = "",
        description: str = "",
        election_id: UUID | None = None,
        details_json: dict | None = None,
        is_active: bool = True,
        kind: str | None = None,
        summary: str | None = None,
    ) -> SecurityAlert:
        kind_val = alert_type or kind or "SECURITY_ALERT"
        summary_val = title or summary or description or "Alert"
        sev_val = severity.value if hasattr(severity, "value") else str(severity)
        return await self.create(
            election_id=election_id,
            kind=kind_val,
            severity=sev_val,
            summary=summary_val,
            details_json=details_json or {},
            is_active=is_active,
        )

    async def list_active(self, election_id: UUID | None = None) -> list[SecurityAlert]:
        if election_id:
            return await self.list_for_election(election_id)
        return await self.list_all()

    async def list_all(self, limit: int = 200) -> list[SecurityAlert]:
        stmt = select(SecurityAlert).order_by(desc(SecurityAlert.created_at)).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_for_election(self, election_id: UUID) -> list[SecurityAlert]:
        stmt = (
            select(SecurityAlert)
            .where(SecurityAlert.election_id == election_id)
            .order_by(desc(SecurityAlert.created_at))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


SecurityAlertRepo = AlertRepo

