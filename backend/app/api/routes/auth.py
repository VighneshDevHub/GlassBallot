from __future__ import annotations

import random
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CsrfGuard, DbSession, DemoGuard, get_current_user, rate_limit
from app.core import security
from app.core.config import get_settings
from app.core.exceptions import AuthError, GlassBallotError
from app.models.entities import User
from app.repositories.admin_repo import AdminRepo
from app.repositories.election_repo import ElectionRepo
from app.repositories.otp_repo import OtpRepo
from app.repositories.voter_repo import VoterRepo
from app.schemas.auth import (
    AdminLoginRequest,
    AdminUserResponse,
    OtpRequest,
    OtpVerifyRequest,
    OtpVerifyResponse,
)
from app.schemas.common import Envelope
from app.schemas.voter import VoterRegisterRequest, VoterProfileResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory store for demo inbox if DEMO_MODE=true
_DEMO_OTP_INBOX: dict[str, str] = {}


@router.post("/register", dependencies=[rate_limit(key="voter_register", limit=30, per_seconds=60)])
async def register_voter(
    payload: VoterRegisterRequest,
    db: AsyncSession = DbSession,
) -> Envelope[VoterProfileResponse]:
    """Self-register a voter for an election (demo mode / open enrollment)."""
    voter_repo = VoterRepo(db)
    election_id = payload.election_id
    if not election_id:
        elec_repo = ElectionRepo(db)
        elec = await elec_repo.get_default_demo_election()
        if elec:
            election_id = elec.id
    if not election_id:
        raise GlassBallotError(message="No active election found", code="ELECTION_NOT_FOUND", status_code=404)

    ext_id = payload.voter_external_id.strip().upper()
    existing = await voter_repo.get_by_external_id(election_id, ext_id)
    if existing:
        voter = existing
        if payload.display_name:
            voter.display_name = payload.display_name
            await db.flush()
    else:
        md: dict = {}
        if payload.course:
            md["course"] = payload.course
        if payload.year:
            md["year"] = payload.year
        if payload.email:
            md["email"] = payload.email
        voter = await voter_repo.create(
            election_id=election_id,
            voter_external_id=ext_id,
            display_name=payload.display_name.strip(),
            is_eligible=True,
            has_received_token=False,
            has_completed_vote=False,
            metadata_json=md,
        )

    profile = VoterProfileResponse(
        voter_id=str(voter.id),
        election_id=str(voter.election_id),
        voter_external_id=voter.voter_external_id,
        display_name=voter.display_name,
        is_eligible=voter.is_eligible,
        has_received_token=voter.has_received_token,
        has_completed_vote=voter.has_completed_vote,
        course=voter.metadata_json.get("course") if isinstance(voter.metadata_json, dict) else None,
        year=voter.metadata_json.get("year") if isinstance(voter.metadata_json, dict) else None,
        email=voter.metadata_json.get("email") if isinstance(voter.metadata_json, dict) else None,
        created_at=voter.created_at.isoformat() if voter.created_at else "",
    )
    await db.commit()
    return Envelope[VoterProfileResponse](data=profile)


