# GlassBallot Migration — Implementation Tasks

**Spec:** `.trae/specs/glassballot-migration/spec.md`
**Baseline:** Existing `gb/` crypto modules + partial FastAPI skeleton + SQLite Flask prototype

### Task Priorities Legend: H=high, M=medium, L=low

### Status: pending | in_progress | blocked | completed | cancelled

---

## Phase 1: Foundation & Infrastructure

### Task 1: Backend project scaffolding & dependency management

**Status:** completed | **Priority:** H | **Depends on:** — | **Covers:** R1

- Create `backend/requirements.txt` / `pyproject.toml` with: fastapi[all], uvicorn[standard], sqlalchemy[asyncio]>=2.0, asyncpg, alembic, pydantic>=2.0, pydantic-settings, cryptography>=42.0, redis[hiredis], celery, argon2-cffi, python-multipart, httpx, pytest, pytest-asyncio, pytest-cov, hypothesis, ruff, mypy, python-dotenv
- Create `backend/README.txt` with dev setup instructions
- Ensure `backend/app` package is on PYTHONPATH so `from app.x import y` works
- Verify the legacy `gb/` package is importable from both test suites and backend services

**Test Requirements:**

- (rule) `pip install -r backend/requirements.txt` succeeds in a clean venv
- (rule) `python -c "from app.main import app; from gb import crypto, merkle, witness, store"` succeeds

**Completion Evidence:**
- `backend/requirements.txt` exists and was used for the compatibility baseline
- Legacy + backend import compatibility was restored via the shim in `backend/app/__init__.py`
- `pytest -q` passes: 20 tests passed in 8.47s

---

### Task 2: Core modules completion (exceptions, logging, security, deps, full schemas directory)

**Status:** completed | **Priority:** H | **Depends on:** Task 1 | **Covers:** AC15, AC16, AC17, NFR1, NFR2

- `backend/app/core/exceptions.py`: GlassBallotError base class + typed subclasses (AuthError, InvalidTokenError, MalformedBallotError, StateTransitionError, IntegrityFailureError, DemoDisabledError, etc.) with HTTP status codes
- `backend/app/core/logging.py`: Structured JSON log formatter + request_id injection; `configure_logging()` function; utility `get_logger(name)`; blacklist fields that must never be logged (`password`, `otp`, `secret`, `share`, `plaintext`, `cookie`, `ballot_plaintext`)
- `backend/app/core/security.py`: Argon2id password hashing (`hash_password`, `verify_password`), HTTP-only session cookie helpers, CSRF token generation/validation, constant-time comparison wrappers
- `backend/app/api/deps.py`: `get_db` session dependency, `get_current_user` (admin cookie auth), `require_roles(*roles)` dependency, `get_current_voter_session` (voter OTP session), `require_demo_mode` guard dependency, `rate_limit(key, n, per_sec)` dependency using Redis
- Populate `backend/app/schemas/` with Pydantic v2 request/response models for all endpoints (auth, elections, voting, ballots, verification, witnesses, integrity, admin, trustees, reports, demo). Split schemas by domain.

**Test Requirements:**

- (rule) Argon2id hash round-trips: `verify_password(pw, hash_password(pw)) == True`; wrong pw returns False
- (rule) CSRF validation: missing `X-Requested-With: glassballot` header on POST/PUT/DELETE returns 403
- (rule) `require_demo_mode` raises 403 when `settings.demo_mode == False` (AC13)
- (rule) Rate limiter with Redis: >N calls within window returns 429 (AC15)
- (rubric, 0-2, ≥1) Schema completeness: all API surfaces have typed request + response models (0=no schemas, 1=half, 2=every endpoint fully typed)

**Completion Evidence:**

---

### Task 3: Alembic setup + initial migration of all PostgreSQL entities

**Status:** completed | **Priority:** H | **Depends on:** Task 2 | **Covers:** AC2

- `backend/alembic.ini` + `backend/alembic/` directory structure with `env.py` configured for async SQLAlchemy
- First migration file creates all tables from `backend/app/models/entities.py` including:
  - Enums: election_state, token_status, witness_status, witness_observation_status, integrity_status, tally_session_status
  - Tables: users, roles, user_roles, elections, election_candidates, voters, otp_challenges, voter_auth_attempts, ballot_tokens, sealed_ballots, merkle_tree_heads, witnesses, witness_observations, spoiled_test_ballots, trustees, trustee_key_shares, tally_sessions, tally_results, audit_events, security_alerts, integrity_checks, evidence_bundles, demo_scenarios
  - All uniqueness constraints + indexes explicitly named matching `NAMING_CONVENTION`
- Seed migration or bootstrap service that inserts RBAC roles: SUPER_ADMIN, ELECTION_ADMIN, ELECTION_OFFICER, FACULTY_TRUSTEE, STUDENT_TRUSTEE, POLLING_AGENT, VOTER

**Test Requirements:**

- (rule) `alembic upgrade head` succeeds on empty PostgreSQL
- (rule) `alembic downgrade base` succeeds
- (rule) After upgrade, information_schema confirms UNIQUE constraints on:
  - (election_id, voter_external_id) voters
  - (election_id, ledger_index) sealed_ballots
  - (token_hash) ballot_tokens
  - (entry_hash) sealed_ballots
  - (event_hash) audit_events

**Completion Evidence:**

---

