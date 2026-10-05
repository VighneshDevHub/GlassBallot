# GlassBallot — UI Consistency + Backend Integration — Implementation Plan

---

## Task 1: Backend — Alembic Migration 0002 (Enum Drift + Orphan Tables)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Create `backend/alembic/versions/0002_enum_orphan_fixes.py` (use `alembic revision -m "enum and orphan fixes"`).
  - `upgrade()`:
    - Add missing values to 3 PostgreSQL enums (use `ALTER TYPE ... ADD VALUE IF NOT EXISTS`):
      - `election_state` → `SETUP`, `DECRYPTING`, `PUBLISHED`
      - `witness_status` → `ACCEPTED`, `REJECTED`
      - `tally_session_status` → `COMPLETED`, `FAILED`
    - Drop tables `voter_auth_attempts` and `demo_scenarios` (CASCADE foreign keys if any; confirm migration 0001 has no FKs pointing to them).
  - `downgrade()`: Re-create the two dropped tables (mirror 0001 DDL) and remove the 7 added enum values (Postgres does not support DROP VALUE directly; if `ALTER TYPE ... DROP VALUE` is unavailable, document limitation and downgrade step just re-creates tables only).
  - Confirm `backend/app/models/enums.py` values match Postgres exactly (add / remove minimal deltas).
  - Fix fully orphaned entity references (if any code imports `VoterAuthAttempt`/`DemoScenario`, remove — audit via grep).
- **Acceptance Criteria Addressed**: AC-7, AC-8
- **Test Requirements**:
  - `rule` TR-1.1: On empty PostgreSQL, `alembic upgrade head` exits 0.
  - `rule` TR-1.2: Round-trip `alembic downgrade -1` → `alembic upgrade head` exits 0 both times.
  - `rule` TR-1.3: `alembic check` (autogenerate) after running upgrade head returns "No new upgrade operations detected" (exit 0).
  - `rule` TR-1.4: Insert a test row with `election_state='SETUP'` + `tally_session_status='COMPLETED'` + `witness_status='ACCEPTED'` succeeds (no `InvalidTextRepresentation`).
  - `rule` TR-1.5: `postgres=# \d voter_auth_attempts` + `\d demo_scenarios` → "Did not find any relation".
- **Notes**: Pre-requisite for Task 2 (SpoiledBallotRepo) and all future persistence of new states. Run first.

---

## Task 2: Backend — SpoiledBallotRepo Method Signature Fix
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - In `backend/app/repositories/spoiled_ballot_repo.py` (or wherever the repo lives):
    - Option A (less repo change, more route change): Fix call sites in `voting.py` + `ballots.py` to call `append(verification_ok=is_match, ciphertext_payload=ciphertext_payload)` — add missing `ciphertext_payload` kwarg support to `append()` if not present.
    - Option B (less route change, more repo change): Add `create_spoiled_ballot(**kwargs)` alias that accepts `is_match` (renamed to `verification_ok` internally) and `ciphertext_payload`.
  - Choose the option that results in fewer total line changes.
  - Add a small unit test that calls the endpoint with a test-ballot spoil and confirms a `SpoiledTestBallot` row exists afterward with correct `verification_ok` bool and non-null `ciphertext_payload`.
- **Acceptance Criteria Addressed**: FR-6.2, AC-8
- **Test Requirements**:
  - `rule` TR-2.1: `POST /api/v1/ballots/test` with valid spoil payload → 2xx response AND exactly 1 new row in `spoiled_test_ballots` with `verification_ok = <expected bool>`.
  - `rule` TR-2.2: No `TypeError` or "unexpected keyword argument" errors in logs during the call.
- **Notes**: Small but critical latent bug fix; keep change surgical.

---

## Task 3: Backend — New Endpoints Batch A (Auth, Voter, Profile, Preferences)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1 (enum drift only; not strictly required but nice to have completed first)
- **Description**:
  - New Pydantic schemas in `backend/app/schemas/` as needed (e.g. `voter_profile.py`, `admin_users.py`, `activity.py`, etc.):
    - `VoterRegisterIn`, `VoterRegisterOut`
    - `VoterMeOut`, `VoterMePatch`
    - `AdminUsersListOut`, `AdminUserRolePatch`
    - `ActivityItemOut`
    - `VoterReceiptOut`
    - `ElectionStatsByHourOut`, `ElectionMilestoneOut`
  - New repo methods as needed in existing repos:
    - `VoterRepo`: upsert from registration, get-by-election with pagination (filter by voted status), get-me
    - `UserRepo`: list admin users with roles, patch roles
    - `AuditRepo`: get activity items scoped by voter identity
    - `SealedBallotRepo`: get voter's receipts (join via token identity where valid; remember no identity linkage — receipts are by voter-facing receipt token hash stored in the voter record if present; otherwise synthesize from the voter's known ballot_token entries → find matching sealed ballots)
  - New route file additions (add to existing route files OR add new route files and include in `api/router.py`):
    - **FR-4.1**: `POST /api/v1/auth/voters/register` → `routes/auth.py`
    - **FR-4.5**: `GET /api/v1/auth/voter/me`, `PATCH /api/v1/auth/voter/me` → `routes/auth.py`; `PATCH /api/v1/auth/admin/me` → `routes/auth.py`; `GET /api/v1/admin/users`, `PATCH /api/v1/admin/users/{id}/roles` → `routes/admin.py`
    - **FR-4.6**: `GET /api/v1/voter/activity` → new `routes/voter.py` or inside `routes/auth.py` under voter scope
    - **FR-4.7**: `GET /api/v1/elections?scope=me` (extend existing `/elections` list) → `routes/elections.py`; `GET /api/v1/voter/receipts` → `routes/voter.py`
    - **FR-4.8**: `GET /api/v1/elections/{id}/stats/by-hour`, `GET /api/v1/elections/{id}/milestones` → `routes/elections.py`
  - All new endpoints get:
    - Correct auth/deps guards (admin scope RBAC, voter cookie, rate limits where applicable)
    - Consistent JSON envelope via existing http client convention
