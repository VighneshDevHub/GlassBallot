# GlassBallot Migration Specification

**Disclaimer:** Production-quality prototype for low-stakes college/student elections. Independent security audit required before real-world deployment. NOT suitable for legally binding government elections.

---

## Problem

The existing GlassBallot prototype (`Flask + SQLite + Vanilla JS`) demonstrates correct cryptographic concepts (encrypted ballots, Merkle trees, candidate witnesses, Shamir secret sharing, inclusion/consistency proofs, test ballots, proof cards, reconciliation, tamper detection) but is architecturally limited:

- Single-file Flask app mixes HTTP, business logic, and persistence
- SQLite is not suitable for concurrent production workloads
- No role-based access control beyond a single admin password
- Rate limiting is in-memory only (no Redis)
- Vanilla JS frontend with manual DOM management
- No async I/O
- Witnesses use a separate SQLite file instead of the main database

The codebase already has a partial FastAPI skeleton started in `backend/` with PostgreSQL models, enums, and service adapters wrapping the legacy `gb/` crypto modules.

## Users

| User                      | Goals                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Voter                     | Authenticate with college ID + OTP, test ballot integrity (Test My Ballot), cast encrypted vote, receive Proof Card, verify inclusion publicly |
| Candidate / Polling Agent | Operate independent witness, monitor ledger consistency, receive ALARM on history rewrite                                                      |
| Election Admin            | Create/manage elections, monitor integrity, close election, view audit log, manage trustees                                                    |
| Trustees (3)              | Provide Shamir shares for 2-of-3 threshold tally decryption                                                                                    |
| Public Verifier           | Verify individual ballot inclusion + Merkle proofs + signed tree heads + witness agreement without learning vote content or voter identity     |

## Goals

1. Migrate the application to the target modern full-stack architecture while **preserving existing cryptographic logic and tests unchanged**
2. Separate domain logic, cryptography, persistence, HTTP, and UI into clean layers
3. Implement the complete voter journey, integrity engine, witness system, tamper demo, and trustee tally
4. Implement PostgreSQL transactional voting with atomic vote casting
5. Implement Redis rate limiting, secure cookies, Argon2id admin auth, and OTP voter auth
6. Provide a premium Next.js App Router frontend with the required UI pages
7. Dockerize with docker-compose for all services
8. Seed demo data for the "Student Council President 2026" election with 40 voters

## Non-Goals

- Kubernetes, Kafka, microservices, or service mesh
- Real ERP/college ID system integration
- Booth mode hardware or ESP32 integration
- Blind signature tokens, mixnets, or zero-knowledge proofs (roadmap only)
- Real SMS/email OTP delivery (development inbox only for demo)
- Independent security audit (documented as required, not performed)
- Use for legally binding government elections (explicitly disclaimed)

---

## Functional Requirements (FR)

### FR1 — Cryptographic Preservation

- The `gb/crypto.py`, `gb/merkle.py`, `gb/witness.py` modules must be preserved as the cryptographic source of truth (not rewritten)
- Backend services must adapt/wrap these modules rather than reimplementing algorithms
- All existing tests (`tests/test_core.py`, `tests/test_e2e.py`) must continue to pass against the legacy Flask app
- Additional FastAPI-level tests must cover the same properties independently

### FR2 — PostgreSQL & Data Model

- All entities from `backend/app/models/entities.py` must be materialized with Alembic migrations
- Key uniqueness constraints: `UNIQUE(election_id, voter_external_id)`, `UNIQUE(election_id, ledger_index)`, `UNIQUE(token_hash)`, `UNIQUE(entry_hash)`, `UNIQUE(event_hash)`
- UTC timezone-aware timestamps everywhere
- No plaintext passwords, OTPs, votes, or identity-to-ballot mappings stored
- Vote casting must be a single database transaction atomically performing: token validation + ballot validation + ledger append + token mark-used + Merkle state + audit event (all-or-nothing rollback)

### FR3 — Authentication & RBAC

- **Voter auth:** College voter_external_id → 6-digit OTP (hashed, 5-min expiry, 5 attempt max, no enumeration) → short-lived session → one-time 256-bit voting token → identity dropped from session after token issue
- **Admin auth:** Username/email + Argon2id password hash → secure HttpOnly SameSite=Strict session cookie → RBAC
- **Roles:** SUPER_ADMIN, ELECTION_ADMIN, ELECTION_OFFICER, FACULTY_TRUSTEE, STUDENT_TRUSTEE, POLLING_AGENT, VOTER
- Every sensitive API endpoint performs server-side authorization
- OTP demo inbox exposed ONLY when `APP_ENV=development AND DEMO_MODE=true`