### Task 4: Docker Compose, environment, health checks, nginx config

**Status:** pending | **Priority:** H | **Depends on:** Task 1 | **Covers:** AC18

- `.env.example` with all required variables: APP_ENV, DEBUG, SECRET_KEY, SESSION_SECRET, DATABASE_URL, REDIS_URL, CORS_ORIGINS, MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET_REPORTS, DEMO_MODE, OTP_PROVIDER, LOG_LEVEL, GB_ADMIN_PASSWORD
- `docker-compose.yml` services:
  - **postgres**: image postgres:16-alpine, healthcheck `pg_isready`, persistent volume
  - **redis**: image redis:7-alpine, healthcheck `redis-cli ping`
  - **minio**: image minio/minio, healthcheck, create reports bucket on startup
  - **backend**: Dockerfile for FastAPI uvicorn server, depends on postgres + redis, runs `alembic upgrade head` before uvicorn, health endpoint
  - **worker**: same backend image running celery worker
  - **frontend**: Next.js Dockerfile (node:20-alpine build stage → runner)
  - **nginx**: image nginx:alpine, reverse-proxies frontend (/) + backend (/api), port 80 exposed
- Backend `Dockerfile`: python:3.12-slim, non-root user, copies requirements then code, EXPOSE 8000
- Nginx `default.conf`: CORS headers, large client body buffer, passes X-Request-ID
- `backend/start.sh` entrypoint: wait-for postgres → alembic upgrade head → run uvicorn

**Test Requirements:**

- (rule) `docker compose up -d --build` completes without error
- (rule) After startup, `GET http://localhost:80/api/v1/health/ready` returns `status: "ok"` with postgres and redis both ok (AC18)
- (rule) `GET http://localhost/` serves Next.js frontend

**Completion Evidence:**

---

## Phase 2: Core Repositories & Domain Services

### Task 5: Repository layer (CRUD for all entities)

**Status:** pending | **Priority:** H | **Depends on:** Task 3 | **Covers:** R1

- Create `backend/app/repositories/` with a repository per domain:
  - `election_repo.py`: create/get/update_state election, list candidates, add candidate
  - `voter_repo.py`: get_by_external_id, list_eligible, mark_token_issued, mark_voted
  - `otp_repo.py`: upsert_challenge, get_active, increment_attempts, consume
  - `token_repo.py`: create_issued, mark_used, void_unused, get_by_hash
  - `ballot_repo.py`: append_ballot (atomic with token), get_by_index, get_ledger_range, get_leaf_hashes_up_to, genesis_hash, entry_hash
  - `sth_repo.py`: publish_sth, get_latest, get_all, get_by_size
  - `witness_repo.py`: upsert_witness_state, get_all_for_election, insert_observation
  - `spoiled_repo.py`: record_spoiled_test_ballot, list_recent
  - `trustee_repo.py`: create_trustee_for_election, get_by_role, list
  - `tally_repo.py`: create_session, add_approval, record_results, get_published
  - `audit_repo.py`: append_event, verify_chain, list_recent
  - `alert_repo.py`: create_alert, list_active, resolve
  - `integrity_repo.py`: save_check_result, latest_for_election
  - `evidence_repo.py`: create_bundle, get_by_id, store_content (with MinIO fallback to fs)
  - `admin_repo.py`: user CRUD + role assignments, authenticate_user
- Base `Repository` class with `db: AsyncSession` dependency
- **Strict rule:** repositories contain only SQLAlchemy queries; no business logic; no crypto

**Test Requirements:**

- (rule) `ballot_repo.append_ballot` uses a transaction and row-locking `SELECT ... FOR UPDATE` on the token row to prevent double-cast races
- (rule) `audit_repo.append_event` correctly computes prev_hash from the last event's hash (or zero-hash genesis) and stores the event_hash
- (rubric, 0-2, ≥1) Repository completeness and test coverage (0=empty, 1=50% of repos covered with a happy-path test, 2=all repos have CRUD tests including error paths)

**Completion Evidence:**

---

### Task 6: Election setup & demo data seeding service

**Status:** pending | **Priority:** H | **Depends on:** Task 5 | **Covers:** AC2, FR18

- `ElectionSetupService`:
  1. Generate Ed25519 STH signing keypair (store priv in a secure location)
  2. Generate election P-256 keypair via CryptoService wrapping `gb/crypto.gen_election_key`
  3. Shamir split private scalar 2-of-3 → create Trustee + TrusteeKeyShare rows
  4. Insert 4 candidates (Riya, Kabir, Ananya, NOTA)
  5. Insert 40 voters: `RGIT26001`–`RGIT26040` with random Indian names (same FIRST/LAST lists as legacy)
  6. Insert 3 candidate witnesses (Riya/Kabir/Ananya polling agents)
  7. Create 3 trustee users (election_officer / faculty / student_rep) with proper roles + Argon2 password hashes
- `DemoSeedService.seed_sample_votes(n: int)`: generate n sample encrypted ballots using crypto service; full flow: issue_token → encrypt_ballot → cast
- Admin bootstrap: ensure SUPER_ADMIN user exists with password from `GB_ADMIN_PASSWORD` env var on first run
- Register all this as a startup event or CLI command `python -m app.cli bootstrap-demo`

**Test Requirements:**

