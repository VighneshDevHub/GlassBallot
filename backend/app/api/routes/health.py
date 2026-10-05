from sqlalchemy import text

from fastapi import APIRouter

from app.core.config import get_settings
from app.core.database import engine
from app.schemas.health import HealthCheckResult, LivenessResponse, ReadinessResponse

router = APIRouter(tags=["health"])


@router.get("/health/live", response_model=LivenessResponse)
async def live() -> LivenessResponse:
    return LivenessResponse()


@router.get("/health/ready", response_model=ReadinessResponse)
async def ready() -> ReadinessResponse:
    settings = get_settings()
    checks: dict[str, HealthCheckResult] = {}

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["postgres"] = HealthCheckResult(status="ok", details={"url": settings.database_url})
    except Exception as exc:  # noqa: BLE001
        checks["postgres"] = HealthCheckResult(status="error", details={"message": str(exc)})

    try:
        import redis.asyncio as redis

        client = redis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
        await client.ping()
        await client.aclose()
        checks["redis"] = HealthCheckResult(status="ok", details={"url": settings.redis_url})
    except Exception as exc:  # noqa: BLE001
        checks["redis"] = HealthCheckResult(status="error", details={"message": str(exc)})

    status = "ok" if all(item.status == "ok" for item in checks.values()) else "degraded"
    return ReadinessResponse(status=status, checks=checks)
