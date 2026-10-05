import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app  # noqa: E402
from gb import crypto as C  # noqa: E402

H = {"X-Requested-With": "glassballot"}


class E2E(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.app = create_app(self.tmp.name, demo=True)
        self.c = self.app.test_client()
        self.s = self.app.store
        self.pub = C.b64d(self.s.meta("election_pub"))
        self.eid = self.s.eid

    def tearDown(self):
        self.tmp.cleanup()

    def post(self, path, data=None, headers=None):
        return self.c.post(path, json=data or {}, headers={**H, **(headers or {})})

    def login(self, vid):
        self.post("/api/otp/request", {"voter_id": vid})
        otp = self.c.get(f"/api/demo/inbox?voter_id={vid}").json["otp"]
        self.assertEqual(self.post("/api/otp/verify", {"voter_id": vid, "otp": otp}).status_code, 200)
        return self.post("/api/token").json["token"]

    def vote(self, vid, choice):
        tok = self.login(vid)
        ballot, _ = C.encrypt_ballot(self.pub, self.eid, choice)
        r = self.post("/api/ballot/cast", {"token": tok, "ballot": ballot})
        self.assertEqual(r.status_code, 200, r.json)
        return r.json

    def admin(self):
        self.assertEqual(self.post("/api/admin/login", {"password": "glassballot-demo"}).status_code, 200)

    def test_csrf_header_required(self):
        self.assertEqual(self.c.post("/api/otp/request", json={"voter_id": "RGIT26001"}).status_code, 403)

    def test_full_flow_and_one_vote_per_voter(self):
        r = self.vote("RGIT26001", "riya")
        self.assertEqual(r["index"], 0)
        self.post("/api/otp/request", {"voter_id": "RGIT26001"})
        otp = self.c.get("/api/demo/inbox?voter_id=RGIT26001").json["otp"]
        self.post("/api/otp/verify", {"voter_id": "RGIT26001", "otp": otp})
        self.assertEqual(self.post("/api/token").status_code, 409)           # second token refused
        self.assertTrue(self.c.get("/api/reconcile").json["ok"])
        self.assertTrue(self.c.get("/api/integrity").json["ok"])

    def test_token_cannot_be_reused_and_bad_ballot_rejected(self):
        tok = self.login("RGIT26002")
        ballot, _ = C.encrypt_ballot(self.pub, self.eid, "kabir")
        self.assertEqual(self.post("/api/ballot/cast", {"token": tok, "ballot": {"v": 1}}).status_code, 422)
        self.assertEqual(self.post("/api/ballot/cast", {"token": tok, "ballot": ballot}).status_code, 200)
        self.assertEqual(self.post("/api/ballot/cast", {"token": tok, "ballot": ballot}).status_code, 403)
        self.assertEqual(self.post("/api/ballot/cast", {"token": "forged", "ballot": ballot}).status_code, 403)

    def test_wrong_otp_lockout_and_no_enumeration(self):
        self.post("/api/otp/request", {"voter_id": "RGIT26003"})
        for _ in range(5):
            self.post("/api/otp/verify", {"voter_id": "RGIT26003", "otp": "000000"})
        otp = self.c.get("/api/demo/inbox?voter_id=RGIT26003").json["otp"]
        self.assertEqual(self.post("/api/otp/verify", {"voter_id": "RGIT26003", "otp": otp}).status_code, 401)
        a = self.post("/api/otp/request", {"voter_id": "NOPE"}).json
        b = self.post("/api/otp/request", {"voter_id": "RGIT26010"}).json
        self.assertEqual(a, b)

    def test_inclusion_proof(self):
        for i in range(1, 6):
            self.vote(f"RGIT26{i:03d}", "riya")
        from gb import merkle as M
        p = self.c.get("/api/proof/inclusion?index=3").json
        self.assertTrue(M.verify_inclusion(bytes.fromhex(p["leaf_hash"]), 3, p["size"],
                                           [bytes.fromhex(x) for x in p["path"]], bytes.fromhex(p["sth"]["root"])))

    def test_test_ballot_catches_cheating_device(self):
        tok = self.login("RGIT26004")
        good, d = C.encrypt_ballot(self.pub, self.eid, "riya")
        dd = C.b64e(d).replace("+", "-").replace("/", "_").rstrip("=")
        r = self.post("/api/ballot/spoil", {"ballot": good, "eph_d": dd, "claimed": "riya"}, {"X-Ballot-Token": tok})
        self.assertTrue(r.json["ok"])
        cheat, d2 = C.encrypt_ballot(self.pub, self.eid, "kabir")   # device encrypted a different choice
        dd2 = C.b64e(d2).replace("+", "-").replace("/", "_").rstrip("=")
        r = self.post("/api/ballot/spoil", {"ballot": cheat, "eph_d": dd2, "claimed": "riya"}, {"X-Ballot-Token": tok})
        self.assertFalse(r.json["ok"])
        self.assertEqual(r.json["revealed"], "kabir")
        self.admin()
        kinds = [a["kind"] for a in self.c.get("/api/admin/alerts").json["alerts"]]
        self.assertIn("DEVICE_MISMATCH", kinds)
        self.assertEqual(self.post("/api/ballot/spoil", {"ballot": good, "eph_d": dd, "claimed": "riya"}).status_code, 403)

    def test_naive_tamper_is_caught_by_chain(self):
        self.admin()
        self.post("/api/admin/seed", {"n": 8})
        self.assertTrue(self.c.get("/api/integrity").json["ok"])
        t = self.post("/api/admin/attack", {"kind": "naive"}).json["target"]
        r = self.c.get("/api/integrity").json
        self.assertFalse(r["ok"])
        self.assertEqual(r["first_bad_index"], t)

    def test_rewrite_passes_server_checks_but_witnesses_raise_alarm(self):
        self.admin()
        self.post("/api/admin/seed", {"n": 8})
        ws = self.c.get("/api/witnesses").json["witnesses"]
        self.assertTrue(all(w["status"] == "ok" for w in ws))
        self.post("/api/admin/attack", {"kind": "rewrite"})
        self.assertTrue(self.c.get("/api/integrity").json["ok"])             # the insider covered their tracks locally
        ws = self.c.get("/api/witnesses/sync", headers=H) if False else self.post("/api/witnesses/sync").json["witnesses"]
        self.assertTrue(all(w["status"] == "alarm" for w in ws), ws)

    def test_honest_growth_keeps_witnesses_ok(self):
        self.admin()
        self.post("/api/admin/seed", {"n": 5})
        self.post("/api/admin/seed", {"n": 5})
        ws = self.post("/api/witnesses/sync").json["witnesses"]
        self.assertTrue(all(w["status"] == "ok" for w in ws), ws)
        self.assertEqual(ws[0]["size"], 10)

    def test_ballot_stuffing_breaks_the_books(self):
        self.vote("RGIT26001", "riya")
        ballot, _ = C.encrypt_ballot(self.pub, self.eid, "kabir")
        with self.s.tx() as c:
            self.s._append(c, ballot, "ab" * 32)
        r = self.c.get("/api/reconcile").json
        self.assertFalse(r["ok"])

    def test_close_and_tally_with_two_trustees(self):
        self.admin()
        self.post("/api/admin/seed", {"n": 12})
        self.post("/api/admin/close")
        late = self.post("/api/otp/request", {"voter_id": "RGIT26040"})
        self.assertEqual(late.status_code, 200)
        s1, s2, s3 = (self.c.get(f"/api/admin/share/{i}").json for i in (1, 2, 3))
        self.assertEqual(self.post("/api/admin/tally", {"shares": [s1]}).status_code, 422)   # one trustee is not enough
        bad = dict(s2, y=hex(int(s2["y"], 16) + 1))
        self.assertEqual(self.post("/api/admin/tally", {"shares": [s1, bad]}).status_code, 403)
        r = self.post("/api/admin/tally", {"shares": [s1, s3]}).json
        self.assertEqual(r["total"], 12)
        self.assertTrue(r["matches_ledger"])
        self.assertTrue(r["published"])

    def test_admin_endpoints_need_login(self):
        for path in ("/api/admin/audit", "/api/admin/alerts"):
            self.assertEqual(self.c.get(path).status_code, 401)
        self.assertEqual(self.post("/api/admin/seed", {"n": 1}).status_code, 401)
        self.assertEqual(self.post("/api/admin/login", {"password": "wrong"}).status_code, 401)

    def test_audit_log_is_hash_chained(self):
        self.vote("RGIT26001", "riya")
        self.assertTrue(self.s.audit_check()["ok"])
        with self.s.tx() as c:
            c.execute("UPDATE audit SET detail='edited' WHERE id=2")
        self.assertFalse(self.s.audit_check()["ok"])


if __name__ == "__main__":
    unittest.main()