- (rule) After bootstrap, elections row count = 1, voters = 40, candidates = 4, trustees = 3, witnesses = 3
- (rule) election_pub stored matches `pub_from_secret(shamir_combine(any 2 shares))` (verifies correct Shamir round-trip)
- (rule) `seed_sample_votes(10)` results in reconciliation ok: 10 marked = 10 ballots recorded + 0 pending (FR5/FR6 baseline)

**Completion Evidence:**

---

### Task 7: MerkleService + STH signing (independent & correct)

**Status:** pending | **Priority:** H | **Depends on:** Task 5 | **Covers:** AC6, AC7

- Enhance `MerkleService` to work with BallotRepo leaf hashes (wraps `gb/merkle.py` unmodified)
- `compute_root_for_size(size)` → root hex
- `build_inclusion_proof(index, size)` → leaf_hash_hex + path_hex_list + size (validates against root)
- `build_consistency_proof(old_size, new_size)` → path_hex_list
- Enhance CryptoService to load/generate the Ed25519 STH signing key (similar to legacy `Signer` class but adapted for service use; key not stored in DB field — use key file or environment variable for now)
- `sign_tree_head(election_id, size, root_hex, ts)` → signature_b64
- `verify_tree_head_sig(sth_public_key_b64, sth_message_bytes, sig_b64)` → bool (wraps existing `verify_sig`)
- Integration tests: inclusion + consistency for sizes 1–20 explicitly; property-based test (hypothesis) for sizes 1–500

**Test Requirements:**

- (rule) For every size N in {1,2,3,4,5,10,100,1000}: for every index 0..N-1: `verify_inclusion(leaf, idx, N, path, root) == True` (AC6)
- (rule) Rewriting a leaf and then calling `verify_consistency(old_size, new_size, old_root, new_root, path)` returns False (AC6)
- (rule) An STH signed with `sign_tree_head` passes `verify_tree_head_sig` with the correct pubkey and fails with a different pubkey or a tampered size/root
- (rubric, 0-2, ≥1) Hypothesis property tests coverage: (0=no, 1=merkle inclusion only, 2=inclusion + consistency both)

**Completion Evidence:**

---

### Task 8: WitnessService + sync protocol (PostgreSQL-backed, sticky alarms)

**Status:** pending | **Priority:** H | **Depends on:** Task 7 | **Covers:** AC7, AC8

- Witness service that re-implements `gb/witness.py` sync semantics but against PostgreSQL repositories (keeping `gb/witness.py` unmodified for the legacy CLI)
- Sync flow:
  a. If witness status == ALARM already → only update last_synced_at; keep alarm (STICKY)
  b. Fetch latest STH
  c. Verify Ed25519 signature on STH → invalid sig → ALARM
  d. If first sync (size 0 root empty) → accept
  e. If new_size < old_size → ALARM (shrink)
  f. If new_size == old_size → if root same: ok; else: ALARM (rewrite)
  g. Else: request consistency proof(m,n); if verify: accept new head; else: ALARM
- Every sync result inserted as `witness_observations` row; ALARM rows link to an evidence bundle
- Witness alarm transition automatically creates a HIGH severity SecurityAlert + triggers integrity check

**Test Requirements:**

- (rule) 3 tests covering AC7 scenarios: shrink → ALARM; same-size-different-root → ALARM; consistency proof fails → ALARM
- (rule) After ALARM, three subsequent "honest" sync calls do not change status back to SYNCED (stickiness)
- (rule) End-to-end: seed 8 honest votes → sync all 3 witnesses (all SYNCED at size 8) → perform hash-chain rewrite attack equivalent to legacy `store.attack("rewrite")` using repositories → resync witnesses → **all 3 are ALARM** even though local integrity (without witnesses) returns ok (AC8)

**Completion Evidence:**

---

### Task 9: Integrity Engine (10 checks)

**Status:** pending | **Priority:** H | **Depends on:** Task 8 | **Covers:** AC9, AC10, AC11, AC12

- `IntegrityService.run_full_check(election_id)`:
  1. `check_hash_chain`: walk sealed_ballots in idx order → prev_hash matches, entry_hash recomputed matches
  2. `check_merkle_root`: compute MTH of all leaf hashes vs latest STH root
  3. `check_signed_heads`: for every STH row, verify signature AND verify root matches ledger at that size
  4. `check_witnesses`: query latest observations for each witness; any ALARM → fail; also count SYNCED vs WAITING
  5. `check_audit_chain`: walk audit_events; recompute each event_hash and prev_hash link
  6. `check_reconciliation`: exactly ReconciliationService output; each problem = fail
  7. `check_duplicate_tokens`: token_hash in ledger unique; ballot_tokens unique
  8. `check_ledger_sequence`: ledger_index 0..N-1 with no gaps (strict continuity)
  9. `check_ballot_structure`: every ballot_payload validates via CryptoService.validate_ballot
  10. `check_election_state`: state machine transitions valid (e.g., COMPLETED only reachable via CLOSED/TALLYING)
- Returns structured result: `{status: VERIFIED|COMPROMISED, checks: {name: pass/fail/details}, first_failed_check: str|None, evidence: {...}}`
- On COMPROMISED (if election not already FROZEN):
  a. Transition election.state → FROZEN (with audit)
  b. Create IntegrityCheck row with results
  c. Create HIGH severity SecurityAlert
  d. Generate EvidenceBundle (JSON dump of all failed check details + affected rows + old/new hashes + timestamps + witness observations)
