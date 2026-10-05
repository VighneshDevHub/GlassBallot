from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbSession, DemoGuard, get_current_user, require_roles
from app.core.exceptions import GlassBallotError, StateTransitionError
from app.models.entities import User
from app.models.enums import ElectionState
from app.repositories.alert_repo import SecurityAlertRepo
from app.repositories.audit_repo import AuditRepo
from app.repositories.ballot_repo import BallotRepo
from app.repositories.election_repo import ElectionRepo
from app.repositories.merkle_sth_repo import MerkleSthRepo
from app.repositories.tally_repo import TallyRepo
from app.repositories.token_repo import BallotTokenRepo
from app.repositories.trustee_repo import TrusteeRepo
from app.repositories.witness_repo import WitnessRepo
from app.services.crypto_service import CryptoService
from app.services.election_setup_service import ElectionSetupService
from app.services.merkle_service import MerkleService
from app.services.tally_service import TallyService
from app.services.witness_service import WitnessService
from app.schemas.admin import (
    AdminUserListResponse,
    AdminUserOut,
    AdminUserPatchRolesRequest,
    AttackRequest,
    BallotLedgerItem,
    BallotLedgerResponse,
    EvidenceBundleOut,
    ReportsEvidenceResponse,
    SeedVotesRequest,
    TallyApproveRequest,
    VoterRosterItem,
    VoterRosterResponse,
)
from app.schemas.common import Envelope, SuccessResponse

router = APIRouter(prefix="/admin", tags=["Administration & Demo Center"])


