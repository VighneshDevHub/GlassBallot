from __future__ import annotations

from datetime import timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbSession, VoterSession
from app.core.exceptions import AuthError, GlassBallotError
from app.models.entities import AuditEvent, SealedBallot
from app.repositories.audit_repo import AuditRepo
from app.repositories.ballot_repo import BallotRepo
from app.repositories.election_repo import ElectionRepo
from app.repositories.spoiled_ballot_repo import SpoiledBallotRepo
from app.repositories.token_repo import BallotTokenRepo
from app.repositories.voter_repo import VoterRepo
from app.schemas.common import Envelope, SuccessResponse
from app.schemas.voter import (
    ActivityItem,
    ActivityListResponse,
    ReceiptItem,
    ReceiptListResponse,
    VoterProfileResponse,
    VoterProfileUpdate,
    VoterSettingsResponse,
    VoterSettingsUpdate,
)

router = APIRouter(prefix="/voter", tags=["Voter Self-Service"])


async def _resolve_voter(
    session: dict,
    db: AsyncSession,
) -> tuple[Any, Any]:
    from uuid import UUID as _UUID

    voter_repo = VoterRepo(db)
    raw_vid = session.get("voter_id") or session.get("vid")
    if not raw_vid or raw_vid == "demo":
        election_repo = ElectionRepo(db)
        default_election = await election_repo.get_default_demo_election()
        if not default_election:
            raise AuthError("No voter session established.")
        voters = await voter_repo.list_for_election(default_election.id)
        if not voters:
            raise AuthError("No eligible voters in election.")
        voter = voters[0]
        election = default_election
    else:
        try:
            vid = _UUID(str(raw_vid))
        except Exception:
            raise AuthError("Invalid voter session.")
        voter = await voter_repo.get(vid)
        if not voter:
            raise AuthError("Voter not found.")
        election_repo = ElectionRepo(db)
        election = await election_repo.get(voter.election_id)
    return voter, election


@router.get("/me")
async def get_voter_me(
    session: dict = VoterSession,
    db: AsyncSession = DbSession,
) -> Envelope[VoterProfileResponse]:
    """Return authenticated voter profile."""
    voter, _election = await _resolve_voter(session, db)
    md = voter.metadata_json if isinstance(voter.metadata_json, dict) else {}
    return Envelope[VoterProfileResponse](
        data=VoterProfileResponse(
            voter_id=str(voter.id),
            election_id=str(voter.election_id),
            voter_external_id=voter.voter_external_id,
            display_name=voter.display_name,
            is_eligible=voter.is_eligible,
            has_received_token=voter.has_received_token,
            has_completed_vote=voter.has_completed_vote,
            course=md.get("course"),
            year=md.get("year"),
            email=md.get("email"),
            created_at=voter.created_at.isoformat() if voter.created_at else "",
        )
    )


@router.patch("/me")
async def patch_voter_me(
    payload: VoterProfileUpdate,
    session: dict = VoterSession,
    db: AsyncSession = DbSession,
) -> Envelope[VoterProfileResponse]:
    """Update authenticated voter profile fields."""
    voter, _election = await _resolve_voter(session, db)
    if payload.display_name is not None and payload.display_name.strip():
        voter.display_name = payload.display_name.strip()
    md = dict(voter.metadata_json) if isinstance(voter.metadata_json, dict) else {}
    for key in ("course", "year", "email"):
        val = getattr(payload, key, None)
        if val is not None:
            md[key] = val
    voter.metadata_json = md
    await db.flush()
    await db.commit()
    return Envelope[VoterProfileResponse](
        data=VoterProfileResponse(
            voter_id=str(voter.id),
            election_id=str(voter.election_id),
            voter_external_id=voter.voter_external_id,
            display_name=voter.display_name,
            is_eligible=voter.is_eligible,
            has_received_token=voter.has_received_token,
            has_completed_vote=voter.has_completed_vote,
            course=md.get("course"),
            year=md.get("year"),
            email=md.get("email"),
            created_at=voter.created_at.isoformat() if voter.created_at else "",
        )
    )