- ReconciliationService: `reconcile(election_id)` returning `{ok, voters_marked, ballots_recorded, pending, void, problems[]}` (per FR6)

**Test Requirements:**

- (rule) 4 tests covering AC9: stuffing (+1 ballot via raw insert) → reconciliation fail; deletion (remove ballot) → fail; insert duplicate token_hash → fail; insert unissued token_hash → fail
- (rule) Audit chain integrity: modify 1 audit event's detail → audit check fails and reports first_bad event id (AC11)
- (rule) Integrity transition: create a naive ballot modification (bit flip ct) → run_full_check → status COMPROMISED, election.state = FROZEN, evidence bundle exists, alert created (AC12)
- (rule) In FROZEN state, a vote cast attempt is rejected with 409 / election frozen error

**Completion Evidence:**

---

## Phase 3: Authentication & Voting API

### Task 10: Auth routes (voter OTP + admin RBAC)

**Status:** pending | **Priority:** H | **Depends on:** Task 6 | **Covers:** AC3, AC4, AC15, AC16, AC17

- **Router:** `backend/app/api/routes/auth.py`
  - `POST /api/v1/auth/otp/request` — rate-limited (8/min/IP + 3/min/voter_id), always returns `ok: true` + same message whether ID exists or not (no enumeration, AC4)
  - `POST /api/v1/auth/otp/verify` — validates OTP hash match, max 5 attempts, on success sets short-lived voter session cookie, returns session token
  - `GET /api/v1/auth/demo/inbox` — guarded by `require_demo_mode`, returns last OTP for a voter_id (AC13)
  - `POST /api/v1/auth/admin/login` — rate-limited (6/min/IP), Argon2 password verify, sets HttpOnly SameSite=Strict admin session cookie, logs ADMIN_LOGIN / ADMIN_LOGIN_FAIL audit events
  - `POST /api/v1/auth/admin/logout` — clears session
  - `GET /api/v1/auth/admin/me` — returns current admin user + roles
- Voter session cookie: short TTL, HttpOnly, Secure when HTTPS, SameSite=Lax
- Admin session cookie: longer TTL, HttpOnly, Secure, SameSite=Strict
- Role-based access enforcement: `require_roles(SUPER_ADMIN, ELECTION_ADMIN)` pattern

**Test Requirements:**

- (rule) OTP request returns identical JSON for "RGIT26001" and "NONEXISTENT_ID123" when compared via deep equality (AC4)
- (rule) DB inspection after OTP request: otp_challenges row stores only hash, no plaintext (AC4)
- (rule) 5 wrong OTP verify attempts → subsequent correct OTP rejected as locked (AC4)
- (rule) Admin endpoint without cookie → 401; as VOTER role → 403; as ELECTION_ADMIN → ok (AC16)
- (rule) POST without X-Requested-With header → 403 (AC17)
- (rule) Rate limiting: 10 rapid OTP requests → last N return 429 with Redis tracking (AC15)

**Completion Evidence:**

---

### Task 11: Voting, Ballot & Casting routes (full flow)

**Status:** pending | **Priority:** H | **Depends on:** Task 10 | **Covers:** AC3, AC5, FR5, FR6

- **Router:** `backend/app/api/routes/voting.py`
  - `POST /api/v1/voting/token` — requires voter auth session → calls `issue_token`, marks voter.has_received_token, drops voter identity from session after token returned
- **Router:** `backend/app/api/routes/ballots.py`
  - `POST /api/v1/ballots/test` — requires X-Ballot-Token header (token must be ISSUED), validates ballot, receives `{ballot, eph_d_b64u, claimed_choice}`, calls `decrypt_with_ephemeral`, records spoiled_test_ballot, returns `{ok, claimed, revealed, fingerprint}`. If ok=False → also trigger DEVICE_MISMATCH HIGH alert.
  - `POST /api/v1/ballots/cast` — rate-limited (30/min/IP), validates token (via hash lookup), validates ballot, atomically appends ballot + marks token USED + publishes STH + syncs all 3 witnesses + creates BALLOT_CAST audit event, returns `{index, entry_hash, sth, election_id, ballot_fingerprint, proof_card_url}`
- `BallotService.cast_ballot(token_str, ballot_obj)` — runs the full transactional flow with row locking. The transaction must be a single DB session: BEGIN → select token FOR UPDATE → check state → append ballot → mark token used → compute STH → insert STH row → insert audit event → commit. Any exception → rollback everything.
- After cast: build inclusion proof for index → prepare Proof Card data

**Test Requirements:**

- (rule) Transactional atomicity (AC3): after issuing a valid token, simulate DB error on ballot insert (inject via monkeypatch or crafted payload); verify: token state is still ISSUED (not USED) and no ballot row exists
- (rule) Test My Ballot: seal "riya" and claim "riya" → ok=true; seal "kabir" but claim "riya" → ok=false, revealed="kabir", DEVICE_MISMATCH alert present (AC5)
- (rule) Spoiled test ballot's token remains ISSUED so voter can cast again with a fresh ballot; spoiled rows correctly excluded from later tally
- (rule) Same token cast twice → second attempt: 403 token used

**Completion Evidence:**

---

### Task 12: Public Verification, Merkle proof, Consistency proof, Witness, Integrity, Reconcile, Status, Results routes

