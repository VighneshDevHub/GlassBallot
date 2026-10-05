from __future__ import annotations

import time
from collections.abc import AsyncIterator, Callable
from typing import Any

from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.exceptions import (
    AuthError,
    CsrfError,
    DemoDisabledError,
    ForbiddenError,
    RateLimitError,
)

try:
    import redis.asyncio as redis_lib  # type: ignore
except Exception:  # noqa: BLE001
    redis_lib = None  # type: ignore


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


DbSession: Any = Depends(get_db_session)


def _get_request_id(request: Request) -> str:
    rid = getattr(request.state, "request_id", None)
    return rid or ""


def require_csrf(x_requested_with: str | None = Header(default=None)) -> None:
    if not security.validate_csrf_header(x_requested_with):
        raise CsrfError()


CsrfGuard: Any = Depends(require_csrf)


def require_demo_mode() -> None:
    settings = get_settings()
    if not settings.demo_mode:
        raise DemoDisabledError()


DemoGuard: Any = Depends(require_demo_mode)


def _rate_limit_key_prefix() -> str:
    return "gb:rl"


class _RedisRateLimiter:
    """In-memory fallback rate limiter when Redis is unavailable."""

    def __init__(self) -> None:
        self._memory: dict[str, list[float]] = {}
        self._client: Any = None
        self._init_attempted = False

    async def _get_client(self) -> Any:
        if self._init_attempted:
            return self._client
        self._init_attempted = True
        if redis_lib is None:
            return None
        try:
            settings = get_settings()
            client = redis_lib.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
            await client.ping()
            self._client = client
        except Exception:  # noqa: BLE001
            self._client = None
        return self._client

    async def check(self, key: str, limit: int, per_seconds: int) -> None:
        full_key = f"{_rate_limit_key_prefix()}:{key}"
        client = await self._get_client()
        now = time.time()
        if client is not None:
            try:
                pipe = client.pipeline()
                await pipe.zremrangebyscore(full_key, 0, now - per_seconds)
                await pipe.zadd(full_key, {str(now): now})
                await pipe.expire(full_key, per_seconds + 1)
                await pipe.zcard(full_key)
                results = await pipe.execute()
                count = int(results[-1]) if results else 0
                if count > limit:
                    raise RateLimitError()
                return
            except Exception:  # noqa: BLE001
                pass
        self._memory.setdefault(full_key, [])
        bucket = [t for t in self._memory[full_key] if now - t < per_seconds]
        if len(bucket) >= limit:
            raise RateLimitError()
        bucket.append(now)
        self._memory[full_key] = bucket


_limiter = _RedisRateLimiter()


def rate_limit(key: str | Callable[..., str], limit: int, per_seconds: int = 60) -> Any:
    async def _dep(request: Request) -> None:
        key_str = key(request) if callable(key) else f"{key}:{_remote_addr(request)}"
        await _limiter.check(key_str, limit, per_seconds)

    return Depends(_dep)


def _remote_addr(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rl_per_ip(suffix: str, limit: int, per: int) -> Any:
    return rate_limit(lambda r: f"ip:{suffix}:{_remote_addr(r)}", limit, per)


def rl_voter_id(limit: int, per: int) -> Any:
    async def _dep(request: Request) -> None:
        try:
            body = await request.json()
        except Exception:  # noqa: BLE001
            body = {}
        vid = str(body.get("voter_id", "")).upper()[:20] or "none"
        await _limiter.check(f"voterid:otp:{vid}", limit, per)

    return Depends(_dep)


def get_voter_session(
    request: Request,
) -> dict:
    settings = get_settings()
    cookie = (
        request.cookies.get(security.VOTER_SESSION_COOKIE)
        or request.cookies.get("voter_session")
        or request.cookies.get("gb_voter_session")
        or request.headers.get("Authorization", "").replace("Bearer ", "")
        or request.headers.get("X-Voter-Token", "")
    )
    if cookie:
        parsed = security.parse_voter_session(cookie)
        if parsed:
            return parsed

    if settings.demo_mode:
        return {"voter_id": "demo", "vid": "demo", "election_id": "demo", "eid": "demo"}

    raise AuthError("Sign in with your ID and one-time code first.")


VoterSession: Any = Depends(get_voter_session)
get_current_voter_session = get_voter_session


def get_admin_session_optional(request: Request) -> dict | None:
    cookie = (
        request.cookies.get(security.ADMIN_SESSION_COOKIE)
        or request.cookies.get("admin_session")
        or request.cookies.get("gb_admin_session")
        or request.headers.get("Authorization", "").replace("Bearer ", "")
        or request.headers.get("X-Admin-Token", "")
    )
    if not cookie:
        return None
    parsed = security.parse_admin_session(cookie)
    return parsed


def require_admin_session(request: Request) -> dict:
    parsed = get_admin_session_optional(request)
    if not parsed:
        raise AuthError("Admin sign-in required.")
    return parsed


AdminSession: Any = Depends(require_admin_session)


async def get_current_user(
    request: Request,
    db: AsyncSession = DbSession,
) -> tuple[Any, list[str]]:
    session = require_admin_session(request)
    from uuid import UUID
    from app.repositories.admin_repo import AdminRepo
    # The session payload uses "uid" (set by make_admin_session), not "user_id"
    raw_uid = session.get("uid") or session.get("user_id") or session.get("id")
    if not raw_uid:
        raise AuthError("Admin session missing user identifier.")
    user_id = UUID(str(raw_uid))
    admin_repo = AdminRepo(db)
    user = await admin_repo.get_user(user_id)
    if not user:
        raise AuthError("Admin user not found.")
    roles = session.get("roles") or []
    return user, roles


def require_roles(*allowed_roles: str) -> Any:
    def _check(session: dict = AdminSession) -> dict:
        roles = session.get("roles") or []
        if "SUPER_ADMIN" in roles:
            return session
        if any(role in roles for role in allowed_roles):
            return session
        raise ForbiddenError()

    return Depends(_check)