### FR4 — Rate Limiting

- Redis-backed rate limiting on: OTP requests, OTP verification, admin login, token generation, ballot casting, public verification, demo endpoints
- Frontend restrictions are UX-only, not security controls

### FR5 — Voting Flow

1. Voter enters ID → requests OTP → enters OTP → receives one-time token
2. Voter selects candidate → seals ballot in-browser via WebCrypto (ECDH P-256 → SHA-256 KDF → AES-256-GCM, election_id as AAD, 96-byte padded plaintext)
3. **Test My Ballot (Lock 3):** Voter may spoil a test ballot revealing the ephemeral key → server decrypts and matches claimed choice → if mismatch: "TEST FAILED — DO NOT CAST", creates DEVICE_MISMATCH security alert
4. Spoiled test ballot excluded from tally; fresh ballot required for real cast
5. Real ballot cast → atomic ledger append → signed tree head → witness sync → Proof Card returned

### FR6 — Two Books Reconciliation (Lock 1)

- **Book A (Eligibility):** voters table — who was issued a token / marked as voted — never stores candidate choice
- **Book B (Sealed Ballot Ledger):** sealed_ballots table — encrypted ballots + hash chain + Merkle — never stores voter identity
- ReconciliationService verifies: voters_marked = tokens_issued + tokens_used + tokens_void AND ballots_recorded = tokens_used AND no duplicate tokens AND no unissued tokens in ledger
- Detects: ballot stuffing, deleted ballots, duplicate tokens, unissued tokens, inconsistencies

### FR7 — Merkle Tree & Signed Tree Heads

- RFC 6962/9162 inclusion proofs and consistency proofs via `gb/merkle.py`
- Leaf hashing: `0x00 || entry_hash_bytes`; node hashing: `0x01 || left || right`
- Signed Tree Head (STH): Ed25519 signature over canonical JSON of `{v, election, size, root, ts}`
- Public verifier independently validates signature
- Tests for tree sizes: 1, 2, 3, 4, 5, 10, 100, 1000 and malformed proof rejection

### FR8 — Candidate Witnesses (Lock 2)

- Each election has ≥1 witness per candidate; each witness tracks last accepted tree head independently
- Witness states: WAITING, SYNCED, ALARM, OFFLINE
- Sync protocol: fetch STH → verify Ed25519 sig → if first head: accept → if smaller size or same-size-different-root: ALARM → else request consistency proof(m,n) → if verify: update head else: ALARM
- Alarms are STICKY: never silently cleared; evidence stored permanently in witness_observations
- Witness Dashboard shows: owner, last accepted size, current size, last/current root, sig status, consistency status, last sync, alarm status, evidence

### FR9 — Integrity Engine

- IntegrityService runs 10 checks:
  1. Hash chain (sealed_ballots.prev_hash chain)
  2. Merkle root vs ledger leaves
  3. Signed tree head signature + root match
  4. Witness consistency (no ALARM among active witnesses)
  5. Audit chain hash chain
  6. Voter/token reconciliation
  7. Duplicate token detection
  8. Ledger sequence continuity (no gaps in ledger_index)
  9. Ballot structural validation (validate_ballot on every entry)
  10. Election state machine validity
- Returns: `VERIFIED` or `COMPROMISED` with per-check pass/fail and first_failed details
- On COMPROMISED: election transitions to FROZEN state, evidence bundle created, security alert raised

### FR10 — Audit Chain

- Append-only audit_events table: each event has prev_hash + event_hash over canonical serialization
- `GET /api/v1/admin/audit/verify` recomputes the full chain; returns first affected event if integrity fails
- Never log: passwords, OTPs, private keys, secret shares, plaintext votes, session cookies
- Event types: ELECTION_CREATED, OTP_SENT, OTP_FAIL, LOGIN_OK, VOTER_MARKED, BALLOT_CAST, TEST_BALLOT, DEVICE_MISMATCH, ELECTION_CLOSED, TALLY_REJECTED, TALLIED, ADMIN_LOGIN, ADMIN_LOGIN_FAIL, DB_EDIT, DB_REWRITE, FROZEN, etc.

### FR11 — Election State Machine