**Status:** pending | **Priority:** H | **Depends on:** Task 11 | **Covers:** AC14, FR7, FR8, FR9

- **Router:** `backend/app/api/routes/verification.py`
  - `GET /api/v1/verification/proof/{entry_hash_or_idx}` — returns `{index, leaf_hash, size, path:[...], sth:{election,size,root,ts,sig}, witnesses:[{id,owner,status,last_accepted_size,last_accepted_root}], verified: null}` (caller verifies)
  - `GET /api/v1/verification/{id}/verify` — server-side performs all 4 checks: (1) inclusion proof against STH root, (2) STH signature valid, (3) all witnesses that were synced accept root/size, (4) integrity overall status. Returns `{status: VERIFIED, checks:{...}}` or `{status: UNVERIFIED, failures:[...]}`. NEVER includes voter_id, voter_name, candidate choice (AC14)
- **Router:** `backend/app/api/routes/witnesses.py`
  - `GET /api/v1/elections/{id}/witnesses` — list all with latest observations
  - `POST /api/v1/elections/{id}/witnesses/sync` — admin only, forces sync all, returns updated states
- **Router:** `backend/app/api/routes/integrity.py`
  - `GET /api/v1/elections/{id}/integrity` — full IntegrityService output
  - `GET /api/v1/elections/{id}/reconcile` — ReconciliationService output
  - `GET /api/v1/public/status` — one-call aggregation for dashboards: `{config, reconcile, integrity, sth, results_published}`
- **Router:** `backend/app/api/routes/elections.py`
  - `GET /api/v1/elections` list, `GET /api/v1/elections/{id}` detail (with candidates), `POST /api/v1/elections` create (admin)
  - `GET /api/v1/elections/{id}/results` — published tally only (shuffled choices list, counts, metadata, NOT individual ballots)

**Test Requirements:**

- (rule) `verification/{id}/verify` for a valid ballot returns VERIFIED and response JSON deep-search finds NO voter_id / voter_external_id fields and NO candidate choice fields (AC14)
- (rule) `GET /api/v1/elections/{id}/integrity` after honest seed returns status VERIFIED with all 10 checks pass
- (rule) `/witnesses/sync` for honest election returns 3 SYNCED witnesses with size matching the ledger

**Completion Evidence:**

---

### Task 13: Admin routes (audit, close, tally, trustees, demo attack center, reset)

**Status:** pending | **Priority:** H | **Depends on:** Task 12 | **Covers:** AC10, AC11, AC12, AC13, FR10, FR11, FR12, FR13

- **Router:** `backend/app/api/routes/admin.py` — all require ELECTION_ADMIN+ role except SUPER_ADMIN ones
  - Audit: `GET /api/v1/admin/audit` (list recent), `GET /api/v1/admin/audit/verify` (recompute chain, return ok/fail + first_bad)
  - Alerts: `GET /api/v1/admin/alerts` (list active)
  - Close election: `POST /api/v1/admin/elections/{id}/close` → state → CLOSED; void all ISSUED tokens; publish final STH; sync witnesses; audit ELECTION_CLOSED
  - Trustees: `GET /api/v1/admin/elections/{id}/trustees` list, `GET /api/v1/admin/trustees/share/{n}` (DEMO_MODE only, read trustee share for demo)
  - Tally:
    - `POST /api/v1/admin/elections/{id}/tally/sessions` create new tally session (CLOSED state only)
    - `POST /api/v1/admin/tally/sessions/{sid}/approve` trustee authenticated approval (append approval row)
    - When 2 approvals reached: `TallyService.perform_tally(session_id)`
      1. Load shares from approvals → combine 2-of-3 → validate pub matches (invalid shares → TALLY_REJECTED audit + fail)
      2. In-memory only: decrypt every sealed ballot → validate candidate is one of candidates (bad → increment failed_count)
      3. Count votes per candidate; collect plaintext choices in a list; randomly shuffle (SystemRandom)
      4. Delete old tally rows; insert new tally results + shuffled list; election.state → COMPLETED; audit TALLIED
      5. Delete reconstructed key scalar from memory (del + overwrite)
      6. Never expose individual plaintext ballots via API — only aggregated counts and shuffled list
  - Demo center (all guarded by DEMO_MODE, AC13):
    - `POST /api/v1/admin/demo/seed` — SeedService.seed_sample_votes(n)
    - `POST /api/v1/admin/demo/attack` — attack scenarios: MODIFY_BALLOT, DELETE_BALLOT, REORDER_LEDGER, CHANGE_TOKEN_HASH, MODIFY_AUDIT_EVENT, REWRITE_MERKLE_ROOT, DUPLICATE_TOKEN. Each returns `{kind, affected_index, note}`
    - `POST /api/v1/admin/demo/device` — toggle "compromised device" flag (seals wrong choice for the next Test My Ballot; when ON, test ballot spoils reveal mismatched choice)
    - `POST /api/v1/admin/demo/reset` — DANGEROUS demo-only: truncate election data, re-bootstrap demo (use with extreme caution; confirm demo_mode)

**Test Requirements:**

