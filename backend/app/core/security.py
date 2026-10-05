from __future__ import annotations

import base64
import hmac
import os
import secrets
import time
from dataclasses import dataclass
from typing import Literal

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from itsdangerous import BadSignature, URLSafeTimedSerializer

from app.core.config import get_settings

_password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
)

CSRF_HEADER = "X-Requested-With"
CSRF_TOKEN = "glassballot"
VOTER_SESSION_COOKIE = "gb_voter_session"
ADMIN_SESSION_COOKIE = "gb_admin_session"


import hashlib


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, TypeError, ValueError):
        return False


def hash_otp(otp_code: str) -> str:
    return hashlib.sha256(otp_code.encode("utf-8")).hexdigest()


def constant_time_equal(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def constant_time_compare(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def create_voter_session_token(voter_id: str, election_id: str) -> str:
    cookie_opts = make_voter_session(voter_id, election_id)
    return cookie_opts.value


def create_admin_session_token(user_id: str, username: str, roles: list[str]) -> str:
    cookie_opts = make_admin_session(user_id, roles)
    return cookie_opts.value


def b64e(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def b64d(s: str) -> bytes:
    return base64.b64decode(s, validate=True)


def random_token(n: int = 32) -> str:
    return secrets.token_urlsafe(n)


@dataclass
class CookieOpts:
    key: str
    value: str
    max_age: int
    httponly: bool = True
    secure: bool = False
    samesite: Literal["lax", "strict", "none"] = "lax"
    path: str = "/"


def _serializer(salt: str) -> URLSafeTimedSerializer:
    settings = get_settings()
    return URLSafeTimedSerializer(settings.session_secret, salt=salt)


def make_voter_session(voter_external_id: str, election_id: str) -> CookieOpts:
    settings = get_settings()
    payload = _serializer("voter").dumps({"vid": voter_external_id, "voter_id": voter_external_id, "eid": election_id, "election_id": election_id})
    return CookieOpts(
        key=VOTER_SESSION_COOKIE,
        value=payload,
        max_age=30 * 60,
        httponly=True,
        secure=settings.app_env == "production",
        samesite="lax",
    )


def parse_voter_session(cookie_value: str, max_age: int = 30 * 60) -> dict | None:
    try:
        data = _serializer("voter").loads(cookie_value, max_age=max_age)
        if isinstance(data, dict):
            v_id = data.get("voter_id") or data.get("vid") or ""
            e_id = data.get("election_id") or data.get("eid") or ""
            data["voter_id"] = str(v_id)
            data["vid"] = str(v_id)
            data["election_id"] = str(e_id)
            data["eid"] = str(e_id)
            return data
        return None
    except (BadSignature, Exception):
        return None


def clear_voter_session() -> CookieOpts:
    return CookieOpts(key=VOTER_SESSION_COOKIE, value="", max_age=0)


def make_admin_session(user_id: str, roles: list[str]) -> CookieOpts:
    settings = get_settings()
    payload = _serializer("admin").dumps({"uid": user_id, "roles": roles, "ts": int(time.time())})
    return CookieOpts(
        key=ADMIN_SESSION_COOKIE,
        value=payload,
        max_age=8 * 60 * 60,
        httponly=True,
        secure=settings.app_env == "production",
        samesite="strict",
    )


def parse_admin_session(cookie_value: str) -> dict | None:
    try:
        return _serializer("admin").loads(cookie_value, max_age=8 * 60 * 60)
    except (BadSignature, Exception):
        return None


def clear_admin_session() -> CookieOpts:
    return CookieOpts(key=ADMIN_SESSION_COOKIE, value="", max_age=0)


def validate_csrf_header(header_value: str | None) -> bool:
    if not header_value:
        return False
    return hmac.compare_digest(header_value.strip().lower(), CSRF_TOKEN.lower())


def generate_sth_key_bytes() -> tuple[bytes, bytes]:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ed25519

    private_key = ed25519.Ed25519PrivateKey.generate()
    private_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_bytes = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return private_bytes, public_bytes


def load_or_create_sth_key(key_path: str) -> tuple[bytes, bytes]:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ed25519

    if os.path.exists(key_path):
        with open(key_path, "rb") as f:
            pem = f.read()
        private_key = serialization.load_pem_private_key(pem, password=None)
        if not isinstance(private_key, ed25519.Ed25519PrivateKey):
            raise ValueError("STH key file does not hold an Ed25519 key")
        public_bytes = private_key.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        return pem, public_bytes

    private_bytes, public_bytes = generate_sth_key_bytes()
    directory = os.path.dirname(key_path)
    if directory:
        os.makedirs(directory, exist_ok=True)
    fd = os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(private_bytes)
    return private_bytes, public_bytes