- States: DRAFT → OPEN → CLOSING → CLOSED → TALLYING → COMPLETED ; FROZEN (from any state on integrity failure)
- Server-only transitions; frontend cannot force arbitrary state changes
- Voting only accepted in OPEN state
- Tally only initiated from CLOSED state
- FROZEN prevents voting, tallying, and state changes except by SUPER_ADMIN with audit logging

### FR12 — Trustee Tally (2-of-3 Shamir)

- 3 trustees: Election Officer, Faculty Member, Student Representative
- Election private key split 2-of-3 via Shamir at election creation; each share encrypted-at-rest
- Tally session: requires 2 separate trustee authenticated approvals
- Key reconstruction happens ONLY IN MEMORY; reconstructed private key never persisted
- Decrypt all ballots; validate each plaintext candidate choice
- Shuffle decrypted choices randomly before publish (break ledger order link)
- Publish: per-candidate totals, valid ballot count, spoiled test ballot count, integrity metadata, witness status, Merkle root
- Never expose individual plaintext ballots via API

### FR13 — Tamper Demo Center (DEMO_MODE only)

- Scenarios: MODIFY_BALLOT (naive bit flip), DELETE_BALLOT, REORDER_LEDGER, CHANGE_TOKEN_HASH, MODIFY_AUDIT_EVENT, REWRITE_MERKLE_ROOT (rewrite hash chain + re-sign STH), SIMULATE_COMPROMISED_DEVICE (seal wrong choice then Test My Ballot catches), DUPLICATE_TOKEN
- Flow: BEFORE → Integrity VERIFIED → ATTACK (controlled modification) → AFTER → Integrity COMPROMISED (show failed checks + affected record + old/new hash + witness evidence + audit event) + election FROZEN + evidence bundle
- Reset demo endpoint to restore clean state
- All demo endpoints guarded by DEMO_MODE=true config flag

### FR14 — Proof Card & Public Verification

- After cast, voter receives Proof Card containing: election_id, ledger_index, ballot_fingerprint/entry_hash, tree_size, merkle_root, verification_url, timestamp
- Proof Card MUST NOT contain: voter name, voter ID, candidate choice, identity-to-ballot mapping
- Public `/verify/[id]` page fetches inclusion proof, verifies: ballot included, Merkle proof valid, STH signature valid, witness agreement
- Verification returns VERIFIED without disclosing voter identity or vote content

### FR15 — Next.js Frontend

- App Router + TypeScript strict mode; avoid unnecessary `use client`; prefer server components
- Pages:
  - `/` (Landing): tagline, Three Locks explanation, Proof Card explainer, Witnesses explainer, IDENTITY≠BALLOT≠RESULT visual
  - `/vote`: full voter flow (ID → OTP → eligibility → candidate select → Test My Ballot → fresh ballot → cast → Proof Card)
  - `/test-ballot`: dedicated test ballot flow
  - `/proof/[id]`: Proof Card display with QR
  - `/verify/[id]`: public verification page with per-check green/red status
  - `/results`: published election results
  - `/integrity`: integrity dashboard with all 10 checks + visual chain diagram (Eligibility → Token → Sealed Ballot → Hash Chain → Merkle Root → STH → Witnesses → Public Verify)
  - `/witnesses`: witness dashboard
  - `/admin/*`: Overview, Elections, Voters, Ballots, Witnesses, Integrity, Audit, Trustees, Results, Reports, Demo Center
- UI library: Tailwind + shadcn/ui + Lucide React + Recharts
- Validation: React Hook Form + Zod
- Color system: deep navy, warm white, teal, blue; green only for VERIFIED/pass; red only for FAILURES/alarm
- Font: Inter/Geist/Manrope
- No cyberpunk/neon/crypto imagery; calm, professional, enterprise cybersecurity aesthetic
- Mobile/tablet/desktop responsive; keyboard accessible

### FR16 — Docker & Infrastructure

- docker-compose services: frontend, backend, postgres, redis, worker (celery), minio, nginx
- `.env.example` with all variables
- PostgreSQL 16+, Redis, MinIO for reports/evidence bundles
- Health checks: `/health/live`, `/health/ready` (PostgreSQL + Redis ping)
- Non-root containers where practical
- PostgreSQL is the **authoritative** store; Redis NEVER stores ballot ledger

### FR17 — Observability & Logging

- Structured JSON logs with request IDs
- Never log sensitive voting/cryptographic data
- `/health/live` and `/health/ready` endpoints

### FR18 — Demo Data Seeding