- (rule) Tally AC10: create session → 1 approval only → status still PENDING and decrypt never runs → 1 valid share + 1 tampered share (y+1) → 403 shares don't match election pub → 2 valid distinct trustees → SUCCESS, shuffled list published, ballot count matches ledger (AC10)
- (rule) Audit verify AC11: after 5 votes → audit/verify ok → manually modify 1 audit_event metadata_json field → audit/verify returns FAILED with first_bad pointing at modified event id (AC11)
- (rule) REWRITE_MERKLE_ROOT demo attack: performs hash-chain rewrite + deletes old STH + resigns new STH → local integrity ok → witnesses/sync → all ALARM → full integrity check → COMPROMISED + election FROZEN (AC8 / AC12)
- (rule) With DEMO_MODE=false: `POST /demo/seed` returns 403 (AC13)

**Completion Evidence:**

---

## Phase 4: Next.js Frontend

### Task 14: Next.js project scaffold, Tailwind, shadcn/ui, Lucide, Recharts, global design system

**Status:** pending | **Priority:** H | **Depends on:** Task 4 | **Covers:** R2, R5, FR15, NFR3

- Scaffold `frontend/`: Next.js 14 (App Router), TypeScript strict mode: true, noUncheckedIndexedAccess: true, noImplicitAny: true
- `tailwind.config.ts` with custom theme:
  - colors: navy-950, navy-900, navy-800, warmwhite-50, teal-600, blue-500, verified-green-600 (ONLY green for pass/verified), failure-red-600 (ONLY red for failures/alarm), gold-500 (waiting)
  - fontFamily: sans: ['Inter', 'system-ui', ...]
- Initialize shadcn/ui in `frontend/`: Button, Card, Input, Label, Badge, Alert, AlertDialog, Table, Tabs, Select, Checkbox, Dialog, Separator, Progress, Skeleton, Toast, Form (with react-hook-form + zod)
- `frontend/src/lib/api/client.ts` — centralized fetch wrapper with: baseURL from NEXT_PUBLIC_API_URL, X-Requested-With: glassballot header, cookie credentials: 'include', request-id, error handling, typed response promise
- `frontend/src/lib/api/endpoints.ts` — typed fetch wrappers for every backend route
- `frontend/src/lib/crypto/*` — minimal ballot sealing using WebCrypto (match gb/crypto.py protocol exactly: P-256 ECDH → SHA-256 with DOMAIN + shared + eph_pub → AES-GCM, 96-byte padded plaintext, election_id as AAD). This is the dual of C.encrypt_ballot in the browser.
- `frontend/src/lib/validation/schemas.ts` — Zod schemas matching backend Pydantic schemas
- `frontend/src/types/*.ts` — TypeScript interfaces for all API types (no any)
- Global layout: navbar with brand logo (SVG ballot box), nav links (Vote, Verify, Integrity, Witnesses, Results, Admin), footer with disclaimer

**Test Requirements:**

- (rule) `npm run build` completes with 0 TypeScript errors and 0 ESLint errors
- (rule) Ballot sealed in browser via frontend/src/lib/crypto decrypts correctly using backend CryptoService (byte-compatibility test using test harness)
- (rubric, 0-2, ≥1) Design quality: screenshot of landing page showing premium navy/warmwhite/teal palette with no cyberpunk/neon (R2)
- (rubric, 0-2, ≥1) Responsive: 3 screenshots at 375px, 768px, 1440px widths of /vote page show no overflow (R5)

**Completion Evidence:**

---

### Task 15: Public-facing pages (Landing, Vote flow, Proof, Verify, Results, Integrity, Witnesses)

**Status:** pending | **Priority:** H | **Depends on:** Task 14 | **Covers:** R2, R6, FR5, FR14, FR15

- **`/` (Landing)**:
  - Hero: GlassBallot title + tagline "Transparent to verify. Private to vote." + CTA buttons (Start Voting, Verify a Ballot, See Integrity)
  - Three Locks section: Lock 1 Two Books, Lock 2 Candidate Witnesses, Lock 3 Test My Ballot — each with icon, title, 1-paragraph explanation
  - Window section: Proof Card + QR + Public Verify explainer
  - Core principle visual: IDENTITY ≠ BALLOT ≠ RESULT (three distinct cards with arrows showing separation)
  - Disclaimer footer line ("Prototype for low-stakes elections, independent audit required")
- **`/vote`**:
  - Step 1: Enter college ID field → "Send code" → Step 2: Enter 6-digit OTP → (demo mode: floating "demo inbox" panel showing current OTP) → Step 3: Candidate list cards (photo placeholder/avatar, name, tag, radio select) → Step 4: "Seal my ballot" browser encryption → Step 5: Test My Ballot section: "Test this ballot" button → spoil → green PASS or red "TEST FAILED — DO NOT CAST" banner with mismatch details → If PASS, "Seal a fresh ballot & cast" button (re-encrypts to fresh ephemeral key before cast) → Step 6: Proof Card display with QR code, all fields listed, "Open verification page" link
- **`/proof/[id]`**: Public Proof Card replica (same data as cast receipt, QR) + "Verify this proof now" button linking to /verify/[id]
- **`/verify/[id]`**: Public verification result page:
  - Big VERIFIED / UNVERIFIED banner (green / red)
  - Status lines: "Ballot included in ledger ✓", "Merkle proof valid ✓", "Signed tree head valid ✓", "Witnesses agree ✓" (or X with reason)
  - Raw proof data collapsible section
  - Line: "This verification proves inclusion and integrity only. It does NOT reveal how anyone voted."
