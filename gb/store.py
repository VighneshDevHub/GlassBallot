"""GlassBallot state: the Two Books, the hash-chained Sealed Ballot Ledger,
signed tree heads, a hash-chained audit log, alerts, tally and a tamper simulator.
"""
import hashlib
import hmac
import json
import os
import random
import secrets
import sqlite3
import threading
import time
from contextlib import contextmanager

from . import crypto as C
from . import merkle as M

ELECTION = {
    "id": "RGIT-SC-2026",
    "title": "Student Council President 2026",
    "college": "RGIT Mumbai (demo election)",
    "candidates": [
        {"id": "riya", "name": "Riya Menon", "tag": "Campus infrastructure"},
        {"id": "kabir", "name": "Kabir Shah", "tag": "Clubs and events"},
        {"id": "ananya", "name": "Ananya Iyer", "tag": "Academic support"},
        {"id": "nota", "name": "None of the above", "tag": ""},
    ],
}
FIRST = ["Aarav", "Diya", "Vihaan", "Isha", "Arjun", "Meera", "Rohan", "Sara", "Kunal", "Neha"]
LAST = ["Patil", "Nair", "Khan", "Desai", "Rao", "Joshi", "D'Souza", "Gupta"]
THRESHOLD, TRUSTEES = 2, 3
TRUSTEE_ROLES = ["Election officer", "Faculty member", "Student representative"]


def now() -> int:
    return int(time.time())


class StoreError(Exception):
    def __init__(self, msg, code=400):
        super().__init__(msg)
        self.code = code


