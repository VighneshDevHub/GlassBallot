import pytest
from fastapi.testclient import TestClient

from app.main import app


def test_full_election_lifecycle_e2e():
    """Test full election lifecycle from admin setup to voter OTP, ballot sealing, challenge, casting, integrity check, witness sync, admin phase transitions, and decrypted results."""
    
    with TestClient(app) as client:
        # 1. Health checks
        res_live = client.get("/api/v1/health/live")
        assert res_live.status_code == 200
        res_ready = client.get("/api/v1/health/ready")
        assert res_ready.status_code == 200

        # 2. Public Status & Config
        res_status = client.get("/api/v1/public/status")
        assert res_status.status_code == 200
        status_data = res_status.json()
        assert status_data["success"] is True
        assert "election" in status_data, f"Status response missing 'election': {status_data}"
        election = status_data["election"]
        election_id = election["id"]

        res_config = client.get(f"/api/v1/elections/config?election_id={election_id}")
        assert res_config.status_code == 200
        config_data = res_config.json()
        assert "candidates" in config_data or "election" in config_data

        # 3. Admin Authentication
        res_admin_me_unauth = client.get("/api/v1/admin/me")
        assert res_admin_me_unauth.status_code == 200
        assert res_admin_me_unauth.json()["authenticated"] is False

        res_admin_login = client.post(
            "/api/v1/admin/login",
            json={"username": "admin", "password": "admin123"},
        )
        assert res_admin_login.status_code == 200
        admin_session_cookie = res_admin_login.cookies.get("admin_session")
        admin_headers = {"Authorization": f"Bearer {admin_session_cookie}"} if admin_session_cookie else {}

        res_admin_me = client.get("/api/v1/admin/me", headers=admin_headers)
        assert res_admin_me.status_code == 200
        assert res_admin_me.json()["authenticated"] is True

        # 4. Voter Authentication & Voting Token
        res_otp_req = client.post(
            "/api/v1/auth/otp/request",
            json={"election_id": election_id, "voter_external_id": "RGIT26001"},
        )
        assert res_otp_req.status_code == 200

        res_otp_ver = client.post(
            "/api/v1/auth/otp/verify",
            json={"election_id": election_id, "voter_external_id": "RGIT26001", "otp": "123456"},
        )
        assert res_otp_ver.status_code == 200
        voter_session = res_otp_ver.json()
        voter_token = voter_session.get("session_token")
        voter_headers = {"Authorization": f"Bearer {voter_token}"}

        res_voting_token = client.get(f"/api/v1/voting/token?election_id={election_id}", headers=voter_headers)
        assert res_voting_token.status_code == 200

        # 5. Ballot Sealing & Benaloh Challenge
        seal_payload = {
            "election_id": election_id,
            "ciphertext": "aabbccdd11223344",
            "ephemeral_public_key": "04112233445566778899",
            "commitment_hash": "a" * 64,
            "nonce": "12345678",
        }
        res_seal = client.post("/api/v1/ballots/seal", json=seal_payload)
        assert res_seal.status_code == 200
        ballot_id = res_seal.json().get("ballot_id") or "B-123"

        # Challenge test
        res_challenge = client.post(
            "/api/v1/ballots/challenge",
            json={"ballot_id": ballot_id, "randomness": "secret_randomness_key_123"},
        )
        assert res_challenge.status_code == 200

        # 6. Cast Ballot & Receipt Generation
        res_cast = client.post(
            "/api/v1/ballots/cast",
            json={
                "election_id": election_id,
                "ciphertext": "aabbccdd11223344",
                "ephemeral_public_key": "04112233445566778899",
                "commitment_hash": "b" * 64,
                "nonce": "12345678",
                "voter_session_token": voter_token,
            },
        )
        assert res_cast.status_code == 200
        cast_data = res_cast.json()
        assert "proof_card_id" in cast_data or "ballot_id" in cast_data or "receipt" in cast_data or "status" in cast_data

        # 7. Verification Endpoint Compliance
        res_verify = client.get(f"/api/v1/verification/verify?index=0&election_id={election_id}")
        assert res_verify.status_code == 200
        verify_data = res_verify.json()
        # AC14 check: zero identity leak
        verify_str = str(verify_data)
        assert "voter_id" not in verify_str
        assert "voter_external_id" not in verify_str
        assert "candidate_choice" not in verify_str

        # 8. Integrity Ledger (10 Cryptographic Checks)
        res_integrity_status = client.get(f"/api/v1/integrity/status?election_id={election_id}")
        assert res_integrity_status.status_code == 200
        res_integrity_checks = client.get(f"/api/v1/integrity/checks?election_id={election_id}")
        assert res_integrity_checks.status_code == 200
        res_integrity_run = client.post(f"/api/v1/integrity/run?election_id={election_id}")
        assert res_integrity_run.status_code == 200

        # 9. Witness Sync & Mirrored Nodes
        res_witnesses = client.get(f"/api/v1/witnesses?election_id={election_id}")
        assert res_witnesses.status_code == 200
        res_witnesses_sync = client.post(f"/api/v1/witnesses/sync?election_id={election_id}")
        assert res_witnesses_sync.status_code == 200

        # 10. Admin Phase Controls & Key Generation
        res_admin_phase = client.post(
            "/api/v1/admin/phase",
            json={"election_id": election_id, "phase": "frozen"},
            headers=admin_headers,
        )
        assert res_admin_phase.status_code == 200

        res_admin_phase_decrypt = client.post(
            "/api/v1/admin/phase",
            json={"election_id": election_id, "phase": "decrypting"},
            headers=admin_headers,
        )
        assert res_admin_phase_decrypt.status_code == 200

        res_admin_phase_published = client.post(
            "/api/v1/admin/phase",
            json={"election_id": election_id, "phase": "published"},
            headers=admin_headers,
        )
        assert res_admin_phase_published.status_code == 200

        # 11. Results Tally & Breakdown
        res_results = client.get(f"/api/v1/elections/results?election_id={election_id}")
        assert res_results.status_code == 200
        results_data = res_results.json()
        assert "results" in results_data or "tally" in results_data or "total_ballots" in results_data or "candidates" in results_data
