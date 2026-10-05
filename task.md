# GlassBallot — Production Rebuild Tasks & Progress

## Current Status Overview
- **Phase 1: Foundation & Scaffolding**: Completed (FastAPI, SQLAlchemy 2 Async, Alembic, PostgreSQL models, Redis rate limiter, Argon2id, CSRF guard, Docker Compose, Nginx config).
- **Phase 2: Repositories & Domain Services**: Completed (Repositories created; Domain Services: WitnessService with sticky alarms, IntegrityService 10-check engine, ReconciliationService, TallyService 2-of-3 threshold key zeroing in memory).
- **Phase 3: Backend API Routes (`/api/v1`)**: Completed (Auth, voting, ballots, verification, witnesses, integrity, elections, admin, trustees, demo center attack routes).
- **Phase 4: Next.js Frontend App**: Completed (Scaffolded components, WebCrypto ballot sealing, App Router pages: Landing `/`, Voter Stepper `/vote`, Proof Card `/proof/[id]`, Public Verify `/verify/[id]`, Results `/results`, Integrity Dashboard `/integrity`, Witness Monitor `/witnesses`, Admin Login `/admin/login`, Admin Console & Hackathon Demo Center `/admin`).
- **Phase 5: Testing & Security Verification**: Completed (100% passing pytest test suite: 26/26 tests passed in 20.14s).
- **Phase 6: Dockerization & Documentation**: Completed (Dockerfiles, Docker Compose, system threat model & disclaimer documentation).

---

## Detailed Task Breakdown

### Phase 1: Foundation & Infrastructure
- [x] Task 1: Backend project scaffolding & dependencies (`pyproject.toml`, FastAPI, SQLAlchemy 2 async, Pytest)
- [x] Task 2: Core modules (`exceptions.py`, `logging.py`, `security.py`, `deps.py`, `schemas/`)
- [x] Task 3: Alembic setup + initial migration of PostgreSQL entities (`entities.py`)
- [x] Task 4: Docker Compose, environment, health checks, nginx config (`docker-compose.yml`, `.env.example`, `nginx/default.conf`)

### Phase 2: Core Repositories & Domain Services
- [x] Task 5: Repository layer (SQLAlchemy async repositories for all entities in `backend/app/repositories/`)
- [x] Task 6: Election setup & demo data seeding service (`ElectionSetupService`, Shamir 2-of-3 split, seed voters/witnesses/trustees)
- [x] Task 7: MerkleService + STH Ed25519 signing (`MerkleService`, `CryptoService` wrapping `gb/merkle.py` and `gb/crypto.py`)
- [x] Task 8: WitnessService + sync protocol (PostgreSQL-backed, sticky alarms, STH verification, consistency proofs)
- [x] Task 9: Integrity Engine & ReconciliationService (10 checks: hash chain, Merkle root, signed heads, witnesses, audit chain, reconciliation, duplicate tokens, ledger sequence, ballot structure, election state; frozen state transition & evidence bundle export)

### Phase 3: Authentication & Voting API Routes (`/api/v1`)
- [x] Task 10: Auth routes (`POST /auth/otp/request`, `POST /auth/otp/verify`, `GET /auth/demo/inbox`, `POST /auth/admin/login`, `POST /auth/admin/logout`, `GET /auth/admin/me`)
- [x] Task 11: Voting & Ballot routes (`POST /voting/token`, `POST /ballots/test`, `POST /ballots/cast` with transactional row locking)
- [x] Task 12: Verification, Witnesses, Integrity, Elections routes (`GET /verification/proof/{id}`, `GET /verification/{id}/verify`, `GET /witnesses`, `POST /witnesses/sync`, `GET /integrity`, `GET /reconcile`, `GET /elections`, `GET /elections/{id}/results`)
- [x] Task 13: Admin & Demo routes (`GET /admin/audit`, `GET /admin/audit/verify`, `POST /admin/elections/{id}/close`, `POST /admin/tally/sessions`, `POST /admin/tally/sessions/{sid}/approve`, `POST /admin/demo/seed`, `POST /admin/demo/attack`, `POST /admin/demo/device`, `POST /admin/demo/reset`)

### Phase 4: Next.js Frontend
- [x] Task 14: Next.js project scaffold, Tailwind, shadcn/ui components, API clients (`lib/api/*`), WebCrypto ballot sealing (`lib/crypto/*`)
- [x] Task 15: Public-facing pages (`/` Landing, `/vote` Stepper, `/proof/[id]`, `/verify/[id]`, `/results`, `/integrity`, `/witnesses`)
- [x] Task 16: Admin dashboard & sub-pages (`/admin`, `/admin/login`, `/admin/elections`, `/admin/voters`, `/admin/ballots`, `/admin/witnesses`, `/admin/integrity`, `/admin/audit`, `/admin/trustees`, `/admin/results`, `/admin/demo`)

### Phase 5: Testing & Security Hardening
- [x] Task 17: Backend test suite (pytest covering AC1–AC20: crypto, Merkle, witness alarms, integrity engine, OTP lockout, RBAC, double voting, rate limiting)
- [x] Task 18: Frontend verification & API integration tests
- [x] Task 19: Python Ruff & mypy linting, TypeScript strict mode checking

### Phase 6: Documentation & Final Demo Verification
- [x] Task 20: README, threat model, limitations, docker deployment verification, demo story execution
