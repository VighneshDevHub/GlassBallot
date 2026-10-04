# GlassBallot

**Transparent to verify. Private to vote.**
A tamper-evident college e-voting prototype for CodeAstra 2.0 (Cybersecurity & Blockchain, PS 3).

Rival candidates become the auditors, every voter can test their own ballot, and anyone can verify the ledger in their own browser without learning how anyone voted.

> Prototype for low-stakes college elections. It has **not** had an independent security audit. Do not use it for a real election until it has.

---

## Run it (2 minutes)

```bash
pip install -r requirements.txt        # Flask + cryptography
python app.py                          # http://localhost:5000
```

- Open **http://localhost:5000** (use `localhost` or HTTPS: browsers only allow WebCrypto in a secure context).
- Demo voters: `RGIT26001` to `RGIT26040`. The one-time code appears in the on-screen **demo inbox** (a real deployment would send SMS or email).
- Control room password: `glassballot-demo`. Change it with `GB_ADMIN_PASSWORD`.
- Set `GB_DEMO=0` to turn off the demo inbox and the attack simulator.
- QR codes load a small library from cdnjs, so they need internet. Everything else works offline.

Docker: `docker build -t glassballot . && docker run -p 5000:5000 glassballot`

Tests: `python -m unittest discover -s tests` (18 tests). Browser walkthrough: see `tests/browser_test.js`.

---

## The idea: Three Locks and a Window

| | What | Where in the code |
|---|---|---|
| Lock 1: **Two Books** | An eligibility register (who voted, never what) and a sealed ballot ledger (what, never who). They must balance: voters marked = ballots recorded + tokens not yet used. Stuffing or deleting breaks the balance. | `Store.reconcile` |
| Lock 2: **Candidate Witnesses** | Each candidate's agent keeps their own copy of the last signed ledger head and accepts a new one only if an RFC 6962 consistency proof shows it extends the old one. | `gb/witness.py`, `gb/merkle.py` |
| Lock 3: **Test My Ballot** | Before casting, a voter opens a throwaway ballot to see what their device really sealed (Benaloh-style challenge). | `Store.spoil`, `GB.sealBallot` |
| Window: **Proof Card** | A receipt with a Merkle inclusion proof. Anyone can check it, in the browser, without learning the vote. | `static/app.js` (`checkCard`) |

Blockchain is used only as a **notary pattern** (append-only, publicly checkable log, as in Certificate Transparency), not as a ballot box. That matters: security researchers (for example at MIT) have shown that putting votes on a blockchain does not fix the hard problems of online voting.

## How a vote flows

1. **Sign in:** college ID plus OTP (hashed, 5-minute expiry, 5 attempts, no ID enumeration).
2. **Unlink:** the server issues a random 256-bit one-time token and keeps only its SHA-256. The session forgets the voter's identity immediately.
3. **Seal (in the browser):** ECDH P-256 to the election public key, key derived with SHA-256, AES-256-GCM, election id as associated data. Plaintext is padded to 96 bytes so ciphertext length never leaks the choice.
4. **Test or cast:** a test reveals the ballot's ephemeral key, an independent Python verifier decrypts it and compares with what the voter chose. A cast appends the ciphertext to the hash-chained ledger.
5. **Sign the head:** the Merkle root is signed (Ed25519) and every witness syncs.
6. **Close and tally:** unused tokens are voided. The election private key never exists on the server; it was split 2-of-3 with Shamir sharing at setup. Any two trustees reassemble it in memory, decrypt, and the ballots are published in random order.

## Architecture

```
Browser (lib.js + app.js)            Flask API (app.py)               SQLite (data/)
 - seals ballots (WebCrypto)  ---->   - OTP, tokens, rate limits  ---> voters  (Book A)
 - re-hashes the whole ledger         - CSRF header, CSP headers      tokens   (hashed, unlinked)
 - verifies Merkle proofs             - ballot validation             ledger   (Book B, hash-chained)
 - recomputes witness roots           - signed tree heads             sth, audit (hash-chained), alerts
                                                  |
                              gb/witness.py ------+--> witnesses.db  (separate store)
                              python -m gb.witness http://server:5000   (runs on a candidate's own laptop)
```