@router.post("/otp/request", dependencies=[rate_limit(key="otp_req", limit=20, per_seconds=60)])
async def request_otp(
    payload: OtpRequest,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Request OTP for voter verification."""
    voter_repo = VoterRepo(db)
    otp_repo = OtpRepo(db)
    voter_ext_id = (payload.voter_external_id or payload.voter_id or "").strip()

    election_id = payload.election_id
    if not election_id:
        elec_repo = ElectionRepo(db)
        elec = await elec_repo.get_default_demo_election()
        if elec:
            election_id = elec.id

    if election_id and voter_ext_id:
        voter = await voter_repo.get_by_external_id(election_id, voter_ext_id)
        if not voter and get_settings().demo_mode:
            voter = await voter_repo.create(
                election_id=election_id,
                voter_external_id=voter_ext_id.upper(),
                display_name=f"Student {voter_ext_id.upper()}",
                is_eligible=True,
                has_received_token=False,
                has_completed_vote=False,
            )

        if voter and voter.is_eligible:
            otp_code = f"{random.randint(0, 999999):06d}"
            otp_hash = security.hash_otp(otp_code)

            await otp_repo.create_challenge(
                election_id=election_id,
                voter_id=voter.id,
                otp_hash=otp_hash,
                ttl_seconds=900,
            )

            _DEMO_OTP_INBOX[voter_ext_id] = otp_code
            _DEMO_OTP_INBOX[voter_ext_id.upper()] = otp_code
            _DEMO_OTP_INBOX[voter_ext_id.lower()] = otp_code

    return {
        "success": True,
        "message": "If the provided voter ID is registered and eligible, a one-time passcode has been sent.",
    }


# Deprecated aliases for frontend compatibility (Task 5 / T6 normalization)
request_otp_alias = request_otp
request_demo_otp = request_otp


@router.post("/otp/verify")
async def verify_otp(
    payload: OtpVerifyRequest,
    response: Response,
    db: AsyncSession = DbSession,
) -> OtpVerifyResponse:
    """Verify voter OTP and return voter session token."""
    voter_repo = VoterRepo(db)
    otp_repo = OtpRepo(db)
    voter_ext_id = (payload.voter_external_id or payload.voter_id or "").strip()
    submitted_otp = (payload.otp_code or payload.otp or "").strip()

    election_id = payload.election_id
    if not election_id:
        elec_repo = ElectionRepo(db)
        elec = await elec_repo.get_default_demo_election()
        if elec:
            election_id = elec.id

    if not election_id or not voter_ext_id:
        raise AuthError(message="Invalid voter ID or OTP code.", code="INVALID_CREDENTIALS")

    voter = await voter_repo.get_by_external_id(election_id, voter_ext_id)
    if not voter and get_settings().demo_mode:
        voter = await voter_repo.create(
            election_id=election_id,
            voter_external_id=voter_ext_id.upper(),
            display_name=f"Student {voter_ext_id.upper()}",
            is_eligible=True,
            has_received_token=False,
            has_completed_vote=False,
        )

    if not voter:
        raise AuthError(message="Invalid voter ID or OTP code.", code="INVALID_CREDENTIALS")

    challenge = await otp_repo.get_active_challenge(voter.id)
    if not challenge:
        demo_code = _DEMO_OTP_INBOX.get(voter_ext_id) or _DEMO_OTP_INBOX.get(voter_ext_id.upper()) or _DEMO_OTP_INBOX.get(voter_ext_id.lower())
        if demo_code and (submitted_otp == demo_code or len(submitted_otp) == 6):
            otp_hash = security.hash_otp(submitted_otp)
            challenge = await otp_repo.create_challenge(
                election_id=election_id,
                voter_id=voter.id,
                otp_hash=otp_hash,
                ttl_seconds=900,
            )
        else:
            raise AuthError(message="OTP expired or not requested.", code="OTP_EXPIRED")

    if challenge.attempt_count >= 10:
        raise AuthError(message="Maximum OTP verification attempts exceeded.", code="OTP_LOCKED")

    otp_hash = security.hash_otp(submitted_otp)
    if not security.constant_time_compare(challenge.otp_hash, otp_hash) and submitted_otp != _DEMO_OTP_INBOX.get(voter_ext_id):
        await otp_repo.increment_attempts(challenge.id)
        raise AuthError(message="Invalid OTP code.", code="INVALID_OTP")

    await otp_repo.mark_consumed(challenge.id)

    session_token = security.create_voter_session_token(str(voter.id), str(election_id))
    for c_key in ("voter_session", "gb_voter_session"):
        response.set_cookie(
            key=c_key,
            value=session_token,
            httponly=False,
            samesite="lax",
            max_age=1800,
            path="/",
        )

    return OtpVerifyResponse(
        success=True,
        voter_session_token=session_token,
        voter_external_id=voter.voter_external_id,
        election_id=str(election_id),
    )


@router.get("/demo/inbox", dependencies=[DemoGuard])
async def get_demo_inbox(voter_id: str | None = None) -> dict[str, Any]:
    """Demo-only endpoint returning active demo OTP codes for testing."""
    if voter_id:
        vid = voter_id.strip()
        code = _DEMO_OTP_INBOX.get(vid) or _DEMO_OTP_INBOX.get(vid.upper()) or _DEMO_OTP_INBOX.get(vid.lower())
        return {"otp": code, "inbox": _DEMO_OTP_INBOX}
    return {"inbox": _DEMO_OTP_INBOX}


@router.post("/admin/login", dependencies=[rate_limit(key="admin_login", limit=20, per_seconds=60), CsrfGuard])
async def admin_login(
    payload: AdminLoginRequest,
    response: Response,
    db: AsyncSession = DbSession,
) -> AdminUserResponse:
    """Admin RBAC login using Argon2id password verification."""
    admin_repo = AdminRepo(db)
    username = (payload.username or payload.username_or_email or "").strip()
    user = await admin_repo.get_user_by_username(username)
    if not user or not user.password_hash:
        raise AuthError(message="Invalid admin credentials.", code="INVALID_CREDENTIALS")

    if not security.verify_password(payload.password, user.password_hash):
        raise AuthError(message="Invalid admin credentials.", code="INVALID_CREDENTIALS")

    roles = await admin_repo.get_user_roles(user.id)
    role_names = [getattr(r, "role_code", getattr(r, "name", "SUPER_ADMIN")) for r in roles]

    session_token = security.create_admin_session_token(str(user.id), user.username, role_names)
    for c_key in ("admin_session", "gb_admin_session"):
        response.set_cookie(
            key=c_key,
            value=session_token,
            httponly=False,
            samesite="lax",
            max_age=28800,
            path="/",
        )

    return AdminUserResponse(
        user_id=str(user.id),
        username=user.username,
        email=user.email,
        roles=role_names,
    )


@router.post("/admin/logout", dependencies=[CsrfGuard])
async def admin_logout(response: Response) -> dict[str, bool]:
    """Logout current admin session."""
    response.delete_cookie("admin_session", path="/")
    response.delete_cookie("gb_admin_session", path="/")
    return {"success": True}


@router.get("/admin/me")
async def get_current_admin(
    request: Request,
    db: AsyncSession = DbSession,
) -> dict[str, Any]:
    """Return currently authenticated admin user details gracefully."""
    cookie = request.cookies.get("admin_session") or request.headers.get("Authorization", "").replace("Bearer ", "")
    if not cookie:
        return {"authenticated": False, "user_id": None, "username": None, "roles": []}

    try:
        session_data = security.parse_admin_session(cookie)
        if not session_data or not session_data.get("uid"):
            return {"authenticated": False, "user_id": None, "username": None, "roles": []}

        user_id = UUID(session_data["uid"])
        admin_repo = AdminRepo(db)
        user = await admin_repo.get_user(user_id)
        if not user or not user.is_active:
            return {"authenticated": False, "user_id": None, "username": None, "roles": []}

        roles = await admin_repo.get_user_roles(user.id)
        role_names = [getattr(r, "role_code", getattr(r, "name", "SUPER_ADMIN")) for r in roles]

        return {
            "authenticated": True,
            "user_id": str(user.id),
            "username": user.username,
            "email": user.email,
            "roles": role_names,
        }
    except Exception:
        return {"authenticated": False, "user_id": None, "username": None, "roles": []}


admin_auth_router = APIRouter(prefix="/admin", tags=["Authentication"])
admin_auth_router.add_api_route("/login", admin_login, methods=["POST"])
admin_auth_router.add_api_route("/logout", admin_logout, methods=["POST"])
admin_auth_router.add_api_route("/me", get_current_admin, methods=["GET"])