- **Acceptance Criteria Addressed**: AC-4, AC-5, AC-8
- **Test Requirements**:
  - `rule` TR-3.1: `POST /auth/voters/register` with valid payload → `Voter` row created (DB select confirms); duplicate external ID returns 409 or 200 with existing record depending on chosen semantics.
  - `rule` TR-3.2: `GET /auth/voter/me` without cookie → 401; with valid voter session → 2xx with profile matching the voter. `PATCH /auth/voter/me` → DB row updated; same via hard reload.
  - `rule` TR-3.3: `GET /admin/users` (admin session) → paginated list of users with roles; `PATCH /admin/users/{id}/roles` → `user_roles` junction updated; hard reload confirms.
  - `rule` TR-3.4: Each new endpoint returns a properly enveloped JSON response (matches the convention of neighboring endpoints; the frontend `http.ts` envelope unwrapper can parse it without modification).
- **Notes**: Largest backend task. Break into sub-changes internally (schemas → repos → routes → guards) but keep as single atomic task here for traceability.

---

## Task 4: Backend — New Endpoints Batch B (Admin Voters, Ballots, Reports)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - **FR-4.2 Admin Voters Roster**:
    - `GET /api/v1/admin/elections/{election_id}/voters?status=all|eligible|voted&page=1&size=25` → `routes/admin.py`
    - Paginated response shape: `{items: [...], total, page, size, filters_applied}`
    - SELECT columns exactly per FR-4.2 (no identity-to-ballot linkage leaked; `voter_external_id` visible to ELECTION_ADMIN+ per AC-4 / open Q3 default)
  - **FR-4.3 Admin Ballot Ledger**:
    - `GET /api/v1/admin/elections/{election_id}/ballots?page=1&size=25` → `routes/admin.py`
    - `GET /api/v1/admin/elections/{election_id}/ballots/counts` → `{total, last_24h, by_hour_last_7d: [...]}`
    - Columns exactly per FR-4.3 (NO identity, NO candidate choice)
  - **FR-4.4 Reports / Evidence**:
    - `GET /api/v1/admin/reports/evidence/{bundle_id}` → `routes/admin.py` → returns JSON content (inline) OR a 303 redirect to MinIO signed URL, depending on what `EvidenceBundle.payload` actually stores (inspect entity + existing service to decide).
    - `GET /api/v1/admin/reports/election/{election_id}` → synthesized summary report from election + candidates + tally results + reconciliation numbers + integrity + witnesses.
  - Add corresponding repo methods + Pydantic schemas + RBAC guards (ELECTION_ADMIN+ for voters/ballots, SUPER_ADMIN+ for reports if sensitive).
- **Acceptance Criteria Addressed**: AC-4, AC-8
- **Test Requirements**:
  - `rule` TR-4.1: After demo seed 10 votes, `GET /admin/elections/{id}/voters?status=voted` returns >= 10 rows; pagination `size=5` returns 5 rows + correct `total`.
  - `rule` TR-4.2: Ballot ledger endpoint returns correct `total` matching the number of cast ballots; NO column contains voter identity or candidate choice (schema inspection).
  - `rule` TR-4.3: `GET /admin/reports/election/{id}` returns JSON with keys for `candidates[]`, `counts{}`, `integrity{}`, `witnesses[]`.
- **Notes**: Pair with Task 5 (frontend pages) once this is done.

---

## Task 5: Backend — Fix Stubbed Auth + Clean http.ts Client Contract (No Code If Already OK)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - No-op verify step first: Run the new endpoints from Task 3/4 against the frontend `http.ts` envelope unwrapper.
  - If any response shape mismatches `{ ok, data, error, request_id }` or whatever `http.ts` currently expects (the one that was already audited as clean), adjust backend responses or the http client minimally so the existing wrappers in `frontend/lib/api/*.ts` work without adding `.data.data.data` chains.
  - Fix `VoterAuthAttempt` + `DemoScenario` leftover import references in Python code (delete imports / type hints that reference dropped tables). Run `ruff check` / `mypy` to confirm clean.
