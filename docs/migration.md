# GlassBallot Migration Plan

Production-quality prototype for low-stakes elections; independent security audit required before real-world deployment.

## What Exists Today

The current repository is a compact Flask + SQLite prototype with several strong ideas worth preserving:

- `gb/crypto.py`
  - ECIES-style ballot sealing with ECDH P-256
  - AES-256-GCM ballot encryption
  - fixed-size padded plaintext to reduce choice-length leakage
  - Ed25519 signed tree heads
  - 2-of-3 Shamir secret sharing for trustees
- `gb/merkle.py`
  - RFC 6962 / 9162 inclusion and consistency proofs
- `gb/store.py`
  - eligibility register and sealed-ballot ledger separation
  - one-time ballot tokens
  - append-only hash-chained ledger
  - append-only hash-chained audit log
  - reconciliation checks
  - tally flow with in-memory key reconstruction
  - demo tamper scenarios
- `gb/witness.py`
  - independent witness state
  - sticky alarm semantics
  - consistency-proof based rewrite detection
- `static/lib.js` and `static/app.js`
  - browser-side ballot sealing
  - browser-side verification of inclusion, Merkle state, and full-ledger audit
- `tests/`
  - crypto, Merkle, tamper, witness, tally, and JS/Python compatibility coverage

## Preservation Rules

These pieces should be treated as domain assets, not throwaway prototype code:

1. Preserve the canonical hashing/signing behavior unless a concrete security issue requires change.
2. Preserve the witness alarm model: alarms must be sticky and never silently cleared.
3. Preserve the two-book separation:
   - identity/eligibility register
   - sealed ballot ledger
4. Preserve browser-verifiable proofs and public verification.
5. Preserve Test My Ballot as a spoiled pre-cast challenge flow.

## Inspection Findings

The current prototype already demonstrates:

- `IDENTITY != BALLOT != RESULT`
- token unlinking between login and cast
- signed Merkle heads
- witness-based history rewrite detection
- reconciliation against stuffing/deletion
- public proof-card verification in the browser
- trustee threshold tallying
- demo attack simulation that proves detection, not just prevention

The main migration pressure is architectural, not conceptual:

- Flask routes mix transport and orchestration
- SQLite is doing both domain persistence and demo storage
- there is no async boundary for PostgreSQL/Redis/worker tasks
- the frontend is effective but not componentized
- deployment/runtime configuration is still prototype-grade

## Immediate Fixes Applied During Inspection

- Fixed `gb/witness.py` to close SQLite connections cleanly on Windows while still committing writes.
- Verified the preserved baseline with `python -m unittest discover -s tests` -> 18 tests passing.

## Target Mapping

| Legacy area | Keep | Move to |
|---|---|---|
| `gb/crypto.py` | cryptographic primitives and canonicalization | `backend/app/services/crypto_service.py` adapter now, dedicated crypto package later |
| `gb/merkle.py` | proof construction and verification | `backend/app/services/merkle_service.py` adapter now, dedicated Merkle module later |
| `gb/witness.py` | witness protocol and alarm semantics | `backend/app/services/witness_service.py` now, PostgreSQL-backed witness repository later |
| `gb/store.py` | business rules | split across repositories + services |
| `app.py` | route intent only | `backend/app/api/routes/*` |
| `static/` | product flow and proof UX | Next.js App Router frontend |

## New Backend Shape

The new backend scaffold now exists under `backend/app/`:

- `main.py`
- `core/config.py`
- `core/database.py`
- `api/router.py`
- `api/routes/health.py`
- `models/`
- `services/crypto_service.py`
- `services/merkle_service.py`
- `services/witness_service.py`
- `services/integrity_service.py`

This keeps the legacy implementation alive while the new architecture grows around preserved logic.

## Recommended Migration Sequence

### Phase 1: Preserve and Wrap

- keep Flask demo runnable
- keep current tests green
- wrap legacy crypto, Merkle, and witness logic behind backend services
- add PostgreSQL models and initial Alembic migration

### Phase 2: Split `Store`

Break `gb/store.py` into:

- `AuthService`
- `OtpService`
- `TokenService`
- `BallotService`
- `AuditService`
- `MerkleService`
- `WitnessService`
- `ReconciliationService`
- `IntegrityService`
- `TallyService`
- repositories for each persistence concern

### Phase 3: PostgreSQL as Authority

- move elections, voters, tokens, sealed ballots, heads, witnesses, audit events, alerts, and tally metadata into PostgreSQL
- keep Redis for rate limiting, OTP/session support, and background work coordination only
- never make Redis the authoritative ballot ledger

### Phase 4: FastAPI API

- implement `/api/v1/` routes
- add secure cookie auth and RBAC
- add request IDs, structured logs, and readiness checks
- add demo-only endpoint protection behind `DEMO_MODE=true`

### Phase 5: Next.js Frontend

- port voter flow first:
  - login
  - OTP
  - token issuance
  - candidate selection
  - Test My Ballot
  - cast
  - Proof Card
- then add:
  - public verification
  - integrity dashboard
  - witness dashboard
  - admin control center

## Data Model Notes

The initial SQLAlchemy models cover the recommended tables:

- users, roles, user_roles
- elections, election_candidates
- voters, otp_challenges, voter_auth_attempts
- ballot_tokens, sealed_ballots
- merkle_tree_heads
- witnesses, witness_observations
- spoiled_test_ballots
- trustees, trustee_key_shares
- tally_sessions, tally_results
- audit_events, security_alerts, integrity_checks
- evidence_bundles, demo_scenarios

Important invariants to enforce in migrations and services:

- `UNIQUE(token_hash)`
- `UNIQUE(election_id, ledger_index)`
- `UNIQUE(election_id, voter_external_id)`
- transactional vote casting
- no identity-to-ballot mapping
- no plaintext OTP, password, vote, private key, or trustee share exposure

## Open Engineering Tasks

1. Add Alembic with a real initial PostgreSQL migration.
2. Move constants like the election state machine and role catalog into backend domain modules.
3. Replace the prototype admin password flow with Argon2id-backed admin auth and secure cookies.
4. Build Redis-backed rate limiting for OTP, login, token, cast, verification, and demo routes.
5. Port the browser verifier to Next.js without changing proof semantics.
6. Add evidence bundle generation for JSON, HTML, and PDF outputs.

## What We Should Not Do

- Do not replace working cryptographic logic for style reasons.
- Do not claim suitability for legally binding government elections.
- Do not move ballot authority into Redis.
- Do not clear witness alarms automatically.
- Do not expose trustee shares or reconstructed private keys through APIs.