- **`/results`**: Published results chart (Recharts bar chart) + tally metadata + integrity status badge + witness summary + NOTA line
- **`/integrity`**: Integrity dashboard — 10-check list each with PASS/FAIL badge, visual chain diagram (Eligibility → Token → Sealed Ballot → Hash Chain → Merkle Root → STH → Witnesses → Public Verify) each node colored by status, reconciliation numbers box (eligible, marked, ballots, pending, void), overall VERIFIED/COMPROMISED banner, evidence bundle download if COMPROMISED
- **`/witnesses`**: Witness dashboard table: owner, status pill (WAITING/SYNCED/ALARM), last accepted size, current size, last root truncated, last sync timestamp, last message, alarm evidence link if ALARM

**Test Requirements:**

- (rule) Each route defined returns 200 when visited via build-time render or runtime (no "Application error")
- (rule) Vote E2E: Playwright script can complete the flow (or vitest jsdom test of form state) end to end including Test My Ballot pass path
- (rule) `/verify/[id]` DOM contains NO candidate choice text and NO voter name/id text when inspected by Playwright selector search (AC14 corollary on frontend)
- (rubric, 0-2, ≥1) Demo completeness: voter can click through Vote→Test→Cast→Proof→Verify→Integrity in a single unbroken session (R6 baseline)

**Completion Evidence:**

---

### Task 16: Admin dashboard & sub-pages

**Status:** pending | **Priority:** M | **Depends on:** Task 15 | **Covers:** R1, R2, FR15

- `/admin/page.tsx` — Admin sign-in gate (if no session → login form; if session → overview)
- Admin Overview: stats cards (eligible voters, votes cast, ballots recorded, witnesses synced, integrity status), recent activity (last 5 audit events), quick actions (Close election, Seed votes, Start tally, Run integrity check)
- `/admin/elections` list + `/admin/elections/[id]` detail (candidates mgmt, state pills, open/close actions)
- `/admin/voters` table: voter_external_id, display_name, eligibility, has_token, has_voted
- `/admin/ballots` table: ledger_index, ballot_fingerprint, entry_hash truncated, created_at; click row opens inclusion proof
- `/admin/witnesses` table + force-sync button
- `/admin/integrity` same as public integrity page but with "Run check" button + history of previous checks
- `/admin/audit` audit events table with verify chain button + chain status banner; verify runs server verify endpoint and highlights first bad row
- `/admin/trustees` trustee list, tally sessions list, "Approve tally session" button for authenticated trustees (modal to submit share — demo mode auto-fills from share endpoint)
- `/admin/results` published results + download report (JSON/PDF/HTML buttons placeholder)
- `/admin/demo` Demo Center: Seed votes input + button, Attack Simulator card with 8 attack buttons (MODIFY_BALLOT, DELETE_BALLOT, REORDER_LEDGER, CHANGE_TOKEN_HASH, MODIFY_AUDIT_EVENT, REWRITE_MERKLE_ROOT, SIMULATE_COMPROMISED_DEVICE toggle, DUPLICATE_TOKEN), each attack has confirm dialog, after attack page auto-refreshes and shows BEFORE/AFTER integrity comparison, Reset demo button with confirm

**Test Requirements:**

- (rule) Admin pages are 401 redirected if not logged in; layout correctly shows role-specific menu items
- (rule) Demo Center attack REWRITE_MERKLE_ROOT button → after success → integrity page auto-refreshes → COMPROMISED → Witnesses all ALARM → election state shows FROZEN (visual evidence of R6)
- (rubric, 0-2, ≥1) Admin information density: dashboard can show all overview metrics without horizontal scroll on 1024px width

**Completion Evidence:**

---

## Phase 5: Testing, Verification, Hardening

### Task 17: Backend test suite (pytest + hypothesis + httpx + async)

**Status:** pending | **Priority:** H | **Depends on:** Task 13 | **Covers:** AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8, AC9, AC10, AC11, AC12, AC13, AC14, AC15, AC16, AC17, AC20, R3