Modules: `gb/merkle.py` (RFC 6962/9162 proofs), `gb/crypto.py` (ECIES ballots, Shamir, Ed25519 heads), `gb/store.py` (books, ledger, checks, tally, attack simulator), `gb/witness.py`, `app.py`, `static/`.

## What the tests prove

- `tests/test_core.py`: inclusion and consistency proofs for every tree size up to 40, rewrite detection, Shamir, ballot round trips, constant ciphertext length.
- `tests/test_e2e.py`: one vote per voter, token reuse refused, OTP lockout, CSRF header required, forged tokens, naive tamper caught at the right entry, **history rewrite passes every server-side check but all witnesses raise ALARM**, ballot stuffing breaks the books, 2-of-3 tally with wrong or insufficient shares refused, audit log hash chain.
- `tests/js_compat.js` + `tests/check_js_ballot.py`: the browser's SHA-256, ledger hashing, Merkle roots and inclusion proofs match the Python server byte for byte, and a ballot sealed in the browser is accepted and opened by the server.
- `tests/browser_test.js`: a real Chromium walkthrough (16 checks) of voting, test ballots, a compromised device, both attacks, witnesses and the tally.

## Security notes and honest limits

**Defended:** insider edits and deletions, ballot stuffing, double voting, token replay, history rewrites (via witnesses), malformed ballots, CSRF, XSS (DOM built with `textContent`, strict CSP), voter-ID enumeration, OTP brute force.

**Not defended, and said openly:**
- A fully compromised voter device. Test My Ballot catches a device that seals the wrong choice, but cannot stop all malware.
- Coercion and vote selling in remote voting. The Proof Card proves inclusion, not the choice, but this is not coercion-resistant.
- Timing correlation: someone watching the server logs could correlate sign-in time with cast time. Roadmap: batching and blind-signature tokens.
- Tally correctness is checked by count (decrypted ballots = ledger entries, every ciphertext authenticates), not by zero-knowledge proofs. Roadmap: verifiable decryption proofs and a mixnet.
- The signing key lives on the server. That is exactly why witnesses exist: an insider who re-signs a rewritten history still cannot fool a witness that kept the earlier head.
- Demo conveniences (demo inbox, trustee shares stored as files, attack simulator, shipped admin password) must be removed for any real use (`GB_DEMO=0`).
- **Booth Mode** (supervised kiosk, ESP32 tamper sensor, printed Proof Card) is designed but **not built**. Say "planned" in the PPT.

## Demo script for the video (about 2.5 minutes)

1. **Dispute (0:00).** Voiceover only: Riya lost by 3 votes and nobody could prove the count.
2. **Control room (0:25).** Sign in, click **Add 10 sample votes**. Show the tiles: `10 = 10`, Chain valid, 3 of 3 agree.
3. **Vote (0:45).** Voter `RGIT26031`: send code, type it from the demo inbox, choose a candidate, **Seal my ballot**, **Test this ballot** (passes), **Seal a fresh ballot**, **Cast this ballot**.
4. **Proof (1:15).** On the Proof Card click **Check my card now**: every line turns green, including the three witnesses.
5. **Cheating device (1:35).** Control room: **Compromised voting device: ON**. Vote as `RGIT26032`, test the ballot: red "Test failed. Do not cast." Turn the switch off.
6. **The attack (1:55).** Control room: **Insider rewrites history and re-signs**. Point at the tiles: Chain valid, Log intact, but **3 of 3 ALARM**. Open **Verify** and click **Run full audit**: "Tampering detected".
7. **Close (2:20).** Tagline and roadmap.

Tip: click **Reset demo** between takes for a clean election.

## Map to the PPT

| Slide | Use from this repo |
|---|---|
| 3 Solution | `docs/screenshots/2_proof_card.png`, `4_device_caught.png` |
| 4 Tech and USP | Architecture above, `gb/` module list, "notary not ballot box" |
| 6 Supporting | `5_rewrite_alarm.png`, `7_audit_detects.png`, `6_witnesses.png`, `1_control_clean.png` |

(QR codes are blank in the screenshots because they were taken offline. Re-take them on your machine for the final deck.)

## Roadmap

Blind-signature tokens, verifiable decryption proofs and mixnet, ERP/ID integration, third-party witnesses, Booth Mode hardware, accessibility, and an independent security audit before any real use.
