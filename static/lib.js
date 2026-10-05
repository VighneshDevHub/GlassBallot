/* GlassBallot browser library: no network, no DOM. Pure functions so the same code
   runs in the page and in the Node compatibility test. */
(function (root) {
  "use strict";
  const GB = {};
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  GB.sha256 = function (data) {
    const l = data.length, padded = new Uint8Array(((l + 9 + 63) >> 6) << 6);
    padded.set(data); padded[l] = 0x80;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 8, Math.floor(l / 0x20000000));
    dv.setUint32(padded.length - 4, (l << 3) >>> 0);
    let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const w = new Uint32Array(64);
    for (let i = 0; i < padded.length; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(w[t-15],7) ^ rotr(w[t-15],18) ^ (w[t-15] >>> 3);
        const s1 = rotr(w[t-2],17) ^ rotr(w[t-2],19) ^ (w[t-2] >>> 10);
        w[t] = (w[t-16] + s0 + w[t-7] + s1) >>> 0;
      }
      let [a,b,c,d,e,f,g,hh] = h;
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25), ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
        const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22), mj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + mj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h = [h[0]+a,h[1]+b,h[2]+c,h[3]+d,h[4]+e,h[5]+f,h[6]+g,h[7]+hh].map(x => x >>> 0);
    }
    const out = new Uint8Array(32), o = new DataView(out.buffer);
    h.forEach((x, i) => o.setUint32(i * 4, x));
    return out;
  };

  const enc = new TextEncoder();
  GB.utf8 = s => enc.encode(s);
  GB.hex = u => Array.from(u, b => b.toString(16).padStart(2, "0")).join("");
  GB.fromHex = s => Uint8Array.from(s.match(/../g) || [], h => parseInt(h, 16));
  GB.b64e = u => btoa(String.fromCharCode.apply(null, u));
  GB.b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  GB.b64u = u => GB.b64e(u).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; a.forEach(x => { o.set(x, p); p += x.length; }); return o; };
  GB.cat = cat;
  GB.eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

  // ----- Merkle (RFC 6962 / 9162), identical to gb/merkle.py -----
  GB.leafHash = d => GB.sha256(cat(Uint8Array.of(0), d));
  GB.nodeHash = (l, r) => GB.sha256(cat(Uint8Array.of(1), l, r));
  const split = n => { let k = 1; while (k * 2 < n) k *= 2; return k; };
  GB.mth = function mth(hs) {
    if (hs.length === 0) return GB.sha256(new Uint8Array(0));
    if (hs.length === 1) return hs[0];
    const k = split(hs.length);
    return GB.nodeHash(mth(hs.slice(0, k)), mth(hs.slice(k)));
  };
  GB.verifyInclusion = function (leaf, index, size, path, root) {
    if (index < 0 || index >= size) return false;
    let fn = index, sn = size - 1, r = leaf;
    for (const p of path) {
      if (sn === 0) return false;
      if ((fn & 1) || fn === sn) {
        r = GB.nodeHash(p, r);
        if (!(fn & 1)) while (!(fn & 1) && fn !== 0) { fn >>= 1; sn >>= 1; }
      } else r = GB.nodeHash(r, p);
      fn >>= 1; sn >>= 1;
    }
    return sn === 0 && GB.eq(r, root);
  };

  // ----- ledger hashing, identical to Store.entry_hash -----
  GB.canonical = o => "{" + Object.keys(o).sort().map(k => JSON.stringify(k) + ":" + JSON.stringify(o[k])).join(",") + "}";
  GB.entryHash = function (idx, prevHex, ballot, tokenHashHex) {
    const i8 = new Uint8Array(8); new DataView(i8.buffer).setUint32(4, idx);
    const bh = GB.sha256(GB.utf8(GB.canonical(ballot)));
    return GB.hex(GB.sha256(cat(i8, GB.fromHex(prevHex), bh, GB.fromHex(tokenHashHex))));
  };
  GB.genesis = eid => GB.hex(GB.sha256(GB.utf8("glassballot-genesis|" + eid)));

  /* Re-checks the whole public ledger in the visitor's browser. */
  GB.auditLedger = function (entries, eid) {
    let prev = GB.genesis(eid), firstBad = null; const problems = [];
    entries.forEach(e => {
      const exp = GB.entryHash(e.index, prev, e.ballot, e.token_hash);
      if (e.prev_hash !== prev) problems.push(`Entry ${e.index}: chain link broken.`);
      else if (e.entry_hash !== exp) problems.push(`Entry ${e.index}: contents do not match their hash.`);
      else { prev = e.entry_hash; return; }
      if (firstBad === null) firstBad = e.index;
      prev = e.entry_hash;
    });
    const leaves = entries.map(e => GB.leafHash(GB.fromHex(e.entry_hash)));
    return { ok: problems.length === 0, firstBad, problems, leaves,
             rootAt: n => GB.hex(GB.mth(leaves.slice(0, n))) };
  };

  // ----- ballot sealing (WebCrypto): ECDH P-256 -> SHA-256 -> AES-256-GCM -----
  const PAD = 96;
  GB.sealBallot = async function (electionPubB64, electionId, choice) {
    const cr = root.crypto, s = cr.subtle;
    const pub = await s.importKey("raw", GB.b64d(electionPubB64), { name: "ECDH", namedCurve: "P-256" }, false, []);
    const eph = await s.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const shared = new Uint8Array(await s.deriveBits({ name: "ECDH", public: pub }, eph.privateKey, 256));
    const ephPub = new Uint8Array(await s.exportKey("raw", eph.publicKey));
    const keyBytes = GB.sha256(cat(GB.utf8("glassballot-v1"), shared, ephPub));
    const key = await s.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
    const iv = cr.getRandomValues(new Uint8Array(12));
    const nonce = GB.hex(cr.getRandomValues(new Uint8Array(8)));
    const pt = GB.utf8(JSON.stringify({ c: choice, n: nonce }).padEnd(PAD, " "));
    const ct = new Uint8Array(await s.encrypt({ name: "AES-GCM", iv, additionalData: GB.utf8(electionId) }, key, pt));
    const jwk = await s.exportKey("jwk", eph.privateKey);
    return { ballot: { v: 1, eph: GB.b64e(ephPub), iv: GB.b64e(iv), ct: GB.b64e(ct) }, ephD: jwk.d };
  };
  GB.fingerprint = ballot => GB.hex(GB.sha256(GB.utf8(GB.canonical(ballot)))).slice(0, 16).replace(/(.{4})/g, "$1 ").trim();

  // ----- receipts -----
  GB.encodeReceipt = r => "GB1." + GB.b64u(GB.utf8(JSON.stringify(r)));
  GB.decodeReceipt = function (code) {
    const m = /^GB1\.([A-Za-z0-9_-]+)$/.exec((code || "").trim());
    if (!m) return null;
    try {
      const r = JSON.parse(new TextDecoder().decode(GB.b64d(m[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(m[1].length / 4) * 4, "="))));
      return r && Number.isInteger(r.i) && /^[0-9a-f]{64}$/.test(r.h || "") ? r : null;
    } catch (e) { return null; }
  };

  if (typeof module !== "undefined") module.exports = GB; else root.GB = GB;
})(typeof window !== "undefined" ? window : globalThis);
