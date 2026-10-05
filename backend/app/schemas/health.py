from pydantic import BaseModel


class HealthCheckResult(BaseModel):
    status: str
    details: dict[str, str]


class LivenessResponse(BaseModel):
    status: str = "ok"


class ReadinessResponse(BaseModel):
    status: str
    checks: dict[str, HealthCheckResult]
