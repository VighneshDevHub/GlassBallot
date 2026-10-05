from __future__ import annotations

from typing import Any
from uuid import UUID
from app.schemas.common import GBBaseModel


class TokenRequest(GBBaseModel):
    election_id: UUID | str | None = None


class TokenResponse(GBBaseModel):
    success: bool = True
    election_id: str
    ballot_token: str
    token: str | None = None
    issued: bool = True


VotingTokenRequest = TokenRequest
VotingTokenResponse = TokenResponse


class BallotPayload(GBBaseModel):
    v: int = 1
    eph: str
    iv: str
    ct: str


class BallotSpoilRequest(GBBaseModel):
    ballot: dict[str, Any] | None = None
    ciphertext_payload: dict[str, Any] | None = None
    eph_d: str | None = None
    ephemeral_priv_b64: str | None = None
    claimed_choice: str = ""
    ballot_id: str | None = None
    randomness: str | None = None
    election_id: UUID | str | None = None
    ballot_token: str | None = None


class BallotSpoilResponse(GBBaseModel):
    success: bool = True
    ok: bool = True
    match: bool = True
    claimed: str = ""
    claimed_choice: str = ""
    revealed: str = ""
    revealed_choice: str = ""
    fingerprint: str = ""
    ballot_fingerprint: str = ""
    message: str = "TEST PASSED"


class BallotCastRequest(GBBaseModel):
    token: str | None = None
    ballot_token: str | None = None
    ballot: dict[str, Any] | None = None
    ciphertext_payload: dict[str, Any] | None = None
    ciphertext: str | None = None
    ephemeral_public_key: str | None = None
    commitment_hash: str | None = None
    nonce: str | None = None
    voter_session_token: str | None = None
    election_id: UUID | str | None = None


class BallotCastResponse(GBBaseModel):
    success: bool = True
    index: int = 0
    ledger_index: int = 0
    entry_hash: str = ""
    sth: dict[str, Any] = {}
    election_id: str = ""
    ballot_fingerprint: str = ""
    proof_card_url: str = ""
    proof_card_id: str = ""
    receipt: dict[str, Any] = {}
