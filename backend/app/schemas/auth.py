from __future__ import annotations

from uuid import UUID
from pydantic import BaseModel, Field

from app.schemas.common import GBBaseModel


class OtpRequest(GBBaseModel):
    election_id: UUID | None = None
    voter_external_id: str | None = None
    voter_id: str | None = None


class OtpResponse(GBBaseModel):
    success: bool = True
    message: str = "If this ID is eligible, a one-time code has been sent."


class OtpVerifyRequest(GBBaseModel):
    election_id: UUID | None = None
    voter_external_id: str | None = None
    voter_id: str | None = None
    otp_code: str | None = None
    otp: str | None = None


class OtpVerifyResponse(GBBaseModel):
    success: bool = True
    voter_session_token: str
    voter_external_id: str
    election_id: str


class DemoInboxResponse(GBBaseModel):
    inbox: dict[str, str] = Field(default_factory=dict)


class AdminLoginRequest(GBBaseModel):
    username: str | None = Field(None, min_length=1, max_length=255)
    username_or_email: str | None = Field(None, min_length=1, max_length=255)
    password: str = Field(..., min_length=1, max_length=512)


class AdminUserResponse(GBBaseModel):
    user_id: str
    username: str
    email: str | None = None
    roles: list[str] = Field(default_factory=list)


class AdminLogoutResponse(GBBaseModel):
    success: bool = True


AdminMeResponse = AdminUserResponse
AdminLoginResponse = AdminUserResponse