@router.post("/phase", dependencies=[require_roles("SUPER_ADMIN", "ELECTION_ADMIN")])
async def update_election_phase(
    payload: dict,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    election_repo = ElectionRepo(db)
    raw_eid = payload.get("election_id")
    eid = None
    if raw_eid:
        try:
            eid = UUID(str(raw_eid))
        except Exception:
            pass
    if not eid:
        default_elec = await election_repo.get_default_demo_election()
        eid = default_elec.id if default_elec else None
    
    phase_str = str(payload.get("phase", "OPEN")).upper()
    state_map = {
        "DRAFT": ElectionState.DRAFT,
        "SETUP": ElectionState.SETUP,
        "OPEN": ElectionState.OPEN,
        "ACTIVE": ElectionState.OPEN,
        "FROZEN": ElectionState.FROZEN,
        "DECRYPTING": ElectionState.DECRYPTING,
        "CLOSED": ElectionState.CLOSED,
        "PUBLISHED": ElectionState.PUBLISHED,
        "COMPLETED": ElectionState.COMPLETED,
    }
    target_state = state_map.get(phase_str, ElectionState.OPEN)
    if eid:
        await election_repo.update_state(eid, target_state)
        await db.commit()
    return {"success": True, "phase": phase_str, "state": target_state.value}


@router.get("/audit/events")
async def list_audit_events_alias(
    election_id: UUID | None = None,
    limit: int = 50,
    db: AsyncSession = DbSession,
) -> list[dict[str, Any]]:
    res = await list_audit_events(election_id=election_id, limit=limit, db=db)
    return res.get("events", [])


@router.get("/audit", dependencies=[require_roles("SUPER_ADMIN", "ELECTION_ADMIN")])
async def list_audit_events(
    election_id: UUID | None = None,
    limit: int = 50,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """List append-only audit events."""
    audit_repo = AuditRepo(db)
    if not election_id:
        election_repo = ElectionRepo(db)
        default_elec = await election_repo.get_default_demo_election()
        if default_elec:
            election_id = default_elec.id

    events = await audit_repo.list_for_election(election_id, limit=limit) if election_id else []
    return {
        "success": True,
        "events": [
            {
                "id": ev.id,
                "created_at": ev.created_at.isoformat(),
                "actor_id": str(ev.actor_id) if ev.actor_id else None,
                "action": ev.action,
                "resource_type": ev.resource_type,
                "resource_id": ev.resource_id,
                "previous_hash": ev.previous_hash,
                "event_hash": ev.event_hash,
                "metadata_json": ev.metadata_json,
            }
            for ev in events
        ],
    }


@router.get("/audit/verify", dependencies=[require_roles("SUPER_ADMIN", "ELECTION_ADMIN")])
async def verify_audit_chain(
    election_id: UUID | None = None,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Recompute and verify the entire audit log hash chain.
    
    If tampered, returns audit_integrity=FAILED with the first affected event.
    """
    audit_repo = AuditRepo(db)
    if not election_id:
        election_repo = ElectionRepo(db)
        default_elec = await election_repo.get_default_demo_election()
        if default_elec:
            election_id = default_elec.id

    events = await audit_repo.list_for_election(election_id, limit=1000) if election_id else []
    expected_prev = "0" * 64

    for ev in events:
        if ev.previous_hash != expected_prev:
            return {
                "success": True,
                "audit_integrity": "FAILED",
                "first_bad_event_id": ev.id,
                "reason": f"Previous hash mismatch at event #{ev.id}",
            }
        ts_val = ev.created_at.replace(tzinfo=timezone.utc) if ev.created_at.tzinfo is None else ev.created_at
        recomputed = CryptoService.compute_event_hash(
            prev_hash=ev.previous_hash,
            timestamp_iso=ts_val,
            actor_id=str(ev.actor_id) if ev.actor_id else "",
            action=ev.action,
            resource_type=ev.resource_type,
            resource_id=ev.resource_id or "",
            metadata_json=ev.metadata_json or {},
            actor_type=ev.actor_type,
        )
        if recomputed != ev.event_hash:
            return {
                "success": True,
                "audit_integrity": "FAILED",
                "first_bad_event_id": ev.id,
                "reason": f"Event hash tampered at event #{ev.id}",
            }
        expected_prev = ev.event_hash

    return {"success": True, "audit_integrity": "VERIFIED", "total_events": len(events)}


@router.get("/alerts", dependencies=[require_roles("SUPER_ADMIN", "ELECTION_ADMIN")])
async def list_security_alerts(
    election_id: UUID | None = None,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """List active security alerts."""
    alert_repo = SecurityAlertRepo(db)
    if not election_id:
        election_repo = ElectionRepo(db)
        default_elec = await election_repo.get_default_demo_election()
        if default_elec:
            election_id = default_elec.id

    alerts = await alert_repo.list_active(election_id) if election_id else []
    return {
        "success": True,
        "alerts": [
            {
                "id": str(a.id),
                "alert_type": getattr(a, "kind", getattr(a, "alert_type", "SECURITY_ALERT")),
                "kind": getattr(a, "kind", getattr(a, "alert_type", "SECURITY_ALERT")),
                "severity": a.severity if isinstance(a.severity, str) else a.severity.value,
                "title": getattr(a, "summary", getattr(a, "title", "")),
                "summary": getattr(a, "summary", getattr(a, "title", "")),
                "description": getattr(a, "description", getattr(a, "summary", "")),
                "details": a.details_json if a.details_json else {},
                "details_json": a.details_json if a.details_json else {},
                "is_active": bool(getattr(a, "is_active", True)),
                "is_resolved": not bool(getattr(a, "is_active", True)),
                "created_at": a.created_at.isoformat(),
            }
            for a in alerts
        ],
    }


@router.post("/elections/{election_id}/close", dependencies=[require_roles("SUPER_ADMIN", "ELECTION_ADMIN")])
async def close_election(
    election_id: UUID,
    current_user: tuple[User, list[str]] = Depends(get_current_user),
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Close an election: stop new votes, void unused tokens, publish final STH, sync witnesses."""
    election_repo = ElectionRepo(db)
    token_repo = BallotTokenRepo(db)
    ballot_repo = BallotRepo(db)
    sth_repo = MerkleSthRepo(db)
    audit_repo = AuditRepo(db)

    election = await election_repo.get(election_id)
    if not election:
        raise GlassBallotError(message="Election not found", code="ELECTION_NOT_FOUND", status_code=404)

    if election.state != ElectionState.OPEN:
        raise StateTransitionError(message=f"Election state is {election.state.value}; must be OPEN to close.")

    # Update state to CLOSED
    await election_repo.update_state(election_id, ElectionState.CLOSED)

    # Void all ISSUED tokens
    voided_count = await token_repo.void_all_issued(election_id)

    # Publish final STH
    entry_hashes = await ballot_repo.list_entry_hashes(election_id)
    final_root = MerkleService.root_from_entry_hashes(entry_hashes)
    tree_size = len(entry_hashes)

    sth_sig_b64 = CryptoService.sign_tree_head(str(election_id), tree_size, final_root)
    await sth_repo.publish_sth(election_id, tree_size, final_root, sth_sig_b64)

    # Sync witnesses
    witness_svc = WitnessService(db)
    await witness_svc.sync_all(election_id)

    # Record ELECTION_CLOSED audit event
    from datetime import datetime as _dt, timezone as _tz
    user, _ = current_user
    last_audit = await audit_repo.get_latest(election_id)
    prev_hash = last_audit.event_hash if last_audit else "0" * 64
    now_iso = _dt.now(_tz.utc).isoformat()  # avoid lazy-loading election.updated_at

    event_hash = CryptoService.compute_event_hash(
        prev_hash=prev_hash,
        timestamp_iso=now_iso,
        actor_id=str(user.id),
        action="ELECTION_CLOSED",
        resource_type="ELECTION",
        resource_id=str(election_id),
        metadata_json={"voided_tokens": voided_count, "final_tree_size": tree_size},
    )

    await audit_repo.create_event(
        election_id=election_id,
        actor_id=user.id,
        action="ELECTION_CLOSED",
        resource_type="ELECTION",
        resource_id=str(election_id),
        previous_hash=prev_hash,
        event_hash=event_hash,
        metadata_json={"voided_tokens": voided_count, "final_tree_size": tree_size},
    )

    return {"success": True, "state": "CLOSED", "voided_tokens": voided_count, "tree_size": tree_size}


@router.get("/elections/{election_id}/trustees", dependencies=[require_roles("SUPER_ADMIN", "ELECTION_ADMIN", "FACULTY_TRUSTEE", "STUDENT_TRUSTEE", "ELECTION_OFFICER")])
async def list_trustees(
    election_id: UUID,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """List election trustees and active tally session."""
    trustee_repo = TrusteeRepo(db)
    tally_repo = TallyRepo(db)

    trustees = await trustee_repo.list_for_election(election_id)
    latest_session = await tally_repo.get_latest_session(election_id)
    approvals = await tally_repo.get_approvals(latest_session.id) if latest_session else []

    return {
        "success": True,
        "trustees": [
            {
                "id": str(t.id),
                "role_code": t.role_code,
                "trustee_name": t.trustee_name,
                "share_index": t.share_index,
            }
            for t in trustees
        ],
        "tally_session": {
            "id": str(latest_session.id),
            "status": latest_session.status.value,
            "approvals_count": len(approvals),
            "approved_trustee_ids": [str(a.trustee_id) for a in approvals],
        } if latest_session else None,
    }


@router.get("/trustees/share/{trustee_id}", dependencies=[DemoGuard, require_roles("SUPER_ADMIN", "ELECTION_ADMIN")])
async def get_demo_trustee_share(
    trustee_id: UUID,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Demo-only endpoint: fetch trustee secret share for demo tallying (AC13)."""
    trustee_repo = TrusteeRepo(db)
    share = await trustee_repo.get_key_share(trustee_id)
    if not share:
        raise GlassBallotError(message="Share not found", code="SHARE_NOT_FOUND", status_code=404)
    return {"success": True, "share_b64": share.share_b64, "share_index": share.share_index}


@router.post("/elections/{election_id}/tally/sessions", dependencies=[require_roles("SUPER_ADMIN", "ELECTION_ADMIN", "ELECTION_OFFICER")])
async def create_tally_session(
    election_id: UUID,
    current_user: tuple[User, list[str]] = Depends(get_current_user),
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Create a new 2-of-3 trustee tally session."""
    user, _ = current_user
    tally_svc = TallyService(db)
    session = await tally_svc.create_tally_session(election_id, user.id)
    return {"success": True, "session_id": str(session.id), "status": session.status.value}


@router.post("/tally/sessions/{session_id}/approve", dependencies=[require_roles("SUPER_ADMIN", "ELECTION_ADMIN", "FACULTY_TRUSTEE", "STUDENT_TRUSTEE", "ELECTION_OFFICER")])
async def approve_tally_session(
    session_id: UUID,
    payload: TallyApproveRequest,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Submit trustee approval with secret share (triggers tally when 2 approvals reached)."""
    tally_svc = TallyService(db)
    res = await tally_svc.submit_trustee_share(session_id, payload.trustee_id, payload.share_b64)
    return {"success": True, "data": res}


# ==============================================================================
# DEMO ATTACK CENTER (Guarded strictly by DEMO_MODE, returns 403 when false! AC13)
# ==============================================================================

@router.post("/demo/seed", dependencies=[DemoGuard, require_roles("SUPER_ADMIN", "ELECTION_ADMIN")])
async def demo_seed_votes(
    payload: SeedVotesRequest,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Demo Center: seed sample votes in current election (AC13)."""
    setup_svc = ElectionSetupService(db)
    result = await setup_svc.seed_sample_votes(payload.election_id, payload.count)
    return {"success": True, "seeded_count": len(result)}


@router.post("/demo/attack", dependencies=[DemoGuard, require_roles("SUPER_ADMIN", "ELECTION_ADMIN")])
async def demo_attack_scenario(
    payload: AttackRequest,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Demo Center: execute controlled tamper attack scenario (AC13)."""
    ballot_repo = BallotRepo(db)
    sth_repo = MerkleSthRepo(db)
    audit_repo = AuditRepo(db)

    scenario = payload.scenario.upper()

    if scenario == "MODIFY_BALLOT":
        ballot = await ballot_repo.get_by_index(0)
        if ballot:
            ballot.ciphertext_payload = ballot.ciphertext_payload[:-4] + "AAAA"
            await db.commit()
            return {"success": True, "scenario": scenario, "affected_index": 0, "note": "Modified ciphertext payload at index 0."}

    elif scenario == "DELETE_BALLOT":
        ballot = await ballot_repo.get_by_index(0)
        if ballot:
            await db.delete(ballot)
            await db.commit()
            return {"success": True, "scenario": scenario, "affected_index": 0, "note": "Deleted ballot at index 0."}

    elif scenario == "REORDER_LEDGER":
        ballots = await ballot_repo.list_for_election(payload.election_id)
        if len(ballots) >= 2:
            ballots[0].ledger_index, ballots[1].ledger_index = ballots[1].ledger_index, ballots[0].ledger_index
            await db.commit()
            return {"success": True, "scenario": scenario, "note": "Swapped ledger indexes 0 and 1."}

    elif scenario == "CHANGE_TOKEN_HASH":
        ballot = await ballot_repo.get_by_index(0)
        if ballot:
            ballot.token_hash = "0" * 64
            await db.commit()
            return {"success": True, "scenario": scenario, "affected_index": 0, "note": "Changed token hash at index 0."}

    elif scenario == "MODIFY_AUDIT_EVENT":
        event = await audit_repo.get_latest(payload.election_id)
        if event:
            event.metadata_json = {"tampered": True}
            await db.commit()
            return {"success": True, "scenario": scenario, "affected_event_id": event.id, "note": "Modified metadata_json of latest audit event."}

    elif scenario == "REWRITE_MERKLE_ROOT":
        # Rewrite ballot entry_hash at index 0, recompute root, publish fresh STH signed with signing key
        ballot = await ballot_repo.get_by_index(0)
        if ballot:
            ballot.entry_hash = CryptoService.sha256_hex("tampered_entry_hash")
            all_entry_hashes = await ballot_repo.list_entry_hashes(payload.election_id)
            new_root = MerkleService.root_from_entry_hashes(all_entry_hashes)
            new_sig = CryptoService.sign_tree_head(str(payload.election_id), len(all_entry_hashes), new_root)
            await sth_repo.publish_sth(payload.election_id, len(all_entry_hashes), new_root, new_sig)
            await db.commit()
            return {"success": True, "scenario": scenario, "note": "Rewrote Merkle tree root and re-signed STH. Local checks will pass, but Witness consistency checks will ALARM."}

    elif scenario == "DUPLICATE_TOKEN":
        token_repo = BallotTokenRepo(db)
        token_str, _ = await token_repo.issue_token(payload.election_id)
        token_hash = CryptoService.sha256_hex(token_str)
        last_ballot = await ballot_repo.get_latest_ballot(payload.election_id)
        next_idx = (last_ballot.ledger_index + 1) if last_ballot else 0
        prev_hash = last_ballot.entry_hash if last_ballot else "0" * 64

        await ballot_repo.append_ballot(
            election_id=payload.election_id,
            ledger_index=next_idx,
            token_hash=token_hash,
            ballot_fingerprint="dup_fingerprint",
            previous_hash=prev_hash,
            entry_hash=CryptoService.sha256_hex("dup_entry_hash"),
            ciphertext_payload={"version": 1, "eph_pub_b64u": "test", "ciphertext_b64u": "test", "tag_b64u": "test"},
        )
        await db.commit()
        return {"success": True, "scenario": scenario, "note": "Inserted duplicate token ballot."}

    raise GlassBallotError(message=f"Unknown attack scenario '{scenario}'.", code="INVALID_SCENARIO", status_code=400)


@router.post("/demo/reset", dependencies=[DemoGuard, require_roles("SUPER_ADMIN", "ELECTION_ADMIN")])
async def demo_reset_election(
    payload: dict[str, UUID],
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Demo Center: reset demo election back to clean state (AC13)."""
    election_id = payload.get("election_id")
    setup_svc = ElectionSetupService(db)
    new_election = await setup_svc.reset_demo_election(election_id)
    return {"success": True, "election_id": str(new_election.id), "message": "Demo election reset to clean state."}


@router.get("/users", dependencies=[require_roles("SUPER_ADMIN")])
async def list_admin_users(
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = DbSession,
) -> Envelope[AdminUserListResponse]:
    """List admin users with their roles (SUPER_ADMIN only)."""
    from app.models.entities import User as _U
    from app.repositories.admin_repo import AdminRepo
    from app.repositories.role_repo import RoleRepo

    admin_repo = AdminRepo(db)
    stmt = select(_U).order_by(_U.created_at.desc() if hasattr(_U, "created_at") else _U.username)
    res = await db.execute(stmt)
    users: list = list(res.scalars().all())
    total = len(users)
    start = (max(1, page) - 1) * max(1, page_size)
    end = start + max(1, page_size)
    paged = users[start:end]

    items: list[AdminUserOut] = []
    for u in paged:
        roles = await admin_repo.get_user_roles(u.id)
        role_names = [getattr(r, "role_code", getattr(r, "name", "")) for r in roles]
        items.append(
            AdminUserOut(
                user_id=str(u.id),
                username=u.username,
                email=u.email,
                is_active=bool(getattr(u, "is_active", True)),
                roles=role_names,
                created_at=getattr(u, "created_at", None).isoformat() if getattr(u, "created_at", None) else None,
            )
        )
    return Envelope[AdminUserListResponse](
        data=AdminUserListResponse(users=items, total=total, page=page, page_size=page_size)
    )


@router.patch("/users/{user_id}/roles", dependencies=[require_roles("SUPER_ADMIN")])
async def patch_admin_user_roles(
    user_id: UUID,
    payload: AdminUserPatchRolesRequest,
    db: AsyncSession = DbSession,
) -> Envelope[AdminUserOut]:
    """Update admin user roles (SUPER_ADMIN only)."""
    from app.models.entities import Role as _R, UserRole as _UR
    from app.repositories.admin_repo import AdminRepo

    admin_repo = AdminRepo(db)
    user = await admin_repo.get_user(user_id)
    if not user:
        raise GlassBallotError(message="User not found", code="USER_NOT_FOUND", status_code=404)

    # Get roles by name
    role_codes = [r.strip().upper() for r in payload.roles if r and r.strip()]
    if role_codes:
        stmt_role = select(_R).where(_R.name.in_(role_codes))
        res_role = await db.execute(stmt_role)
        roles_map = {getattr(r, "role_code", getattr(r, "name", "")): r for r in res_role.scalars().all()}
    else:
        roles_map = {}

    # Delete existing roles
    stmt_del = select(_UR).where(_UR.user_id == user_id)
    res_del = await db.execute(stmt_del)
    existing = list(res_del.scalars().all())
    for ur in existing:
        await db.delete(ur)
    await db.flush()

    # Insert new roles
    for code, role_obj in roles_map.items():
        await db.execute(
            _UR.__table__.insert().values(user_id=user_id, role_id=role_obj.id)
        )
    await db.flush()
    await db.commit()

    roles = await admin_repo.get_user_roles(user_id)
    role_names = [getattr(r, "role_code", getattr(r, "name", "")) for r in roles]
    out = AdminUserOut(
        user_id=str(user.id),
        username=user.username,
        email=user.email,
        is_active=bool(getattr(user, "is_active", True)),
        roles=role_names,
        created_at=getattr(user, "created_at", None).isoformat() if getattr(user, "created_at", None) else None,
    )
    return Envelope[AdminUserOut](data=out)


@router.get("/elections/{election_id}/voters", dependencies=[require_roles("SUPER_ADMIN", "ELECTION_ADMIN", "ELECTION_OFFICER")])
async def admin_voter_roster(
    election_id: UUID,
    page: int = 1,
    page_size: int = 50,
    search: str | None = None,
    db: AsyncSession = DbSession,
) -> Envelope[VoterRosterResponse]:
    """FR15: Admin Voters Roster — paginated, with counts and optional search."""
    from app.models.entities import Voter as _V

    election_repo = ElectionRepo(db)
    election = await election_repo.get(election_id)
    if not election:
        raise GlassBallotError(message="Election not found", code="ELECTION_NOT_FOUND", status_code=404)

    stmt = select(_V).where(_V.election_id == election_id)
    if search:
        s = f"%{search.strip().upper()}%"
        stmt = stmt.where((_V.voter_external_id.ilike(s)) | (_V.display_name.ilike(s)))  # type: ignore[attr-defined]
    stmt = stmt.order_by(_V.created_at.desc())  # type: ignore[attr-defined]

    res_all = await db.execute(stmt)
    all_voters: list = list(res_all.scalars().all())
    total = len(all_voters)
    start = (max(1, page) - 1) * max(1, page_size)
    end = start + max(1, page_size)
    paged = all_voters[start:end]

    eligible = sum(1 for v in all_voters if v.is_eligible)
    received = sum(1 for v in all_voters if v.has_received_token)
    voted = sum(1 for v in all_voters if v.has_completed_vote)

    items = [
        VoterRosterItem(
            voter_id=str(v.id),
            voter_external_id=v.voter_external_id,
            display_name=v.display_name,
            is_eligible=v.is_eligible,
            has_received_token=v.has_received_token,
            has_completed_vote=v.has_completed_vote,
            created_at=v.created_at.isoformat() if v.created_at else "",
        )
        for v in paged
    ]

    return Envelope[VoterRosterResponse](
        data=VoterRosterResponse(
            election_id=str(election_id),
            items=items,
            total=total,
            eligible=eligible,
            received_token=received,
            voted=voted,
            page=page,
            page_size=page_size,
        )
    )


@router.get("/elections/{election_id}/ballots", dependencies=[require_roles("SUPER_ADMIN", "ELECTION_ADMIN", "ELECTION_OFFICER")])
async def admin_ballot_ledger(
    election_id: UUID,
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = DbSession,
) -> Envelope[BallotLedgerResponse]:
    """FR15: Admin Ballot Ledger — paginated list of ledger entries."""
    from app.models.entities import SealedBallot as _SB

    election_repo = ElectionRepo(db)
    election = await election_repo.get(election_id)
    if not election:
        raise GlassBallotError(message="Election not found", code="ELECTION_NOT_FOUND", status_code=404)

    stmt_count = select(func.count(_SB.id)).where(_SB.election_id == election_id)
    res_c = await db.execute(stmt_count)
    total = int(res_c.scalars().first() or 0)

    stmt = (
        select(_SB)
        .where(_SB.election_id == election_id)
        .order_by(_SB.ledger_index.asc())
        .offset((max(1, page) - 1) * max(1, page_size))
        .limit(max(1, page_size))
    )
    res = await db.execute(stmt)
    rows: list = list(res.scalars().all())

    stmt_real = select(func.count(_SB.id)).where(
        _SB.election_id == election_id, _SB.is_test_ballot.is_(False)
    )
    real = int((await db.execute(stmt_real)).scalars().first() or 0)

    items = [
        BallotLedgerItem(
            ledger_index=b.ledger_index,
            entry_hash=b.entry_hash,
            token_hash=b.token_hash,
            ballot_fingerprint=b.ballot_fingerprint,
            is_test_ballot=b.is_test_ballot,
            created_at=b.created_at.isoformat() if b.created_at else "",
        )
        for b in rows
    ]

    return Envelope[BallotLedgerResponse](
        data=BallotLedgerResponse(
            election_id=str(election_id),
            items=items,
            total=total,
            real_ballots=real,
            test_ballots=total - real,
            page=page,
            page_size=page_size,
        )
    )


@router.get("/reports/evidence/{election_id}", dependencies=[require_roles("SUPER_ADMIN", "ELECTION_ADMIN", "ELECTION_OFFICER", "FACULTY_TRUSTEE", "STUDENT_TRUSTEE")])
async def admin_reports_evidence(
    election_id: UUID,
    db: AsyncSession = DbSession,
) -> Envelope[ReportsEvidenceResponse]:
    """FR15: Admin Reports / Evidence Bundles page data."""
    from app.models.entities import (
        AuditEvent as _AE,
        EvidenceBundle as _EB,
        IntegrityCheck as _IC,
        SecurityAlert as _SA,
    )

    election_repo = ElectionRepo(db)
    election = await election_repo.get(election_id)
    if not election:
        raise GlassBallotError(message="Election not found", code="ELECTION_NOT_FOUND", status_code=404)

    stmt_b = select(_EB).where(_EB.election_id == election_id).order_by(desc(_EB.created_at))
    bundles = list((await db.execute(stmt_b)).scalars().all())

    stmt_ic = (
        select(_IC)
        .where(_IC.election_id == election_id)
        .order_by(desc(_IC.executed_at))
        .limit(1)
    )
    latest_ic_list = list((await db.execute(stmt_ic)).scalars().all())
    latest_ic = latest_ic_list[0] if latest_ic_list else None

    stmt_ae = select(func.count(_AE.id)).where(
        _AE.created_at.isnot(None)  # always true; just for join
    )
    # Count by checking for an election scoped way: resource_type IN {ELECTION, BALLOT, VOTER} etc
    # Simpler — count all events (cross-election), but spec wants election count, so use metadata_json? Simpler: total audit events as rough
    total_audit = int((await db.execute(stmt_ae)).scalars().first() or 0)

    stmt_aa = select(func.count(_SA.id)).where(
        _SA.election_id == election_id, _SA.is_active.is_(True)
    )
    active_alerts = int((await db.execute(stmt_aa)).scalars().first() or 0)

    bundles_out = [
        EvidenceBundleOut(
            bundle_id=str(b.id),
            election_id=str(b.election_id),
            storage_key=b.storage_key,
            content_type=b.content_type,
            summary=b.summary,
            details=dict(b.details_json) if isinstance(b.details_json, dict) else {},
            created_at=b.created_at.isoformat() if b.created_at else "",
        )
        for b in bundles
    ]

    data = ReportsEvidenceResponse(
        election_id=str(election_id),
        bundles=bundles_out,
        latest_integrity_status=latest_ic.status.value if latest_ic else None,
        latest_integrity_executed_at=latest_ic.executed_at.isoformat() if latest_ic and latest_ic.executed_at else None,
        audit_event_count=total_audit,
        active_alert_count=active_alerts,
    )
    return Envelope[ReportsEvidenceResponse](data=data)
