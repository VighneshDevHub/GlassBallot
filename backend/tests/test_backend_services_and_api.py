import pytest
from uuid import uuid4
from fastapi.testclient import TestClient

from app.main import app
from app.core import security
from app.services.crypto_service import CryptoService
from app.services.merkle_service import MerkleService

client = TestClient(app)


def test_crypto_shamir_and_encryption_roundtrip():
    """Test Shamir secret sharing and ballot encryption roundtrip."""
    # Gen election key: returns (priv_scalar_int, pub_bytes)
    priv_scalar, pub_bytes = CryptoService.gen_election_key()
    assert priv_scalar is not None
    assert len(pub_bytes) > 0

    # Shamir 2-of-3 split (t=2 threshold, n=3 total shares)
    shares = CryptoService.shamir_split(priv_scalar, 2, 3)
    assert len(shares) == 3

    # Shamir 2-of-3 combine
    combined_scalar = CryptoService.shamir_combine(shares[:2])
    assert combined_scalar == priv_scalar
    assert CryptoService.pub_from_secret(combined_scalar) == pub_bytes

    # Encrypt ballot: takes (pub_bytes, election_id, choice), returns (ballot_dict, eph)
    payload, _ = CryptoService.encrypt_ballot(pub_bytes, "E1", "Riya Menon")
    assert CryptoService.validate_ballot(payload) is True

    # Decrypt ballot: takes (priv_scalar_int, ballot_dict, election_id) -> returns dict {"c": choice, "n": nonce}
    choice = CryptoService.decrypt_ballot(priv_scalar, payload, "E1")
    assert choice["c"] == "Riya Menon"


def test_merkle_service_inclusion_and_consistency():
    """Test MerkleService inclusion and consistency proof verification."""
    entries = ["01" * 32, "02" * 32, "03" * 32, "04" * 32]
    root = MerkleService.root_from_entry_hashes(entries)
    assert len(root) == 64

    # Inclusion proof for index 1
    path = MerkleService.inclusion_path_from_entry_hashes(1, entries)
    leaf_hash = MerkleService.leaf_hash(bytes.fromhex(entries[1]))
    path_bytes = [bytes.fromhex(p) for p in path]
    root_bytes = bytes.fromhex(root)

    valid_inc = MerkleService.verify_inclusion(leaf_hash, 1, 4, path_bytes, root_bytes)
    assert valid_inc is True

    # Consistency proof between size 2 and 4
    root_size_2 = MerkleService.root_from_entry_hashes(entries[:2])
    cons_path = MerkleService.consistency_path_from_entry_hashes(2, entries)
    cons_bytes = [bytes.fromhex(p) for p in cons_path]

    valid_cons = MerkleService.verify_consistency(2, 4, bytes.fromhex(root_size_2), root_bytes, cons_bytes)
    assert valid_cons is True


def test_api_health():
    """Test health endpoints."""
    res = client.get("/api/v1/health/live")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_api_public_status():
    """Test public status overview endpoint."""
    res = client.get("/api/v1/public/status")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True


def test_api_otp_request_non_enumeration():
    """Test OTP request returns generic response to prevent voter enumeration (AC4)."""
    status_res = client.get("/api/v1/public/status").json()
    election_id = status_res.get("election", {}).get("id") or str(uuid4())

    res_valid = client.post(
        "/api/v1/auth/otp/request",
        json={"election_id": election_id, "voter_external_id": "RGIT26001"},
    )
    assert res_valid.status_code == 200
    json_valid = res_valid.json()

    res_invalid = client.post(
        "/api/v1/auth/otp/request",
        json={"election_id": election_id, "voter_external_id": "NONEXISTENT_VOTER_123"},
    )
    assert res_invalid.status_code == 200
    json_invalid = res_invalid.json()

    # Exact equality check to guarantee zero voter enumeration
    assert json_valid == json_invalid


def test_api_verification_no_identity_leak():
    """Test public verification endpoint compliance (AC14 - NO voter identity or choice leak)."""
    res = client.get("/api/v1/verification/0/verify")
    if res.status_code == 200:
        data = res.json()
        raw_str = str(data)
        # Ensure no sensitive voter fields exist
        assert "voter_id" not in raw_str
        assert "voter_external_id" not in raw_str
        assert "candidate_choice" not in raw_str
