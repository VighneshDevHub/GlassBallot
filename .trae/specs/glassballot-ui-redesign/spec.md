# GlassBallot UI Redesign - Product Requirements Document

_Updated to match user-provided "elevate" design reference_

## Overview

- **Summary**: Complete visual redesign of GlassBallot frontend matching the "elevate" SaaS UI reference: Manrope font, soft pastel palette (lime/lavender/peach/blue accent cards, off-white bg, near-black text), pill-shaped active nav, minimal rounded cards, sidebar layout for dashboards. Separate public landing vs authenticated dashboard visuals; role-segregated auth pages.
- **Purpose**: Replace current teal/slate generic look with the exact clean, friendly, minimal modern SaaS aesthetic provided in the user's design reference.
- **Target Users**: Public visitors, Student voters, Election Officers/Admins, Trustees, Auditors.

## Goals

1. Match the EXACT elevate design system: Manrope font, #DAF39F lime active pill, #EBD3FF lavender, #FFDEB0 peach, #F5F5F4 bg, #202124 text
2. Create two distinct layouts: `PublicLayout` (landing + auth, clean top nav) and `SidebarDashboardLayout` (student/admin dashboards with elevate-style sidebar + top header)
3. Role-segregated authentication: Separate pages for student login/register and admin login (no combined tabs)
4. Seamless navigation flow with auth guards, breadcrumbs, skeleton loaders, Sonner toasts
5. Expanded features: Profile, Settings, Notifications, Activity Timeline, Quick Action widgets

## Non-Goals