- Ensure legacy tests still pass: `python -m unittest discover -s tests` runs against legacy Flask app unchanged (AC1)
- Create `backend/tests/conftest.py`: async test DB session (PostgreSQL test container or test database), httpx.AsyncClient test fixture against TestApp, Redis test fixture, demo bootstrap fixture (runs ElectionSetupService before each test class), admin login helper, voter login helper
- Test files mirror service decomposition:
  - `test_crypto.py`: Shamir round-trip, ballot encrypt/decrypt, validate ballot rejects junk, constant ciphertext length across choices
  - `test_merkle.py`: inclusion/consistency at sizes 1,2,3,4,5,10,100 + hypothesis
  - `test_witness.py`: 3 alarm scenarios + stickiness; rewrite attack witnesses alarm test (AC8)
  - `test_integrity.py`: all 10 checks pass baseline, 10 individual break tests each with targeted break + correct failure report
  - `test_reconciliation.py`: 4 scenarios of AC9
  - `test_auth.py`: OTP no-enumeration, OTP lockout, admin login, rate limiting
  - `test_voting.py`: full cast flow, token double-cast prevented, atomic failure (AC3)
  - `test_tally.py`: AC10 2-of-3 scenarios
  - `test_audit.py`: chain verify + tamper detection AC11
  - `test_security.py`: CSRF guard AC17, RBAC AC16, role 403 matrix, rate limit 429 AC15, FROZEN reject vote, IDOR attempts (verify someone else's ballot id → still no identity leak), Redis inspection after vote flow confirms no ballot data (AC20)
  - `test_demo_guard.py`: DEMO_MODE=false → all /demo/\* endpoints 403 (AC13)
- `backend/pytest.ini` / config in pyproject.toml; run pytest with `--asyncio-mode=auto`

**Test Requirements:**

- (rule) Every Rule Acceptance Criterion (AC1–AC20) has at least one automated test that verifies it (evidenced by test file + test name mapping document or grep)
- (rule) Legacy test suite passes untouched: `python -m unittest discover -s tests` result = OK (AC1)
- (rule) Full pytest suite (`pytest backend/tests`) passes on a clean DB
- (rubric, 0-2, ≥1) Security test breadth: count of distinct security properties covered by tests ≥ 10 (R3)

**Completion Evidence:**

---

### Task 18: Frontend tests (Vitest) + Playwright E2E demo flow

**Status:** pending | **Priority:** M | **Depends on:** Task 16 | **Covers:** R5, R6, FR13, FR14

- `frontend/vitest.config.ts` + `frontend/src/__tests__/`
- Unit tests: ballot sealing WebCrypto → output accepted by backend (round-trip), proof card QR payload, API type guard helpers
- `frontend/playwright.config.ts` — Chromium + Firefox + mobile Chrome
- E2E Flow 1 (Playwright): create election (or use demo bootstrap) → admin login → seed 10 → voter login RGIT26031 → OTP from demo inbox → candidate select → Test My Ballot (pass) → cast fresh → proof card → open verify → all checks VERIFIED → admin close → 2 trustee approvals → tally → results page shows counts.
- E2E Flow 2 (Playwright): seed 10 votes → verify integrity VERIFIED → go to Demo Center → REWRITE_MERKLE_ROOT → confirm → watch integrity transition to COMPROMISED → Witnesses all ALARM → election FROZEN banner → click "Download evidence" bundle → (optionally) show failed checks in Integrity page with specific indices.

**Test Requirements:**

- (rule) E2E Flow 1 passes in Playwright (Chromium) on a fully running docker-compose stack
- (rule) E2E Flow 2 passes (complete VOTE→EVIDENCE→ATTACK→DETECT story, R6)
- (rubric, 0-2, ≥1) Accessibility: Playwright `axe-core` scan of landing + vote + verify pages passes ≤ 10 violations, all best-practice not serious (R5 baseline)

**Completion Evidence:**

---

### Task 19: Ruff + mypy for Python, ESLint + build-check for TS, final lint/type pass

**Status:** pending | **Priority:** M | **Depends on:** Task 17, Task 18 | **Covers:** NFR4, R1

- `backend/pyproject.toml`: ruff config (line-length 100, target-version py312, exclude legacy gb/ from new rules but keep gb/ valid syntax); mypy config (strict for app/ directory, ignore_missing_imports for 3rd party)
- Ruff check fixes + mypy fixes for all new backend code
- TypeScript `strict: true` + `noUncheckedIndexedAccess: true` + `noImplicitReturns: true`; `npm run lint:fix`; review `any` type uses — replace with generics or unknown

**Test Requirements:**

- (rule) `ruff check backend/app backend/tests` exits 0
- (rule) `mypy backend/app` exits 0 (≤ 5 "note" level messages allowed, 0 errors)
- (rule) `cd frontend && npm run lint` exits 0; `npm run build` exits 0
- (rule) Count of `any` keyword in `frontend/src/app/` and `frontend/src/lib/` ≤ 5 (excluding node_modules and autogenerated)

**Completion Evidence:**

---

## Phase 6: Evidence, Demo Readiness

### Task 20: README + demo script verification

**Status:** pending | **Priority:** M | **Depends on:** Task 19 | **Covers:** FR13, R6

- Final run of the complete demo script from README:
  1. `docker compose up -d --build` → wait for healthy
  2. Admin login at `/admin` (pw from GB_ADMIN_PASSWORD) → overview → Seed 10 sample votes → overview shows 10=10 balance
  3. Vote as RGIT26031 from demo inbox → OTP → Test My Ballot → cast → Proof Card → Verify → all green
  4. Demo Center → Compromised device ON → vote RGIT26032 → Test ballot → FAIL red banner → Compromised device OFF
  5. Demo Center → Rewrite Merkle → confirm → Integrity COMPROMISED, 3 witnesses ALARM, election FROZEN
  6. Reset demo → clean state → Close election → 2 trustee approvals → Tally → Results
- Record screenshots or video evidence for each step

**Test Requirements:**

- (rule) All 6 steps above complete without error on a fresh clone
- (rubric, 0-2, ≥2) Demo completeness: full 6-step walkthrough succeeds end-to-end; evidence bundle from step 5 downloads and contains expected affected_index, old_hash, new_hash, witness_observations, timestamps (R6)

**Completion Evidence:**

---

### Review Gate

All tasks completed → enter Review phase. Reviewer independently re-runs:

1. Legacy tests
2. Backend pytest suite
3. Frontend build + lint
4. Playwright E2E 1 + 2
5. Manual docker-compose demo steps
6. Crypto preservation diff check of gb/ vs baseline
7. Architecture layer spot-check across 3 API endpoints
