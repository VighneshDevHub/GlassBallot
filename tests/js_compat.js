// Node check: browser library output must match the Python server byte for byte.
const crypto = require("crypto"), GB = require("../static/lib.js"), fs = require("fs");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } };
for (const n of [0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 200, 1000]) {
  const b = crypto.randomBytes(n);
  ok(GB.hex(GB.sha256(b)) === crypto.createHash("sha256").update(b).digest("hex"), "sha256 len " + n);
}
(async () => {
  const fx = JSON.parse(fs.readFileSync(process.argv[2]));
  // 1. JS seals a ballot; Python must open it (checked by test_js_interop.py via the JSON written here)
  const sealed = await GB.sealBallot(fx.pub, fx.eid, "ananya");
  fs.writeFileSync(process.argv[3], JSON.stringify({ ballot: sealed.ballot, eph_d: sealed.ephD }));
  // 2. JS re-hashes the Python ledger and recomputes the Merkle root
  const a = GB.auditLedger(fx.entries, fx.eid);
  ok(a.ok, "JS audit of Python ledger: " + a.problems.join(";"));
  ok(a.rootAt(fx.entries.length) === fx.root, "JS Merkle root equals Python root");
  const m = Math.floor(fx.entries.length / 2);
  ok(a.rootAt(m) === fx.mid_root, "JS prefix root equals Python prefix root");
  const p = fx.proof;
  ok(GB.verifyInclusion(GB.fromHex(p.leaf_hash), p.index, p.size, p.path.map(GB.fromHex), GB.fromHex(fx.root)), "JS verifies Python inclusion proof");
  // 3. tampered ledger is flagged at the right index
  const bad = JSON.parse(JSON.stringify(fx.entries)); bad[2].ballot.iv = bad[3].ballot.iv;
  const t = GB.auditLedger(bad, fx.eid);
  ok(!t.ok && t.firstBad === 2, "JS names tampered entry 2");
  // 4. receipts
  const r = { e: "X", i: 3, h: "ab".repeat(32), s: 9, r: "cd".repeat(32) };
  ok(JSON.stringify(GB.decodeReceipt(GB.encodeReceipt(r))) === JSON.stringify(r), "receipt roundtrip");
  ok(GB.decodeReceipt("garbage") === null, "receipt garbage rejected");
  console.log(fails ? fails + " FAILURES" : "JS compat OK");
  process.exit(fails ? 1 : 0);
})();