- No backend/crypto changes; no DB changes; no new auth mechanisms
- No dark mode in this cycle
- No rewrite of shadcn/ui components themselves (theme via CSS vars only)
- No new npm dependencies unless absolutely required (only next/font/google/Manrope is needed — it's built-in)

## Background & Context

User provided 2 screenshots of the "elevate" learning platform UI as the target aesthetic:

- Left sidebar: Logo top-left; nav items listed vertically; active item has **pill-shaped lime background (#DAF39F)**
- Top header: Pill-shaped search (left), notifications bell + avatar dropdown (right)
- Cards: White rounded cards with subtle shadow
- **Course-style cards**: Each has a pastel colored background: 1=peach (#FFDEB0), 2=lavender (#EBD3FF), 3=lime (#DAF39F), 4=soft blue
- Font: **Manrope** displayed prominently as the brand font
- Color palette specified exactly: #DAF39F (lime), #EBD3FF (lavender), #FFDEB0 (peach), #F5F5F4 (off-white), #FFFFFF (white), #202124 (near-black)
- Overall: Clean, minimal, rounded-16px cards, friendly SaaS feel

Current stack (unchanged): Next.js 14 App Router, TS strict, Tailwind 3.4, shadcn/ui (Radix), Lucide React, Recharts, Sonner.

## Functional Requirements

### FR-1: Elevate Design System

- **FR-1.1**: Tailwind + CSS vars updated with exact palette:
  ```
  --background: #F5F5F4
  --card: #FFFFFF
  --foreground: #202124
  --primary: #DAF39F  (lime green active pill)
  --primary-foreground: #202124
  --accent-1: #FFDEB0  (peach)
  --accent-2: #EBD3FF  (lavender)
  --accent-3: #DAF39F  (lime)
  --accent-4: #CFE8FF  (soft light blue)
  --success: #4CAF7A (muted verified green)
  --danger:  #E05252
  --warning: #D4A853
  --muted-fg: #5C7089
  --border: #EAEAE5
  --radius: 1rem (16px)
  ```
- **FR-1.2**: Load Manrope via `next/font/google` and set as `font-sans` globally (replace Inter)
- **FR-1.3**: All buttons/cards/inputs use 16px radius (lg), sidebar nav active item is pill-shaped
- **FR-1.4**: Card subtle shadow: `shadow-[0_2px_8px_rgba(0,0,0,0.04)]`; no hard borders
- **FR-1.5**: Create reusable layout wrappers:
  - `SidebarDashboardLayout`: Fixed sidebar + top header + content area (for dashboards)
  - `PublicLayout`: Clean marketing-oriented with simple top nav (for landing + auth)

### FR-2: Landing Page (PublicLayout)

- **FR-2.1**: Clean hero with large heading, subheading, dual CTAs
- **FR-2.2**: "Three Pillars of Trust" 3-col card section (each card soft pastel bg matching accent-1/2/4)
- **FR-2.3**: 4-Lock cryptographic pipeline (cards in elevate pastel accent colors)
- **FR-2.4**: Live stats row (4 cards with pastel variants)
- **FR-2.5**: Role portal cards: 4 pastel cards → Student Voter, Student Hub, Officer Console, Integrity Ledger
- **FR-2.6**: Trust badges + 4-col footer

### FR-3: Student Dashboard (SidebarDashboardLayout)

- **FR-3.1**: Sidebar matches elevate exactly:
  - Logo + brand name top-left
  - Nav items: Overview, Cast Ballot, My Receipts, Candidates, Results, Integrity, Profile, Settings
  - Active nav = lime (#DAF39F) pill bg with dark text
  - Icons left-aligned with text
- **FR-3.2**: Top header: Search bar (pill-shaped, rounded-full), Notifications bell, User avatar dropdown
- **FR-3.3**: Overview content:
  - Page title: "Courses" style → "My Dashboard" + subtitle
  - **My Active Elections** row: 4 pastel accent cards like "My Courses" (peach/lavender/lime/blue) with progress bars
  - **Weekly Voting Progress** chart card (Recharts, peach accent) + **Next Election Events** card
  - **Stats summary row**: 4 mini stat boxes (elevate style)
  - **Recent Activity** timeline list

### FR-4: Admin Console (SidebarDashboardLayout, slightly differentiated)

- **FR-4.1**: Sidebar nav items: Overview, Election Mgmt, Voter Roster, Ballot Ledger, Trustees, Witnesses, Integrity Audit, Attack Simulator, Reports, Settings
- **FR-4.2**: Top header: Election state pill badge, Refresh, Admin avatar + logout
- **FR-4.3**: Overview content:
  - System health 4-pastel-card row
  - Election progress card + Security alerts panel
  - Quick action buttons
  - Audit log activity feed

### FR-5: Role-Segregated Auth Pages

- **FR-5.1**: `/auth/student/login` — Split-screen: Left = pastel illustration panel with brand; Right = clean form card with student ID + OTP flow
- **FR-5.2**: `/auth/student/register` — Same split-screen layout, enrollment form
- **FR-5.3**: `/auth/admin/login` — Same split-screen layout, slightly darker/more formal variant; username + password form
- **FR-5.4**: `/auth` — Role selection landing: 2 big pastel cards (Student Voter / Election Officer)
- **FR-5.5**: Old `/login` → redirect to `/auth/student/login`; `/register` → redirect to `/auth/student/register`; `/admin/login` → redirect to `/auth/admin/login`

### FR-6: New Feature Pages

- **FR-6.1**: `/dashboard/profile` — Voter info, session list, linked devices
- **FR-6.2**: `/dashboard/settings` & `/admin/settings` — Notif prefs + security
- **FR-6.3**: Notifications dropdown (bell) + notifications list page
- **FR-6.4**: Breadcrumbs component across dashboard pages
- **FR-6.5**: Skeleton loaders for all async data areas
- **FR-6.6**: Sonner toasts for every success/error state transition

### FR-7: Flow & Auth Guards

- **FR-7.1**: Unauthenticated `/dashboard/*` → redirect to `/auth/student/login` with return URL
- **FR-7.2**: Unauthenticated `/admin/*` → redirect to `/auth/admin/login` with return URL
- **FR-7.3**: Successful student auth → go to return URL or `/dashboard`
- **FR-7.4**: Successful admin auth → go to return URL or `/admin`
- **FR-7.5**: Logout → clear session → redirect to `/`

### FR-8: Responsive & Accessibility

- **FR-8.1**: Desktop: sidebar fixed ~240px; Tablet: sidebar collapsible; Mobile: sidebar → hamburger drawer
- **FR-8.2**: Auth split-screen stacks on mobile (col form only)
- **FR-8.3**: Keyboard nav + focus states use lime ring
- **FR-8.4**: All icon buttons have aria-labels

## Non-Functional Requirements

- **NFR-1**: `next build` passes; 0 TS errors; no runtime console errors
- **NFR-2**: All existing API calls work unchanged (same endpoints)
- **NFR-3**: Pages use either PublicLayout or SidebarDashboardLayout exclusively
- **NFR-4**: Palette usage strictly limited to the elevate 6 colors + success/danger/warning

## Constraints

- Technical: Stack locked (Next.js 14 App Router, Tailwind, shadcn/ui, Radix, Lucide, Recharts, Sonner). No new runtime deps.
- Visual: MUST match the elevate screenshots exactly (Manrope, lime active pill, pastel accent cards, 16px radius, subtle shadows, off-white bg)

## Assumptions

1. The elevate screenshots represent the user's definitive desired look
2. Manrope from Google Fonts is acceptable (built-in to Next.js via next/font)
3. Soft pastel cards for ballot/election items (like elevate's course cards) is the pattern
4. Old route aliases can redirect permanently (308)

## Acceptance Criteria

### AC-1: Elevate Design System Applied

- **Type**: `rule`
- **Given**: tailwind.config.js + globals.css updated; Manrope loaded
- **When**: Loading any page
- **Then**: Color palette matches: bg=#F5F5F4, cards=#FFF, text=#202124, active nav pill=#DAF39F; no old teal/slate palette; font is Manrope
- **Pass Condition**: `grep` for old `teal-` primary classes returns 0 in new design code; font loaded; CSS vars match exactly
- **Evidence**: Build output + visual inspection

### AC-2: Sidebar Matches Elevate Exact Style

- **Type**: `rule`
- **Given**: Dashboard sidebar component
- **When**: Visiting `/dashboard` or `/admin`
- **Then**: Left sidebar has logo top, vertical nav icons+labels, ACTIVE item is PILL shape with lime (#DAF39F) bg + dark text; inactive items are plain text
- **Pass Condition**: Screenshot side-by-side with elevate screenshot shows same sidebar structure
- **Evidence**: Source code of sidebar + screenshots

### AC-3: Dashboard Cards Use 4 Pastel Accents (Elevate Course Card Pattern)

- **Type**: `rule`
- **Given**: Dashboard "My Active Elections" / "System Health" row
- **When**: Rendering a 4-card grid
- **Then**: Card backgrounds = [peach #FFDEB0, lavender #EBD3FF, lime #DAF39F, soft blue #CFE8FF] in that order, matching elevate's 4 courses exactly
- **Pass Condition**: Card classes render the 4 specific bg colors; visual match
- **Evidence**: DOM colors + screenshot

### AC-4: Auth Pages Role-Separated

- **Type**: `rule`
- **Given**: Auth route structure
- **When**: Visiting `/auth/student/login`, `/auth/admin/login`
- **Then**: Each is a separate page; NO tabbed student/admin toggle on same page
- **Pass Condition**: No Tabs component used in any auth page; 4 distinct routes work
- **Evidence**: Route files present + DOM inspection

### AC-5: Auth Guards & Redirects Work

- **Type**: `rule`
- **Given**: Clean browser (no cookies)
- **When**: Direct-nav to `/dashboard` or `/admin`
- **Then**: Client-redirect to respective login page; after login, returns to originally requested page
- **Pass Condition**: 3 scenarios each: student, admin, post-login return URL
- **Evidence**: Manual flow test + redirect logic in hooks/routes

### AC-6: Profile & Settings Pages Exist & Render

- **Type**: `rule`
- **Given**: New routes
- **When**: `/dashboard/profile`, `/dashboard/settings`, `/admin/settings`
- **Then**: Pages render cleanly without console errors
- **Pass Condition**: No runtime errors; layout uses SidebarDashboardLayout
- **Evidence**: Build output + console log

### AC-7: Visual Fidelity (Rubric)

- **Type**: `rubric`
- **Dimension**: Overall visual match to user-provided elevate screenshots
- **Scale**: 1-5
- **Anchors**: 1 = No resemblance; 3 = Same layout but wrong palette/typography; 5 = Exact palette (#DAF39F active pill, 4 pastel accents), Manrope font, 16px radius, sidebar pill shape, card shadows — indistinguishable from the reference screenshots provided aside from GlassBallot-specific content
- **Pass Threshold**: >= 4
- **Evidence**: Side-by-side screenshot comparison

### AC-8: Navigation Flow Coherence

- **Type**: `rubric`
- **Dimension**: E2E flow quality
- **Scale**: 1-5
- **Anchors**: 1 = Broken links; 3 = Basic nav works; 5 = Landing → /auth role select → correct login → dashboard (sidebar all clickable) → sub-pages → breadcrumbs accurate → logout → landing works seamlessly
- **Pass Threshold**: >= 4
- **Evidence**: Full walkthrough test

### AC-9: Responsiveness

- **Type**: `rubric`
- **Dimension**: Mobile/tablet quality
- **Scale**: 1-5
- **Anchors**: 1 = Broken; 3 = Works only on desktop; 5 = Mobile/tablet/desktop all clean; sidebar drawer on mobile; auth split stacks on mobile
- **Pass Threshold**: >= 4
- **Evidence**: Breakpoint screenshots
