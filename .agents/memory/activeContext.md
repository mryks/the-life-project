# Active Context — Finance Domain

## Session Boundary & Permanent Role
- **Permanent Role:** **Finance Domain Specialist & Lead** (The Life Project OS).
- **Session Scope:** This chat session is strictly dedicated to all things personal finance:
  - Financial domain modeling & deterministic accounting engine (`lib/finance.ts`, `lib/accounts.ts`, `lib/types.ts`).
  - Account balances, cashflow analytics, net worth tracking, and liquid vs. investment fund logic.
  - Multi-device cloud sync with Supabase PostgreSQL (`lib/sync.ts`, `lib/supabase.ts`, `supabase/schema.sql`).
  - Security, encryption, and Master PIN access control (`lib/security.ts`, `app/api/auth/verify-pin/`).
  - Financial UI/UX (Duolingo + Arc tactile design, bento grids, drag-and-drop, modals, filters).
- **Out of Scope for This Session:**
  - Non-finance life domains (e.g. Habit Tracker, Daily Journal, Priority Tasks) are maintained in independent chat sessions with their own routes (e.g., `/habits`, `/journal`).
  - No domain crossover or schema entanglement.

---

## Current Status: STABLE PRODUCTION (GO-LIVE OFFICIAL)
- **Production URL:** [https://the-life-project-os.vercel.app/finance](https://the-life-project-os.vercel.app/finance)
- **Supabase Cloud DB:** Live at `peydzblrtfgdoaisljkm.supabase.co` (`financial_events` table + RLS enabled).
- **Security & Access Control:**
  - Fixed Server-Side Master PIN configured via Vercel Secret `MASTER_PIN` + `/api/auth/verify-pin`.
  - Rate limiting active (5 failed attempts -> 30s lockout returning HTTP 429).
  - Pure, instantaneous Master PIN access without slow browser WebAuthn / biometric prompt overhead.
  - Zero "Create Master PIN" setup forms exposed on untrusted/incognito windows.
- **Mobile PWA:**
  - `public/manifest.json` configured with standalone mode, oat milk theme `#FBF9F4`, and bespoke SVG icon.
  - Viewport optimized for mobile notch (`viewportFit: 'cover'`) and smooth touch drag interactions.
- **Test Suite Status:** 100% passing (**22 test suites, 387 tests passed** via `npm test`).
- **Linter & Typecheck:** 0 errors, 0 warnings (`npm run lint`, `npx tsc --noEmit`).
- **Sync Engine Hotfix (Resolved):**
  - Edit Persistence: Created outbox `queuePendingUpserts` so edited existing transactions are queued and pushed to Supabase (`upsert`), preventing cloud fetch from reverting edits.
  - Reorder Persistence: Reordering computes per-date `within_day_order`, queues affected records, and pushes to Supabase so card order is retained permanently across page refreshes.
- **Cashback Account Relational Cascade (New Rule):**
  - Changing an Expense account when Cashback is linked now automatically cascades the new `accountId` to the Cashback transaction.
  - Interactive tactile confirmation warning dialog alerts user before saving: *"Changing the expense account from [Old] to [New] will also automatically update the cashback account to [New]"*.

---

## Completed Phases (Milestones 1 - 7)
1. **Langkah 1: Data & Accounting Foundation** (17 accounts: 10 Liquid & 7 Investment, admin fees, savings rate, cashflow metrics).
2. **Langkah 2 & 3: Warm Paper & Pastel Crayon Pivot** (Anti-AI-slop design exploration, 20 handcrafted concepts).
3. **Langkah 4: Casual Modern UI Polish** (100% English copy, zero raw keyboard emojis, mature modern typography).
4. **Langkah 5: Duolingo + Arc Browser Fusion Redesign** (Sora tabular numbers, tactile 3D buttons, dynamic BrandLogo, pure hold-and-drag mobile reorder).
5. **Langkah 6: Master PIN & Privacy Blur Shield** (6-digit PIN hashing, 15-min auto-lock, WebAuthn biometrics).
6. **Langkah 7: Supabase Cloud Sync & Vercel Go-Live** (PostgreSQL schema, local-first engine, real-time cloud sync, custom Vercel domain deployment).
7. **Langkah 8: Edit & Reorder Sync Engine Fix** (Pending upserts queue, per-date `within_day_order` calculation, deterministic cloud reconciliation).
8. **Langkah 9: Cashback Account Change Cascade & Confirmation Warning** (Expense account migration cascades to linked cashback with modal guardrail).
9. **Langkah 10: Date Presentation Formatting Polish** (Card view sticky date: `Wednesday, 7 October 2026`; Ledger view date column: `7 Oct 2026`; Transaction options modal: `7 October 2026`).
10. **Langkah 11: 3-Letter Month Standard & Unselected Form Defaults** (Ledger date uses strict 3-letter months e.g. `30 Sep 2026`; New transaction form starts with account & category unselected).
11. **Langkah 12: Simplified Form Labels & Clean Card View** (Labels simplified to `AMOUNT`, `DESCRIPTION`, `ACCOUNT`, Transfer retains `SOURCE ACCOUNT`/`DESTINATION ACCOUNT`, removed `Click for options` hint from Card view).
12. **Langkah 13: Background Scroll Lock on Modal Open** (Locked background body scrolling with scrollbar compensation and touch-none overscroll containment when Transaction Options or other interactive modals are active).
13. **Langkah 14: Type Color Harmonization & Custom Tactile Category Dropdown** (Transfer set to blue in both form switcher `.btn-tactile-blue` and filter chips; Refund filter set to purple/violet `.bg-violet-600`; Category filter upgraded from native `<select>` to custom tactile Duolingo-style dropdown).
14. **Langkah 15: Refund Editing & Net Expense Accounting Integrity** (Enabled editing existing refunds via RefundModal, validated max refundable limit against remaining parent balance, cascaded parent account changes to refunds, enforced refund non-income rule with purple credit styling, and displayed net expense breakdown directly on parent expense cards).
15. **Langkah 16: Multi-Device Sync Hardening & Root Memory Vault Setup** (Auto-sync on mount/visibilitychange/focus, `inFlightSync` caching, root `memory/` vault initial setup).
16. **Langkah 17: Direct Force Upload to Cloud & Legacy Vercel Cleanup** (Direct bulk upsert in `lib/sync.ts`, backup restore auto-push, migration and cleanup of duplicate `the-life-project-eta`).
17. **Langkah 18: EasyUI Gooey Menu & Mobile Keyboard Auto-Dismiss** (Liquid SVG metaballs category dropdown, mobile keyboard blur on scroll/tap, `autoCapitalize="none"` on descriptions).
18. **Langkah 19: Premium Gooey Menu PC Scrollbar & EasyUI Interactive Preview** (Zinc-600 custom scrollbar, HTML interactive preview with desktop & phone simulator).
19. **Langkah 20: Fluid Spring Indicator Tabs for Transaction Record Form** (Elastic spring sliding pill with icons and tactile bottom border for Expense, Income, Transfer).
20. **Langkah 21: Refund Modal Amount & Date Standardization** (Live IDR dot-delimited amount, tactile formatted date card display with transparent picker).
21. **Langkah 22: Cross-Account Refunds & Multi-Account Support** (Removed same-account refund constraint, added unselected destination account selector in RefundModal, account change preservation).
22. **Langkah 23: Comprehensive Codebase & Financial Engine Audit** (Offline deletion tombstone shield, force upload parity soft-delete, Recharts negative pie arc clamp, zero-emoji verification).
23. **Langkah 24: Obsidian Finance Memory Vault Expansion** (Dedicated notes: `Accounts & Portfolio.md`, `Refunds & Relations.md`, `Agreements & Historical Context.md`, bidirectional `[[Wikilinks]]`).
24. **Langkah 25: Post-Transaction Redirect to Accounts & EasyUI Animated Number Motion** (Redirect on transaction/refund save, Framer Motion physics-based rolling digits with IDR dot formatting, tactile amber card pulse, smooth auto-scroll).
25. **Langkah 26: Animated Number Duration Calibration & Timing Cadence** (710ms delay + 2500ms spin + 730ms post-read buffer).
26. **Langkah 27: Animated Number Deceleration Curve Polish** (Smooth settling curve, stable numeric morphing).
27. **Langkah 28: React Aria Swipeable Tabs Carousel Prototype** (Horizontal tab carousel hosting Overview, Accounts, Activity).
28. **Langkah 29: Senior Front-End Playbook & Single-Step Invariant Math** (Installed `.agents/skills/senior-frontend-engineer/SKILL.md`, `lib/swipe-tabs.ts` `calculateBoundedSwipeTarget` strictly constraining gestures to $\pm 1$ tab).
29. **Langkah 30: Glitch Elimination & Hardware-Accelerated Gesture Engine** (Framer Motion `<motion.div>` gesture engine, dynamic drag constraints, responsive height containment).
30. **Langkah 31: Elimination of Tab Peeking / Bleed via Full-Bleed Viewport Hierarchy** (Moved outer carousel to `w-full overflow-hidden`, inner padding `max-w-5xl mx-auto px-4 sm:px-6` moved inside each tab panel, 0px adjacent tab bleed).
31. **Langkah 32: Buttery Smooth Gesture Physics & Zero Layout Thrashing** (Injected real finger velocity `info.velocity.x` into spring, eliminated mid-gesture height collapse with `settledTab`, synchronized Apple-grade spring physics, GPU compositor promotion).
32. **Langkah 33: Undo Delete Transaction with 4-Second Linear Countdown Bar (Option A)** (Optimistic deletion with 4.0s grace period, tactile floating pill with linear countdown bar `scaleX: 1 -> 0`, 3D push-down Undo button, haptic feedback, safe area containment, cascading cashback/refund restoration, sequential delete flush, `beforeunload` commit, and 27 comprehensive unit tests).
33. **Langkah 34: Mechanical Gear Ratio & Units-First Cascade Rolling Counter (Option 2)** (Right-to-left cascading delays where units roll first at `delay = 0.71s`, physical gear ratio revolutions where units spin 2 full revolutions + delta and tens/hundreds spin 1 revolution, strict time budget bounding invariant `columnDelay + columnDuration <= delay + duration`, 45 automated unit tests in `tests/ui/animated-number.test.ts`, 289/289 total tests passing).
34. **Langkah 35: Live Motion Reorder with Real-Time FLIP Displacement & Edge Auto-Scroll Hard Stop** (Framer Motion `<motion.div layout>` and `<motion.tr layout>` dynamic item parting with Apple Critically Damped spring, green dashed border `border-2 border-dashed border-emerald-500` applied strictly to the active held card without background placeholder clutter, same-date boundary locking with auto-scroll hard stop, atomic unit cohesion, and 28 comprehensive unit tests in `tests/finance/live-reorder.test.ts`, 317/317 total tests passing).
35. **Langkah 36: Reorder Speed & 120fps Drag Performance Overhaul** (Snappy 50ms hold on desktop mouse with instant drag on $\ge 4\text{px}$ movement, 150ms hold on mobile touch with immediate tactile pickup, zero-latency direct GPU translation `translateY` tracking pointer, slot pre-measurement eliminating layout thrashing and reducing React re-renders from 120/sec to 1 per slot swap, expanded to 50 tests in `tests/finance/live-reorder.test.ts`, 339/339 total tests passing).
36. **Langkah 37: Elimination of Unrequested Bounce/Squishy Scale from Transaction Hold** (Completely removed `scale-[0.98]` tactile press and `scale-[1.02]` lift expansion; locked card/row scale strictly to flat 1.0; active card uniquely signaled by green dashed border `border-2 border-dashed border-emerald-500` and drop shadow `shadow-xl` without rubbery geometric warping; 339/339 tests passing).
37. **Langkah 38: Custom Categories for Income & Expense with Quick Inline Add & Unused Deletion (Option A)** (Created `lib/categories.ts` dynamic category registry with `thelife-custom-categories` localStorage persistence; open TypeScript union types `DefaultExpenseCategory | (string & {})` and `DefaultIncomeCategory | (string & {})`; quick inline `+ Add` category pill with `Enter`/`Escape` keyboard shortcuts and auto-selection; delete button on unused custom categories with financial transaction guard; dynamic non-NaN `categoryTotals` and pie chart aggregation; 24 unit tests in `tests/finance/categories.test.ts`, 363/363 total tests passing).
38. **Langkah 39: Complete Removal of Fingerprint / WebAuthn Biometrics in Favor of Pure, Fast Master PIN (Option 1)** (Removed all WebAuthn sensor checks, auto-prompts, setup dialogs, and biometric buttons from `MasterPinLockscreen.tsx` and `lib/security.ts`; auto-purged legacy biometric storage keys; locked lockscreen to 100% zero-latency tactile 6-digit PIN keypad; expanded unit tests in `tests/finance/security.test.ts` to 17 tests; 367/367 total tests passing).
39. **Langkah 40: "Trust this device (Stay unlocked)" Persistent Device Authorization** (Added `thelife-device-trusted` localStorage persistence for personal devices, allowing instant access across app kills, browser restarts, and reboots without PIN prompts; preserved temporary session security with 15-minute idle timeout when untrusted; provided tactile toggle in `MasterPinLockscreen.tsx` and explicit manual lock revocation; expanded unit tests in `tests/finance/security.test.ts` to 376/376 total tests passing).
40. **Langkah 41: 1-Day "Trust This Device" with Day-Change Expiry & Default Unchecked** (Bounded device trust strictly to 1 calendar day `YYYY-MM-DD`; automatic expiration and Master PIN requirement upon midnight date rollover "ganti hari"; automatic cleanup of stale yesterday dates; toggle checkbox starts unchecked by default `false`; expanded unit tests in `tests/finance/security.test.ts` to 381/381 total tests passing).
41. **Langkah 42: Ledger Table Month Separator Redesign (Option 4: Deep Slate Blue Bar)** (Replaced pale left-aligned month header with centered `text-center`, bold `font-black`, and deep slate blue bar `bg-slate-800 text-slate-100 border-y border-slate-900 shadow-inner` spanning across all 6 ledger columns, establishing high-contrast monthly division).
42. **Langkah 43: Activity Freeze Panes & Cascading Sticky Date Headers** (Implemented dynamic freeze pane covering search bar, category chips, and view toggles at `top-0`; Table Ledger row 1 column headers stick seamlessly at `top: [freezeHeight]`; Card View features native iOS-style cascading sticky date headers where each date badge stays frozen until the next date group pushes it off-screen; cleared carousel CSS `transform` on settled tabs to prevent containing block trapping of window-sticky elements; verified with 6 new unit tests in `tests/finance/freeze-panes.test.ts`, 387/387 total tests passing).
43. **Langkah 44: Freeze Panes Stickiness Overhaul, Synchronized Table Header, Ghost Touch Glitch Elimination & Automated Mobile E2E Testing** (Diagnosed and solved 4 root causes: `<main>` `overflow-x: hidden` computing to scroll container, Framer Motion dynamic `display: none` layout expansion causing 780px ghost-touch jumps, `transform` containing block traps, and table `overflow-x: auto` isolating `thead`. Replaced with normal DOM flow and `overflow-x: clip`, touch-end gesture guards, synchronized Table Ledger header row inside the sticky freeze pane with bidirectional horizontal scroll sync, accurate `freezeHeight` measurement across tab switches, and a real automated mobile browser subagent test suite `scripts/test-mobile-e2e.mjs` verifying iPhone 14 Pro touch physics and freeze pane coordinates on live Vercel production; 22 test suites, 389 unit tests passing, 0 errors, 0 warnings).

---

## Finance Domain Backlog & Future Enhancements
The following features are prioritized for when the user returns to this session:

### 1. High Priority
- [ ] **Monthly Category Budgets & Spending Caps:**
  - Set a budget target for specific expense categories (e.g., Food & Dining: IDR 3,000,000/mo).
  - Tactile progress bar showing percentage consumed with warning states (80% yellow, 100% red).
- [ ] **Data Export & Reporting (PDF / CSV / Excel):**
  - Download monthly expense statement as clean, printable PDF (ready for personal review).
  - Export raw transaction log as CSV for external spreadsheet analysis.

### 2. Medium Priority
- [ ] **Recurring Transactions / Subscriptions Tracker:**
  - Template engine for monthly bills (Netflix, Spotify, WiFi, Rent, Insurance).
  - One-tap batch logging or scheduled reminders.
- [ ] **Smart Category Insights & Trends:**
  - Month-over-month category comparison (% change vs previous month).
  - Top 3 spending spikes detection and weekday vs weekend spending patterns.

### 3. Low Priority / Polish
- [ ] **Investment Asset Performance (Manual NAV Updates):**
  - Quick adjustment transactions for investment accounts (`k`, `h`, `sb`, `poe`, `kb`, `i`, `p`) to reflect market fluctuations without distorting liquid cashflow.
- [ ] **Offline Sync Queue Visual Indicator:**
  - Pill badge indicating pending unsynced offline transactions when internet connection drops.
