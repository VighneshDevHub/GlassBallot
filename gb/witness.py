"""Candidate Witnesses.

A witness keeps its OWN copy of the last signed tree head it accepted, in its own
database, and only accepts a new head if (1) the signature is valid and (2) an
RFC 6962 consistency proof shows the new log extends the old one. If the log is
ever rewritten, even by someone who can re-sign heads, the proof fails and the
witness raises a permanent alarm.

In production each witness runs on the candidate's own machine (see witness_cli.py).
The in-app witnesses exist so the demo can show the idea in one window.
"""
import json
import os
import sqlite3
import time
import urllib.request
from contextlib import contextmanager

from . import crypto as C
from . import merkle as M

WITNESSES = [
    {"id": "w_riya", "owner": "Riya Menon's polling agent"},
    {"id": "w_kabir", "owner": "Kabir Shah's polling agent"},
    {"id": "w_ananya", "owner": "Ananya Iyer's polling agent"},
]


class LocalLog:
    """Adapter so in-app witnesses read the log through the same interface a remote witness uses."""

    def __init__(self, store):
        self.s = store

    def latest_sth(self):
        return self.s.latest_sth()

    def consistency(self, m, n):
        return self.s.consistency(m, n)["path"]

    def sth_pub(self):
        return self.s.signer.pub_b64


class HttpLog:
    def __init__(self, base):
        self.base = base.rstrip("/")

    def _get(self, path):
        with urllib.request.urlopen(self.base + path, timeout=10) as r:
            return json.load(r)

    def latest_sth(self):
        return self._get("/api/sth/latest")

    def consistency(self, m, n):
        return self._get(f"/api/proof/consistency?first={m}&second={n}")["path"]

    def sth_pub(self):
        return self._get("/api/config")["sth_pub"]


class WitnessStore:
    def __init__(self, path):
        self.path = path
        with self._tx() as c:
            c.execute("""CREATE TABLE IF NOT EXISTS witness(
                id TEXT PRIMARY KEY, size INTEGER, root TEXT, ts INTEGER, sig TEXT,
                status TEXT, message TEXT, last_sync INTEGER)""")

    def _c(self):
        c = sqlite3.connect(self.path, timeout=15)
        c.row_factory = sqlite3.Row
        return c

    @contextmanager
    def _tx(self):
        c = self._c()
        try:
            yield c
            c.commit()
        except Exception:
            c.rollback()
            raise
        finally:
            c.close()

    def get(self, wid):
        with self._tx() as c:
            r = c.execute("SELECT * FROM witness WHERE id=?", (wid,)).fetchone()
        return dict(r) if r else None

    def save(self, wid, **kw):
        cur = self.get(wid) or {"id": wid, "size": 0, "root": "", "ts": 0, "sig": "", "status": "waiting",
                                "message": "Not synced yet.", "last_sync": 0}
        cur.update(kw)
        with self._tx() as c:
            c.execute("INSERT OR REPLACE INTO witness(id,size,root,ts,sig,status,message,last_sync) "
                      "VALUES(:id,:size,:root,:ts,:sig,:status,:message,:last_sync)", cur)
        return cur

    def reset(self):
        with self._tx() as c:
            c.execute("DELETE FROM witness")


def sync(ws: WitnessStore, wid: str, log, election_id: str):
    """One witness sync. Returns the witness's stored state after the attempt."""
    cur = ws.get(wid)
    if cur and cur["status"] == "alarm":
        return ws.save(wid, last_sync=int(time.time()))      # alarms are sticky: evidence is kept
    try:
        sth = log.latest_sth()
        pub = log.sth_pub()
    except Exception as e:  # noqa: BLE001
        return ws.save(wid, message=f"Could not reach the log: {e}", last_sync=int(time.time()))
    msg = C.sth_message(election_id, sth["size"], sth["root"], sth["ts"])
    if not C.verify_sig(pub, msg, sth["sig"]):
        return ws.save(wid, status="alarm", message="Signed head has an INVALID signature.", last_sync=int(time.time()))
    if not cur or cur["size"] == 0 or not cur["root"]:
        return ws.save(wid, size=sth["size"], root=sth["root"], ts=sth["ts"], sig=sth["sig"], status="ok",
                       message=f"First head recorded (size {sth['size']}).", last_sync=int(time.time()))
    m, n = cur["size"], sth["size"]
    if n < m:
        return ws.save(wid, status="alarm", last_sync=int(time.time()),
                       message=f"ALARM: the log SHRANK from {m} to {n} entries.")
    if n == m:
        if sth["root"] != cur["root"]:
            return ws.save(wid, status="alarm", last_sync=int(time.time()),
                           message=f"ALARM: same size ({m}) but a different root. History was rewritten.")
        return ws.save(wid, status="ok", message=f"In sync at {m} entries.", last_sync=int(time.time()))
    try:
        path = [bytes.fromhex(p) for p in log.consistency(m, n)]
        good = M.verify_consistency(m, n, bytes.fromhex(cur["root"]), bytes.fromhex(sth["root"]), path)
    except Exception:  # noqa: BLE001
        good = False
    if not good:
        return ws.save(wid, status="alarm", last_sync=int(time.time()),
                       message=f"ALARM: the log at size {n} is NOT an extension of the head I saw at size {m}.")
    return ws.save(wid, size=n, root=sth["root"], ts=sth["ts"], sig=sth["sig"], status="ok",
                   message=f"Consistent. Log grew from {m} to {n} entries, nothing rewritten.",
                   last_sync=int(time.time()))


def main():
    """Standalone witness: run on your own machine.

    python -m gb.witness http://localhost:5000 my_witness.db
    """
    import sys
    base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5000"
    path = sys.argv[2] if len(sys.argv) > 2 else "my_witness.db"
    log = HttpLog(base)
    election = log.latest_sth()["election"]
    ws = WitnessStore(path)
    print(f"Witness watching {election} at {base}. Ctrl+C to stop.")
    while True:
        r = sync(ws, "me", log, election)
        stamp = time.strftime("%H:%M:%S")
        print(f"[{stamp}] {r['status'].upper():5} {r['message']}")
        if r["status"] == "alarm":
            print("Evidence kept in", os.path.abspath(path))
        time.sleep(5)


if __name__ == "__main__":
    main()
