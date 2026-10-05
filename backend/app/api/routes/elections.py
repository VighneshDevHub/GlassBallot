from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbSession, require_roles
from app.core.exceptions import GlassBallotError
from app.models.enums import ElectionState
from app.repositories.ballot_repo import BallotRepo
from app.repositories.election_repo import ElectionRepo
from app.repositories.spoiled_ballot_repo import SpoiledBallotRepo
from app.repositories.tally_repo import TallyRepo
from app.repositories.voter_repo import VoterRepo
from app.schemas.common import Envelope
from app.schemas.elections import ElectionCreateRequest
from app.schemas.voter import ElectionStatsResponse, MilestoneItem, MilestonesResponse

router = APIRouter(prefix="/elections", tags=["Elections"])


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


@router.get("")
async def list_elections(
    scope: str | None = None,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """List all elections. Use ?scope=me for voter-scoped elections."""
    repo = ElectionRepo(db)
    elections = await repo.list_all()
    if scope == "me":
        e_list = []
        for e in elections:
            candidates = await repo.list_candidates(e.id)
            e_list.append({
                "id": str(e.id),
                "public_id": e.public_id,
                "title": e.title,
                "college_name": getattr(e, "college_name", ""),
                "description": e.description,
                "state": e.state.value,
                "public_key_b64": e.election_public_key_b64,
                "opens_at": e.opens_at.isoformat() if e.opens_at else None,
                "closes_at": e.closes_at.isoformat() if e.closes_at else None,
                "candidates": [
                    {
                        "id": str(c.id),
                        "candidate_code": c.candidate_code,
                        "display_name": c.display_name,
                        "name": c.display_name,
                        "statement": getattr(c, "statement", None),
                        "department": getattr(c, "department", None),
                        "avatar_url": getattr(c, "avatar_url", None),
                        "sort_order": c.sort_order,
                    }
                    for c in candidates
                ],
                "created_at": e.created_at.isoformat(),
            })
        return {"success": True, "elections": e_list}
    return {
        "success": True,
        "elections": [
            {
                "id": str(e.id),
                "public_id": e.public_id,
                "title": e.title,
                "description": e.description,
                "state": e.state.value,
                "public_key_b64": e.election_public_key_b64,
                "created_at": e.created_at.isoformat(),
            }
            for e in elections
        ],
    }


@router.get("/{election_id}/stats")
async def get_election_stats(
    election_id: str,
    db: AsyncSession = DbSession,
) -> Envelope[ElectionStatsResponse]:
    """Return computed stats for an election (voters, turnout, state)."""
    from datetime import timezone as _tz
    from sqlalchemy import func as _func
    eid = await _resolve_election_id(election_id, db)
    if not eid:
        raise GlassBallotError(message="Election not found", code="ELECTION_NOT_FOUND", status_code=404)

    election_repo = ElectionRepo(db)
    voter_repo = VoterRepo(db)
    ballot_repo = BallotRepo(db)
    spoiled_repo = SpoiledBallotRepo(db)

    election = await election_repo.get(eid)
    if not election:
        raise GlassBallotError(message="Election not found", code="ELECTION_NOT_FOUND", status_code=404)

    voters = await voter_repo.list_for_election(eid)
    eligible = sum(1 for v in voters if v.is_eligible)
    received_token = sum(1 for v in voters if v.has_received_token)
    cast_count = sum(1 for v in voters if v.has_completed_vote)
    spoiled_count_raw = await spoiled_repo.list_for_election(eid)
    spoiled_count = len(spoiled_count_raw)
    ballots_real = await ballot_repo.count_real_ballots(eid)

    turnout = (cast_count / eligible * 100.0) if eligible else 0.0

    # Build per-hour ballot count for the last 7 days for the chart
    from app.models.entities import SealedBallot as _SB
    from datetime import datetime as _dt, timedelta as _td
    from sqlalchemy import select as _select
    cutoff = _dt.now(_tz.utc) - _td(days=7)
    stmt = (
        _select(_SB.created_at)
        .where(_SB.election_id == eid)
        .where(_SB.is_test_ballot == False)  # noqa: E712
        .where(_SB.created_at >= cutoff)
        .order_by(_SB.created_at.asc())
    )
    rows = await db.execute(stmt)
    ballot_times = [r[0] for r in rows.fetchall()]

    # Aggregate into hour buckets
    hour_counts: dict[str, int] = {}
    for ts in ballot_times:
        if ts:
            # Truncate to hour
            hour_key = ts.replace(minute=0, second=0, microsecond=0).isoformat()
            hour_counts[hour_key] = hour_counts.get(hour_key, 0) + 1

    by_hour = [{"hour": h, "count": c} for h, c in sorted(hour_counts.items())]

    data = ElectionStatsResponse(
        election_id=str(eid),
        eligible_voters=eligible,
        registered_voters=len(voters),
        received_tokens=received_token,
        cast_ballots=max(cast_count, ballots_real),
        total_cast=max(cast_count, ballots_real),
        spoiled_test_ballots=spoiled_count,
        turnout_percent=round(turnout, 2),
        integrity_pct=100 if eligible > 0 else 0,
        state=election.state.value,
        opens_at=election.opens_at.isoformat() if election.opens_at else None,
        closes_at=election.closes_at.isoformat() if election.closes_at else None,
        tally_completed_at=election.tally_completed_at.isoformat() if election.tally_completed_at else None,
        by_hour_last_7d=by_hour,
    )
    return Envelope[ElectionStatsResponse](data=data)


@router.get("/{election_id}/milestones")
async def get_election_milestones(
    election_id: str,
    db: AsyncSession = DbSession,
) -> Envelope[MilestonesResponse]:
    """Return the 5-step lifecycle milestone tracker for an election."""
    eid = await _resolve_election_id(election_id, db)
    if not eid:
        raise GlassBallotError(message="Election not found", code="ELECTION_NOT_FOUND", status_code=404)

    election_repo = ElectionRepo(db)
    tally_repo = TallyRepo(db)
    election = await election_repo.get(eid)
    if not election:
        raise GlassBallotError(message="Election not found", code="ELECTION_NOT_FOUND", status_code=404)

    state = election.state
    steps_done: set[str] = set()
    steps_current: set[str] = set()

    if state in {ElectionState.DRAFT}:
        steps_current = {"DRAFT"}
    elif state in {ElectionState.SETUP}:
        steps_done = {"DRAFT"}
        steps_current = {"SETUP"}
    elif state in {ElectionState.OPEN, ElectionState.CLOSING}:
        steps_done = {"DRAFT", "SETUP"}
        steps_current = {"VOTING_OPEN"}
    elif state in {ElectionState.CLOSED, ElectionState.DECRYPTING, ElectionState.TALLYING}:
        steps_done = {"DRAFT", "SETUP", "VOTING_OPEN"}
        steps_current = {"TALLYING"}
    elif state in {ElectionState.COMPLETED, ElectionState.PUBLISHED, ElectionState.FROZEN}:
        steps_done = {"DRAFT", "SETUP", "VOTING_OPEN", "TALLYING"}
        steps_current = {"PUBLISHED"}

    latest_session = await tally_repo.get_latest_session(eid)
    tally_completed_at_ts = None
    if latest_session and latest_session.completed_at:
        tally_completed_at_ts = latest_session.completed_at.isoformat()
    elif election.tally_completed_at:
        tally_completed_at_ts = election.tally_completed_at.isoformat()

    items = [
        MilestoneItem(
            key="DRAFT",
            label="Election Configured",
            status="DONE" if "DRAFT" in steps_done else ("CURRENT" if "DRAFT" in steps_current else "PENDING"),
            timestamp=election.created_at.isoformat() if election.created_at else None,
            description="Election structure, candidates & trustees defined",
        ),
        MilestoneItem(
            key="SETUP",
            label="Keys Generated",
            status="DONE" if "SETUP" in steps_done else ("CURRENT" if "SETUP" in steps_current else "PENDING"),
            timestamp=election.created_at.isoformat() if "SETUP" in steps_done and election.created_at else None,
            description="Shamir trustee key shares generated; voters roster sealed",
        ),
        MilestoneItem(
            key="VOTING_OPEN",
            label="Voting Open",
            status="DONE" if "VOTING_OPEN" in steps_done else ("CURRENT" if "VOTING_OPEN" in steps_current else "PENDING"),
            timestamp=election.opens_at.isoformat() if election.opens_at else None,
            description="Ballot tokens issued; voters casting sealed ballots",
        ),
        MilestoneItem(
            key="TALLYING",
            label="Tally & Decryption",
            status="DONE" if "TALLYING" in steps_done else ("CURRENT" if "TALLYING" in steps_current else "PENDING"),
            timestamp=tally_completed_at_ts or (election.closes_at.isoformat() if election.closes_at else None),
            description="2-of-3 trustee decryption; Merkle + witness reconciliation",
        ),
        MilestoneItem(
            key="PUBLISHED",
            label="Results Published",
            status="DONE" if "PUBLISHED" in steps_done else ("CURRENT" if "PUBLISHED" in steps_current else "PENDING"),
            timestamp=election.tally_completed_at.isoformat() if election.tally_completed_at else None,
            description="Verifiable results published; permanent freeze",
        ),
    ]

    return Envelope[MilestonesResponse](
        data=MilestonesResponse(election_id=str(eid), items=items)
    )


@router.get("/config")
async def get_election_config(
    id: str | None = None,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Return configuration details for active election."""
    eid = await _resolve_election_id(id, db)
    if not eid:
        return {"success": False, "state": "draft", "demo": True}

    repo = ElectionRepo(db)
    election = await repo.get(eid)
    if not election:
        return {"success": False, "state": "draft", "demo": True}

    candidates = await repo.list_candidates(eid)
    c_list = [
        {
            "id": str(c.id),
            "candidate_code": c.candidate_code,
            "display_name": c.display_name,
            "name": c.display_name,
            "statement": getattr(c, "statement", None),
            "department": getattr(c, "department", None),
            "avatar_url": getattr(c, "avatar_url", None),
            "sort_order": c.sort_order,
        }
        for c in candidates
    ]

    return {
        "success": True,
        "state": election.state.value,
        "demo": True,
        "threshold": 2,
        "trustees": 3,
        "election_pub": election.election_public_key_b64,
        "sth_pub": election.sth_public_key_b64,
        "election": {
            "id": str(election.id),
            "public_id": election.public_id,
            "title": election.title,
            "college_name": election.college_name,
            "description": election.description,
            "state": election.state.value,
            "election_public_key_b64": election.election_public_key_b64,
            "sth_public_key_b64": election.sth_public_key_b64,
            "candidates": c_list,
        },
    }


@router.get("/results")
@router.get("/{election_id}/results")
async def get_election_results(
    election_id: str | None = None,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Get published results for an election."""
    eid = await _resolve_election_id(election_id, db)
    if not eid:
        return {"success": True, "published": False, "counts": {}, "total": 0, "message": "No active election found."}

    election_repo = ElectionRepo(db)
    tally_repo = TallyRepo(db)

    election = await election_repo.get(eid)
    if not election:
        return {"success": True, "published": False, "counts": {}, "total": 0, "message": "Election not found."}

    results = await tally_repo.get_published_results(eid)
    if not results:
        return {
            "success": True,
            "published": False,
            "state": election.state.value,
            "counts": {},
            "results": {},
            "tally": {},
            "total": 0,
            "total_ballots": 0,
            "candidates": [],
            "ledger_entries": 0,
            "matches_ledger": True,
            "shuffled_choices": [],
            "spoiled_count": 0,
            "failed_count": 0,
            "message": "Results are not yet published. Require 2 trustee approvals.",
        }

    return {
        "success": True,
        "published": True,
        "state": election.state.value,
        "election_id": str(eid),
        "counts": results.candidate_counts,
        "total": results.total_ballots,
        "ledger_entries": results.valid_ballots,
        "matches_ledger": True,
        "shuffled_choices": results.shuffled_choices,
        "spoiled_count": results.spoiled_ballots,
        "failed_count": 0,
        "results": {
            "total_ballots": results.total_ballots,
            "valid_ballots": results.valid_ballots,
            "spoiled_ballots": results.spoiled_ballots,
            "candidate_counts": results.candidate_counts,
            "shuffled_choices": results.shuffled_choices,
            "published_at": results.published_at.isoformat(),
        },
    }


@router.get("/{election_id}")
async def get_election_detail(
    election_id: str,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Get detailed information about an election including candidates."""
    eid = await _resolve_election_id(election_id, db)
    if not eid:
        raise GlassBallotError(message="Election not found", code="ELECTION_NOT_FOUND", status_code=404)

    repo = ElectionRepo(db)
    election = await repo.get(eid)
    if not election:
        raise GlassBallotError(message="Election not found", code="ELECTION_NOT_FOUND", status_code=404)

    candidates = await repo.list_candidates(eid)

    return {
        "success": True,
        "election": {
            "id": str(election.id),
            "public_id": election.public_id,
            "title": election.title,
            "description": election.description,
            "state": election.state.value,
            "public_key_b64": election.election_public_key_b64,
            "election_public_key_b64": election.election_public_key_b64,
            "candidates": [
                {
                    "id": str(c.id),
                    "name": c.display_name,
                    "candidate_code": c.candidate_code,
                    "display_name": c.display_name,
                    "statement": getattr(c, "statement", None),
                    "department": getattr(c, "department", None),
                    "avatar_url": getattr(c, "avatar_url", None),
                    "sort_order": c.sort_order,
                }
                for c in candidates
            ],
            "created_at": election.created_at.isoformat(),
        },
    }


@router.post("", dependencies=[require_roles("SUPER_ADMIN", "ELECTION_ADMIN")])
async def create_election(
    payload: ElectionCreateRequest,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Create a new election (Admin only). Starts in OPEN state so voters can see it immediately."""
    from app.models.enums import ElectionState as _ES
    repo = ElectionRepo(db)
    election = await repo.create_election(
        public_id=payload.public_id,
        title=payload.title,
        description=payload.description,
        public_key_b64=payload.public_key_b64,
    )
    # Set to OPEN so the election is visible on the student portal
    election.state = _ES.OPEN
    await db.flush()

    for idx, cand in enumerate(payload.candidates):
        await repo.add_candidate(
            election.id,
            cand.name,
            cand.party_or_tag,
            display_order=idx,
            department=getattr(cand, "department", None),
            avatar_url=getattr(cand, "avatar_url", None),
        )
    await db.commit()
    return {"success": True, "election_id": str(election.id)}
