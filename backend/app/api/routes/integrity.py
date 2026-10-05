from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbSession
from app.repositories.ballot_repo import BallotRepo
from app.repositories.election_repo import ElectionRepo
from app.repositories.merkle_sth_repo import MerkleSthRepo
from app.repositories.witness_repo import WitnessRepo
from app.services.integrity_service import IntegrityService, ReconciliationService

router = APIRouter(prefix="", tags=["Integrity Engine"])


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


@router.get("/integrity/status")
@router.get("/public/status")
async def get_integrity_status(
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Return system integrity status and reconciliation stats for the current active election."""
    election_repo = ElectionRepo(db)
    ballot_repo = BallotRepo(db)
    sth_repo = MerkleSthRepo(db)
    witness_repo = WitnessRepo(db)

    default_election = await election_repo.get_default_demo_election()
    if not default_election:
        return {
            "success": True,
            "status": "VERIFIED",
            "overall": "VERIFIED",
            "entries": 0,
            "merkle_root": "",
            "frozen": False,
            "checks": [],
            "reconciliation": {
                "ok": True,
                "status": "1:1 MATCH",
                "voters_marked": 0,
                "ballots_recorded": 0,
                "pending": 0,
                "problems": [],
            },
        }

    ballots = await ballot_repo.list_for_election(default_election.id)
    sth = await sth_repo.get_latest(default_election.id)
    witnesses = await witness_repo.list_for_election(default_election.id)
    recon_svc = ReconciliationService(db)
    recon = await recon_svc.reconcile(default_election.id)
    integrity_svc = IntegrityService(db)
    integrity = await integrity_svc.run_full_check(default_election.id)

    return {
        "success": True,
        "active": True,
        "status": integrity.get("overall", "VERIFIED"),
        "overall": integrity.get("overall", "VERIFIED"),
        "frozen": default_election.is_frozen or False,
        "entries": len(ballots),
        "merkle_root": sth.root_hash if sth else "",
        "tree_size": sth.tree_size if sth else 0,
        "checks": integrity.get("checks", []),
        "evidence_bundle_id": integrity.get("evidence_bundle_id"),
        "first_failed_check": integrity.get("first_failed_check"),
        "election": {
            "id": str(default_election.id),
            "title": default_election.title,
            "state": default_election.state.value,
        },
        "metrics": {
            "ballots_recorded": len(ballots),
            "voters_marked": recon["voters_marked"],
            "merkle_root": sth.root_hash if sth else "",
            "tree_size": sth.tree_size if sth else 0,
            "witnesses_synced": sum(1 for w in witnesses if w.status.value == "SYNCED"),
            "witnesses_total": len(witnesses),
            "reconciliation_status": recon["status"],
            "overall_integrity": integrity.get("overall", "VERIFIED"),
        },
        "reconciliation": recon,
    }


@router.get("/integrity/checks")
async def get_integrity_checks(
    db: AsyncSession = DbSession,
) -> list[dict[str, Any]]:
    """Return array of 10 continuous integrity checks."""
    st = await get_integrity_status(db)
    return st.get("checks", [])


@router.post("/integrity/run")
async def run_integrity(
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Trigger re-running of all 10 continuous integrity engine checks."""
    return await get_integrity_status(db)


@router.get("/elections/{election_id}/integrity")
async def get_integrity_report(
    election_id: str,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Run full 10-check Integrity Engine and return detailed status report."""
    eid = await _resolve_election_id(election_id, db)
    if not eid:
        return {"success": False, "error": "Election not found"}
    service = IntegrityService(db)
    report = await service.run_full_check(eid)
    return {"success": True, "report": report}


@router.get("/elections/{election_id}/reconcile")
async def get_reconciliation_report(
    election_id: str,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Run Two Books reconciliation check (Eligibility Register vs Sealed Ledger)."""
    eid = await _resolve_election_id(election_id, db)
    if not eid:
        return {"success": False, "error": "Election not found"}
    service = ReconciliationService(db)
    report = await service.reconcile(eid)
    return {"success": True, "reconciliation": report}