- Election: "Student Council President 2026"
- Candidates: Riya Menon (Campus infrastructure), Kabir Shah (Clubs and events), Ananya Iyer (Academic support), None of the above
- 40 fictional voters with IDs RGIT26001–RGIT26040 and random Indian names
- 3 trustees with proper roles
- 3 candidate witnesses (one per named candidate)

---

## Non-Functional Requirements (NFR)

### NFR1 — Security

- AES-256-GCM for ballot encryption; ECDH/P-256 key agreement; SHA-256 hashing; Ed25519 STH signing; Shamir 2-of-3; Argon2id for admin passwords
- CSRF protection on state-changing endpoints
- Secure HttpOnly SameSite=Strict cookies; no sensitive tokens in localStorage
- All cryptographic inputs validated (keys, ciphertext, IVs/nonces, signatures, proofs, tokens)
- Canonical serialization (sorted keys, compact JSON) before every hash/sign operation

### NFR2 — Layered Architecture

- Routes thin → services contain business logic → repositories contain database queries
- `/api/v1/` prefix everywhere
- Consistent JSON envelope with request_id

### NFR3 — Testing

- Backend unit tests: crypto, Merkle, Shamir, tokens, OTP, reconciliation, audit, integrity, witness, state transitions
- Backend integration tests: PostgreSQL, FastAPI auth flow, vote flow, verification, witness, tally
- Security tests: double vote, token replay, OTP brute force, invalid ciphertext, modified ballot, deleted ballot, duplicate token, ledger rewrite, Merkle mismatch, witness mismatch, audit tampering, unauthorized API, rate limiting, IDOR, CSRF
- Use pytest, httpx, hypothesis (for Merkle/hash-chain property tests)
- Existing legacy tests must continue passing unchanged

### NFR4 — Code Quality

- Ruff + mypy for Python
- ESLint + TypeScript strict mode for TS/Next.js
- No `any` type in TypeScript without explicit justification

---

## Constraints & Dependencies

- **Preserve `gb/` modules:** Cryptographic logic in `gb/crypto.py`, `gb/merkle.py`, `gb/witness.py`, `gb/store.py` must not be altered in ways that break existing tests. New backend adapts these.
- **Technology stack lock-in:** No substitutions from the specified stack (FastAPI, Next.js App Router, PostgreSQL 16, Redis, Celery, SQLAlchemy 2 async, Alembic, Tailwind, shadcn/ui, cryptography library, pytest/hypothesis, httpx, Vitest, Playwright).
- **DB is authoritative:** Redis may cache but never be the source of truth for ballots or election state.
- **DEMO_MODE guard:** All tamper/attack endpoints and demo OTP inbox require `DEMO_MODE=true`.

## Assumptions

1. Development mode demo OTP inbox is acceptable for prototype demonstration; production SMS/email integration is out of scope.
2. Trustee key shares may be stored encrypted in DB for the prototype (rather than HSMs); documentation will flag this for production.
3. Witnesses run in-process for the demo (as in the original prototype); remote HTTP witness CLI (`python -m gb.witness`) protocol preserved via adapter pattern.
4. MinIO may be skipped for local development evidence storage (filesystem fallback acceptable), but docker-compose must include it.

## Open Questions

_None at this time — scope is bounded by "complete prototype demo of all core concepts" per the original brief._

---

## Acceptance Criteria

### Rule ACs (Binary Pass/Fail)

