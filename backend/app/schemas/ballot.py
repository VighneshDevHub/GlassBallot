from __future__ import annotations

from typing import Any
from uuid import UUID
from app.schemas.common import GBBaseModel


class TestBallotRequest(GBBaseModel):
    election_id: UUID | str | None = None
    ballot_token: str | None = None
    ephemeral_priv_b64: str | None = None
    eph_d: str | None = None
    claimed_choice: str = ""
    ciphertext_payload: dict[str, Any] | None = None
    ballot: dict[str, Any] | None = None


class TestBallotResponse(GBBaseModel):
    success: bool = True
    match: bool = True
    ok: bool = True
    claimed_choice: str = ""
    revealed_choice: str = ""
    ballot_fingerprint: str = ""
    fingerprint: str = ""
    message: str = "TEST PASSED"


class CastBallotRequest(GBBaseModel):
    election_id: UUID | str | None = None
    ballot_token: str | None = None
    token: str | None = None
    ciphertext_payload: dict[str, Any] | None = None
    ballot: dict[str, Any] | None = None
    ciphertext: str | None = None
    ephemeral_public_key: str | None = None
    commitment_hash: str | None = None
    nonce: str | None = None
    voter_session_token: str | None = None


class CastBallotResponse(GBBaseModel):
    success: bool = True
    election_id: str = ""
    ledger_index: int = 0
    index: int = 0
    ballot_fingerprint: str = ""
    entry_hash: str = ""
    tree_size: int = 0
    merkle_root: str = ""
    sth_signature: str = ""
    proof_card_url: str = ""
    proof_card_id: str | None = None
    receipt: dict[str, Any] | None = None
