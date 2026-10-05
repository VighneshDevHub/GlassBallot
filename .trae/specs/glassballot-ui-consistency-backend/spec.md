# GlassBallot — UI Consistency, Backend Integration & Feature Completion

## Overview

- **Summary**: Complete the GlassBallot prototype to a consistent production-quality state. (A) Migrate the 9 remaining pages onto the Elevate design system so every page uses `PublicLayout` or `SidebarDashboardLayout`, pastel cards, rounded-full pills, and the Manrope font. (B) Remove all frontend mock data and stubbed API calls so every data surface is read from the real FastAPI + PostgreSQL backend and every user action is persisted (no more "toast-only" pages). (C) Add the missing FR15 admin pages (Voters Roster, Ballot Ledger, Reports) plus Profile/Settings endpoints on the backend and wire them through clean user flows. (D) Fix enum drift in PostgreSQL so all valid election/trustee states persist correctly, correct orphaned models, and repair the vote page's duplicated raw fetch logic in favor of the typed API wrappers.
- **Purpose**: Eliminate the current "half-finished" state where the landing/admin/dashboard look premium but the rest of the journey is legacy-styled and half the feature pages don't actually touch the database. Guarantee that every click in the UI either succeeds against the real backend or surfaces a clear user-facing error — no silent catch-block success forgery.
- **Target Users**: Public verifiers, Student voters (profile/settings/receipts), Election Admins (voters/ballots/reports), Trustees, Auditors.

## Goals

1. **UI Consistency (Elevate DS)**: Every non-redirect page renders inside either `PublicLayout` or `SidebarDashboardLayout`. Zero remaining `bg-teal-50` / `bg-slate-900` / `rounded-xl` (on primary CTAs) legacy look on the 9 current pages: vote, verify, verify/[id], proof/[id], results, integrity, witnesses, trustees, simulator.
2. **Zero Mock Data in Production Surfaces**: Every card, table, stat, and list on every page is populated from a typed `@/lib/api/*` call (no silent `.catch(() => fakeData)`). Where the backend currently lacks an endpoint, the endpoint is added (see Goal 4) before the frontend is wired.
3. **Real Session Validation & Auth Flow**: `useVoterSession` and `useAdminSession` always server-validate the session cookie. No more cookie-exists = authenticated. Auth guards redirect unauthenticated users cleanly, post-login returns them to the originally requested deep link.
4. **Missing Backend Endpoints + Admin Pages**: Add the FR15 admin pages (Voters Roster, Ballot Ledger, Reports/Evidence Bundles) and their backing API endpoints, plus profile/settings/preferences endpoints that the dashboard/profile & settings pages actually persist to and read from.
5. **Simple, Intuitive User Flow**: Landing → role select → correct login → relevant dashboard → natural sub-navigation → actionable pages → clean error/success feedback (Sonner toasts) with explicit loading/skeleton states and no dead-end "toast-only" forms.
6. **Backend Drift Fixes**: Add the missing enum values to PostgreSQL (`SETUP`, `DECRYPTING`, `PUBLISHED`, `ACCEPTED`, `REJECTED`, `COMPLETED`, `FAILED`) via a new Alembic migration; drop the two fully orphaned tables (`voter_auth_attempts`, `demo_scenarios`) or backfill minimal repo wiring; fix the `SpoiledBallotRepo` method name / kwarg mismatch so spoiled ballots actually persist.

## Non-Goals

- No changes to cryptographic primitives in `gb/crypto.py`, `gb/merkle.py`, `gb/witness.py` (FR1 — preservation preserved).
- No Docker / infrastructure changes (FR16 already covered by migration spec).
- No new user-facing design system outside the Elevate palette (no dark mode, no new accent colors).
- No substitution of the tech stack (still FastAPI, SQLAlchemy 2 async, Alembic, Next.js App Router, Tailwind, shadcn/ui, Manrope).
- No independent security audit (still flagged as required pre-production).
- No ERP/SMS/Email integration. OTP demo inbox pattern is preserved as-is.

## Background & Context

The project already has two approved specs:

