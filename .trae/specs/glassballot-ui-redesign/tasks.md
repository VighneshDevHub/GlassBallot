# GlassBallot UI Redesign - Implementation Plan
*Aligned to the user-provided "elevate" design reference (Manrope + pastel palette)*

---

## Task 1: Design System (Tailwind config, CSS vars, Manrope font, tokens)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Update `tailwind.config.js`: Replace teal/slate palette with elevate colors (#DAF39F lime, #EBD3FF lavender, #FFDEB0 peach, #CFE8FF blue, #F5F5F4 bg, #202124 text). Set `--radius: 1rem`.
  - Update `frontend/app/globals.css`: New CSS vars for shadcn/ui theme matching elevate palette; subtle card shadows; body bg `bg-[#F5F5F4]`.
  - Update `frontend/app/layout.tsx`: Replace Inter with Manrope via `next/font/google`, set as `font-sans`.
  - Add utility classes for pastel card variants (`.card-peach`, `.card-lavender`, `.card-lime`, `.card-blue`).
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `rule` TR-1.1: `npx tsc --noEmit` passes (frontend dir) after config changes
  - `rule` TR-1.2: globals.css contains all 6 elevate hex colors in `:root` vars; `--radius` is 1rem
  - `rubric` TR-1.3: Font loaded & applied; scale 1-5; anchors 1=font missing 3=loaded not applied 5=Manrope visibly used; threshold >=4; evidence: Chrome DevTools computed font-family on body
- **Notes**: Run first; all downstream tasks depend on this.

---

