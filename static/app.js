(function () {
  "use strict";
  const view = document.getElementById("view");
  let cfg = null, timer = null;

  // ---------- tiny helpers (DOM is built with textContent only: no innerHTML, no XSS) ----------
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  async function api(path, opts = {}) {
    const o = { method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
                headers: { "X-Requested-With": "glassballot", ...(opts.headers || {}) } };
    if (opts.body !== undefined) { o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(opts.body); }
    const r = await fetch(path, o);
    let d = {};
    try { d = await r.json(); } catch (e) { /* non-JSON error page */ }
    if (!r.ok) throw new Error(d.error || "Request failed (" + r.status + ")");
    return d;
  }
  const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(k => k != null && k !== false));
  const short = (x, n = 12) => (x ? x.slice(0, n) + "\u2026" : "");
  const nameOf = id => ((cfg && cfg.election.candidates.find(c => c.id === id)) || { name: id }).name;
  const clock = ts => (ts ? new Date(ts * 1000).toLocaleTimeString([], { hour12: false }) : "never");
  const notice = (kind, ...kids) => h("div", { class: "notice " + kind, role: kind === "bad" ? "alert" : null }, kids);
  const shortCode = hex => "GB-" + hex.slice(0, 12).toUpperCase().replace(/(.{4})/g, "$1-").replace(/-$/, "");

  async function loadConfig() {
    cfg = await api("/api/config");
    const p = document.getElementById("state-pill");
    const map = { open: ["Voting open", "ok"], closed: ["Voting closed", "warn"], tallied: ["Results published", "ok"] };
    const [t, k] = map[cfg.state] || [cfg.state, ""];
    p.textContent = t; p.className = "pill " + k;
  }

  // ---------- router ----------
  function route() {
    clearInterval(timer); timer = null;
    const m = /^#\/(\w+)(?:\?(.*))?$/.exec(location.hash) || [null, "vote", ""];
    const qs = new URLSearchParams(m[2] || "");
    document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("on", a.dataset.r === m[1]));
    const views = { vote: renderVote, verify: renderVerify, witnesses: renderWitnesses, control: renderControl };
    loadConfig().then(() => (views[m[1]] || renderVote)(qs)).catch(e => view.replaceChildren(notice("bad", e.message)));
    view.focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", route);

  // =====================================================================
  // VOTE
  // =====================================================================
  const V = { step: 0, voterId: "", otpSent: false, inbox: null, token: null, choice: null, sealed: null, test: null, receipt: null, msg: null, busy: false };
  const STEPS = ["Sign in", "Choose", "Seal and check", "Proof Card"];

  function resetVote() { Object.assign(V, { step: 0, voterId: "", otpSent: false, inbox: null, token: null, choice: null, sealed: null, test: null, receipt: null, msg: null, busy: false }); }
  const guard = fn => async (...a) => { V.msg = null; V.busy = true; try { await fn(...a); } catch (e) { V.msg = { kind: "bad", text: e.message }; } V.busy = false; renderVote(); };

  function renderVote() {
    const closed = cfg.state !== "open" && V.step < 3;
    const body = closed ? notice("warn", h("b", { text: "Voting is closed." }), " Results are on the Verify page once the trustees have counted.")
      : [loginStep, chooseStep, sealStep, doneStep][V.step]();
    view.replaceChildren(
      h("h1", { text: V.step === 3 ? "Your Proof Card" : "Cast your vote" }),
      h("p", { class: "muted", text: cfg.election.title + " · " + cfg.election.college }),
      h("ol", { class: "steps", "aria-label": "Progress" }, STEPS.map((s, i) => h("li", { class: i < V.step ? "done" : i === V.step ? "now" : "", text: s }))),
      ...(V.msg ? [notice(V.msg.kind, V.msg.text)] : []), body);
  }

  const sendCode = guard(async () => {
    V.voterId = document.getElementById("vid").value.trim().toUpperCase();
    await api("/api/otp/request", { body: { voter_id: V.voterId } });
    V.otpSent = true;
    if (cfg.demo) V.inbox = (await api("/api/demo/inbox?voter_id=" + encodeURIComponent(V.voterId))).otp;
  });
  const verifyCode = guard(async () => {
    await api("/api/otp/verify", { body: { voter_id: V.voterId, otp: document.getElementById("otp").value.trim() } });
    V.token = (await api("/api/token", { body: {} })).token;   // identity leaves the session here
    V.step = 1;
  });

  function loginStep() {
    return h("div", { class: "grid2" },
      h("div", { class: "card" },
        h("h2", { text: "Sign in with your college ID" }),
        h("label", { class: "field" }, h("span", { text: "College ID" }), h("input", { type: "text", id: "vid", value: V.voterId, autocomplete: "off", placeholder: "RGIT26001", maxlength: 20 })),
        V.otpSent ? [
          cfg.demo ? h("div", { class: "inbox" }, h("div", { class: "small", text: "Demo inbox. In a real election this code arrives by SMS or college email." }),
            V.inbox ? h("div", { class: "code", text: V.inbox }) : h("div", { class: "small", text: "No code was sent. Check the ID." })) : null,
          h("label", { class: "field" }, h("span", { text: "One-time code" }), h("input", { type: "text", id: "otp", autocomplete: "one-time-code", inputmode: "numeric", maxlength: 6 })),
          h("div", { class: "btns" }, h("button", { class: "btn primary", disabled: V.busy, onclick: verifyCode, text: "Verify and continue" }),
            h("button", { class: "btn", disabled: V.busy, onclick: sendCode, text: "Send a new code" }))
        ] : h("div", { class: "btns" }, h("button", { class: "btn primary", disabled: V.busy, onclick: sendCode, text: "Send my code" })),
        cfg.demo ? h("p", { class: "small muted", text: "Demo voters: RGIT26001 to RGIT26040." }) : null),
      h("div", { class: "card" }, h("h2", { text: "What happens to your vote" }),
        h("p", { text: "Your ID decides whether you may vote. After that, you get a random one-time token. The ballot is sealed on this device with the election key, and the ledger stores only the sealed ballot, never your name." }),
        h("p", { class: "small muted", text: "You will be able to test the sealed ballot before casting it, and check afterwards that it was counted." })));
  }

  function chooseStep() {
    return h("div", { class: "card" }, h("h2", { text: "Choose one candidate" }),
      h("div", { class: "cands", role: "group", "aria-label": "Candidates" }, cfg.election.candidates.map(c =>
        h("button", { class: "cand", "aria-pressed": String(V.choice === c.id), onclick: () => { V.choice = c.id; renderVote(); } },
          h("b", { text: c.name }), c.tag ? h("span", { class: "small muted", text: c.tag }) : null))),
      notice("", "Your choice is encrypted in this browser before anything is sent. The server only ever sees the sealed ballot."),
      h("div", { class: "btns" }, h("button", { class: "btn primary", disabled: !V.choice || V.busy, onclick: sealBallot, text: "Seal my ballot" })));
  }

  const sealBallot = guard(async () => {
    cfg = await api("/api/config");
    // Demo switch: a compromised device quietly encrypts a different candidate than the one chosen.
    const actual = cfg.compromised_device ? (V.choice === "kabir" ? "riya" : "kabir") : V.choice;
    const s = await GB.sealBallot(cfg.election_pub, cfg.election.id, actual);
    V.sealed = { ...s, fp: GB.fingerprint(s.ballot) }; V.test = null; V.step = 2;
  });
  const testBallot = guard(async () => {
    V.test = await api("/api/ballot/spoil", { headers: { "X-Ballot-Token": V.token },
      body: { ballot: V.sealed.ballot, eph_d: V.sealed.ephD, claimed: V.choice } });
  });
  const castBallot = guard(async () => {
    const r = await api("/api/ballot/cast", { body: { token: V.token, ballot: V.sealed.ballot } });
    const rec = { e: r.election, i: r.index, h: r.entry_hash, s: r.sth.size, r: r.sth.root };
    V.receipt = { ...rec, code: GB.encodeReceipt(rec) };
    V.token = null; V.sealed = null; V.step = 3;
  });

  function sealStep() {
    const t = V.test;
    return h("div", { class: "card" }, h("h2", { text: "Your ballot is sealed" }),
      h("p", { text: "This fingerprint identifies your sealed ballot:" }), h("div", { class: "fp", text: V.sealed.fp }),
      !t ? [h("p", { text: "Before you cast it, you can test it. A test opens a throwaway copy so you can see what this device really put inside. A test ballot is never counted." }),
        h("div", { class: "btns" }, h("button", { class: "btn", disabled: V.busy, onclick: testBallot, text: "Test this ballot" }),
          h("button", { class: "btn primary", disabled: V.busy, onclick: castBallot, text: "Cast this ballot" }))]
        : [t.ok ? notice("ok", h("b", { text: "Test passed. " }), "This device sealed ", h("b", { text: nameOf(t.revealed) }), ", exactly what you chose. The test ballot is discarded and listed on the public test board. Seal a fresh ballot to cast your real vote.")
          : notice("bad", h("b", { text: "Test failed. Do not cast. " }), "You chose ", h("b", { text: nameOf(t.claimed) }), " but this device sealed ", h("b", { text: t.revealed ? nameOf(t.revealed) : "something unreadable" }), ". The mismatch has been logged. Tell the election officer and use a supervised device."),
          h("div", { class: "btns" }, h("button", { class: "btn primary", disabled: V.busy, onclick: sealBallot, text: "Seal a fresh ballot" }))]);
  }

  function doneStep() {
    const r = V.receipt, url = location.origin + "/#/verify?r=" + r.code;
    const qr = h("div", { class: "qr" });
    setTimeout(() => { try { if (window.QRCode) new QRCode(qr, { text: url, width: 168, height: 168, correctLevel: QRCode.CorrectLevel.L }); else qr.append(h("p", { class: "small muted", text: "QR needs an internet connection to load. Use the receipt code below." })); } catch (e) { /* QR is optional */ } }, 0);
    return h("div", null,
      h("div", { class: "stub" },
        h("div", { class: "head" }, h("div", { class: "small muted", text: cfg.election.title }), h("h2", { text: "Proof Card" }), h("span", { class: "seal", text: "Recorded in the ledger" })),
        h("div", { class: "perf" }),
        h("div", { class: "code", text: shortCode(r.h) }), qr,
        h("dl", { class: "kv" }, h("dt", { text: "Entry" }), h("dd", { text: "#" + r.i }), h("dt", { text: "Fingerprint" }), h("dd", { text: short(r.h, 16) }),
          h("dt", { text: "Ledger root" }), h("dd", { text: short(r.r, 16) }), h("dt", { text: "Ledger size" }), h("dd", { text: String(r.s) }))),
      h("div", { class: "card" }, h("p", { text: "Keep this card. Anyone can use it to check that your ballot is in the ledger and that nothing before it has been changed. It does not say who you voted for, so it cannot be used to prove your vote to someone else." }),
        h("div", { class: "btns" },
          h("button", { class: "btn primary", onclick: () => { location.hash = "#/verify?r=" + r.code; }, text: "Check my card now" }),
          h("button", { class: "btn", onclick: e => { navigator.clipboard && navigator.clipboard.writeText(r.code); e.target.textContent = "Copied"; }, text: "Copy receipt code" }),
          h("button", { class: "btn", onclick: () => download("glassballot-receipt.json", JSON.stringify(r, null, 2)), text: "Download receipt" }),
          h("button", { class: "btn", onclick: () => { resetVote(); renderVote(); }, text: "Next voter" }))));
  }
  function download(name, text) {
    const a = h("a", { href: URL.createObjectURL(new Blob([text], { type: "application/json" })), download: name });
    document.body.append(a); a.click(); a.remove();
  }

  // =====================================================================
  // VERIFY (every check below is recomputed in this browser)
  // =====================================================================
  const li = (k, ...t) => h("li", { class: k }, t);

  async function auditChecks(items) {
    const [L, sth, W] = await Promise.all([api("/api/ledger"), api("/api/sth/latest"), api("/api/witnesses")]);
    const a = GB.auditLedger(L.entries, cfg.election.id);
    items.push(a.ok ? li("ok", "Recomputed from scratch: all " + L.entries.length + " ledger entries match their hashes and link to each other.")
      : li("bad", "The ledger has been altered. First broken entry: #" + a.firstBad + ". " + a.problems[0]));
    items.push(a.rootAt(sth.size) === sth.root ? li("ok", "The ledger's Merkle root matches the latest signed head (size " + sth.size + ").")
      : li("bad", "The ledger's Merkle root does NOT match the latest signed head."));
    W.witnesses.forEach(w => {
      if (!w.size) { items.push(li("info", w.owner + " has not recorded a head yet.")); return; }
      const same = w.size <= L.entries.length && a.rootAt(w.size) === w.root;
      items.push(w.status === "alarm" || !same
        ? li("bad", w.owner + ": ALARM. " + (same ? w.message : "The head it saw at size " + w.size + " does not match this ledger. History was rewritten."))
        : li("ok", w.owner + " saw this ledger at size " + w.size + " and it still matches."));
    });
    return a;
  }

  async function checkCard(text, out) {
    out.replaceChildren(h("p", { class: "muted", text: "Checking\u2026" }));
    const r = GB.decodeReceipt(text), items = [];
    if (!r) { out.replaceChildren(notice("bad", "That is not a valid receipt code. It starts with GB1.")); return; }
    try {
      const p = await api("/api/proof/inclusion?index=" + r.i);
      const mine = GB.leafHash(GB.fromHex(r.h));
      items.push(GB.eq(mine, GB.fromHex(p.leaf_hash)) ? li("ok", "Ledger entry #" + r.i + " has the same fingerprint as your card.")
        : li("bad", "Ledger entry #" + r.i + " is different from the one on your card. It was changed after you voted."));
      items.push(GB.verifyInclusion(mine, r.i, p.size, p.path.map(GB.fromHex), GB.fromHex(p.sth.root))
        ? li("ok", "Your entry connects to the published root through " + p.path.length + " hashes, checked in this browser.")
        : li("bad", "Your entry does not connect to the published root."));
      const a = await auditChecks(items);
      items.push(r.s <= a.leaves.length && a.rootAt(r.s) === r.r
        ? li("ok", "Rolled back to the moment you voted (size " + r.s + "), the ledger has exactly the root printed on your card. Nothing before your vote was rewritten.")
        : li("bad", "The ledger at size " + r.s + " no longer matches the root on your card. History was rewritten."));
    } catch (e) { items.push(li("bad", e.message)); }
    const bad = items.some(i => i.className === "bad");
    out.replaceChildren(bad ? notice("bad", h("b", { text: "Verification failed." }), " Something does not add up. See the red items.")
      : notice("ok", h("b", { text: "Verified. " }), "Your ballot is in the ledger and the ledger is intact."), h("ul", { class: "checks" }, items));
  }

  async function runFullAudit(out) {
    out.replaceChildren(h("p", { class: "muted", text: "Downloading the public ledger and recomputing everything\u2026" }));
    const items = [];
    try {
      const [rec, srv] = await Promise.all([api("/api/reconcile"), api("/api/integrity")]);
      items.push(rec.ok ? li("ok", "The two books balance: " + rec.voters_marked + " voters marked, " + rec.ballots_recorded + " ballots recorded" + (rec.pending ? ", " + rec.pending + " token(s) not yet used." : "."))
        : li("bad", "The two books do not balance. " + rec.problems.join(" ")));
      await auditChecks(items);
      items.push(srv.ok ? li("info", "The server's own integrity check also passes. (On its own this proves little: an insider could make it pass. The witnesses above are the independent check.)")
        : li("bad", "The server's own integrity check fails: " + srv.problems[0]));
    } catch (e) { items.push(li("bad", e.message)); }
    const bad = items.some(i => i.className === "bad");
    out.replaceChildren(bad ? notice("bad", h("b", { text: "Tampering detected." }), " At least one check failed.") : notice("ok", h("b", { text: "Clean audit. " }), "Every check passed."), h("ul", { class: "checks" }, items));
  }

  async function renderVerify(qs) {
    const ta = h("textarea", { id: "rc", "aria-label": "Receipt code", placeholder: "GB1.…" }); ta.value = qs.get("r") || "";
    const out1 = h("div"), out2 = h("div"), board = h("div"), res = h("div");
    view.replaceChildren(h("h1", { text: "Verify, don't trust" }),
      h("p", { text: "Everything on this page is recomputed in your browser from the public ledger. You are not taking the server's word for anything." }),
      h("div", { class: "card" }, h("h2", { text: "Check my Proof Card" }), h("label", { class: "field" }, h("span", { text: "Receipt code" }), ta),
        h("div", { class: "btns" }, h("button", { class: "btn primary", onclick: () => checkCard(ta.value, out1), text: "Check my card" })), out1),
      h("div", { class: "card" }, h("h2", { text: "Audit the whole election" }), h("p", { text: "Download the public ledger, re-hash every entry, rebuild the Merkle tree and compare it with what each candidate's witness saw." }),
        h("div", { class: "btns" }, h("button", { class: "btn primary", onclick: () => runFullAudit(out2), text: "Run full audit" })), out2),
      h("div", { class: "card" }, h("h2", { text: "Test ballot board" }), h("p", { class: "small muted", text: "Every test a voter ran. A mismatch means a device sealed a different choice than the voter selected." }), board),
      h("div", { class: "card" }, h("h2", { text: "Results" }), res));
    if (qs.get("r")) checkCard(ta.value, out1);
    try {
      const sp = (await api("/api/spoiled")).spoiled;
      board.replaceChildren(sp.length ? h("div", { class: "scroll" }, h("table", null, h("thead", null, h("tr", null, ["Time", "Fingerprint", "Voter chose", "Device sealed", "Result"].map(x => h("th", { text: x })))),
        h("tbody", null, sp.map(s => h("tr", { class: s.ok ? "" : "bad" }, h("td", { class: "nw", text: clock(s.ts) }), h("td", { class: "mono", text: short(s.ballot_fp, 12) }), h("td", { text: nameOf(s.claimed) }), h("td", { text: nameOf(s.revealed) }), h("td", { text: s.ok ? "Match" : "MISMATCH" })))))) : h("p", { class: "muted", text: "No tests yet." }));
      res.replaceChildren(resultsView(await api("/api/results")));
    } catch (e) { board.replaceChildren(notice("bad", e.message)); }
  }

  function resultsView(r) {
    if (!r.published) return h("p", { class: "muted", text: "Results appear after voting closes and two of three trustees unlock the tally." });
    const max = Math.max(1, ...Object.values(r.counts));
    return h("div", null, h("div", { class: "bars" }, cfg.election.candidates.map(c => {
      const n = r.counts[c.id] || 0, fill = h("i");
      fill.style.width = Math.round((n / max) * 100) + "%";
      return h("div", { class: "bar-row" }, h("span", { text: c.name }), h("div", { class: "bar" }, fill), h("b", { text: n }));
    })), notice(r.matches_ledger ? "ok" : "bad", r.total + " ballots decrypted for " + r.ledger_entries + " ledger entries. ", r.matches_ledger ? "The counts match." : "The counts do NOT match."),
      h("p", { class: "small muted", text: "Ballots are published in random order so the tally cannot be linked back to ledger order." }));
  }

  // =====================================================================
  // WITNESSES
  // =====================================================================
  async function renderWitnesses() {
    const list = h("div");
    view.replaceChildren(h("h1", { text: "Candidate witnesses" }),
      h("p", { text: "Each candidate's polling agent keeps their own copy of the last signed ledger head. A witness only accepts a new head if a consistency proof shows it extends the old one. If anyone rewrites history, even someone who can re-sign it, every witness raises an alarm and keeps the evidence." }),
      h("p", { class: "small muted", text: "In a real election each witness runs on the candidate's own laptop: python -m gb.witness http://server:5000. The three below run inside this demo." }), list);
    const draw = async sync => {
      try {
        const d = sync ? await api("/api/witnesses/sync", { body: {} }) : await api("/api/witnesses");
        list.replaceChildren(...d.witnesses.map(w => {
          const kind = w.status === "ok" ? "ok" : w.status === "alarm" ? "bad" : "warn";
          return h("div", { class: "card" }, h("h2", { text: w.owner }),
            h("span", { class: "pill " + kind, text: w.status === "ok" ? "Agrees with the ledger" : w.status === "alarm" ? "ALARM" : "Waiting" }),
            h("p", { text: w.message }),
            h("dl", { class: "kv small" }, h("dt", { text: "Head size" }), h("dd", { class: "mono", text: String(w.size) }), h("dt", { text: "Root" }), h("dd", { class: "mono", text: short(w.root, 32) }), h("dt", { text: "Last sync" }), h("dd", { text: clock(w.last_sync) })));
        }));
      } catch (e) { list.replaceChildren(notice("bad", e.message)); }
    };
    await draw(true);
    timer = setInterval(() => draw(true), 4000);
  }

  // =====================================================================
  // CONTROL ROOM
  // =====================================================================
  const C = { shares: {}, msg: null };

  async function renderControl() {
    let me = { admin: false };
    try { me = await api("/api/admin/me"); } catch (e) { /* treated as signed out */ }
    if (!me.admin) {
      const pw = h("input", { type: "password", id: "pw", autocomplete: "current-password" });
      const msg = h("div");
      const go = async () => { try { await api("/api/admin/login", { body: { password: pw.value } }); renderControl(); } catch (e) { msg.replaceChildren(notice("bad", e.message)); } };
      pw.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
      view.replaceChildren(h("h1", { text: "Control room" }), h("div", { class: "card" }, h("h2", { text: "Election officer sign-in" }),
        h("label", { class: "field" }, h("span", { text: "Password" }), pw), msg, h("div", { class: "btns" }, h("button", { class: "btn primary", onclick: go, text: "Sign in" })),
        cfg.demo ? h("p", { class: "small muted", text: "Demo password: glassballot-demo (change it with GB_ADMIN_PASSWORD)." }) : null));
      return;
    }
    const tiles = h("div"), dyn = h("div"), act = h("div");
    const run = (fn, ok) => async () => { act.replaceChildren(); try { const r = await fn(); if (ok) act.replaceChildren(notice("ok", ok(r))); } catch (e) { act.replaceChildren(notice("bad", e.message)); } await refresh(); await loadConfig(); controlsDrawn(); };
    let controlsHost = h("div");
    const controlsDrawn = () => controlsHost.replaceChildren(controls());

    function controls() {
      const open = cfg.state === "open", closed = cfg.state === "closed";
      const trusteeBtns = [1, 2, 3].map(n => h("button", { class: "btn", "aria-pressed": String(!!C.shares[n]),
        onclick: async () => { if (C.shares[n]) delete C.shares[n]; else C.shares[n] = await api("/api/admin/share/" + n); controlsDrawn(); },
        text: (C.shares[n] ? "\u2713 " : "") + "Trustee " + n + " (" + ["Election officer", "Faculty member", "Student representative"][n - 1] + ")" }));
      return h("div", null,
        h("div", { class: "card" }, h("h2", { text: "Election" }),
          h("div", { class: "btns" }, open ? h("button", { class: "btn", onclick: run(() => api("/api/admin/seed", { body: { n: 10 } }), r => r.added + " sample ballots added."), text: "Add 10 sample votes" }) : null,
            open ? h("button", { class: "btn", onclick: () => confirm("Close voting? Unused tokens will be voided.") && run(() => api("/api/admin/close", { body: {} }), () => "Voting closed. Final signed head published.")(), text: "Close voting" }) : null,
            h("button", { class: "btn", onclick: async () => { await api("/api/admin/logout", { body: {} }); renderControl(); }, text: "Sign out" })),
          closed ? [h("h3", { text: "Trustee ceremony: any 2 of 3 unlock the tally" }), h("div", { class: "btns" }, trusteeBtns),
            h("div", { class: "btns" }, h("button", { class: "btn primary", disabled: Object.keys(C.shares).length < 2, onclick: run(() => api("/api/admin/tally", { body: { shares: Object.values(C.shares) } }), r => "Tally published: " + r.total + " ballots."), text: "Unlock and publish tally" }))] : null),
        cfg.demo ? h("div", { class: "card" }, h("h2", { text: "Demo tools" }), h("p", { class: "small muted", text: "These simulate attackers so you can watch the system catch them. They exist only in demo mode." }),
          h("div", { class: "btns" },
            h("button", { class: "btn danger", onclick: run(() => api("/api/admin/attack", { body: { kind: "naive" } }), r => r.note + " (entry #" + r.target + ")"), text: "Insider edits one ballot in the database" }),
            h("button", { class: "btn danger", onclick: run(() => api("/api/admin/attack", { body: { kind: "rewrite" } }), r => r.note + " (from entry #" + r.target + ")"), text: "Insider rewrites history and re-signs" }),
            h("button", { class: "btn", onclick: run(() => api("/api/admin/device", { body: { on: !cfg.compromised_device } }), r => "Compromised device simulation " + (r.compromised_device ? "ON: the next sealed ballot will hold the wrong candidate." : "OFF.")), text: "Compromised voting device: " + (cfg.compromised_device ? "ON" : "OFF") }),
            h("button", { class: "btn", onclick: () => confirm("Reset everything with a new election?") && run(async () => { C.shares = {}; resetVote(); return api("/api/admin/reset", { body: {} }); }, () => "Demo reset. New election keys generated.")(), text: "Reset demo" }))) : null);
    }

    async function refresh() {
      try {
        const [st, wi, al, led, au, res] = await Promise.all([api("/api/status"), api("/api/witnesses"), api("/api/admin/alerts"), api("/api/ledger"), api("/api/admin/audit"), api("/api/results")]);
        const rec = st.reconcile, ig = st.integrity, bad = wi.witnesses.filter(w => w.status === "alarm").length;
        tiles.replaceChildren(
          h("div", { class: "tiles" },
            h("div", { class: "tile " + (rec.ok ? "ok" : "bad") }, h("div", { class: "big", text: rec.voters_marked + " = " + rec.ballots_recorded + (rec.pending ? " + " + rec.pending : "") }), h("div", { class: "lab", text: "Two Books: voters marked = ballots recorded" + (rec.pending ? " + tokens not yet used" : "") }), rec.ok ? null : h("div", { class: "small", text: rec.problems[0] })),
            h("div", { class: "tile " + (ig.ok ? "ok" : "bad") }, h("div", { class: "big", text: ig.ok ? "Chain valid" : "Broken at #" + ig.first_bad_index }), h("div", { class: "lab", text: ig.entries + " entries · root " + short(ig.root, 10) }), ig.ok ? null : h("div", { class: "small", text: ig.problems[0] })),
            h("div", { class: "tile " + (bad ? "bad" : "ok") }, h("div", { class: "big", text: bad ? bad + " of 3 ALARM" : "3 of 3 agree" }), h("div", { class: "lab", text: "Candidate witnesses" })),
            h("div", { class: "tile " + (ig.audit.ok ? "ok" : "bad") }, h("div", { class: "big", text: ig.audit.ok ? "Log intact" : "Log altered" }), h("div", { class: "lab", text: "Audit log hash chain" }))));
        fill(dyn,
          h("div", { class: "card" }, h("h2", { text: "Alerts" }), al.alerts.length ? h("div", { class: "scroll" }, h("table", null, h("thead", null, h("tr", null, ["Time", "Severity", "Kind", "Detail"].map(x => h("th", { text: x })))),
            h("tbody", null, al.alerts.slice(0, 8).map(a => h("tr", { class: a.severity === "high" ? "bad" : "" }, h("td", { class: "nw", text: clock(a.ts) }), h("td", { text: a.severity }), h("td", { class: "mono", text: a.kind }), h("td", { text: a.detail })))))) : h("p", { class: "muted", text: "No alerts." })),
          res.published ? h("div", { class: "card" }, h("h2", { text: "Results" }), resultsView(res)) : null,
          h("div", { class: "grid2" },
            h("div", { class: "card" }, h("h2", { text: "Latest ledger entries" }), h("div", { class: "scroll" }, h("table", null, h("thead", null, h("tr", null, ["#", "Entry hash", "Previous"].map(x => h("th", { text: x })))),
              h("tbody", null, led.entries.slice(-8).reverse().map(e => h("tr", null, h("td", { text: e.index }), h("td", { class: "mono", text: short(e.entry_hash, 14) }), h("td", { class: "mono", text: short(e.prev_hash, 14) }))))))),
            h("div", { class: "card" }, h("h2", { text: "Audit log" }), h("div", { class: "scroll" }, h("table", null, h("tbody", null, au.audit.slice(0, 10).map(a => h("tr", null, h("td", { class: "nw", text: clock(a.ts) }), h("td", { text: a.action }), h("td", { class: "small", text: a.detail })))))))));
      } catch (e) { tiles.replaceChildren(notice("bad", e.message)); }
    }

    controlsDrawn();
    view.replaceChildren(h("h1", { text: "Control room" }), tiles, act, controlsHost, dyn);
    await refresh();
    let lastKey = cfg.state + cfg.compromised_device;
    timer = setInterval(async () => {
      await api("/api/witnesses/sync", { body: {} }).catch(() => {}); await refresh();
      await loadConfig().catch(() => {});
      if (cfg.state + cfg.compromised_device !== lastKey) { lastKey = cfg.state + cfg.compromised_device; controlsDrawn(); }
    }, 4000);
  }

  route();
})();
