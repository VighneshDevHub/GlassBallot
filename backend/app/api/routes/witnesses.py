from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbSession
from app.repositories.election_repo import ElectionRepo
from app.repositories.witness_repo import WitnessRepo
from app.services.witness_service import WitnessService

router = APIRouter(prefix="", tags=["Candidate Witnesses"])


async def _resolve_election_id(election_id: str | UUID | None, db: AsyncSession) -> UUID | None:
    if isinstance(election_id, UUID):
        return election_id
    if election_id and str(election_id) not in ("0", "default", "demo"):
        try:
            return UUID(str(election_id))
        except Exception:
            pass
    elec_repo = ElectionRepo(db)
    elec = await elec_repo.get_default_demo_election()
    return elec.id if elec else None


@router.get("/witnesses")
@router.get("/elections/{election_id}/witnesses")
async def list_witnesses(
    election_id: str | None = None,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """List all candidate witnesses and their current observation statuses."""
    eid = await _resolve_election_id(election_id, db)
    if not eid:
        return {"success": True, "witnesses": []}

    repo = WitnessRepo(db)
    witnesses = await repo.list_for_election(eid)
    return {
        "success": True,
        "witnesses": [
            {
                "id": str(w.id),
                "witness_code": w.witness_code,
                "owner_name": w.owner_name,
                "status": w.status.value,
                "alarm_sticky": w.alarm_sticky,
                "last_accepted_size": w.last_accepted_size,
                "last_accepted_root": w.last_accepted_root,
                "last_signature_b64": w.last_signature_b64,
                "last_synced_at": w.last_synced_at.isoformat() if w.last_synced_at else None,
            }
            for w in witnesses
        ],
    }


@router.post("/witnesses/sync")
@router.post("/elections/{election_id}/witnesses/sync")
async def sync_witnesses(
    election_id: str | None = None,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Force sync all candidate witnesses against the latest STH."""
    eid = await _resolve_election_id(election_id, db)
    if not eid:
        return {"success": False, "error": "Election not found"}

    service = WitnessService(db)
    synced = await service.sync_all(eid)
    return {
        "success": True,
        "synced_count": len(synced),
        "statuses": [w.status.value for w in synced],
    }