@router.get("/me/settings")
async def get_voter_settings(
    session: dict = VoterSession,
    db: AsyncSession = DbSession,
) -> Envelope[VoterSettingsResponse]:
    """Read voter UI/notification preferences (stored in voter.metadata_json.settings)."""
    voter, _election = await _resolve_voter(session, db)
    md = voter.metadata_json if isinstance(voter.metadata_json, dict) else {}
    settings = md.get("settings") or {}
    data = VoterSettingsResponse(
        email_notifications=bool(settings.get("email_notifications", True)),
        sms_notifications=bool(settings.get("sms_notifications", False)),
        dark_mode=bool(settings.get("dark_mode", False)),
        compact_view=bool(settings.get("compact_view", False)),
        accessibility_high_contrast=bool(settings.get("accessibility_high_contrast", False)),
        accessibility_reduced_motion=bool(settings.get("accessibility_reduced_motion", False)),
        language=str(settings.get("language", "en")),
    )
    return Envelope[VoterSettingsResponse](data=data)


@router.patch("/me/settings")
async def patch_voter_settings(
    payload: VoterSettingsUpdate,
    session: dict = VoterSession,
    db: AsyncSession = DbSession,
) -> Envelope[VoterSettingsResponse]:
    """Update voter UI/notification preferences."""
    voter, _election = await _resolve_voter(session, db)
    md = dict(voter.metadata_json) if isinstance(voter.metadata_json, dict) else {}
    settings = dict(md.get("settings") or {})
    for key in (
        "email_notifications",
        "sms_notifications",
        "dark_mode",
        "compact_view",
        "accessibility_high_contrast",
        "accessibility_reduced_motion",
    ):
        val = getattr(payload, key, None)
        if val is not None:
            settings[key] = bool(val)
    if payload.language is not None:
        settings["language"] = payload.language
    md["settings"] = settings
    voter.metadata_json = md
    await db.flush()
    await db.commit()
    data = VoterSettingsResponse(
        email_notifications=bool(settings.get("email_notifications", True)),
        sms_notifications=bool(settings.get("sms_notifications", False)),
        dark_mode=bool(settings.get("dark_mode", False)),
        compact_view=bool(settings.get("compact_view", False)),
        accessibility_high_contrast=bool(settings.get("accessibility_high_contrast", False)),
        accessibility_reduced_motion=bool(settings.get("accessibility_reduced_motion", False)),
        language=str(settings.get("language", "en")),
    )
    return Envelope[VoterSettingsResponse](data=data)


@router.get("/me/activity")
async def get_voter_activity(
    limit: int = 25,
    page: int = 1,
    session: dict = VoterSession,
    db: AsyncSession = DbSession,
) -> Envelope[ActivityListResponse]:
    """Activity timeline for current voter (audit events scoped to voter's election + filtered)."""
    voter, election = await _resolve_voter(session, db)
    audit_repo = AuditRepo(db)
    events = await audit_repo.list_for_election(election.id, limit=max(100, limit * 3))
    voter_id_str = str(voter.id)
    voter_ext = voter.voter_external_id

    items: list[ActivityItem] = []
    for ev in events:
        md = ev.metadata_json if isinstance(ev.metadata_json, dict) else {}
        matches = False
        if str(ev.actor_id or "") == voter_id_str:
            matches = True
        if md and (str(md.get("voter_id", "")) == voter_id_str or str(md.get("voter_external_id", "")) == voter_ext):
            matches = True
        if ev.action in ("VOTER_REGISTERED", "TOKEN_ISSUED", "VOTE_COMPLETED", "TEST_BALLOT_SPOILED", "OTP_VERIFIED", "OTP_REQUESTED"):
            matches = True
        if not matches and len(items) < limit * 3:
            # Include generic election-wide events
            if ev.action in ("ELECTION_OPENED", "ELECTION_CLOSED", "TALLY_STARTED", "RESULTS_PUBLISHED"):
                matches = True
        if matches:
            items.append(
                ActivityItem(
                    id=str(ev.id),
                    timestamp=ev.created_at.isoformat(),
                    action=ev.action,
                    resource_type=ev.resource_type,
                    resource_id=str(ev.resource_id) if ev.resource_id else None,
                    summary=str(md.get("summary") or ev.action.replace("_", " ").title()),
                    metadata=md,
                )
            )
        if len(items) >= limit * 2:
            break
    trimmed = items[:limit]
    return Envelope[ActivityListResponse](
        data=ActivityListResponse(items=trimmed, total=len(items))
    )


