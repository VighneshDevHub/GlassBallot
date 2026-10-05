from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import desc, select

from app.models.entities import TallyResult, TallySession
from app.models.enums import ApprovalStatus
from app.repositories.base import BaseRepo


class TallyRepo(BaseRepo[TallySession]):
    model = TallySession

    async def open_session(
        self,
        election_id: UUID,
        requested_by_user_id: UUID | None = None,
        approvals_required: int = 2,
    ) -> TallySession:
        return await self.create(
            election_id=election_id,
            requested_by_user_id=requested_by_user_id,
            status=ApprovalStatus.PENDING,
            approvals_required=approvals_required,
            approvals_received=0,
        )

    async def latest_session(self, election_id: UUID) -> TallySession | None:
        stmt = (
            select(TallySession)
            .where(TallySession.election_id == election_id)
            .order_by(desc(TallySession.created_at))
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_latest_session(self, election_id: UUID) -> TallySession | None:
        """Alias for latest_session — used by elections route."""
        return await self.latest_session(election_id)

    async def get(self, id_val: UUID) -> TallySession | None:
        return await super().get(id_val)

    async def record_approval(self, session_id: UUID) -> TallySession:
        s = await self.get(session_id)
        assert s is not None
        s.approvals_received += 1
        if s.approvals_received >= s.approvals_required:
            s.status = ApprovalStatus.APPROVED
            s.completed_at = datetime.now(timezone.utc)
        await self.session.flush()
        return s

    async def record_results(
        self,
        tally_session_id: UUID,
        election_id: UUID,
        counts_per_candidate: dict[str, int],
    ) -> list[TallyResult]:
        out: list[TallyResult] = []
        for code, count in counts_per_candidate.items():
            r = TallyResult(
                tally_session_id=tally_session_id,
                election_id=election_id,
                candidate_code=code,
                vote_total=count,
                published_metadata={},
            )
            self.session.add(r)
            out.append(r)
        await self.session.flush()
        return out

    async def list_results(self, election_id: UUID) -> list[TallyResult]:
        stmt = (
            select(TallyResult)
            .where(TallyResult.election_id == election_id)
            .order_by(TallyResult.vote_total.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_result_map(self, tally_session_id: UUID) -> dict[str, int]:
        stmt = select(TallyResult).where(TallyResult.tally_session_id == tally_session_id)
        result = await self.session.execute(stmt)
        return {r.candidate_code: r.vote_total for r in result.scalars().all()}

    async def get_published_results(self, election_id: UUID) -> list[TallyResult]:
        return await self.list_results(election_id)


class TallyResultRepo(BaseRepo[TallyResult]):
    model = TallyResult