| ID   | Criterion                                                                                                                                                                                          | Evidence                                                                                                          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| AC1  | `gb/crypto.py`, `gb/merkle.py`, `gb/witness.py` are unmodified except for non-breaking additions; existing `tests/test_core.py` and `tests/test_e2e.py` pass when run against the legacy Flask app | `python -m unittest discover -s tests` output showing all tests pass                                              |
| AC2  | PostgreSQL tables created via Alembic migration match `backend/app/models/entities.py` with stated uniqueness constraints; `alembic upgrade head` succeeds on empty DB                             | Migration files present + test DB migration run output                                                            |
| AC3  | A vote transaction atomically validates token, validates ballot, appends to ledger, marks token used, computes entry hash, and creates audit event — all roll back on any failure                  | Integration test showing partial failure leaves no partial state                                                  |
| AC4  | OTP request returns identical response for valid and invalid voter IDs (no enumeration); OTP hashed (not plaintext); 5 wrong attempts locks out challenge                                          | API test comparing responses, DB inspection showing only hash                                                     |
| AC5  | Test My Ballot: server decrypts with revealed ephemeral key, confirms/rejects match, spoiled ballot excluded from tally, DEVICE_MISMATCH alert created on mismatch                                 | End-to-end test covering both match and mismatch paths                                                            |
| AC6  | Merkle inclusion proofs verified independently at sizes 1–1000+; consistency proofs detect a rewritten subtree; malformed proof inputs rejected                                                    | Hypothesis property test + fixed-size tests                                                                       |
| AC7  | Witness enters ALARM and evidence is preserved when: log shrinks, same-size-different-root, consistency proof fails. Alarm state never silently cleared.                                           | Tests for all three rewrite scenarios                                                                             |
| AC8  | Rewrite-history attack (naive ballot edit, hash-chain repair + resign STH) passes local integrity checks but ALL witnesses raise ALARM                                                             | Direct port of `test_e2e.test_rewrite_passes_server_checks_but_witnesses_raise_alarm` to FastAPI integration test |
| AC9  | Reconciliation detects: extra ballots (stuffing), missing ballots (deletion), duplicate tokens, unissued tokens in ledger                                                                          | 4 separate integration tests                                                                                      |
| AC10 | Tally requires 2-of-3 distinct trustee shares; 1 share rejected; bad shares rejected; reconstructed key matches election_pub; decrypted ballot shuffled order published                            | Integration test                                                                                                  |
| AC11 | Audit event chain: modifying any single audit event causes `audit/verify` to return FAILED at that event's id                                                                                      | Integration test                                                                                                  |
| AC12 | Integrity Engine runs all 10 checks; on COMPROMISED: election state → FROZEN, evidence bundle created, security alert logged; FROZEN rejects new votes                                             | Integration test covering the transition                                                                          |
| AC13 | Demo attack endpoints 403 when DEMO_MODE=false                                                                                                                                                     | Test with env override                                                                                            |
| AC14 | Public verification page: includes inclusion proof + STH sig check + witness agreement; never shows voter name/ID/candidate choice                                                                 | API response inspection + frontend DOM test                                                                       |
| AC15 | Rate limiting: OTP request >N/min returns 429 via Redis limiter                                                                                                                                    | Redis-backed integration test                                                                                     |
| AC16 | Admin endpoints 401 without cookie auth; 403 when role insufficient                                                                                                                                | Role matrix test                                                                                                  |
| AC17 | CSRF header required on state-changing endpoints; CSRF missing returns 403                                                                                                                         | Middleware test                                                                                                   |
| AC18 | docker-compose up brings up frontend, backend, postgres, redis, minio, nginx; /health/ready returns ok                                                                                             | Compose up + readiness probe                                                                                      |
| AC19 | Next.js frontend has all required pages (/ /vote /proof/[id] /verify/[id] /results /integrity /witnesses /admin/\*) and renders without runtime errors                                             | Build output + Playwright smoke test                                                                              |
| AC20 | Sealed ballot ledger in PostgreSQL and Redis rate limiter: Redis contains NO ballot data or voter identity data after a complete voting flow                                                       | Redis KEYS inspection after test                                                                                  |

### Rubric ACs (Evaluative)

| ID  | Dimension                            | Scale                                                                                                                                              | Threshold | Evidence                                       |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------- |
| R1  | Architecture layering fidelity       | 0-2 (0=routes have SQL inline, 1=thin routes+services but mixed persistence, 2=routes→services→repos clean separation with no layer violations)    | ≥2        | Manual code inspection across 3+ API endpoints |
| R2  | Frontend design quality              | 0-2 (0=unusable, 1=functional but plain, 2=professional premium cybersecurity aesthetic matching brief)                                            | ≥1        | Screenshots of landing, integrity, admin pages |
| R3  | Test coverage of security properties | 0-2 (0=happy path only, 1=key security tests present, 2=all AC Rule security tests implemented + passing with hypothesis property tests)           | ≥1        | pytest output + hypothesis runs                |
| R4  | Crypto preservation discipline       | 0-2 (0=algorithms rewritten from scratch, 1=gb/ modified in breaking ways, 2=gb/ preserved verbatim as source of truth with adapter wrappers only) | ≥2        | Diff of gb/\*.py against original baseline     |
| R5  | Responsiveness & accessibility       | 0-2 (0=broken on mobile, 1=works on desktop only, 2=mobile/tablet/desktop responsive + keyboard navigation works)                                  | ≥1        | Playwright responsive screenshots              |
| R6  | End-to-end demo completeness         | 0-2 (0=broken demo flow, 1=vote+verify works, 2=vote→proof→verify→attack→detect→freeze→evidence complete story works)                              | ≥1        | Full demo script execution recording or test   |