@router.get("/me/receipts")
async def get_voter_receipts(
    limit: int = 20,
    session: dict = VoterSession,
    db: AsyncSession = DbSession,
) -> Envelope[ReceiptListResponse]:
    """Return receipts for current voter: OTP, tokens, cast ballots, spoiled test ballots."""
    voter, election = await _resolve_voter(session, db)
    election_title = election.title if election else "Election"
    items: list[ReceiptItem] = []

    token_repo = BallotTokenRepo(db)
    tokens = []
    try:
        from app.models.entities import BallotToken as _BT

        stmt = select(_BT).where(_BT.voter_id == voter.id).order_by(desc(_BT.created_at)).limit(limit)
        res = await db.execute(stmt)
        tokens = list(res.scalars().all())
    except Exception:
        pass

    for tok in tokens:
        raw_hash = tok.token_hash or ""
        tail = raw_hash[-6:] if len(raw_hash) >= 6 else raw_hash
        items.append(
            ReceiptItem(
                receipt_id=f"TOKEN-{tok.id}",
                kind="ballot_token",
                election_id=str(tok.election_id),
                election_title=election_title,
                issued_at=tok.created_at.isoformat() if tok.created_at else "",
                token_tail=tail or None,
                summary=f"Ballot token issued — Status: {tok.status}",
                verified=(tok.status == "USED"),
                details={"status": str(tok.status), "used_at": tok.used_at.isoformat() if tok.used_at else None},
            )
        )

    ballot_repo = BallotRepo(db)
    ballots: list[SealedBallot] = []
    if tokens:
        token_ids = [t.id for t in tokens]
        stmt = (
            select(SealedBallot)
            .where(SealedBallot.token_id.in_(token_ids))  # type: ignore[attr-defined]
            .order_by(desc(SealedBallot.created_at))
            .limit(limit)
        )
        res = await db.execute(stmt)
        ballots = list(res.scalars().all())

    for b in ballots:
        items.append(
            ReceiptItem(
                receipt_id=f"BALLOT-{b.ledger_index}",
                kind="cast_ballot" if not b.is_test_ballot else "test_ballot",
                election_id=str(b.election_id),
                election_title=election_title,
                issued_at=b.created_at.isoformat() if b.created_at else "",
                fingerprint=b.ballot_fingerprint,
                summary=f"{'Test' if b.is_test_ballot else 'Cast'} ballot recorded at ledger index {b.ledger_index}",
                verified=True,
                details={"ledger_index": b.ledger_index, "entry_hash": b.entry_hash, "is_test_ballot": b.is_test_ballot},
            )
        )

    spoiled_repo = SpoiledBallotRepo(db)
    spoiled = await spoiled_repo.list_for_election(election.id)
    for s in spoiled[:limit]:
        items.append(
            ReceiptItem(
                receipt_id=f"SPOILED-{s.id}",
                kind="spoiled_test",
                election_id=str(s.election_id),
                election_title=election_title,
                issued_at=s.created_at.isoformat() if s.created_at else "",
                fingerprint=s.ballot_fingerprint,
                summary=f"Spoiled test ballot: claimed {s.claimed_choice}, revealed {s.revealed_choice}, match={s.verification_ok}",
                verified=bool(s.verification_ok),
                details={"claimed": s.claimed_choice, "revealed": s.revealed_choice, "verification_ok": s.verification_ok},
            )
        )

    items.sort(key=lambda r: r.issued_at, reverse=True)
    return Envelope[ReceiptListResponse](
        data=ReceiptListResponse(items=items[:limit], total=len(items))
    )


@router.post("/logout")
async def voter_logout(
    _session: dict = VoterSession,
) -> Envelope[SuccessResponse]:
    """Soft-logout (client cookie deletion handled by frontend wrapper)."""
    return Envelope[SuccessResponse](data=SuccessResponse(ok=True, message="Logged out."))
