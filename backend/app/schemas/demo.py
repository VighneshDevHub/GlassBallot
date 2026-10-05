from __future__ import annotations

from app.schemas.common import GBBaseModel


class DemoSeedRequest(GBBaseModel):
    n: int = 10


class DemoSeedResponse(GBBaseModel):
    added: int


class DemoAttackRequest(GBBaseModel):
    kind: str


class DemoAttackResponse(GBBaseModel):
    kind: str
    affected_index: int | None = None
    note: str
    before_integrity: str | None = None
    after_integrity: str | None = None


class DemoDeviceRequest(GBBaseModel):
    on: bool


class DemoDeviceResponse(GBBaseModel):
    compromised_device: bool


class DemoResetResponse(GBBaseModel):
    ok: bool
    message: str = "Demo state reset."