## Task 2: Layout Components (SidebarDashboardLayout + PublicLayout)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Create `frontend/src/components/layouts/SidebarDashboardLayout.tsx`:
    - Fixed left sidebar (~240px wide), off-white bg, rounded content area
    - Sidebar inner: GlassBallot brand top (elevated-style logo mark), then nav list with icon + label; **active item pill with #DAF39F lime bg**
    - Student nav items (Overview, Cast Ballot, My Receipts, Candidates, Results, Integrity, Profile, Settings)
    - Admin nav items (Overview, Election Mgmt, Voter Roster, Ballot Ledger, Trustees, Witnesses, Integrity Audit, Attack Simulator, Reports, Settings)
    - Top header bar: Pill rounded-full search input left; notifications bell + user avatar dropdown right
    - Breadcrumbs below header inside content area
    - Mobile: sidebar collapses to hamburger drawer
    - Renders children in content area with max-w-7xl mx-auto padding
  - Create `frontend/src/components/layouts/PublicLayout.tsx`:
    - Simple clean top nav bar (brand + nav links + Auth CTA buttons), no sidebar
    - Full-width content area with proper padding
    - Rich footer, 4 columns with links + security badges
  - Create `frontend/src/components/ui/Breadcrumb.tsx` reusable
  - Create `frontend/src/components/ui/SidebarNavItem.tsx` reusable (active pill logic)
  - Create `frontend/src/components/ui/PastelCard.tsx` reusable (accepts variant: peach/lavender/lime/blue)
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `rule` TR-2.1: SidebarDashboardLayout renders without errors; active nav item has `bg-[#DAF39F]` class + rounded-full pill
  - `rule` TR-2.2: PastelCard renders 4 variant bg colors correctly (#FFDEB0, #EBD3FF, #DAF39F, #CFE8FF)
  - `rubric` TR-2.3: Layout visual fidelity vs elevate screenshots; scale 1-5; threshold >=4; evidence: screenshots
- **Notes**: Put components under `frontend/src/components/layouts/*` and `frontend/src/components/*` respectively.

---

## Task 3: Landing Page Complete Redesign (PublicLayout)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 1, 2
- **Description**:
  - Rewrite `frontend/app/page.tsx`:
    - Hero: Large Manrope bold heading, subheading, two CTAs (primary button + outline). Soft pastel gradient bg section.
    - "3 Pillars of Trust" 3-col section → PastelCard variant row (peach/lavender/blue)
    - 4 Lock architecture showcase → 4 PastelCard grid (peach/lavender/lime/blue) matching elevate's My Courses pattern
    - Live stats ribbon: 4 cards (white rounded, subtle shadow)
    - Role portals: 4 PastelCard → Student Voter, Student Hub, Officer Console, Integrity Ledger
    - Trust badges row
    - 4-column rich footer
  - Remove old duplicate footer from `layout.tsx` root; use PublicLayout's internal footer
  - Remove old security banner from root layout; move to PublicLayout as a subtle top bar
  - Keep old `SiteNav.tsx` for reference but don't render in new layouts
- **Acceptance Criteria Addressed**: AC-1, AC-7
- **Test Requirements**:
  - `rule` TR-3.1: All 6 sections present (hero, 3 pillars, 4 locks, stats, roles, footer); no runtime errors
  - `rubric` TR-3.2: Landing visual quality; scale 1-5; anchors 1=empty 3=basic 5=premium elevate-style; threshold >=4; evidence: screenshot
- **Notes**: Keep all existing link hrefs functional ("/vote", "/dashboard", "/integrity", etc).

---

## Task 4: Student Dashboard Redesign (SidebarDashboardLayout)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 1, 2
- **Description**:
  - Rewrite `frontend/app/dashboard/page.tsx`:
    - Wrap entire content in `<SidebarDashboardLayout role="student">` (prop switches nav items)
    - Page header: "My Dashboard" h1 + "Track your voting activity & ballot proofs" subheading (elevate Courses layout pattern)
    - **My Active Elections**: 4 PastelCard grid (peach/lavender/lime/blue), each with election title, desc, due date pill, progress bar, % complete — exactly like elevate My Courses
    - **Weekly Voting Progress** (Recharts bar card, peach accent) + **Next Election Events** (calendar list card) — row of 2 cards (like elevate's Weekly Progress / Next Lessons)
    - **Stats summary row**: 4 small stat tiles (Courses Completed style → Ballots Cast, Active Elections, Proofs Verified, Integrity Score)
    - **Recent Activity Timeline**: List of recent actions with date pill + icons
    - Preserve all existing data fetching logic (useEffect hooks, API calls to `/api/v1/*`) from old dashboard — just re-skin
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-7, AC-8
- **Test Requirements**:
  - `rule` TR-4.1: All 4 pastel card variants rendered in "My Active Elections" row with exact bg colors
  - `rule` TR-4.2: Sidebar nav shows STUDENT nav items (8 items); active = Overview pill
  - `rule` TR-4.3: All existing API calls preserved and functioning (no broken fetches)
  - `rubric` TR-4.4: Dashboard fidelity vs elevate screenshot; threshold >=4; evidence: screenshot
- **Notes**: Critical — do NOT remove or break existing useState/useEffect/data-fetching; only re-wrap JSX in new components.

---

## Task 5: Admin Console Redesign (SidebarDashboardLayout)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 1, 2, 4
- **Description**:
  - Rewrite `frontend/app/admin/page.tsx`:
    - Wrap in `<SidebarDashboardLayout role="admin">` (admin nav items)
    - Header: "Governance Center" h1 + subtitle; state pill for election OPEN/CLOSED
    - **System Health at a Glance**: 4 PastelCard grid (peach/lavender/lime/blue) — Matching elevate course cards pattern
    - **Election Progress** + **Security Alerts** 2-card row
    - **Quick Actions** row: Buttons to Close Election, Seed Votes, Start Tally, Verify Audit
    - **Recent Audit Activity** timeline
    - Move the 3 tabs (Demo Center / Trustees / Audit Chain) into 3 separate top-level sub-sections reachable via sidebar nav OR keep tabs but wrap in white rounded card with pastel tab indicators
    - Preserve 100% of existing business logic: admin session checks, attack handler functions, all API calls (loadAllData, handleSeedVotes, handleRunAttack, etc.)
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-7, AC-8
- **Test Requirements**:
  - `rule` TR-5.1: Admin sidebar renders 10 nav items; active=Overview lime pill
  - `rule` TR-5.2: 4 pastel system-health cards rendered with correct variants
  - `rule` TR-5.3: Attack simulator, Trustees, Audit log all functional; handlers work (no runtime error on button click)
  - `rubric` TR-5.4: Admin dashboard fidelity; threshold >=4; evidence: screenshot
- **Notes**: Preserve ALL state management. The attack simulator buttons are critical demo features; don't remove them — just re-skin into pastel-tinted cards.

---

## Task 6: Role-Segregated Authentication Pages (PublicLayout + Split-Screen)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 1, 2, 3
- **Description**:
  - Create directory `frontend/app/auth/` with:
    - `page.tsx` → /auth: Role selection landing with 2 big pastel cards (Student Voter = lime card; Election Officer = deep navy/indigo card)
    - `student/login/page.tsx` → /auth/student/login: Split-screen layout. Left half: soft pastel brand illustration panel (gradient + logo + tagline + feature bullets). Right half: clean white card with ID → OTP 2-step form. No tabs.
    - `student/register/page.tsx` → /auth/student/register: Same split-screen pattern. Enrollment form with all fields (ID, Name, Email, Dept, Year). No tabs.
    - `admin/login/page.tsx` → /auth/admin/login: Split-screen with darker/more formal left panel. Right: admin credential form (username/password).
  - Redirects:
    - Rewrite `frontend/app/login/page.tsx` to: redirect(`/auth/student/login`, RedirectType.replace)
    - Rewrite `frontend/app/register/page.tsx` to: redirect(`/auth/student/register`, RedirectType.replace)
    - Rewrite `frontend/app/admin/login/page.tsx` to: redirect(`/auth/admin/login`, RedirectType.replace)
  - Preserve ALL existing form logic / fetch handlers from old pages (OTP request, OTP verify, admin login, register). Copy handlers verbatim; don't reimplement.
- **Acceptance Criteria Addressed**: AC-4, AC-5, AC-7
- **Test Requirements**:
  - `rule` TR-6.1: No `<Tabs>` component in ANY auth page. Code inspection of 4 new auth routes.
  - `rule` TR-6.2: Old `/login`, `/register`, `/admin/login` respond with 308/redirect to new routes
  - `rule` TR-6.3: Form handlers work (student OTP request, OTP verify, admin login, student register) — all 4 handlers copied and functional
  - `rubric` TR-6.4: Split-screen auth visual quality; threshold >=4; evidence: screenshots
- **Notes**: Keep demo default values (studentId: "RGIT26001", OTP: "123456", admin: admin/admin123) — UX shortcuts critical for demo.

---

## Task 7: New Feature Pages (Profile, Settings, Notifications)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Tasks 2, 4, 5
- **Description**:
  - `frontend/app/dashboard/profile/page.tsx`: Student profile in SidebarDashboardLayout(student). Sections: Voter Info card, Academic Details, Election History table, Linked Sessions, Change Email/Password form (demo stub with toast).
  - `frontend/app/dashboard/settings/page.tsx`: Settings in student dashboard: Notifications toggles (Email, Push, Browser), Display Preferences, Privacy, Connected Devices list.
  - `frontend/app/admin/settings/page.tsx`: Admin settings: User management (invite officer, change roles), Security (2FA, session timeout), Audit preferences, Notification channels.
  - Notifications: Create `frontend/src/components/ui/NotificationsDropdown.tsx` — Popover from bell icon in dashboard top header. Shows 5 recent notifications with "View all" link. Dummy data sufficient.
  - Create skeleton loader components: `frontend/src/components/ui/SkeletonCard.tsx`, `SkeletonPastelRow.tsx` — use in place of loading text.
- **Acceptance Criteria Addressed**: AC-6, AC-7
- **Test Requirements**:
  - `rule` TR-7.1: 3 new routes render without errors
  - `rule` TR-7.2: Notifications dropdown mounts without error when bell clicked (test in browser)
- **Notes**: Demo/stub content fine; don't need backend for settings save. Use Sonner toast "Saved successfully".

---

## Task 8: Navigation Flow, Auth Guards, Breadcrumbs, Skeletons, Toasts
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 2, 4, 5, 6, 7
- **Description**:
  - Auth guards: In `useVoterSession` hook (or create guard component), redirect from any `/dashboard/*` to `/auth/student/login?next=<current path>` if unauthenticated.
  - Similarly, admin: guard `/admin/*` routes → `/auth/admin/login?next=...`.
  - Post-login redirect: Upon OTP verify success, router.push to `searchParams.get('next')` or `/dashboard` fallback. Same for admin.
  - Breadcrumb rendering in SidebarDashboardLayout: Auto-generate from `usePathname()` segments.
  - Toast integration: Wrap root layout with `<Toaster richColors />` from Sonner (check if already there). Use `toast.success()` / `toast.error()` everywhere handlers exist.
  - Add skeleton loaders to all async areas (while loading=true, render SkeletonCard rows instead of "Loading candidates..." text).
  - Update all in-app navigation links (dashboard sidebar CTA buttons, landing role cards) to point at the right new routes.
  - All route redirects (old → new) set up from Task 6.
- **Acceptance Criteria Addressed**: AC-5, AC-6, AC-8
- **Test Requirements**:
  - `rule` TR-8.1: Private route guard test: Clear cookies, access `/dashboard/profile` → redirect to `/auth/student/login` with `next` query param
  - `rule` TR-8.2: Post-login: after OTP success, go to `/dashboard/profile` if `next=/dashboard/profile` was in URL
  - `rubric` TR-8.3: Overall flow smoothness; scale 1-5; threshold >=4; evidence: walkthrough recording or step log
- **Notes**: This task ties everything together; test manually in the browser.

---

## Task 9: Final Build Verification
- **Status**: `pending`
- **Priority**: high
- **Depends On**: All tasks 1-8
- **Description**:
  - In `frontend/` run: `npm run lint` and `npm run typecheck` (from package.json scripts)
  - Fix any TS errors / warnings
  - Run `npm run build` — verify Next.js build succeeds with NO ERRORS
  - Start dev server: `npm run dev` — open localhost:3000, walk the full flow:
    1. Landing `/` → visual OK
    2. `/auth` → role cards OK
    3. `/auth/student/login` → student login works (OTP demo) → redirects to `/dashboard`
    4. Student dashboard → sidebar clicks OK, profile/settings pages render
    5. Logout → back to `/`
    6. `/auth/admin/login` → admin login works → admin dashboard OK, attack simulator works
  - Document any remaining minor issues
- **Acceptance Criteria Addressed**: All ACs via NFR-1
- **Test Requirements**:
  - `rule` TR-9.1: `npm run build` exits with code 0 (build successful)
  - `rule` TR-9.2: `tsc --noEmit` passes with 0 errors
  - `rubric` TR-9.3: Manual walkthrough; scale 1-5; threshold >=4; evidence: step log
- **Notes**: Final gate. Don't proceed past here on any failing build.
