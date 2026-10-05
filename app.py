"""GlassBallot: tamper-evident, voter-verifiable college elections (prototype).

Run:  python app.py        then open http://localhost:5000
"""
import hmac
import os
import secrets
import time

from flask import Flask, jsonify, request, send_from_directory, session

from gb import crypto as C
from gb import witness as W
from gb.store import Store, StoreError

HERE = os.path.dirname(os.path.abspath(__file__))


def create_app(data_dir=None, demo=None):
    data_dir = data_dir or os.environ.get("GB_DATA_DIR", os.path.join(HERE, "data"))
    demo = (os.environ.get("GB_DEMO", "1") == "1") if demo is None else demo
    os.makedirs(data_dir, exist_ok=True)

    app = Flask(__name__, static_folder=os.path.join(HERE, "static"), static_url_path="/static")
    key_path = os.path.join(data_dir, "secret.key")
    if not os.path.exists(key_path):
        fd = os.open(key_path, os.O_WRONLY | os.O_CREAT, 0o600)
        with os.fdopen(fd, "w") as f:
            f.write(secrets.token_hex(32))
    with open(key_path) as f:
        app.secret_key = f.read()
    app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Strict",
                      MAX_CONTENT_LENGTH=512 * 1024)

    store = Store(data_dir, demo=demo)
    wstore = W.WitnessStore(os.path.join(data_dir, "witnesses.db"))
    log = W.LocalLog(store)
    admin_pw = os.environ.get("GB_ADMIN_PASSWORD", "glassballot-demo")
    hits = {}

    def limit(key, n, per):
        t = time.time()
        hits[key] = [x for x in hits.get(key, []) if t - x < per]
        if len(hits[key]) >= n:
            raise StoreError("Too many attempts. Wait a moment and try again.", 429)
        hits[key].append(t)

    def sync_witnesses():
        return [{**W.sync(wstore, w["id"], log, store.eid), "owner": w["owner"]} for w in W.WITNESSES]

    def need_admin():
        if not session.get("admin"):
            raise StoreError("Admin sign-in required.", 401)

    def need_demo():
        need_admin()
        if not store.demo:
            raise StoreError("Demo tools are disabled.", 403)

    # ---------- middleware ----------
    @app.before_request
    def csrf_guard():
        if request.method in ("POST", "PUT", "DELETE") and request.headers.get("X-Requested-With") != "glassballot":
            raise StoreError("Missing CSRF header.", 403)

    @app.after_request
    def headers(r):
        r.headers["Content-Security-Policy"] = ("default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; "
                                                "style-src 'self'; img-src 'self' data:; connect-src 'self'; "
                                                "frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        r.headers["X-Content-Type-Options"] = "nosniff"
        r.headers["X-Frame-Options"] = "DENY"
        r.headers["Referrer-Policy"] = "no-referrer"
        r.headers["Cache-Control"] = "no-store"
        return r

    @app.errorhandler(StoreError)
    def store_error(e):
        return jsonify({"error": str(e)}), e.code

    @app.errorhandler(404)
    def nf(_):
        return jsonify({"error": "Not found."}), 404

    @app.errorhandler(413)
    def too_big(_):
        return jsonify({"error": "Request too large."}), 413

    def body():
        d = request.get_json(silent=True)
        if not isinstance(d, dict):
            raise StoreError("JSON body required.", 400)
        return d

    # ---------- pages ----------
    @app.get("/")
    def index():
        return send_from_directory(app.static_folder, "index.html")

    # ---------- public API ----------
    @app.get("/api/config")
    def config():
        return jsonify(store.config())

    @app.post("/api/otp/request")
    def otp_request():
        d = body()
        limit(f"otp:{request.remote_addr}", 8, 60)
        limit(f"otp:{str(d.get('voter_id'))[:20].upper()}", 3, 60)
        store.request_otp(d.get("voter_id"))
        return jsonify({"ok": True, "message": "If this ID is eligible, a one-time code has been sent."})

    @app.get("/api/demo/inbox")
    def demo_inbox():
        if not store.demo:
            raise StoreError("Disabled.", 403)
        vid = (request.args.get("voter_id") or "").strip().upper()
        return jsonify({"otp": store.inbox.get(vid)})

    @app.post("/api/otp/verify")
    def otp_verify():
        d = body()
        limit(f"verify:{request.remote_addr}", 12, 60)
        session["voter"] = store.verify_otp(d.get("voter_id"), d.get("otp"))
        return jsonify({"ok": True})

    @app.post("/api/token")
    def token():
        vid = session.get("voter")
        if not vid:
            raise StoreError("Sign in with your ID and code first.", 401)
        t = store.issue_token(vid)
        session.pop("voter", None)    # identity is dropped from the session the moment the token is issued
        return jsonify({"token": t})

    def check_token_header():
        t = request.headers.get("X-Ballot-Token", "")
        row = store.q1("SELECT state FROM tokens WHERE token_hash=?", (C.sha256_hex(t.encode()),))
        if not row or row["state"] != "issued":
            raise StoreError("Valid ballot token required.", 403)

    @app.post("/api/ballot/spoil")
    def spoil():
        check_token_header()
        d = body()
        return jsonify(store.spoil(d.get("ballot"), d.get("eph_d"), d.get("claimed")))

    @app.post("/api/ballot/cast")
    def cast():
        d = body()
        limit(f"cast:{request.remote_addr}", 30, 60)
        r = store.cast(d.get("token"), d.get("ballot"))
        sync_witnesses()
        return jsonify(r)

    @app.get("/api/ledger")
    def ledger():
        return jsonify({"entries": store.ledger(), "genesis": store.genesis()})

    @app.get("/api/sth/latest")
    def sth_latest():
        return jsonify(store.latest_sth())

    @app.get("/api/proof/inclusion")
    def inclusion():
        try:
            idx = int(request.args.get("index", ""))
        except ValueError:
            raise StoreError("index must be a number.", 400)
        return jsonify(store.inclusion(idx))

    @app.get("/api/proof/consistency")
    def consistency():
        try:
            m, n = int(request.args["first"]), int(request.args["second"])
        except (KeyError, ValueError):
            raise StoreError("first and second must be numbers.", 400)
        return jsonify(store.consistency(m, n))

    @app.get("/api/reconcile")
    def reconcile():
        return jsonify(store.reconcile())

    @app.get("/api/integrity")
    def integrity():
        return jsonify({**store.integrity(), "audit": store.audit_check()})

    @app.get("/api/witnesses")
    def witnesses():
        out = []
        for w in W.WITNESSES:
            s = wstore.get(w["id"]) or {"id": w["id"], "size": 0, "root": "", "status": "waiting",
                                         "message": "Not synced yet.", "last_sync": 0, "ts": 0}
            out.append({**s, "owner": w["owner"]})
        return jsonify({"witnesses": out})

    @app.post("/api/witnesses/sync")
    def witnesses_sync():
        return jsonify({"witnesses": sync_witnesses()})

    @app.get("/api/spoiled")
    def spoiled():
        return jsonify({"spoiled": store.spoiled_board()})

    @app.get("/api/results")
    def results():
        return jsonify(store.results())

    @app.get("/api/status")
    def status():
        """Everything the dashboards need in one call."""
        return jsonify({"config": store.config(), "reconcile": store.reconcile(),
                        "integrity": {**store.integrity(), "audit": store.audit_check()},
                        "sth": store.latest_sth()})

    # ---------- admin ----------
    @app.post("/api/admin/login")
    def admin_login():
        limit(f"admin:{request.remote_addr}", 6, 60)
        if not hmac.compare_digest(str(body().get("password", "")), admin_pw):
            store.audit("unknown", "ADMIN_LOGIN_FAIL", request.remote_addr or "")
            store.alert("medium", "ADMIN_LOGIN_FAIL", f"failed admin sign-in from {request.remote_addr}")
            raise StoreError("Wrong password.", 401)
        session["admin"] = True
        store.audit("admin", "ADMIN_LOGIN", "")
        return jsonify({"ok": True})

    @app.post("/api/admin/logout")
    def admin_logout():
        session.pop("admin", None)
        return jsonify({"ok": True})

    @app.get("/api/admin/me")
    def admin_me():
        return jsonify({"admin": bool(session.get("admin"))})

    @app.get("/api/admin/audit")
    def admin_audit():
        need_admin()
        return jsonify({"audit": store.q("SELECT * FROM audit ORDER BY id DESC LIMIT 200"),
                        "chain": store.audit_check()})

    @app.get("/api/admin/alerts")
    def admin_alerts():
        need_admin()
        return jsonify({"alerts": store.q("SELECT * FROM alerts ORDER BY id DESC LIMIT 50")})

    @app.post("/api/admin/close")
    def admin_close():
        need_admin()
        sth = store.close()
        sync_witnesses()
        return jsonify({"ok": True, "sth": sth})

    @app.post("/api/admin/tally")
    def admin_tally():
        need_admin()
        return jsonify(store.tally(body().get("shares") or []))

    @app.get("/api/admin/share/<int:n>")
    def admin_share(n):
        need_demo()
        if n not in (1, 2, 3):
            raise StoreError("No such trustee.", 404)
        return jsonify(store.share_file(n))

    @app.post("/api/admin/seed")
    def admin_seed():
        need_demo()
        n = store.seed_votes(min(int(body().get("n", 10)), 30))
        sync_witnesses()
        return jsonify({"added": n})

    @app.post("/api/admin/attack")
    def admin_attack():
        need_demo()
        out = store.attack(body().get("kind"))
        sync_witnesses()
        return jsonify(out)

    @app.post("/api/admin/device")
    def admin_device():
        need_demo()
        on = bool(body().get("on"))
        store.set_meta("compromised_device", "1" if on else "0")
        store.audit("admin", "DEMO_DEVICE_FLAG", "compromised device simulation " + ("ON" if on else "OFF"))
        return jsonify({"compromised_device": on})

    @app.post("/api/admin/reset")
    def admin_reset():
        need_demo()
        store.reset()
        wstore.reset()
        return jsonify({"ok": True})

    app.store, app.wstore = store, wstore    # exposed for tests
    return app


if __name__ == "__main__":
    application = create_app()
    print("\nGlassBallot running on http://localhost:5000  (admin password: "
          + os.environ.get("GB_ADMIN_PASSWORD", "glassballot-demo") + ")\n")
    application.run(host="127.0.0.1", port=5000, debug=False, threaded=True)