- [glassballot-migration/spec.md](file:///c:/Users/vighn/Downloads/glassballot/glassballot/.trae/specs/glassballot-migration/spec.md) — End-to-end migration spec with FR1–FR18 (incl. FR15 frontend pages and FR2 PostgreSQL).
- [glassballot-ui-redesign/spec.md](file:///c:/Users/vighn/Downloads/glassballot/glassballot/.trae/specs/glassballot-ui-redesign/spec.md) — Elevate DS adoption (Manrope, #DAF39F lime pill, 4 pastel accent cards, `SidebarDashboardLayout` + `PublicLayout`). Its companion [tasks.md](file:///c:/Users/vighn/Downloads/glassballot/glassballot/.trae/specs/glassballot-ui-redesign/tasks.md) covers 9 tasks targeting 7 pages only.

A whole-codebase audit performed immediately preceding this spec (2026-10-04) found:

- **9 pages still on legacy visuals** (vote, verify, verify/[id], proof/[id], results, integrity, witnesses, trustees, simulator) — no layout wrapper, no pastel classes, legacy teal/slate palette.
- **8+ pages/modules with hardcoded mock data and/or stubbed API calls**: `admin/settings`, `dashboard/settings`, `dashboard/profile`, `dashboard/page` (weeklyData/events/activity/receipts/activeElections inline), `trustees` (defaultRoster fallback), `simulator` (fabricated responses on error), `vote` (raw fetch duplicated + fallback candidates/pubkey), `auth.ts:registerVoter()` (100% stubbed), `useVoterSession` (zero server validation), `useAdminSession` (fallback cookie-only auth bypass on API error).
- **3 FR15 Admin sub-pages missing from both frontend routes and backend endpoints**: Voters Roster (no `GET /admin/elections/{id}/voters`, no page), Ballot Ledger (no `GET /admin/elections/{id}/ballots`, no page), Reports / Evidence Bundles (no `GET /admin/reports/evidence/{id}`, no page).
- **PostgreSQL enum drift** between `backend/app/models/enums.py` and the migration: states `SETUP`, `DECRYPTING`, `PUBLISHED`, `ACCEPTED`, `REJECTED`, `COMPLETED`, `FAILED` would be rejected at write time.
- **SpoiledBallotRepo mismatch**: routes call `create_spoiled_ballot(is_match=…, ciphertext_payload=…)` but only `append(verification_ok=…)` exists; latent `TypeError`.
- **Orphaned DB tables**: `voter_auth_attempts` + `demo_scenarios` are created by migration but have zero repo/route references.

This PRD completes the "last mile" of the migration spec + UI redesign spec. It deliberately re-uses every design token, layout wrapper, and API client convention already introduced by the two preceding specs.

## Functional Requirements

### FR-1: Elevate Design System on All Remaining Pages

- **FR-1.1**: The following pages MUST wrap their content in `PublicLayout`:
  `/vote`, `/verify`, `/verify/[id]`, `/proof/[id]`, `/results`, `/integrity`, `/witnesses`.
- **FR-1.2**: The following admin pages MUST wrap their content in `SidebarDashboardLayout` with `role="admin"`:
  `/trustees`, `/simulator` (moved into admin sidebar as "Attack Simulator" entry; existing `/simulator` route redirects 308 to `/admin/simulator` OR sidebar nav adds an entry to the public route — single canonical location).
- **FR-1.3**: Every page uses only the elevate palette CSS vars and utility classes. No raw Tailwind teal/slate/emerald tone references (`bg-teal-*`, `bg-slate-900`, `text-slate-muted`, etc.) remain outside `globals.css` and `tailwind.config.js` color aliases that already map to the elevate palette.
- **FR-1.4**: All primary CTA buttons, navigation pills, and badges use `rounded-full` (16px radius via `--radius`); cards use `rounded-2xl`; pastel accent cards use the canonical 4 classes `.pastel-peach`, `.pastel-lavender`, `.pastel-lime`, `.pastel-sky`.

### FR-2: Real Backend-Driven Data, No Mock Fallbacks

- **FR-2.1**: Every list/table/stat/chart on every page is sourced via a typed function in `frontend/src/lib/api/*` using the shared `http.ts` client. No raw `fetch()` calls in pages (`vote/page.tsx` is rewritten to use `@/lib/api/voting.ts` + `@/lib/api/auth.ts` wrappers).
- **FR-2.2**: No catch block may fabricate a fake success response (e.g. `simulator` currently makes a full `DemoAttackResponse` from scratch on error). Catching an error is allowed ONLY to: (a) show a Sonner toast, (b) surface an empty-state component, (c) keep previously fetched data visible while flagging the failure.
- **FR-2.3**: `auth.ts:registerVoter()` performs a real POST against a new `/api/v1/auth/voters/register` endpoint (see FR-4.1) and returns the backend response verbatim. No synthetic success. Catch block re-throws or surfaces via toast.
- **FR-2.4**: `auth.ts:requestDemoOTP()` returns the OTP from `getDemoInbox()` only. Any failure (empty inbox, network error) surfaces as an error to the user + Sonner toast. The `|| { otp: "123456" }` fallback is deleted. The user may still type "123456" manually if the demo seed actually generated it (the backend seed is the source of truth).
- **FR-2.5**: The `dashboard/page.tsx` arrays `weeklyVotingData`, `nextEvents`, `activityItems`, `receipts`, `activeElections`, and the 4 stats are populated from new backend endpoints (FR-4.6, FR-4.7, FR-4.8) where appropriate, or from aggregated existing endpoints (election config + voter receipts + integrity status). Hardcoded initial values are acceptable ONLY as skeleton-loading placeholder structure that is immediately overwritten by a `useEffect` fetch; the final rendered DOM after loading must not contain the demo literal strings.

### FR-3: Real Session Validation & Clean Auth Flow

- **FR-3.1**: `useVoterSession` calls a new `voterMe()` introspection endpoint (`GET /api/v1/auth/voter/me`) on mount and on the 2s interval, and transitions `authenticated=false` on any 401/403/network error — not just on cookie absence. The previous 2s interval pattern is preserved so guards still feel reactive.
- **FR-3.2**: `useAdminSession` calls `adminMe()` on mount and sets `authenticated=true` IFF the API returns 2xx with a valid user object. If `adminMe()` throws, `authenticated=false`; the previous "check cookie if API fails" fallback is deleted.
- **FR-3.3**: Auth guard redirects preserve deep links. Unauthenticated visit to `/dashboard/profile` redirects to `/auth/student/login?next=%2Fdashboard%2Fprofile`. Post-OTP success, `router.push(searchParams.next || "/dashboard")`. Same for admin. The logic is centralized in the two hooks OR in a guard component — whichever matches existing patterns in the codebase.
- **FR-3.4**: The 3 redirect pages (`/login`, `/register`, `/admin/login`) no longer hardcode `http://localhost/` in `NextResponse.redirect`. They use relative URLs: `redirect("/auth/student/login", "replace")`, etc. The existing pattern with `RedirectType.replace` that already works elsewhere is the canonical one.

### FR-4: Missing Backend Endpoints (New)

Add the following endpoints to the FastAPI app and register them in `router.py`. Each must have: rate-limit/CSRF/RBAC guards consistent with neighboring endpoints, proper Pydantic schemas in `schemas/`, repo wiring in `repositories/`, and service-level logic in `services/` when nontrivial.

- **FR-4.1 Voter registration**: `POST /api/v1/auth/voters/register` → body: `{student_external_id, display_name, email, department, year_of_study}` → creates or returns existing `Voter`. Returns a JWT-style opaque one-time-registration-ack token. Guards: rate-limit per IP + ID; no duplicate enrollment without explicit email-change flow.
- **FR-4.2 Admin Voters Roster list**: `GET /api/v1/admin/elections/{election_id}/voters` with `?status=eligible|voted|all&page=&size=` → paginated list of Voters for the election, including: voter_external_id (truncated hash for privacy — never raw ID in production list — FR15 explicitly avoids identity leaks here except for election admins with explicit permission; per existing FR3/FRAcceptance matrix, ELECTION_ADMIN and above MAY see the voter_external_id within the admin console), display_name, department, year, marked_voted bool, token_issued_at, voted_at, otp_attempt_count.
- **FR-4.3 Admin Ballot Ledger list**: `GET /api/v1/admin/elections/{election_id}/ballots?page=&size=` → paginated list of `SealedBallot` rows: ledger_index, entry_hash (short), created_at, ballot_fingerprint, prev_hash (short), device_type (if known). NO candidate choice, NO voter identity linkage. Counts endpoint: `GET /admin/elections/{id}/ballots/counts` → `{total, last_24h, by_hour_last_7d}` for the dashboard chart.
- **FR-4.4 Admin Reports / Evidence Bundle**:
  - `GET /api/v1/admin/reports/evidence/{bundle_id}` → JSON download of the evidence bundle (the entity already stores a JSONB payload and/or MinIO object ref; endpoint returns signed URL or inline JSON depending on what the entity actually has).
  - `GET /api/v1/admin/reports/election/{election_id}` → Election summary report JSON: candidates, counts, two-books numbers, integrity hash, witnesses summary.
- **FR-4.5 Profile + Preferences endpoints**:
  - `GET /api/v1/auth/voter/me` (FR-3.1) → returns voter profile: display_name, email, department, year, campus, active_sessions[].
  - `PATCH /api/v1/auth/voter/me` → update email / display_name / preferences JSONB.
  - `GET /api/v1/auth/admin/me` → returns admin profile (already exists; alias).
  - `PATCH /api/v1/auth/admin/me` → update admin profile + preferences JSONB.
  - `GET /api/v1/admin/users` + `PATCH /api/v1/admin/users/{id}/roles` → admin/settings "Officer & Trustee Management" persistence.
- **FR-4.6 Student Dashboard Activity Timeline**: `GET /api/v1/voter/activity?limit=` → list of recent actions (OTP_REQUESTED, OTP_VERIFIED, TOKEN_ISSUED, BALLOT_CAST, BALLOT_TESTED, PROOF_VIEWED) — synthesized from `audit_events` filtered by current voter identity via secure session.
- **FR-4.7 Student Active Elections + Receipts list**:
  - Extend `GET /api/v1/elections` (already lists elections) with a voter-scoped flag `?scope=me` that returns the voter's participation state per election (eligible, voted, closed, token_issued).
  - `GET /api/v1/voter/receipts?election_id=&page=&size=` → voter's sealed ballot receipts: ledger_index, entry_hash, sth_size, sth_root, sth_ts, election_id, cast_at. Used by the dashboard "My Receipts" tab and Profile "Election History".
- **FR-4.8 Weekly Voting + Next Events**:
  - `GET /api/v1/elections/{id}/stats/by-hour?days=7` → per-hour vote counts for charting the weekly progress card.
  - `GET /api/v1/elections/{id}/milestones` → election lifecycle milestones (OPEN, debate, closes, tally, results) as structured `{title, date, kind, status}` for the Next Events card.

### FR-5: New Admin Sub-Pages (FR15 Completion) + Existing Admin Nav

- **FR-5.1 `/admin/voters` page** (SidebarDashboardLayout admin). Paginated Voters Roster table (from FR-4.2). Search box, status chips (Eligible / Voted / Void), per-election scope selector, Export CSV button (client-side CSV of the paginated data is fine; backend export endpoint is non-goal). Links to `/admin/ballots` via "View Ballot Ledger" CTA.
- **FR-5.2 `/admin/ballots` page** (SidebarDashboardLayout admin). Paginated SealedBallot rows (FR-4.3). Color-coded hash chain links (prev / current hash short columns), per-hour chart card using the counts endpoint, CTA to jump to public verify for a given row via fingerprint.
- **FR-5.3 `/admin/reports` page** (SidebarDashboardLayout admin). 3 cards: Latest Evidence Bundle (links to FR-4.4 download), Election Summary Report JSON preview + download, Tally Session Reports (per session).
- **FR-5.4 Sidebar nav entries** (SidebarDashboardLayout admin): Add entries for "Voter Roster" → `/admin/voters`, "Ballot Ledger" → `/admin/ballots`, "Reports" → `/admin/reports`. "Attack Simulator" nav entry links to the canonical location per FR-1.2.
- **FR-5.5 `/admin/simulator` route**: Create `frontend/app/admin/simulator/page.tsx` (rewrap the existing simulator content in SidebarDashboardLayout admin per FR-1.2). Existing `/simulator` route becomes a 308 redirect → `/admin/simulator`.
- **FR-5.6 `/admin/trustees` route**: Create `frontend/app/admin/trustees/page.tsx` (SidebarDashboardLayout admin; rewrap existing trustees content with proper elevate DS). Existing `/trustees` route becomes a 308 redirect → `/admin/trustees`. Admin sidebar already has a Trustees entry; confirm it points here.

### FR-6: Backend Model & Drift Repairs

- **FR-6.1 New Alembic migration `0002_enum_orphan_fixes.py`**:
  - ALTER TYPE `election_state` ADD VALUE `SETUP`, `DECRYPTING`, `PUBLISHED` (in order, after `FROZEN` or at correct alphabetical/chronological position).
  - ALTER TYPE `witness_status` ADD VALUE `ACCEPTED`, `REJECTED`.
  - ALTER TYPE `tally_session_status` ADD VALUE `COMPLETED`, `FAILED`.
  - DROP TABLE `voter_auth_attempts` (fully orphaned).
  - DROP TABLE `demo_scenarios` (fully orphaned; demo attacks live in code, not this table per current usage).
- **FR-6.2 SpoiledBallotRepo fix**: Rename (or alias) `append()` → `create_spoiled_ballot(verification_ok: bool, ciphertext_payload: str | None, ...)` such that call sites in `voting.py:115` and `ballots.py:102` succeed with their current kwargs (`is_match` → mapped to `verification_ok`; `ciphertext_payload` accepted). Alternatively, fix each call site to match the repo signature and keep one canonical method — whichever is less invasive. Either way, the post-condition is: a spoiled test-ballot call correctly inserts one row into `spoiled_test_ballots` with the test result and payload populated.
- **FR-6.3 Enum consistency**: `backend/app/models/enums.py` and the Postgres enum type must agree exactly. `enums.py` values that are NEVER referenced anywhere may be removed instead of adding them to the DB; take the minimal path that eliminates all runtime persistence failures and produces a clean `alembic check` (no autogenerate diffs).

### FR-7: Flow Simplification & UX Polish

- **FR-7.1 Breadcrumbs**: `SidebarDashboardLayout` auto-generates breadcrumbs from `usePathname()` segments. E.g. `/admin/voters` → "Governance Center / Voter Roster".
- **FR-7.2 Skeletons**: Replace all text-only "Loading…" states with the existing `SkeletonCard` / `SkeletonPastelRow` components (created in UI redesign task 7; locate and reuse).
- **FR-7.3 Toasts**: Every user-initiated action (form submit, button click, file upload) emits at least one Sonner toast on success OR error. No silent failures.
- **FR-7.4 Empty states**: Every list view that can legitimately be empty renders a pastel card with an icon and friendly copy + single CTA (e.g. "Seed demo data", "No receipts yet — cast a ballot").
- **FR-7.5 Dead-end forms**: All forms in `dashboard/profile`, `dashboard/settings`, `admin/settings` that previously fired a toast-only must now PATCH the real endpoints (FR-4.5) and only show "Saved successfully" after a 2xx response; otherwise show the server error.

### FR-8: Admin Settings & Dashboard Profile Persistence

- **FR-8.1 `dashboard/profile/page.tsx`**: Personal info, election history, sessions, linked devices read from `GET /voter/me` (FR-4.5) + `GET /voter/receipts` (FR-4.7) + `GET /voter/activity` (FR-4.6). "Save Changes" calls `PATCH /voter/me`. "Request OTP to verify email" (stub button) now actually calls existing `requestOTP` against the current email.
- **FR-8.2 `dashboard/settings/page.tsx`**: Notification + display + security toggles read/write the JSONB preferences column via `GET/PATCH /voter/me`.
- **FR-8.3 `admin/settings/page.tsx`**:
  - "Officer & Trustee Management" reads from `GET /admin/users` and "Change Role" button calls `PATCH /admin/users/{id}/roles` (FR-4.5).
  - Security toggles (Session Timeout, 2FA — stubs for now) and Notification channels read/write via `GET/PATCH /admin/me` preferences JSONB.
  - Export buttons → call the Reports endpoints (FR-4.4) and stream the download.

### FR-9: Vote Flow Cleanup (`/vote` page)

- **FR-9.1 Replace raw `fetch()` calls**: Step 1 OTP request → `requestOTP()`; Step 2 OTP verify → `verifyOTP()`; Step 3 token → `getVotingToken()`; Step 5 test ballot → `testBallot()`; Step 6 cast → `castBallot()`. All from `@/lib/api/auth.ts` + `@/lib/api/voting.ts`. Any inlined fetch helpers that conflict are removed.
- **FR-9.2 Candidate data**: The candidate select step renders candidates ONLY from `getElectionConfig()` (already exists). If it returns an empty list, the empty-state (FR-7.4) card shows "No candidates — please wait for election setup"; the inline fallback `["Candidate A …", "Candidate B …"]` is deleted.
- **FR-9.3 Test My Ballot badge**: Step 5 displays `TEST PASSED` only if the API response actually indicates success. If mismatch, displays `TEST FAILED — DO NOT CAST` red banner + toast.warning + disables the "Cast Real Ballot" button (current flow already has this logic but it was short-circuited by unconditional success copy).
- **FR-9.4 PublicLayout wrap**: `/vote` page is wrapped in `PublicLayout` per FR-1.1. Stepper progress dots, card containers use rounded-2xl, pastel cards for step info panes.

## Non-Functional Requirements

- **NFR-1 Build**: `npm run build` in `frontend/` exits 0; 0 TS strict errors.
- **NFR-2 Lint/Typecheck**: `npm run lint` and `npx tsc --noEmit` in `frontend/` pass. Backend: `ruff check backend/app` + `mypy backend/app` pass (or only pre-existing unrelated warnings).
- **NFR-3 Migration Idempotency**: `alembic upgrade head` followed by `alembic downgrade -1` then `alembic upgrade head` succeeds cleanly on an empty PostgreSQL DB.
- **NFR-4 API Type Safety**: Every new frontend API module function has explicit Pydantic-shaped TypeScript `type`/`interface` for request and response. No `any`.
- **NFR-5 No Hardcoded Demo Creep**: Demo shortcut credentials (RGIT26001, admin/admin123) may remain as input `defaultValue` (UX convenience) but never as unconditional bypass success values in client logic.
- **NFR-6 Backwards Compatibility**: Existing frontend routes (`/dashboard`, `/admin`, `/vote`, `/verify`, `/results`, `/integrity`, `/witnesses`, `/proof/[id]`, `/verify/[id]`) continue to work; only `/simulator` and `/trustees` are aliased into admin via 308 redirects (per FR-5.5, FR-5.6).
- **NFR-7 No Layer Violations**: Routes thin → services → repos clean separation (already established; preserve). New endpoints follow this pattern.

## Constraints

- **Technical**: Stack locked per migration spec. No substitutions.
- **Visual**: Elevate DS only — Manrope, exact palette (lime #DAF39F active pill, 4 pastel accents, #F5F5F4 bg, #202124 fg, #FFF card, 16px radius), subtle shadow cards.
- **Cryptographic Preservation**: `gb/crypto.py`, `gb/merkle.py`, `gb/witness.py` remain authoritative; adapt via services only.
- **DB Authoritative**: PostgreSQL is the source of truth. Redis caches only (never ballot ledger, never voter identity state).

## Assumptions

1. DEMO_MODE=true is still the default dev environment and the demo OTP inbox endpoint remains guarded by DemoGuard. Production OTP delivery is still out-of-scope.
2. Trustee key shares stored-at-rest-encrypted pattern (flagged for production) stays; no HSM integration here.
3. MinIO/evidence bundle: the current entity stores what it stores; the reports endpoint (FR-4.4) returns whatever is present now without a rewrite of the evidence-bundle creation service (which already works per migration FR9/FR12).
4. Admin users list (FR-4.5 `GET /admin/users`) can reuse the existing `User` entity + joins to `UserRole`/`Role`. Seeded roles and admin user creation follow the existing bootstrap pattern (super admin created on first run via `admin_user: admin/admin123` in migration/env).

## Open Questions

- [ ] **Q1**: Should `/simulator` remain a public route (for academic demo visitors) AND also appear in the admin sidebar, or should it be admin-only? Migration spec FR13 says "Tamper Demo Center (DEMO_MODE only)" and FR15 admin pages list it under admin. It makes more sense **admin-only** because demo/attack endpoints already require DemoGuard + RBAC. Proposal: `/simulator` → 308 → `/admin/simulator` + Admin Sidebar entry. Confirm.
- [ ] **Q2**: Same for `/trustees`. Trustee tally approval is a privileged role action. Proposal: `/trustees` → 308 → `/admin/trustees` + Admin Sidebar. Confirm.
- [ ] **Q3**: Voter roster in `/admin/voters` — given the strict "IDENTITY ≠ BALLOT" invariant, should we display `voter_external_id` only to SUPER_ADMIN and mask it (\*\*\*\*) for ELECTION_ADMIN? Current migration spec FR2 says "No plaintext identity-to-ballot mappings stored". Display of external IDs in the admin console (admin-only UI, not public, not linked to ballot rows) is a UX trade-off. Proposal: show external IDs + name to ELECTION_ADMIN and above; but the ballot ledger row list (FR-5.2) never shows any identity field — zero cross-link possible in any UI. Confirm.

## Acceptance Criteria

### AC-1: All Pages Use Elevate DS

- **Type**: `rule`
- **Given**: Clean browser. Code has been deployed.
- **When**: Visiting every non-redirect route: `/`, `/vote`, `/verify`, `/verify/0`, `/proof/0`, `/results`, `/integrity`, `/witnesses`, `/auth`, `/auth/student/login`, `/auth/student/register`, `/auth/admin/login`, `/dashboard`, `/dashboard/profile`, `/dashboard/settings`, `/admin`, `/admin/settings`, `/admin/voters`, `/admin/ballots`, `/admin/reports`, `/admin/simulator`, `/admin/trustees`.
- **Then**: (a) All pages render with `PublicLayout` or `SidebarDashboardLayout` wrapper present. (b) No legacy `bg-teal-*` / `bg-slate-900` / `text-slate-muted` raw tones are used anywhere in element class names (grep across `frontend/app/**/*.tsx`). (c) Primary CTA buttons, nav pills, badges use `rounded-full`. (d) Card components use `rounded-2xl` and pastel classes where applicable.
- **Pass Condition**: Route-by-route DOM inspection + grep both satisfy (a)-(d).
- **Evidence**: Build output, grep log, and per-route screenshot checklist.

### AC-2: No Mock Data Bypasses In Final Render

- **Type**: `rule`
- **Given**: Backend running (DEMO_MODE true or false), frontend running, backend down scenario also tested.
- **When**: Loading dashboard, profile, settings, admin/voters, admin/ballots, admin/reports, trustees, simulator, vote flow.
- **Then**: (a) All rendered data is from API response objects (inspect React devtools / add console.logs if needed). (b) If backend is DOWN, each page shows a clear error state + Sonner toast + skeleton or empty state; no fabricated "success" cards with fake content. (c) `registerVoter()` performs a real network call (verified in devtools Network) — it is not a no-op. (d) `requestDemoOTP()` no longer hardcodes `"123456"` fallback (grep for literal string `"123456"` outside of default input values returns 0 in logic flow).
- **Pass Condition**: Functional verification of (a)-(d) with both backend-up and backend-down scenarios.
- **Evidence**: Network panel HAR + grep log.

### AC-3: Session Validation Always Server-Side

- **Type**: `rule`
- **Given**: Clean browser (no cookies).
- **When**: (Scenario A) Manually set `gb_voter_session` cookie to any junk value → navigate to `/dashboard/profile`. (Scenario B) Set `gb_admin_session` junk cookie → navigate to `/admin/voters`. (Scenario C) Start at `/dashboard/profile` → login → redirect back to `/dashboard/profile` via `?next=`.
- **Then**: A → redirected to `/auth/student/login` (NOT shown authenticated dashboard). B → redirected to `/auth/admin/login`. C → after successful OTP verify, lands on `/dashboard/profile` (not `/dashboard`).
- **Pass Condition**: All three scenarios behave correctly.
- **Evidence**: Step-by-step browser walkthrough log.

### AC-4: Missing FR15 Admin Pages Work End-to-End

- **Type**: `rule`
- **Given**: Logged in as SUPER_ADMIN.
- **When**: Visiting `/admin/voters`, `/admin/ballots`, `/admin/reports` and triggering actions (refresh, search, page, download report).
- **Then**: (a) Sidebar shows entries for all three pages. (b) Each page renders a non-empty list with real data (after demo seed). (c) API endpoint HTTP 200 on all calls (DevTools). (d) Pagination and empty states both work correctly.
- **Pass Condition**: UI walkthrough showing all three pages functional with seeded data.
- **Evidence**: Screenshots + network panel.

### AC-5: Profile & Settings Actually Persist

- **Type**: `rule`
- **Given**: Student logged in (RGIT26001/123456).
- **When**: (a) Change display_name in `/dashboard/profile` → Save Changes. (b) Toggle Email notifications in `/dashboard/settings` → toggle saved. (c) Reload page (hard refresh Ctrl+F5).
- **Then**: After reload, display_name and notification toggle still reflect the saved values — they are read from the backend. Same pattern verified for admin settings (change role of a user, hard refresh, role persisted).
- **Pass Condition**: Hard-refresh persistence confirmed for student profile + settings + admin settings + roles.
- **Evidence**: Before / after refresh screenshots + DB `SELECT` queries confirming rows updated.

### AC-6: Vote Flow Clean (No Raw Fetch, No Short-Circuits)

- **Type**: `rule`
- **Given**: Student logged in, election open, demo seeded.
- **When**: Full `/vote` walkthrough Steps 1-6 with Network panel open.
- **Then**: (a) Every API call is routed through the typed `@/lib/api/*` wrappers (Network call stack trace shows the wrapper file, not page-level raw fetch). (b) Benaloh test with a mismatch shows TEST FAILED banner. (c) Casting succeeds only when API returns success. (d) Proof Card after cast contains actual `entry_hash` / `root_hash` / `ledger_index` from the response — not hardcoded.
- **Pass Condition**: Step-by-step walkthrough with network stack traces.
- **Evidence**: Video or annotated screenshots of the 6 steps.

### AC-7: Alembic Migration 0002 Succeeds + State Persistence

- **Type**: `rule`
- **Given**: Empty PostgreSQL DB. Backend at HEAD.
- **When**: `alembic upgrade head` → then trigger a state transition that saves an election with state=SETUP (or uses any newly added enum value) → then `alembic downgrade -1` → then `alembic upgrade head` → then `alembic check` (autogenerate reports no changes).
- **Then**: Upgrade/downgrade/upgrade all succeed. The `alembic check` post-condition shows "No new upgrade operations detected". The newly added enum values round-trip correctly (no `InvalidTextRepresentation` from PostgreSQL).
- **Pass Condition**: Full command sequence exits 0; enum roundtrip rows insert OK; autogenerate diff empty.
- **Evidence**: Shell command transcript.

### AC-8: No Build / Type / Lint Errors

- **Type**: `rule`
- **Given**: Fresh clone + `npm install` (frontend) + `pip install` (backend).
- **When**: Run `npm run lint`, `npm run typecheck`, `npm run build` (frontend); `ruff check backend/app`, `mypy backend/app` (backend).
- **Then**: All commands exit with code 0.
- **Pass Condition**: Exit codes 0 across all 5 commands.
- **Evidence**: Console transcript for each command.

### AC-9: UI Visual Fidelity (Rubric)

- **Type**: `rubric`
- **Dimension**: Overall visual match to elevate DS on all 9 remediated pages.
- **Scale**: 1-5
- **Anchors**: 1 = Still using legacy teal/slate palette, no layout wrappers. 3 = Wrappers present but inconsistent pastel usage / rounded-full pills missing on 2+ pages, text font not Manrope. 5 = All wrappers, exact palette (#DAF39F active pill, 4 pastels in accent-card order per page), Manrope visibly applied, rounded-full pills on every CTA/badge, 16px radius visually matching reference screenshots on every card and button.
- **Pass Threshold**: >= 4
- **Evidence**: Per-page screenshot side-by-side with elevate landing/admin reference screenshots already in `glassballot-ui-redesign` scope.

### AC-10: End-to-End Flow Quality (Rubric)

- **Type**: `rubric`
- **Dimension**: End-to-end user flow simplicity + correctness.
- **Scale**: 1-5
- **Anchors**: 1 = Broken links, redirect loops, 404s on new routes. 3 = Every page renders but some breadcrumbs wrong, deep-link redirect flaky, skeletons missing on 1+ pages, error messages cryptic. 5 = Landing → /auth role select → login → deep-link return correct → dashboard sub-nav + breadcrumbs all accurate → profile/settings save persist → new admin pages functional → logout → back to landing; skeletons everywhere; toasts for every action; clean friendly errors with suggested next steps.
- **Pass Threshold**: >= 4
- **Evidence**: Walkthrough script + transcript.

### AC-11: Responsiveness (Rubric)

- **Type**: `rubric`
- **Dimension**: Mobile / tablet quality of the 9 newly redesigned pages.
- **Scale**: 1-5
- **Anchors**: 1 = Layout breaks on mobile (sidebar overflows, cards wrap badly). 3 = Desktop works only; mobile needs manual zoom. 5 = Mobile (sidebar drawer on dashboards; public pages single-column stacked), tablet, and desktop all clean; auth split-screen stacks correctly; tap-targets >= 44px; keyboard focus states use lime ring.
- **Pass Threshold**: >= 4
- **Evidence**: Breakpoint screenshots (375px / 768px / 1280px) for 3 representative pages (vote, integrity, admin/voters).