class Store:
    def __init__(self, data_dir: str, demo: bool = True):
        self.dir = data_dir
        os.makedirs(os.path.join(data_dir, "trustee_shares"), exist_ok=True)
        self.db_path = os.path.join(data_dir, "glassballot.db")
        self.demo = demo
        self.eid = ELECTION["id"]
        self.lock = threading.RLock()
        self.inbox = {}          # demo "SMS inbox": voter_id -> last otp
        self.recent_casts = []   # for burst detection
        self.init()

    # ---------- plumbing ----------
    def connect(self):
        c = sqlite3.connect(self.db_path, timeout=15, isolation_level=None)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA journal_mode=WAL")
        return c

    @contextmanager
    def tx(self):
        with self.lock:
            c = self.connect()
            try:
                c.execute("BEGIN IMMEDIATE")
                yield c
                c.execute("COMMIT")
            except Exception:
                c.execute("ROLLBACK")
                raise
            finally:
                c.close()

    def q(self, sql, args=()):
        c = self.connect()
        try:
            return [dict(r) for r in c.execute(sql, args).fetchall()]
        finally:
            c.close()

    def q1(self, sql, args=()):
        r = self.q(sql, args)
        return r[0] if r else None

    def meta(self, key, default=None):
        r = self.q1("SELECT value FROM meta WHERE key=?", (key,))
        return r["value"] if r else default

    def set_meta(self, key, value, c=None):
        sql = "INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
        if c:
            c.execute(sql, (key, str(value)))
        else:
            with self.tx() as t:
                t.execute(sql, (key, str(value)))

    # ---------- setup ----------
    def init(self):
        c = self.connect()
        try:
            c.executescript("""
            CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE IF NOT EXISTS voters(voter_id TEXT PRIMARY KEY, name TEXT, token_issued INTEGER DEFAULT 0);
            CREATE TABLE IF NOT EXISTS otps(voter_id TEXT PRIMARY KEY, otp_hash TEXT, expires INTEGER, attempts INTEGER DEFAULT 0);
            CREATE TABLE IF NOT EXISTS tokens(token_hash TEXT PRIMARY KEY, state TEXT);
            CREATE TABLE IF NOT EXISTS ledger(idx INTEGER PRIMARY KEY, ballot TEXT, token_hash TEXT, prev_hash TEXT, entry_hash TEXT);
            CREATE TABLE IF NOT EXISTS sth(size INTEGER PRIMARY KEY, root TEXT, ts INTEGER, sig TEXT);
            CREATE TABLE IF NOT EXISTS spoiled(id INTEGER PRIMARY KEY AUTOINCREMENT, ballot_fp TEXT, claimed TEXT, revealed TEXT, ok INTEGER, ts INTEGER);
            CREATE TABLE IF NOT EXISTS tally(id INTEGER PRIMARY KEY AUTOINCREMENT, choice TEXT);
            CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, actor TEXT, action TEXT, detail TEXT, prev_hash TEXT, hash TEXT);
            CREATE TABLE IF NOT EXISTS alerts(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, severity TEXT, kind TEXT, detail TEXT);
            """)
        finally:
            c.close()
        self.signer = C.Signer(os.path.join(self.dir, "sth_signing_key.pem"))
        if self.meta("setup") != "done":
            self.setup_election()

    def setup_election(self):
        secret, pub = C.gen_election_key()
        shares = C.shamir_split(secret, THRESHOLD, TRUSTEES)
        for x, y in shares:   # DEMO: stands in for three hardware tokens held by three trustees
            p = os.path.join(self.dir, "trustee_shares", f"trustee_{x}.json")
            fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "w") as f:
                json.dump({"trustee": x, "role": TRUSTEE_ROLES[x - 1], "x": x, "y": hex(y)}, f)
        del secret   # the private key exists only as shares from here on
        rnd = random.Random(7)
        with self.tx() as c:
            for i in range(1, 41):
                name = f"{rnd.choice(FIRST)} {rnd.choice(LAST)}"
                c.execute("INSERT OR IGNORE INTO voters(voter_id,name) VALUES(?,?)", (f"RGIT26{i:03d}", name))
            self.set_meta("election_pub", C.b64e(pub), c)
            self.set_meta("state", "open", c)
            self.set_meta("compromised_device", "0", c)
            self.set_meta("setup", "done", c)
        self.audit("system", "ELECTION_CREATED", f"{self.eid}; trustees {THRESHOLD}-of-{TRUSTEES}; 40 eligible voters")
        self.publish_sth()

    def reset(self):
        with self.lock:
            for ext in ("", "-wal", "-shm"):
                try:
                    os.remove(self.db_path + ext)
                except FileNotFoundError:
                    pass
            try:
                os.remove(os.path.join(self.dir, "sth_signing_key.pem"))
            except FileNotFoundError:
                pass
            self.inbox.clear()
            self.recent_casts.clear()
            self.init()

    # ---------- audit log (hash-chained) and alerts ----------
    def audit(self, actor, action, detail=""):
        with self.tx() as c:
            last = c.execute("SELECT hash FROM audit ORDER BY id DESC LIMIT 1").fetchone()
            prev = last["hash"] if last else "0" * 64
            ts = now()
            h = C.sha256_hex(f"{prev}|{ts}|{actor}|{action}|{detail}".encode())
            c.execute("INSERT INTO audit(ts,actor,action,detail,prev_hash,hash) VALUES(?,?,?,?,?,?)",
                      (ts, actor, action, detail, prev, h))

    def audit_check(self):
        prev = "0" * 64
        for r in self.q("SELECT * FROM audit ORDER BY id"):
            h = C.sha256_hex(f"{prev}|{r['ts']}|{r['actor']}|{r['action']}|{r['detail']}".encode())
            if r["prev_hash"] != prev or r["hash"] != h:
                return {"ok": False, "first_bad": r["id"]}
            prev = r["hash"]
        return {"ok": True}

    def alert(self, severity, kind, detail):
        recent = self.q1("SELECT id FROM alerts WHERE kind=? AND detail=? AND ts>?", (kind, detail, now() - 60))
        if recent:
            return
        with self.tx() as c:
            c.execute("INSERT INTO alerts(ts,severity,kind,detail) VALUES(?,?,?,?)", (now(), severity, kind, detail))

    # ---------- config ----------
    def config(self):
        return {
            "election": ELECTION, "state": self.meta("state"),
            "election_pub": self.meta("election_pub"), "sth_pub": self.signer.pub_b64,
            "compromised_device": self.meta("compromised_device") == "1",
            "demo": self.demo, "threshold": THRESHOLD, "trustees": TRUSTEES,
        }

    # ---------- identity: OTP -> token (Book A) ----------
    def request_otp(self, voter_id):
        voter_id = (voter_id or "").strip().upper()[:20]
        v = self.q1("SELECT voter_id FROM voters WHERE voter_id=?", (voter_id,))
        if v:
            otp = f"{secrets.randbelow(10 ** 6):06d}"
            with self.tx() as c:
                c.execute("INSERT INTO otps(voter_id,otp_hash,expires,attempts) VALUES(?,?,?,0) "
                          "ON CONFLICT(voter_id) DO UPDATE SET otp_hash=excluded.otp_hash, expires=excluded.expires, attempts=0",
                          (voter_id, C.sha256_hex((voter_id + otp).encode()), now() + 300))
            if self.demo:
                self.inbox[voter_id] = otp
            self.audit("voter", "OTP_SENT", voter_id)
        # same response whether or not the ID exists: no voter-ID enumeration
        return True

    def verify_otp(self, voter_id, otp):
        voter_id = (voter_id or "").strip().upper()[:20]
        r = self.q1("SELECT * FROM otps WHERE voter_id=?", (voter_id,))
        if not r or r["expires"] < now() or r["attempts"] >= 5:
            self.audit("voter", "OTP_FAIL", voter_id)
            raise StoreError("Code is invalid or expired. Request a new one.", 401)
        good = hmac.compare_digest(r["otp_hash"], C.sha256_hex((voter_id + str(otp or "")).encode()))
        with self.tx() as c:
            if good:
                c.execute("DELETE FROM otps WHERE voter_id=?", (voter_id,))
            else:
                c.execute("UPDATE otps SET attempts=attempts+1 WHERE voter_id=?", (voter_id,))
        if not good:
            self.audit("voter", "OTP_FAIL", voter_id)
            if r["attempts"] + 1 >= 3:
                self.alert("medium", "REPEATED_OTP_FAILURES", f"{voter_id}: {r['attempts'] + 1} wrong codes")
            raise StoreError("Wrong code.", 401)
        self.audit("voter", "LOGIN_OK", voter_id)
        return voter_id

    def issue_token(self, voter_id):
        if self.meta("state") != "open":
            raise StoreError("Voting is closed.", 409)
        token = secrets.token_urlsafe(32)
        th = C.sha256_hex(token.encode())
        with self.tx() as c:
            v = c.execute("SELECT token_issued FROM voters WHERE voter_id=?", (voter_id,)).fetchone()
            if not v:
                raise StoreError("Not an eligible voter.", 403)
            if v["token_issued"]:
                raise StoreError("This voter has already received a ballot token.", 409)
            c.execute("UPDATE voters SET token_issued=1 WHERE voter_id=?", (voter_id,))
            c.execute("INSERT INTO tokens(token_hash,state) VALUES(?, 'issued')", (th,))
        self.audit("system", "VOTER_MARKED", voter_id)   # Book A records who voted, never what
        return token

    # ---------- ledger (Book B) ----------
    @staticmethod
    def entry_hash(idx, prev, ballot_json, token_hash):
        bh = hashlib.sha256(ballot_json.encode()).digest()
        return hashlib.sha256(idx.to_bytes(8, "big") + bytes.fromhex(prev) + bh + bytes.fromhex(token_hash)).hexdigest()

    def genesis(self):
        return C.sha256_hex(f"glassballot-genesis|{self.eid}".encode())

    def _append(self, c, ballot, token_hash):
        last = c.execute("SELECT idx, entry_hash FROM ledger ORDER BY idx DESC LIMIT 1").fetchone()
        idx = last["idx"] + 1 if last else 0
        prev = last["entry_hash"] if last else self.genesis()
        bj = C.canonical(ballot)
        eh = self.entry_hash(idx, prev, bj, token_hash)
        c.execute("INSERT INTO ledger(idx,ballot,token_hash,prev_hash,entry_hash) VALUES(?,?,?,?,?)",
                  (idx, bj, token_hash, prev, eh))
        return idx, eh

    def cast(self, token, ballot, check_burst=True):
        if self.meta("state") != "open":
            raise StoreError("Voting is closed.", 409)
        if not C.validate_ballot(ballot):
            raise StoreError("Malformed ballot.", 422)
        th = C.sha256_hex((token or "").encode())
        with self.tx() as c:
            t = c.execute("SELECT state FROM tokens WHERE token_hash=?", (th,)).fetchone()
            if not t or t["state"] != "issued":
                raise StoreError("Token is invalid or already used.", 403)
            idx, eh = self._append(c, ballot, th)
            c.execute("UPDATE tokens SET state='used' WHERE token_hash=?", (th,))
        self.audit("system", "BALLOT_CAST", f"ledger index {idx}")   # no identity here, by design
        sth = self.publish_sth()
        if check_burst:
            self._burst_check()
        return {"index": idx, "entry_hash": eh, "sth": sth, "election": self.eid}

    def _burst_check(self):
        t = time.time()
        self.recent_casts = [x for x in self.recent_casts if t - x < 10] + [t]
        if len(self.recent_casts) > 8:
            self.alert("medium", "VOTE_BURST", f"{len(self.recent_casts)} ballots in 10 seconds")

    def ledger(self, start=0, end=None):
        rows = self.q("SELECT * FROM ledger WHERE idx>=? ORDER BY idx", (start,))
        out = []
        for r in rows:
            if end is not None and r["idx"] >= end:
                break
            out.append({"index": r["idx"], "ballot": json.loads(r["ballot"]), "token_hash": r["token_hash"],
                        "prev_hash": r["prev_hash"], "entry_hash": r["entry_hash"]})
        return out

    def leaves(self, size=None):
        rows = self.q("SELECT entry_hash FROM ledger ORDER BY idx")
        hs = [M.leaf_hash(bytes.fromhex(r["entry_hash"])) for r in rows]
        return hs if size is None else hs[:size]

    # ---------- signed tree heads ----------
    def publish_sth(self):
        hs = self.leaves()
        root = M.mth(hs).hex()
        ts = now()
        sig = self.signer.sign(C.sth_message(self.eid, len(hs), root, ts))
        with self.tx() as c:
            c.execute("INSERT OR REPLACE INTO sth(size,root,ts,sig) VALUES(?,?,?,?)", (len(hs), root, ts, sig))
        return {"election": self.eid, "size": len(hs), "root": root, "ts": ts, "sig": sig}

    def latest_sth(self):
        r = self.q1("SELECT * FROM sth ORDER BY size DESC LIMIT 1")
        return {"election": self.eid, **r} if r else None

    def all_sth(self):
        return [{"election": self.eid, **r} for r in self.q("SELECT * FROM sth ORDER BY size")]

    def inclusion(self, index):
        hs = self.leaves()
        if not 0 <= index < len(hs):
            raise StoreError("No such ledger entry.", 404)
        sth = self.latest_sth()
        hs = hs[:sth["size"]]
        if index >= len(hs):
            raise StoreError("Entry is newer than the latest signed head.", 404)
        return {"index": index, "leaf_hash": hs[index].hex(), "size": len(hs),
                "path": [p.hex() for p in M.inclusion_path(index, hs)], "sth": sth}

    def consistency(self, m, n):
        hs = self.leaves()
        if not (0 < m <= n <= len(hs)):
            raise StoreError("Bad sizes.", 400)
        return {"first": m, "second": n, "path": [p.hex() for p in M.consistency_path(m, hs[:n])]}

    # ---------- the checks ----------
    def reconcile(self):
        """Two Books must balance. Book A: voters marked. Book B: ballots in the ledger."""
        marked = self.q1("SELECT COUNT(*) n FROM voters WHERE token_issued=1")["n"]
        tok = {r["state"]: r["n"] for r in self.q("SELECT state, COUNT(*) n FROM tokens GROUP BY state")}
        issued, used, void = tok.get("issued", 0), tok.get("used", 0), tok.get("void", 0)
        ledger = self.q("SELECT idx, token_hash FROM ledger")
        ballots = len(ledger)
        used_hashes = {r["token_hash"] for r in self.q("SELECT token_hash FROM tokens WHERE state='used'")}
        led_hashes = [r["token_hash"] for r in ledger]
        problems = []
        if marked != issued + used + void:
            problems.append(f"Voters marked ({marked}) does not match tokens issued ({issued + used + void}).")
        if ballots > used:
            problems.append(f"{ballots - used} ballot(s) in the ledger have no matching used token (possible stuffing).")
        if ballots < used:
            problems.append(f"{used - ballots} used token(s) have no ballot in the ledger (possible deletion).")
        if len(set(led_hashes)) != len(led_hashes):
            problems.append("The same token appears in the ledger more than once.")
        if set(led_hashes) - used_hashes:
            problems.append("Ledger contains ballots whose token was never issued.")
        return {"ok": not problems, "voters_marked": marked, "ballots_recorded": ballots,
                "pending": issued, "void": void, "problems": problems}

    def integrity(self):
        """Recompute the whole chain and Merkle tree, and check every stored signed head."""
        rows = self.q("SELECT * FROM ledger ORDER BY idx")
        prev, problems, first_bad = self.genesis(), [], None
        for r in rows:
            exp = self.entry_hash(r["idx"], prev, r["ballot"], r["token_hash"])
            if r["prev_hash"] != prev:
                problems.append(f"Entry {r['idx']}: chain link broken.")
            elif r["entry_hash"] != exp:
                problems.append(f"Entry {r['idx']}: contents do not match their hash (record was altered).")
            else:
                prev = r["entry_hash"]
                continue
            first_bad = r["idx"] if first_bad is None else first_bad
            prev = r["entry_hash"]
        hs = self.leaves()
        for s in self.q("SELECT * FROM sth ORDER BY size"):
            if s["size"] > len(hs) or M.mth(hs[:s["size"]]).hex() != s["root"]:
                problems.append(f"Signed head for size {s['size']} does not match the ledger.")
            elif not C.verify_sig(self.signer.pub_b64, C.sth_message(self.eid, s["size"], s["root"], s["ts"]), s["sig"]):
                problems.append(f"Signed head for size {s['size']} has an invalid signature.")
        latest = self.latest_sth()
        if latest and latest["size"] != len(hs):
            problems.append("Ledger size differs from the latest signed head.")
        return {"ok": not problems, "entries": len(rows), "first_bad_index": first_bad, "problems": problems,
                "root": M.mth(hs).hex()}

    # ---------- test-ballot (cast-as-intended) ----------
    def spoil(self, ballot, eph_d_b64u, claimed):
        if not C.validate_ballot(ballot) or claimed not in [c["id"] for c in ELECTION["candidates"]]:
            raise StoreError("Malformed test ballot.", 422)
        pub = C.b64d(self.meta("election_pub"))
        try:
            revealed = C.decrypt_with_ephemeral(pub, C.b64u_d(eph_d_b64u), ballot, self.eid)["c"]
        except Exception:
            revealed = None
        ok = revealed == claimed
        fp = C.sha256_hex(C.canonical(ballot).encode())
        with self.tx() as c:
            c.execute("INSERT INTO spoiled(ballot_fp,claimed,revealed,ok,ts) VALUES(?,?,?,?,?)",
                      (fp, claimed, revealed or "undecryptable", int(ok), now()))
        self.audit("voter", "TEST_BALLOT", f"{fp[:12]} {'match' if ok else 'MISMATCH'}")
        if not ok:
            self.alert("high", "DEVICE_MISMATCH", f"Test ballot {fp[:12]}: device encrypted '{revealed}' but voter chose '{claimed}'")
        return {"ok": ok, "claimed": claimed, "revealed": revealed, "fingerprint": fp}

    def spoiled_board(self):
        return self.q("SELECT id, ballot_fp, claimed, revealed, ok, ts FROM spoiled ORDER BY id DESC LIMIT 50")

    # ---------- close and tally ----------
    def close(self, actor="admin"):
        if self.meta("state") != "open":
            raise StoreError("Election is not open.", 409)
        with self.tx() as c:
            c.execute("UPDATE tokens SET state='void' WHERE state='issued'")
            self.set_meta("state", "closed", c)
        self.audit(actor, "ELECTION_CLOSED", "unused tokens voided")
        return self.publish_sth()

    def tally(self, shares):
        if self.meta("state") != "closed":
            raise StoreError("Close the election before tallying.", 409)
        try:
            pts = [(int(s["x"]), int(str(s["y"]), 16)) for s in shares]
        except Exception:
            raise StoreError("Malformed trustee share.", 422)
        if len({x for x, _ in pts}) < THRESHOLD:
            raise StoreError(f"Need {THRESHOLD} different trustees.", 422)
        secret = C.shamir_combine(pts)
        if C.pub_from_secret(secret) != C.b64d(self.meta("election_pub")):
            self.audit("admin", "TALLY_REJECTED", "trustee shares do not reconstruct the election key")
            raise StoreError("Those shares do not unlock this election.", 403)
        counts, failed, choices = {}, 0, []
        for e in self.ledger():
            try:
                ch = C.decrypt_ballot(secret, e["ballot"], self.eid)["c"]
                if ch not in [c["id"] for c in ELECTION["candidates"]]:
                    raise ValueError
                choices.append(ch)
            except Exception:
                failed += 1
        del secret
        random.SystemRandom().shuffle(choices)   # published in random order: no link to ledger order
        with self.tx() as c:
            c.execute("DELETE FROM tally")
            c.executemany("INSERT INTO tally(choice) VALUES(?)", [(x,) for x in choices])
            self.set_meta("state", "tallied", c)
        self.audit("admin", "TALLIED", f"{len(choices)} decrypted, {failed} failed, by {len(pts)} trustees")
        return self.results()

    def results(self):
        rows = self.q("SELECT choice, COUNT(*) n FROM tally GROUP BY choice")
        counts = {r["choice"]: r["n"] for r in rows}
        ledger_n = self.q1("SELECT COUNT(*) n FROM ledger")["n"]
        total = sum(counts.values())
        return {"published": self.meta("state") == "tallied", "counts": counts, "total": total,
                "ledger_entries": ledger_n, "matches_ledger": total == ledger_n,
                "shuffled": [r["choice"] for r in self.q("SELECT choice FROM tally ORDER BY id")]}

    def share_file(self, n):
        p = os.path.join(self.dir, "trustee_shares", f"trustee_{int(n)}.json")
        with open(p) as f:
            return json.load(f)

    # ---------- demo tools ----------
    def seed_votes(self, n):
        pub = C.b64d(self.meta("election_pub"))
        weights = ["riya", "riya", "kabir", "kabir", "kabir", "ananya", "nota"]
        done = 0
        for v in self.q("SELECT voter_id FROM voters WHERE token_issued=0 ORDER BY voter_id LIMIT ?", (n,)):
            tok = self.issue_token(v["voter_id"])
            ballot, _ = C.encrypt_ballot(pub, self.eid, random.choice(weights))
            self.cast(tok, ballot, check_burst=False)
            done += 1
        self.audit("admin", "DEMO_SEED_VOTES", f"{done} sample ballots")
        return done

    def attack(self, kind):
        """DEMO ONLY: simulate an insider with direct database access."""
        rows = self.q("SELECT * FROM ledger ORDER BY idx")
        if len(rows) < 4:
            raise StoreError("Cast at least 4 votes first (use 'Add sample votes').", 409)
        target = len(rows) // 2
        pub = C.b64d(self.meta("election_pub"))
        old = json.loads(rows[target]["ballot"])
        if kind == "naive":
            ct = bytearray(C.b64d(old["ct"]))
            ct[5] ^= 0x01
            old["ct"] = C.b64e(bytes(ct))
            with self.tx() as c:
                c.execute("UPDATE ledger SET ballot=? WHERE idx=?", (C.canonical(old), target))
            self.audit("insider", "DB_EDIT", f"ledger entry {target} edited directly in the database")
            return {"kind": kind, "target": target,
                    "note": "One ballot was edited in place. Its hash no longer matches."}
        if kind == "rewrite":
            new, _ = C.encrypt_ballot(pub, self.eid, "nota")
            with self.tx() as c:
                prev = rows[target]["prev_hash"]
                for r in rows[target:]:
                    ballot_json = C.canonical(new) if r["idx"] == target else r["ballot"]
                    eh = self.entry_hash(r["idx"], prev, ballot_json, r["token_hash"])
                    c.execute("UPDATE ledger SET ballot=?, prev_hash=?, entry_hash=? WHERE idx=?",
                              (ballot_json, prev, eh, r["idx"]))
                    prev = eh
                c.execute("DELETE FROM sth")   # the insider also wipes the old signed heads...
            self.publish_sth()                 # ...and signs a fresh one with the server key
            self.audit("insider", "DB_REWRITE", f"ledger rewritten from entry {target}; hashes and signed head regenerated")
            return {"kind": kind, "target": target,
                    "note": "History was rewritten and re-signed. The server alone cannot tell. Witnesses can."}
        raise StoreError("Unknown attack.", 400)
