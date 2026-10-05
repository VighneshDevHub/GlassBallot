"""Cryptography for GlassBallot.

Ballots: ECIES-style. The browser (WebCrypto) encrypts to the election P-256
public key: ephemeral ECDH -> SHA-256 key derivation -> AES-256-GCM, with the
election id as associated data. The election private key is never stored: it is
split 2-of-3 (Shamir) among trustees and only reassembled in memory at tally.
"""
import base64
import hashlib
import json
import os
import secrets

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, ed25519
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

PRIME = 2 ** 521 - 1      # Mersenne prime, larger than any P-256 scalar
PAD = 96                  # plaintext is padded so ciphertext length never leaks the choice
CT_LEN = PAD + 16
DOMAIN = b"glassballot-v1"
CURVE = ec.SECP256R1()
_X962 = (serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)


def b64e(b: bytes) -> str:
    return base64.b64encode(b).decode()


def b64d(s: str) -> bytes:
    return base64.b64decode(s, validate=True)


def b64u_d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def canonical(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


def sha256_hex(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


# ---------- Shamir secret sharing ----------
def shamir_split(secret: int, t: int, n: int):
    coeffs = [secret] + [secrets.randbelow(PRIME) for _ in range(t - 1)]

    def f(x):
        return sum(c * pow(x, i, PRIME) for i, c in enumerate(coeffs)) % PRIME

    return [(x, f(x)) for x in range(1, n + 1)]


def shamir_combine(shares) -> int:
    total = 0
    for i, (xi, yi) in enumerate(shares):
        num = den = 1
        for j, (xj, _) in enumerate(shares):
            if i != j:
                num = num * (-xj) % PRIME
                den = den * (xi - xj) % PRIME
        total = (total + yi * num * pow(den, -1, PRIME)) % PRIME
    return total


# ---------- election key ----------
def gen_election_key():
    priv = ec.generate_private_key(CURVE)
    return priv.private_numbers().private_value, priv.public_key().public_bytes(*_X962)


def pub_from_secret(secret: int) -> bytes:
    return ec.derive_private_key(secret, CURVE).public_key().public_bytes(*_X962)


def _aes_key(shared: bytes, eph_pub: bytes) -> bytes:
    return hashlib.sha256(DOMAIN + shared + eph_pub).digest()


def _pt(choice: str) -> bytes:
    return json.dumps({"c": choice, "n": secrets.token_hex(8)}, separators=(",", ":")).encode().ljust(PAD, b" ")


def encrypt_ballot(pub_raw: bytes, election_id: str, choice: str):
    """Server-side twin of the browser encryptor (seeding and tests only).
    Returns (ballot, ephemeral_private_scalar_bytes)."""
    peer = ec.EllipticCurvePublicKey.from_encoded_point(CURVE, pub_raw)
    eph = ec.generate_private_key(CURVE)
    eph_pub = eph.public_key().public_bytes(*_X962)
    key = _aes_key(eph.exchange(ec.ECDH(), peer), eph_pub)
    iv = os.urandom(12)
    ct = AESGCM(key).encrypt(iv, _pt(choice), election_id.encode())
    ballot = {"v": 1, "eph": b64e(eph_pub), "iv": b64e(iv), "ct": b64e(ct)}
    return ballot, eph.private_numbers().private_value.to_bytes(32, "big")


def validate_ballot(b) -> bool:
    """Strict structural validation before anything touches the ledger."""
    try:
        if not isinstance(b, dict) or set(b) != {"v", "eph", "iv", "ct"} or b["v"] != 1:
            return False
        eph, iv, ct = b64d(b["eph"]), b64d(b["iv"]), b64d(b["ct"])
        if len(eph) != 65 or eph[0] != 4 or len(iv) != 12 or len(ct) != CT_LEN:
            return False
        ec.EllipticCurvePublicKey.from_encoded_point(CURVE, eph)   # must be a real curve point
        return True
    except Exception:
        return False


def _open(shared: bytes, ballot, election_id: str) -> dict:
    eph = b64d(ballot["eph"])
    pt = AESGCM(_aes_key(shared, eph)).decrypt(b64d(ballot["iv"]), b64d(ballot["ct"]), election_id.encode())
    return json.loads(pt.decode().strip())


def decrypt_ballot(secret: int, ballot, election_id: str) -> dict:
    priv = ec.derive_private_key(secret, CURVE)
    peer = ec.EllipticCurvePublicKey.from_encoded_point(CURVE, b64d(ballot["eph"]))
    return _open(priv.exchange(ec.ECDH(), peer), ballot, election_id)


def decrypt_with_ephemeral(pub_raw: bytes, eph_d: bytes, ballot, election_id: str) -> dict:
    """Test-ballot verifier: the voter reveals the ephemeral private key of a ballot they spoil."""
    eph = ec.derive_private_key(int.from_bytes(eph_d, "big"), CURVE)
    peer = ec.EllipticCurvePublicKey.from_encoded_point(CURVE, pub_raw)
    return _open(eph.exchange(ec.ECDH(), peer), ballot, election_id)


# ---------- signed tree heads (Ed25519) ----------
class Signer:
    def __init__(self, path: str):
        if os.path.exists(path):
            with open(path, "rb") as f:
                self.key = serialization.load_pem_private_key(f.read(), None)
        else:
            self.key = ed25519.Ed25519PrivateKey.generate()
            pem = self.key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                         serialization.NoEncryption())
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "wb") as f:
                f.write(pem)
        self.pub_b64 = b64e(self.key.public_key().public_bytes(serialization.Encoding.Raw,
                                                               serialization.PublicFormat.Raw))

    def sign(self, msg: bytes) -> str:
        return b64e(self.key.sign(msg))


def verify_sig(pub_b64: str, msg: bytes, sig_b64: str) -> bool:
    try:
        ed25519.Ed25519PublicKey.from_public_bytes(b64d(pub_b64)).verify(b64d(sig_b64), msg)
        return True
    except (InvalidSignature, ValueError):
        return False


def sth_message(election: str, size: int, root: str, ts: int) -> bytes:
    return canonical({"v": 1, "election": election, "size": size, "root": root, "ts": ts}).encode()