- **Acceptance Criteria Addressed**: AC-2, AC-8
- **Test Requirements**:
  - `rule` TR-5.1: `ruff check backend/app` → no new errors introduced; 0 new `F401 undefined name` or `F821` from orphan-table deletes.
  - `rule` TR-5.2: `mypy backend/app` → no new type errors introduced.
  - `rule` TR-5.3: A call from `frontend/lib/api/admin.ts: getAuditEvents()` and the new `GET /admin/elections/{id}/voters` both return a payload that `http.ts: response.json().data` unwraps correctly (same shape).
- **Notes**: Lightweight integration gate between backend and frontend.

---

## Task 6: Frontend — API Client Extensions (auth.ts / admin.ts / new voter.ts)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 3, 4 (backend endpoints exist or are stub-mockable during development)
- **Description**:
  - **New file `frontend/src/lib/api/voter.ts`**:
    - `voterMe(): Promise<VoterMeOut>` → GET `/auth/voter/me`
    - `patchVoterMe(patch: VoterMePatch): Promise<VoterMeOut>` → PATCH `/auth/voter/me`
    - `getVoterActivity(limit = 50): Promise<ActivityItemOut[]>` → GET `/voter/activity`
    - `getVoterReceipts(params?: { election_id?: string; page?: number; size?: number }): Promise<Paged<VoterReceiptOut>>` → GET `/voter/receipts`
    - `registerVoterReal(payload: VoterRegisterIn): Promise<VoterRegisterOut>` → POST `/auth/voters/register` (FR-2.3 real version; KEEP existing `registerVoter` for now as deprecated alias that calls through to this so old call sites don't break — then replace all usages and delete old alias at the end of this task).
  - **Extend `frontend/src/lib/api/elections.ts`**:
    - `listElections(scope?: "me" | "all"): Promise<ElectionOut[]>` → append `?scope=me` if scope set (FR-4.7)
    - `getElectionHourlyStats(electionId: string, days = 7): Promise<ElectionStatsByHourOut>` → GET `/elections/{id}/stats/by-hour`
    - `getElectionMilestones(electionId: string): Promise<ElectionMilestoneOut[]>` → GET `/elections/{id}/milestones`
  - **Extend `frontend/src/lib/api/admin.ts`**:
    - `listElectionVoters(electionId: string, params: { status?: "all"|"eligible"|"voted"; page?: number; size?: number }): Promise<Paged<VoterRowOut>>` → GET `/admin/elections/{id}/voters`
    - `listElectionBallots(electionId: string, params: { page?: number; size?: number }): Promise<Paged<BallotRowOut>>` → GET `/admin/elections/{id}/ballots`
    - `getBallotCounts(electionId: string): Promise<BallotCountsOut>` → GET `/admin/elections/{id}/ballots/counts`
    - `getEvidenceBundle(bundleId: string): Promise<EvidenceBundleOut>` → GET `/admin/reports/evidence/{id}`
    - `getElectionReport(electionId: string): Promise<ElectionReportOut>` → GET `/admin/reports/election/{id}`
    - `listAdminUsers(params?: Pagination): Promise<Paged<AdminUserOut>>` → GET `/admin/users`
    - `patchAdminUserRole(userId: string, rolePatch: RolePatch): Promise<AdminUserOut>` → PATCH `/admin/users/{id}/roles`
  - **Fix `frontend/src/lib/api/auth.ts`**:
    - **FR-2.3**: Replace stubbed `registerVoter()` body with a real call → `registerVoterReal()` (make it call the new voter.ts function). Catch block re-throws or surface error via toast at the call site — no synthetic success.
    - **FR-2.4**: Delete the `|| { otp: "123456" }` fallback from `requestDemoOTP()`. Keep the literal `"123456"` ONLY as input `defaultValue` in login forms (as UX shortcut pre-fill) — not in auth logic.
    - Remove dual-case confusion: Pick one canonical function casing (`requestOtp` / `verifyOtp` per current majority) and export the other case as a deprecated thin alias that calls through (minimal breakage of existing call sites).
  - Add TypeScript interface definitions for all new request/response shapes. No `any`.
  - Ensure `http.ts` envelope unwrapping works (covered in TR-5 / Task 5; fix if needed).
- **Acceptance Criteria Addressed**: AC-2, AC-4, AC-5, AC-6
- **Test Requirements**:
  - `rule` TR-6.1: `npx tsc --noEmit` (frontend dir) passes after all new API client code added.
  - `rule` TR-6.2: `grep -n '||.*"123456"' frontend/src/lib/api/auth.ts` → 0 matches (fallback removed; literal may still exist in login page defaults, which is OK).
  - `rule` TR-6.3: `registerVoter()` function body contains a `POST`-like `http.post(...)` call (not a fabricated return).
  - `rule` TR-6.4: Each new function in voter.ts + elections.ts + admin.ts has explicit TS interface for both request params (where applicable) and response type.
- **Notes**: Typed API surface for all new frontend pages.

---

## Task 7: Frontend — Session Hooks Real Validation + Auth Guard Cleanup
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 6 (voterMe endpoint available via client)
- **Description**:
  - **`hooks/useVoterSession.ts` rewrite (FR-3.1 + FR-3.3)**:
    - Replace cookie-only check with: on mount (and every 2s on interval), call `voterMe()` from `api/voter.ts`. If it 2xx → authenticated=true + store user object in state. If it 401/network → authenticated=false.
    - Keep reactive cookie presence check as an OPTIMIZATION for immediate render, but NEVER trust it alone — final `authenticated` value flips to false if the server call fails.
    - Export `requireAuth()` helper or integrate with `next/navigation` redirect inside pages via existing pattern — whichever matches current codebase convention. Preserve the `?next=` deep-link behavior (FR-3.3).
  - **`hooks/useAdminSession.ts` rewrite (FR-3.2)**:
    - Delete the API-failure → fallback to cookie-only logic block (the bypass).
    - `authenticated=true` ONLY when `adminMe()` returns 2xx.
    - Preserve `?next=` deep-link redirect post-login.
  - **Fix 3 redirect pages (FR-3.4)**: `frontend/app/login/page.tsx`, `frontend/app/register/page.tsx`, `frontend/app/admin/login/page.tsx` — remove `http://localhost/` hardcoded base URL (grep for it). Use relative `redirect(...)` from `next/navigation` with `RedirectType.replace`. Confirm no hardcoded `localhost` strings remain anywhere in these files.
- **Acceptance Criteria Addressed**: AC-3, AC-8
- **Test Requirements**:
  - `rule` TR-7.1 (Scenario A): DevTools → Application → Cookies. Set `gb_voter_session = "junk_value"`. Navigate to `/dashboard/profile`. Observe: 307/308 redirect to `/auth/student/login?next=%2Fdashboard%2Fprofile`.
  - `rule` TR-7.2 (Scenario B): Set `gb_admin_session = "junk_value"`. Navigate to `/admin/voters`. Redirect to `/auth/admin/login?next=%2Fadmin%2Fvoters`.
  - `rule` TR-7.3 (Scenario C): Navigate DIRECTLY to `/dashboard/profile` (no prior login). Redirected to login with next param. Successfully OTP-verify. Post-verify landing URL is `/dashboard/profile` (not `/dashboard`). Same pattern for admin.
  - `rule` TR-7.4: `grep -n "http://localhost" frontend/app/login frontend/app/register frontend/app/admin/login` → 0 matches.
- **Notes**: Security-critical. Avoid over-engineering; keep the 2s reactivity pattern for now.

---

## Task 8: Frontend — Vote Page Full Rewrap + API Wrapper Migration (FR-1.1 + FR-9)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 6, 7 (API client works, auth is real)
- **Description**:
  - Open `frontend/app/vote/page.tsx`.
  - **Wrap in `<PublicLayout>` (FR-1.1)**: Add import; wrap root JSX. Replace any custom `container`/`mx-auto` top-level padding with the layout's convention.
  - **Migrate all 6 steps to typed API wrappers (FR-9.1)**:
    - Step 1 requestOTP → `requestOTP(studentId)` from api/auth.ts
    - Step 2 verifyOTP → `verifyOTP(studentId, otp)` → set voter session (via hook post-verify).
    - Step 3 get token + election config + candidates → `getVotingToken()` + `getElectionConfig()` (use existing functions). DELETE inline fallback candidates array `["Candidate A …", "Candidate B …"]` — render empty-state pastel card (FR-7.4) when candidates.length === 0.
    - Step 4 Sealed Ballot → keep existing WebCrypto client-side sealing (it is correct per FR5). DELETE the fallback `publicKey = "BGA6T1234567890abcdef"` — instead, if config has no public key, fail with a clear error state + toast.
    - Step 5 Test My Ballot → call `testBallot()` from `api/voting.ts`. Show `TEST PASSED` green pill ONLY if `response.ok && data.match === true`. Otherwise (mismatch): render the `TEST FAILED — DO NOT CAST` red banner + disable next button + `toast.warning(...)`. DELETE unconditional success badge literal.
    - Step 6 Cast → call `castBallot()` from `api/voting.ts`. Build Proof Card from RESPONSE data (ledger_index, entry_hash, sth_root, sth_size, sth_ts). DELETE hardcoded `election_title: "Student Council Election"` — use `config.election.title`; delete `Date.now()` fallback unless sth.ts is genuinely absent.
  - **Apply Elevate DS (FR-1.3, FR-1.4)**:
    - Stepper progress dots use pastel-lime active state, rounded-full.
    - Info cards use pastel-peach/lavender/lime/sky accents per step.
    - Primary step-next buttons: rounded-full, bg-[#202124] or bg-[#DAF39F] per elevate primary/secondary convention used in landing.
    - All cards rounded-2xl, subtle `shadow-card`.
  - **Skeletons + Empty states (FR-7.2, FR-7.4)**: Replace any "Loading..." text with skeleton card components.
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-6, AC-8, AC-9, AC-10
- **Test Requirements**:
  - `rule` TR-8.1: `grep -n "fetch\(" frontend/app/vote/page.tsx` → 0 matches (all calls go through API wrapper imports).
  - `rule` TR-8.2: Root JSX has `<PublicLayout>` wrapper (import verified + open tag present).
  - `rule` TR-8.3: `grep -n "Candidate A — Tech" frontend/app/vote/page.tsx` → 0 matches (fallback deleted).
  - `rule` TR-8.4: In browser, simulate (or mock via devtools override) a test-ballot mismatch response. Confirm cast button is DISABLED AND "TEST FAILED — DO NOT CAST" text is rendered.
  - `rubric` TR-8.5: Vote page visual fidelity; scale 1-5; anchors 1=no wrapper 3=wrapper ok but pills wrong 5=full elevate match; threshold >=4; evidence: screenshot side-by-side with dashboard's elevate style.
- **Notes**: High user-impact. Ensure the cast flow's Proof Card contains fields from real API response (check DevTools response matches displayed fields).

---

## Task 9: Frontend — Rewrap 8 More Remaining Legacy Pages + Admin Alias Redirects
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 8 (same pattern, reuse PublicLayout and SidebarDashboardLayout conventions)
- **Description**:
  Go one-by-one, apply consistent elevate DS rewrapping:
  - **`/verify` (PublicLayout)**: `frontend/app/verify/page.tsx` → Wrap; move legacy `bg-teal-50` cards to `.pastel-card-white`. The quick-select 3 sample ballots become 3 pastel accent cards. Buttons: rounded-full.
  - **`/verify/[id]` (PublicLayout)**: Same palette swap.
  - **`/proof/[id]` (PublicLayout)**: Same. Proof card component already uses a bordered look; tint with a pastel-lime pastel-card outer shell.
  - **`/results` (PublicLayout)**: Swap teal/slate palette for elevate. 3 overview cards → 3 pastel-peach / lavender / lime cards.
  - **`/integrity` (PublicLayout)**: Hero status banner → pastel-lime if VERIFIED / pastel-peach (amber warn) / pastel-red (danger) per convention. 10-check results table: white rounded-2xl card.
  - **`/witnesses` (PublicLayout)**: Same palette swap; sticky alarm banner → pastel-red with rounded-2xl.
  - **`/trustees` → `/admin/trustees` (SidebarDashboardLayout role="admin") (FR-5.6)**:
    - Create NEW file `frontend/app/admin/trustees/page.tsx`. Copy the existing trustees content into it → wrap with admin layout, apply elevate DS (cards → pastel-peach/lavender/lime trustee cards, rounded-full buttons, pastel-card-white table container).
    - Delete the defaultRoster fallback (FR-2.2): if trustees endpoint returns empty, render empty-state pastel card with CTA "Open election first / Seed demo".
    - OLD `frontend/app/trustees/page.tsx` → becomes a 308 redirect: `redirect("/admin/trustees", "replace")`.
  - **`/simulator` → `/admin/simulator` (SidebarDashboardLayout role="admin") (FR-5.5)**:
    - Create NEW `frontend/app/admin/simulator/page.tsx`. Copy existing simulator content (8 scenarios + result banner + assurance section), wrap in admin layout, re-skin to elevate. Delete the fabricated fallback DemoAttackResponse that is created on error (FR-2.2): if `runDemoAttack` throws, surface error toast + keep last result or show error pastel card.
    - OLD `/simulator` → 308 redirect: `redirect("/admin/simulator", "replace")`.
  - **Update SidebarDashboardLayout nav (FR-5.4)**:
    - Admin nav entries: ADD "Voter Roster" → `/admin/voters`, "Ballot Ledger" → `/admin/ballots`, "Reports" → `/admin/reports`. Move "Trustee Tally" → `/admin/trustees`. Move "Attack Simulator" → `/admin/simulator`. (Check existing names used in sidebar component; use same ordering convention.)
  - **Update admin console overview page (admin/page.tsx) quick-action navigation links if any hardcoded `/simulator` or `/trustees` exist → point to `/admin/simulator`, `/admin/trustees`.
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-9, AC-11
- **Test Requirements**:
  - `rule` TR-9.1: Route-by-route open-tag check. `/verify`, `/verify/0`, `/proof/0`, `/results`, `/integrity`, `/witnesses` → each has `<PublicLayout>` wrapper. `/admin/trustees`, `/admin/simulator` → each has `<SidebarDashboardLayout role="admin">`.
  - `rule` TR-9.2: `grep -rn "bg-teal-50\|bg-slate-900\|text-slate-muted" frontend/app/verify frontend/app/proof frontend/app/results frontend/app/integrity frontend/app/witnesses frontend/app/admin/trustees frontend/app/admin/simulator` → 0 matches (legacy tones purged).
  - `rule` TR-9.3: Visit `/simulator` → 308 → `/admin/simulator`. Visit `/trustees` → 308 → `/admin/trustees`.
  - `rule` TR-9.4: Fabricated fallback `DemoAttackResponse` grep in `frontend/app/admin/simulator/` → 0 matches.
  - `rubric` TR-9.5: Visual fidelity of 8 pages; scale 1-5; threshold >= 4; evidence: per-page screenshot.
  - `rubric` TR-9.6: Responsiveness on 3 representative pages (vote / integrity / admin/voters); scale 1-5; threshold >= 4; evidence: 375/768/1280 px screenshots.
- **Notes**: Biggest pure-UI task. Work top-down by page type (public 6 → admin alias 2).

---

## Task 10: Frontend — Dashboard: Real Data for weeklyVotingData / nextEvents / activity / receipts / activeElections / Stats
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 6, 7, 9
- **Description**:
  - Open `frontend/app/dashboard/page.tsx`.
  - **Fetch & hydrate from API (FR-2.5)**:
    - In the existing `useEffect` or `fetchData()`, ADD calls for:
      - `getElectionHourlyStats(electionId, 7)` → hydrate `weeklyVotingData` from the real response (transform to Recharts shape).
      - `getElectionMilestones(electionId)` → hydrate `nextEvents`.
      - `getVoterActivity(10)` → hydrate `activityItems` timeline.
      - `getVoterReceipts({ size: 5 })` → hydrate `receipts`.
      - `listElections("me")` → hydrate `activeElections` 4-card grid (participation state, progress %, etc.). Reuse the 4 pastel classes cyclically (peach/lavender/lime/sky).
      - Stats grid (Ballots Cast / Elections Active / Proofs Verified / Integrity %) → derive from receipts count + election list lengths + integrity endpoint (already fetched, combine).
    - Keep the inline arrays as SKELETON placeholder shapes ONLY (e.g. while loading, render the skeleton card arrays). After API fetch resolves, state is overwritten. The POST-LOAD render must not contain the literal strings like "Budget Referendum" etc. (grep-able check).
  - **Remove the hardcoded initial demo content once skeletons are rendering properly**: Instead of full arrays, use empty or partial skeletons to avoid grep false-positives from literal strings later.
  - **Error cases**: Any API call failure → toast.error + keep skeleton visible or show friendly error pastel card + retry button.
  - **Update any "View all lessons" leftover copy (from audit) → "View all events" / appropriate wording**.
- **Acceptance Criteria Addressed**: AC-2, AC-8, AC-10
- **Test Requirements**:
  - `rule` TR-10.1: After dashboard is fully loaded (loading=false, network idle), DOM innerText contains NO literal "Budget Referendum" NO literal "Weekly Voting Progress" fallback data strings. All text comes from API response objects.
  - `rule` TR-10.2: Trigger backend down (stop API server) + reload dashboard. Dashboard shows: error toast + skeleton cards visible + NO fabricated content.
  - `rule` TR-10.3: Weekly voting Recharts bar chart renders with `weeklyVotingData[0].value` coming from API (inspect state via React DevTools).
  - `rule` TR-10.4: `grep -n "Budget Referendum\|Code of Conduct Amendment\|RGIT26001.*enrolled" frontend/app/dashboard/page.tsx` → 0 matches of inline demo content.
- **Notes**: The core "dashboard data is real" deliverable. Verify with React DevTools that post-load, state objects match API response shapes.

---

## Task 11: Frontend — Profile + Settings Pages Persist (dashboard/profile, dashboard/settings, admin/settings)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 6 (API clients for patch/me/list users), Task 7 (real auth)
- **Description**:
  - **`frontend/app/dashboard/profile/page.tsx` (FR-8.1)**:
    - On mount → `Promise.all([voterMe(), getVoterReceipts(), getVoterActivity(20)])`.
    - Populate all form inputs (`display_name`, `email`, `department`, `year`) from `voterMe()` response (NOT hardcoded "Siddharth Verma"). Avatar initials derived from response.
    - Election History table → rendered from `getVoterReceipts()`.
    - Active Sessions / Linked Devices → from `voterMe().active_sessions[]` or the closest available approximation from the endpoint.
    - "Save Changes" → `patchVoterMe({ display_name, email })`. Show `toast.success("Saved")` only on 2xx.
    - "Request OTP to verify email" → `requestOTP(email_or_id)` using existing wrapper.
    - DELETE Siddharth Verma hardcoded literals from state initial values (set `initialState = empty`; form is controlled by fetched data after load).
  - **`frontend/app/dashboard/settings/page.tsx` (FR-8.2)**:
    - On mount → `voterMe()` → read `preferences JSONB` field → hydrate the 5 notification toggles + display density + proof-display-mode + security toggles.
    - On any toggle change → debounced `patchVoterMe({ preferences: updatedPrefs })` → `toast.success()` on 2xx only.
    - All initial switch states come from server payload, not hardcoded defaults.
  - **`frontend/app/admin/settings/page.tsx` (FR-8.3)**:
    - Section 1 "Officer & Trustee Management" → `listAdminUsers()` renders the roster table (NOT the 4 hardcoded users). "Change Role" action button → `patchAdminUserRole(userId, { new_role_code })`.
    - Section 2 "Security" + Section 3 "Notifications" → read from `adminMe().preferences` (extend admin me endpoint). On toggle, `PATCH /auth/admin/me` with updated preferences.
    - Section 4 "Export" → buttons link/call `getElectionReport(currentElectionId)` + `getEvidenceBundle(latestBundleId)` downloads (use browser Blob download helper).
  - **Apply Skeletons + Errors + Empty states (FR-7)**: Replace inline mock-arrays-for-display with skeletons until load resolves. Empty state pastels for "No officers yet".
- **Acceptance Criteria Addressed**: AC-5, AC-8, AC-10
- **Test Requirements**:
  - `rule` TR-11.1: Hard refresh test: In `/dashboard/profile`, change display_name → Save. Ctrl+F5 reload. Display name reflects saved value (reads from voterMe response). Same check for 1 notification toggle in settings (student) + 1 role change in admin/settings.
  - `rule` TR-11.2: `grep -n "Siddharth Verma\|Principal Officer.*admin\|Trustee Alpha" frontend/app/dashboard/profile frontend/app/dashboard/settings frontend/app/admin/settings` → 0 matches (mock data deleted).
  - `rule` TR-11.3: Simulate API failure on patch — form stays dirty, no success toast, user sees error toast (does not say saved).
- **Notes**: Critical for the "no dead-end forms" requirement.

---

## Task 12: Frontend — New Admin Pages (Voters Roster, Ballot Ledger, Reports) + Sidebar Entries
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 6, 7, 9, 11
- **Description**:
  - **`frontend/app/admin/voters/page.tsx` (FR-5.1)**:
    - Wrap in `<SidebarDashboardLayout role="admin">`.
    - Header: "Voter Roster" h1 + election-scoped dropdown (if multiple elections exist).
    - 4 pastel-card stats row (peach/lavender/lime/sky): Eligible, Voted, Turnout %, Void Tokens. Data from listVoters endpoint totals or existing integrity numbers (use existing totals from integrity endpoint if listVoters total count is expensive; either is fine).
    - Controls: Search input (client-side filter on fetched rows), Status chips (Eligible / Voted / All), Pagination controls (Prev / Next / size selector).
    - Table: Rows from `listElectionVoters()` paginated. Columns per FR-4.2. All rounded-2xl pastel-card-white table container.
    - CTA card: "Go to Ballot Ledger →" link to `/admin/ballots`.
    - Export CSV: client-side CSV of current page rows using browser Blob.
    - Empty state: "No voters seeded" pastel card + CTA to Seed demo (link to admin overview Seed Votes button or call handler inline).
  - **`frontend/app/admin/ballots/page.tsx` (FR-5.2)**:
    - Sidebar layout.
    - Header: "Sealed Ballot Ledger" + election scope selector.
    - Chart card: Hourly votes last 7d (from `getBallotCounts().by_hour_last_7d`) → Recharts bar chart in a pastel-peach card.
    - 3 pastel summary cards: Total Ballots, Last 24h, Chain Hash Status (last entry hash short).
    - Table from `listElectionBallots()` paginated. Columns per FR-4.3 (ledger_index, entry_hash short, prev_hash short, created_at, fingerprint, CTA → "Verify Publicly" link to `/verify/${fingerprint}`).
    - Empty state: "No ballots cast yet" + CTA to seed or overview cast link.
  - **`frontend/app/admin/reports/page.tsx` (FR-5.3)**:
    - Sidebar layout.
    - 3 cards:
      - "Latest Evidence Bundle" → from `integrity.status` (has `evidence_bundle_id`). Calls `getEvidenceBundle(id)` → JSON preview in a scrollable pre tag + Download button (Blob).
      - "Election Summary Report" → calls `getElectionReport(currentElectionId)` → preview + download.
      - "Tally Session Reports" → from tally sessions (admin overview data) → links per session to download/preview.
    - All cards pastel-white; pastel accents (peach/lavender/lime) on CTA buttons.
  - **Add sidebar entries (FR-5.4 / already done in Task 9; confirm + adjust if nav component uses a config array rather than hardcoded items)**: Voter Roster, Ballot Ledger, Reports should appear alphabetically or in current sidebar order convention; active item lime pill.
- **Acceptance Criteria Addressed**: AC-1, AC-4, AC-8, AC-10
- **Test Requirements**:
  - `rule` TR-12.1: With demo data seeded (10 votes): `/admin/voters` table has >= voter rows; pagination size=5 → 5 rows + correct total. `/admin/ballots` table has >= 10 ballot rows + hourly chart renders bars.
  - `rule` TR-12.2: Sidebar nav contains visible entries for Voter Roster, Ballot Ledger, Reports. Clicking "Voter Roster" → URL changes to `/admin/voters`. Active nav item is lime pill.
  - `rule` TR-12.3: Reports page "Download" button for evidence bundle triggers a browser download (Network tab shows GET /admin/reports/evidence/{id}).
  - `rule` TR-12.4: Empty state test — before seeding any votes, `/admin/ballots` renders pastel empty-state card, not an empty table.
- **Notes**: FR15 completion deliverable.

---

## Task 13: Breadcrumbs, Skeletons, Toasts — Cross-Cutting Polish
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Tasks 8–12 (all major pages in place first)
- **Description**:
  - **Breadcrumbs (FR-7.1)**:
    - In `SidebarDashboardLayout`, compute breadcrumbs from `usePathname()` segments. E.g. `/admin/voters` → `Governance Center / Voter Roster`. Implement either:
      - A generic auto-generator that humanizes slugs (capitalize, replace `-` with space) OR
      - A static map of known routes → labels (more precise). Pick whichever matches existing patterns.
    - Insert Breadcrumb component (may already exist from UI redesign — check `frontend/src/components/ui/Breadcrumb.tsx`) between top header and page content.
    - Do the same for PublicLayout breadcrumbs on deep pages (e.g. `/verify/0` → Home / Verify / Ballot #0).
  - **Skeletons (FR-7.2)**: Locate the existing `SkeletonCard` / `SkeletonPastelRow` components (created in UI redesign Task 7). Ensure every async area across: dashboard, profile, settings, voters, ballots, reports, vote, integrity, witnesses, results, verify uses them. Any naked "Loading..." text → skeleton equivalent.
  - **Toasts (FR-7.3)**: Audit all action initiators (form submit, button clicks, nav guards fail). If any lacks success + error Sonner toasts, add them. Consistent pattern: try → on 2xx → toast.success; catch → toast.error.
  - **Empty state sweep (FR-7.4)**: For every list, even if unlikely empty (witnesses, trustees when election exists), wrap the table/grid rendering in `items.length > 0 ? … : <EmptyStateCard variant="…" title="…" cta={…}/>`.
- **Acceptance Criteria Addressed**: AC-8, AC-9, AC-10
- **Test Requirements**:
  - `rule` TR-13.1: `grep -rn ">Loading\.\.\.<" frontend/app frontend/src/components 2>/dev/null` → 0 matches (skeletonized everywhere; not text-only).
  - `rule` TR-13.2: All new dashboard/admin deep routes (`/admin/voters`, `/admin/ballots`, `/admin/reports`, `/dashboard/profile`) render breadcrumbs with >= 2 segments (Home / section / sub).
  - `rule` TR-13.3: Toast audit — manually trigger 5 distinct actions (save profile, seed votes, close election, start tally, run attack). Each produces at least one Sonner toast (success or error depending on backend state).
- **Notes**: Polish pass. Low risk, high UX quality.

---

## Task 14: Final Build + Full E2E Verification Gate
- **Status**: `pending`
- **Priority**: high
- **Depends On**: All tasks 1–13
- **Description**:
  - **Frontend**:
    - Run `npm run lint` in `frontend/`.
    - Run `npx tsc --noEmit`.
    - Run `npm run build`.
    - Fix any TS / lint / build errors introduced in this cycle.
  - **Backend**:
    - `ruff check backend/app` → fix.
    - `mypy backend/app` → fix type errors.
    - `alembic upgrade head` → on a fresh empty PostgreSQL DB.
    - `alembic downgrade -1 && alembic upgrade head` → round trip (Task 1, TR-1.2 re-verify).
    - Run any existing pytest suite (`pytest backend/tests/`) — do NOT break existing tests. If any new endpoint collides with an old test, fix the endpoint.
  - **Manual E2E in browser**:
    - Walkthrough checklist (same as AC-10 rubric):
      1. `/` → landing looks OK.
      2. `/auth` → role select works.
      3. `/auth/student/login` → OTP works → redirects to `/dashboard` or deep link.
      4. `/dashboard` → all 4 sections render with real non-literal data; sidebar clicks OK; breadcrumbs present; skeletons load first.
      5. `/dashboard/profile` → change display name → save → hard refresh → persists.
      6. `/dashboard/settings` → toggle notification → save → hard refresh → persists.
      7. `/vote` → full 6-step flow works; Proof Card has real hashes.
      8. Logout → back to `/`.
      9. `/auth/admin/login` → admin login works.
      10. `/admin/voters` → table non-empty; pagination; empty-state works before seed.
      11. `/admin/ballots` → ledger non-empty after seeding; chart renders.
      12. `/admin/reports` → evidence bundle downloads.
      13. `/admin/settings` → role change on an officer user → hard refresh → persists.
      14. Attack Simulator (now `/admin/simulator`) → 1 attack runs; integrity shows COMPROMISED + witness ALARM via real API response (not fabricated fallback).
      15. `/integrity`, `/results`, `/witnesses`, `/verify`, `/proof/0`, `/verify/0` → all wrapped, pastel palette, no legacy tones.
    - Fix any flow bugs uncovered.
  - Document any remaining minor cosmetic issues (non-blocking) in the task completion evidence.
- **Acceptance Criteria Addressed**: ALL ACs (1–11)
- **Test Requirements**:
  - `rule` TR-14.1: `npm run build` exit code = 0.
  - `rule` TR-14.2: `npx tsc --noEmit` exit code = 0.
  - `rule` TR-14.3: `ruff check backend/app` exit code = 0.
  - `rule` TR-14.4: `mypy backend/app` exit code = 0 (or pre-existing baseline).
  - `rule` TR-14.5: `pytest backend/tests/` exit code = 0 (no existing tests broken).
  - `rule` TR-14.6: `alembic upgrade head` → exit 0 on fresh DB; downgrade then upgrade exits 0.
  - `rubric` TR-14.7: Manual E2E walkthrough pass rate; scale 1-5 (1=5+ broken flows, 3=1-2 broken, 5=all 15 steps work). Threshold >= 4. Evidence: per-step checklist pass/fail log.
- **Notes**: Final quality gate. Do not proceed to Review with any failing `rule` TR here.
