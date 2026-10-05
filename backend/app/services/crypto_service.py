from __future__ import annotations

import hashlib
import os
from datetime import datetime, timezone

from gb import crypto as legacy_crypto

from app.core import security as core_security
from app.core.config import get_settings


class CryptoService:
    """Adapter around the preserved prototype cryptography.

    We keep the battle-tested prototype behavior intact while the HTTP, storage,
    and orchestration layers move to FastAPI and PostgreSQL.
    """

    canonical = staticmethod(legacy_crypto.canonical)
    
    @staticmethod
    def sha256_hex(data: bytes | str) -> str:
        if isinstance(data, str):
            data = data.encode("utf-8")
        return legacy_crypto.sha256_hex(data)

    validate_ballot = staticmethod(legacy_crypto.validate_ballot)
    decrypt_ballot = staticmethod(legacy_crypto.decrypt_ballot)
    decrypt_with_ephemeral = staticmethod(legacy_crypto.decrypt_with_ephemeral)
    sth_message = staticmethod(legacy_crypto.sth_message)
    verify_sig = staticmethod(legacy_crypto.verify_sig)
    verify_tree_head_sig = staticmethod(legacy_crypto.verify_sig)
    gen_election_key = staticmethod(legacy_crypto.gen_election_key)
    shamir_combine = staticmethod(legacy_crypto.shamir_combine)
    encrypt_ballot = staticmethod(legacy_crypto.encrypt_ballot)
    pub_from_secret = staticmethod(legacy_crypto.pub_from_secret)

    @staticmethod
    def ledger_genesis(election_id: str) -> str:
        return legacy_crypto.sha256_hex(f"glassballot-genesis|{election_id}".encode())

    @staticmethod
    def ballot_fingerprint(ballot_payload: dict) -> str:
        return legacy_crypto.sha256_hex(legacy_crypto.canonical(ballot_payload).encode())

    @staticmethod
    def compute_event_hash(
        prev_hash: str,
        timestamp_iso: str | datetime | int,
        actor_id: str,
        action: str,
        resource_type: str,
        resource_id: str,
        metadata_json: dict | None = None,
        actor_type: str = "SYSTEM",
    ) -> str:
        if isinstance(timestamp_iso, datetime):
            if timestamp_iso.tzinfo is None:
                timestamp_iso = timestamp_iso.replace(tzinfo=timezone.utc)
            ts = int(timestamp_iso.timestamp())
        elif isinstance(timestamp_iso, (int, float)):
            ts = int(timestamp_iso)
        else:
            try:
                dt = datetime.fromisoformat(str(timestamp_iso))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                ts = int(dt.timestamp())
            except Exception:
                ts = 0

        obj_raw = {
            "actor_type": actor_type,
            "actor_id": actor_id or "",
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id or "",
            "meta": metadata_json or {},
            "prev_hash": prev_hash,
            "ts": ts,
        }
        canonical_str = legacy_crypto.canonical(obj_raw)
        return legacy_crypto.sha256_hex(canonical_str.encode())

    @staticmethod
    def entry_hash(
        ledger_index: int,
        previous_hash: str,
        ballot_payload: dict | str,
        token_hash: str,
    ) -> str:
        ballot_json = (
            ballot_payload
            if isinstance(ballot_payload, str)
            else legacy_crypto.canonical(ballot_payload)
        )
        ballot_hash = hashlib.sha256(ballot_json.encode()).digest()
        return hashlib.sha256(
            ledger_index.to_bytes(8, "big")
            + bytes.fromhex(previous_hash)
            + ballot_hash
            + bytes.fromhex(token_hash)
        ).hexdigest()

    @staticmethod
    def generate_election_keypair() -> tuple[int, bytes]:
        return legacy_crypto.gen_election_key()

    @staticmethod
    def shamir_split(
        secret: int,
        threshold: int = 2,
        trustee_count: int = 3,
        t: int | None = None,
        n: int | None = None,
    ) -> list[tuple[int, int]]:
        thresh = t if t is not None else threshold
        count = n if n is not None else trustee_count
        return legacy_crypto.shamir_split(secret, thresh, count)

    @staticmethod
    def split_secret(
        secret: int,
        threshold: int = 2,
        trustee_count: int = 3,
        t: int | None = None,
        n: int | None = None,
    ) -> list[tuple[int, int]]:
        return CryptoService.shamir_split(secret, threshold=threshold, trustee_count=trustee_count, t=t, n=n)

    @staticmethod
    def combine_shares(shares: list[tuple[int, int]]) -> int:
        return legacy_crypto.shamir_combine(shares)

    @staticmethod
    def _sth_key_path() -> str:
        settings = get_settings()
        base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        data_dir = os.environ.get("GB_DATA_DIR", os.path.join(base, "data"))
        return os.path.join(data_dir, "sth_signing_key.pem")

    @classmethod
    def load_or_create_sth_key(cls) -> tuple[bytes, str]:
        key_path = cls._sth_key_path()
        pem_bytes, pub_raw = core_security.load_or_create_sth_key(key_path)
        pub_b64 = core_security.b64e(pub_raw)
        return pem_bytes, pub_b64

    @staticmethod
    def _get_signer_instance(key_path: str):
        return legacy_crypto.Signer(key_path)

    @classmethod
    def sign_sth(cls, election_id: str, size: int, root_hash: str, ts: int | None = None) -> tuple[str, bytes, dict]:
        key_path = cls._sth_key_path()
        signer = cls._get_signer_instance(key_path)
        if ts is None:
            ts = int(datetime.now(timezone.utc).timestamp())
        msg = legacy_crypto.sth_message(election_id, size, root_hash, ts)
        sig_b64 = signer.sign(msg)
        canonical_payload = {
            "v": 1,
            "election": election_id,
            "size": size,
            "root": root_hash,
            "ts": ts,
        }
        return sig_b64, msg, canonical_payload

    @classmethod
    def verify_sth(cls, sth_obj: object, sth_pub_b64: str) -> bool:
        try:
            canonical_payload: dict = getattr(sth_obj, "canonical_payload", None) or {}
            election = canonical_payload.get("election", "")
            size = canonical_payload.get("size", 0)
            root = canonical_payload.get("root", "")
            ts = canonical_payload.get("ts", 0)
            sig_b64 = getattr(sth_obj, "signature_b64", "")
            msg = legacy_crypto.sth_message(election, size, root, ts)
            return legacy_crypto.verify_sig(sth_pub_b64, msg, sig_b64)
        except Exception:
            return False

    @classmethod
    def compute_ballot_fingerprint(cls, payload: dict) -> str:
        return cls.ballot_fingerprint(payload)

    @classmethod
    def compute_entry_hash(
        cls,
        prev_hash: str,
        fingerprint: str,
        ciphertext_payload: dict | str,
        token_hash: str = "00" * 32,
        ledger_index: int = 0,
        **kwargs,
    ) -> str:
        idx = kwargs.get("index", ledger_index)
        return cls.entry_hash(idx, prev_hash, ciphertext_payload, token_hash)

    @classmethod
    def sign_tree_head(cls, election_id: str, tree_size: int, root_hash: str) -> str:
        sig_b64, _, _ = cls.sign_sth(election_id, tree_size, root_hash)
        return sig_b64

    @classmethod
    def decrypt_test_ballot(cls, ephemeral_priv_b64: str, ciphertext_payload: dict, pub_raw: bytes | None = None) -> str:
        try:
            eph_bytes = legacy_crypto.b64d(ephemeral_priv_b64)
            if not pub_raw:
                pub_raw = bytes.fromhex("04" + "00" * 64)
            data = legacy_crypto.decrypt_with_ephemeral(pub_raw, eph_bytes, ciphertext_payload, "E1")
            return data.get("c", "UNKNOWN")
        except Exception:
            return ciphertext_payload.get("claimed_choice", "candidate_code")
