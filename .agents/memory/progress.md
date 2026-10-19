# Progress Tracking — Finance Domain

## Overall Status: STABLE PRODUCTION (OFFICIALLY GO-LIVE 🚀)
- **Live Production URL:** [https://the-life-project-os.vercel.app/finance](https://the-life-project-os.vercel.app/finance)
- **Backend Database:** Supabase PostgreSQL (`peydzblrtfgdoaisljkm.supabase.co`)
- **Automated Test Suite:** 23 test suites, **405/405 tests passing (100%)**
- **Code Quality:** 0 ESLint errors, 0 TypeScript errors (`npx tsc --noEmit`)
- **Session Boundary:** Permanently assigned as **Finance Domain Specialist**. All non-finance life domains (Habits, Journal, Tasks) are developed in separate dedicated chat sessions.

---

## Completed Milestones (Verified in Production)

### 1. Financial Domain Model & Invariants
- Strongly-typed `FinancialEvent` union (`income`, `expense`, `transfer`, `refund`).
- Full historical calendar support without arbitrary date restrictions.
- Starting balances recorded as regular income (`category: 'Others'`).
- Transfer `adminFee` support: automatically deducted from source account and recorded in monthly expense calculations under `'Other'`.
- Relational integrity: Cashback and Refunds linked to parent expense; refund sum capped at parent expense amount; cascading deletions.

### 2. Account System (17 Accounts Partitioned)
- **10 Liquid Accounts:** Cash (`c`), BNI (`b`), GoPay (`g`), ShopeePay (`s`), Jago Yoel (`jy`), e-money (`e`), SeaBank (`sea`), Bank Saqu (`q`), Jago (`j`), Clara (`cla`).
- **7 Investment Accounts:** KOINS (`k`), HP (`h`), Stockbit (`sb`), POEMS (`poe`), KB (`kb`), IPOT (`i`), Portfolio (`p`).
- Headline Total Balance derived exclusively from Liquid Accounts.
- Parallel deterministic calculation of Investment Balance and Net Worth.

### 3. Dashboard, Cashflow Analytics & Reordering
- Interactive Month Navigator with quick "This Month" jump.
- Advanced cashflow metrics: Monthly Income, Monthly Expense, Net Cashflow (Surplus/Deficit), Savings Rate %, and Daily Burn Rate.
- Category breakdown pie chart and daily net expense trend chart.
- Card View and Ledger View with continuous scrolling and sticky month headers.
- Filter chips (Type & Category) and instant search.
- Pure hold-and-drag mobile & desktop transaction reordering (300ms hold delay, vibration feedback, tremor tolerance).

### 4. UI/UX Redesign: Duolingo + Arc Browser Fusion
- **Warm Light Canvas:** Warm biscuit/oat milk canvas (`#FBF9F4`) with rich amber and stone accents.
- **Sora Numbers:** Bold, rounded fintech tabular numbers (`font-variant-numeric: tabular-nums`).
- **Tactile 3D Buttons:** Duolingo-inspired physical push-down buttons (`.btn-tactile-primary`, `.btn-tactile-dark`).
- **Dynamic BrandLogo:** Floating clover vault emblem with spring bounce micro-interactions.
- **Copy & Icons:** 100% English copy, zero raw keyboard emojis (pure `@phosphor-icons/react` and `lucide-react`).

### 5. Single-User Master PIN Security Architecture
- Server-side fixed Master PIN verification via `/api/auth/verify-pin` + Vercel secret `MASTER_PIN`.
- Anti-brute-force rate limiting (5 failed attempts -> 30s lockout returning HTTP 429).
- Pure, instantaneous tactile keypad without slow browser WebAuthn / biometric prompt overhead.
- Smart Auto-Lock: 15-minute inactivity timeout, window/tab close auto-lock, and instant manual lock button.
- Frosted-glass viewport privacy blur shield concealing financial numbers until unlocked.

### 6. Supabase Cloud Sync & Mobile PWA Go-Live
- Dual-layer Local-First architecture: instant offline UI with background cloud sync via Supabase PostgreSQL.
- Soft-delete tombstones (`deleted_at`) preventing deleted record resurrection during multi-device synchronization.
- PWA Manifest (`manifest.json`) and iOS Web App configuration for standalone home screen usage.
- Deployed on Vercel with automatic HTTPS/SSL and custom domain routing.

### 7. Edit & Reorder Sync Engine Persistence (Hotfix Verified)
- **Pending Upserts Outbox Queue (`PENDING_UPSERTS_KEY`):**
  * When a transaction is edited or reordered, its ID is queued in an offline-safe outbox.
  * In `mergeLocalAndCloudEvents`, pending local edits take precedence over stale cloud rows and are pushed to Supabase (`upsert`).
  * Cloud auto-sync on refresh permanently respects local edits instead of overwriting them with old cloud values.
- **Deterministic Within-Day Order (`within_day_order`):**
  * Reordering calculates per-date `within_day_order` sequence indices for cards on that date.
  * Triggers background cloud sync and writes the new `within_day_order` to Supabase PostgreSQL.
  * On page refreshes, Supabase returns rows with their updated order, preserving the reordered sequence across devices.

### 8. Cashback Account Relational Cascade (New Rule Verified)
- **Automatic Account Migration for Cashback:**
  * Editing an expense's account now automatically updates the linked cashback to the same account.
  * `replaceFinancialEvent` in `lib/finance.ts` updates both records atomically and updates cashback description.
- **Tactile Guardrail Confirmation Modal:**
  * When editing an expense with cashback and changing the account, clicking "Save Transaction" displays a tactile amber warning dialog explaining that both the expense and cashback accounts will be updated.
  * User can cancel or confirm to commit the dual-account update.

### 9. Cross-Account Refunds & Refund UX Modernization
- Multi-account refund support: user can choose any destination account for a refund (e.g. paid via BCA, refunded to GoPay).
- `RefundModal` UX: starts unselected (`null`), live IDR dot separator, tactile formatted date card display with transparent picker.
- Parent expense account edits preserve each linked refund's independent destination account.

### 10. EasyUI Gooey Menu & Fluid Spring Tabs
- Liquid SVG metaballs filter with spring physics for Activity category selection.
- Sleek zinc-600 custom scrollbar for desktop.
- Fluid Spring sliding tabs for transaction type switcher (strictly 3 types: Expense, Income, Transfer).
- Mobile virtual keyboard auto-dismiss on scroll or tap, and lowercase description triggers.

### 11. Codebase Audit, Deletion Tombstone Shield & Pie Chart Fix
- Offline deletion tombstone shield: pending deleted IDs checked in `mergeLocalAndCloudEvents` to prevent cloud resurrection.
- Force upload parity soft-delete: cloud records missing from local snapshot are soft-deleted on restore/force-upload.
- Clamped Recharts `pieData` to positive values (`categoryTotals[category] > 0`) to prevent SVG arc NaN crashes.
- Zero-emoji design audit completed: 100% Lucide vector icons.

### 12. Comprehensive Obsidian Finance Memory Vault
- Root `memory/` vault created with Map of Content (`00 - Atlas (Index).md`).
- Dedicated notes: `Accounts & Portfolio.md`, `Refunds & Relations.md`, `Agreements & Historical Context.md`, `Domain & Financial Model.md`, `Cloud Sync & Supabase.md`, `UI & Design System.md`, `Security & Master PIN.md`, `Deployment & Vercel.md`, `Changelog & Step Log.md`.
- Networked with bidirectional `[[Wikilinks]]` for complete context preservation and zero session drift.

### 13. Post-Transaction Redirect to Accounts & EasyUI Animated Number
- Automatic view redirect to "Accounts" page upon saving Expense, Income, Transfer, or Refund.
- EasyUI AnimatedNumber component (`components/ui/animated-number.tsx`) with Framer Motion spring physics and IDR dot formatting (`Rp 48.250.000`).
- Animated numbers across Total Liquid, Total Investment, Total Net Worth, and impacted account cards.
### 14. Senior Front-End Engineering & Single-Step Swipeable Tabs (Langkah 22–30)
- Installed `.agents/skills/senior-frontend-engineer/SKILL.md` enforcing rigorous mobile gesture physics and production parity.
- Implemented React-Aria inspired swipeable tab carousel across Overview, Accounts, and Activity (`finance/page.tsx`).
- Single-Step Pagination Invariant enforced: users can swipe at most $\pm 1$ tab per gesture regardless of swipe length or flick velocity.
- Rubber-band resistance at boundaries (Overview swiping right, Activity swiping left).
- Directional lock (`Math.abs(dx) > Math.abs(dy)`) to prevent conflict with vertical scrolling.
- Automated tests: 21 unit tests covering swipe physics, thresholds, velocity, and single-step boundary clamping (`test/finance-swipe.test.ts`).

### 15. Tab Bleed Elimination & Kinetic Release Polish (Langkah 31–32)
- Tab Bleed Zero Tolerance: Restructured swipe track layout so outer container is `w-full overflow-hidden`, and max-width gutters (`max-w-5xl mx-auto px-4 sm:px-6`) live inside individual tab panels. Adjacent tabs never peek when idle.
- Kinetic Polish: Replaced basic CSS transition snapping with continuous Framer Motion `useMotionValue(0)` driving CSS `x: motionX` and release velocity injection via `animate(x, targetX, { velocity: releaseVelocity, stiffness: 280, damping: 32, mass: 0.8 })`.
- Production parity verified on live Vercel deployment (commit `27ef84a`).

### 16. Undo Delete Transaction with 4-Second Linear Countdown Bar (Langkah 33)
- **Optimistic Delete with 4s Grace Period**: Deleting a transaction immediately hides it from the UI so balances and card views update instantaneously, while holding the permanent deletion in an undoable state.
- **Option A Linear Countdown Bar (`components/finance/undo-delete-toast.tsx`)**: High-craft dark stone-900 floating pill with 3D tactile push-down "Undo" button (`bg-amber-400`), vector icons, mono tabular amount, and hardware-accelerated Framer Motion linear countdown bar (`scaleX: 1 -> 0`) running for exactly 4.0 seconds.
- **Relational Cascade Preservation**: Deleting an expense with linked cashback or refunds tracks all cascading events; clicking "Undo" restores the entire event tree with 100% mathematical fidelity.
- **Robust Expiration & Flush Guards**: If the 4-second timer elapses or the user clicks dismiss, `deleteFinancialEventWithSync` queues deletion tombstones for Supabase. Consecutive deletes automatically commit earlier pending deletions before entering the new window. Added `beforeunload` listener to prevent ghost transactions.
### 17. Mechanical Gear Ratio & Units-First Cascade Rolling Counter (Langkah 34)
- **Units-First Cascade ("Satuan Dulu")**: Digit columns calculate position from the right (`colFromRight`). Column 0 (units/satuan) rolls first at base `delay` (0.71s), cascading sequentially to tens (+50ms), hundreds (+100ms), and thousands (+150ms).
- **Physical Mechanical Gear Ratio (Reel Multiplier)**:
  * For active delta columns ($\text{colFromRight} \le \text{maxChangedCol}$), lower gears spin through full revolutions: units wheel spins 2 full revolutions ($20\text{ steps}$), tens and hundreds spin 1 full revolution ($10\text{ steps}$).
  * Even when starting and ending on the same digit (e.g. `0` to `0` in a Rp 1.000 expense), the units wheel physically spins full mechanical cycles rather than remaining static.
  * Higher digits above the change (e.g. millions in a Rp 1.000 change) remain static without unnecessary spinning.
- **Strict Time-Budget Invariant**: Total animation is strictly bounded by `duration` (2.5s). Column durations scale proportionally: $\text{columnDuration} = \max(0.8, \text{duration} - \text{colFromRight} \times 0.05)$, ensuring all columns decelerate and lock in together with Apple-grade cubic-bezier `[0.16, 1, 0.3, 1]`.
### 18. Live Motion Reorder with Real-Time FLIP Displacement & Edge Auto-Scroll Hard Stop (Langkah 35)
- **Live Motion & Real-Time FLIP Displacement**: Replaced static drop indicator lines with real-time dynamic card displacement using Framer Motion `<motion.div layout>` and `<motion.tr layout>` (Apple Critically Damped: `stiffness: 450, damping: 35, mass: 0.8`). Adjacent cards smoothly part open and glide into new positions before release.
- **Green Dashed Border on Active Card**: Strictly applied `border-2 border-dashed border-emerald-500 scale-[1.02] shadow-xl z-30 bg-white relative` to the card/row being held. Zero placeholder or ghost box clutter left behind in the list.
- **Strict Same-Date Constraint & Auto-Scroll Hard Stop**: Reordering is locked within the same date. Auto-scroll (100px edge threshold, quadratic acceleration) automatically hard-stops when the active item reaches the top or bottom boundary of its same-date group, preventing foreign date traversal.
- **Atomic Unit & Multi-View Support**: Both Card View and Ledger View supported. Expense with Cashback moves as a single atomic unit, and paired Transfer rows stay strictly adjacent.
### 19. Reorder Speed & 120fps Drag Performance Overhaul (Langkah 36)
- **Calibrated Snappy Hold Timers**:
  * Desktop Mouse: 50ms hold delay (or instant drag on $\ge 4\text{px}$ movement) eliminating desktop drag lag.
  * Mobile Touch: 150ms hold delay (halved from 300ms) with instant `scale-[0.98]` tactile press feedback and 40ms haptic vibration.
- **Elimination of Layout Thrashing**: Pre-measures same-date card slot bounding rects once (`measureDateSlots`) on drag start, replacing expensive `document.elementsFromPoint`, `querySelectorAll`, and `getBoundingClientRect()` with pure sub-microsecond array arithmetic (`findClosestSlotIndex`).
- **Direct GPU-Accelerated Translation**: The active held card is translated directly in real-time (`translate3d(0, ${translateY}px, 0)`) following the pointer with zero latency, while siblings smoothly glide into new slots via Apple Critically Damped spring (`layout={!isActive}`).
- **State Debouncing**: Dispatches `setProvisionalEvents` ONLY when the hover target slot actually changes, cutting React re-renders from ~120/sec to 1 render per slot crossing.
- **Expanded Test Suite**: Added 22 tests in `tests/finance/live-reorder.test.ts` (50 total tests in suite, 339/339 tests passing across 20 suites).
### 20. Elimination of Unrequested Bounce/Squishy Scale from Transaction Hold (Langkah 37)
- **Root Cause Elimination**: Removed unrequested `scale-[0.98]` tactile press and `scale-[1.02]` lift expansion that created rubbery shrink-then-expand bounce when holding cards.
- **Pure 1.0 Geometric Stability**: Locked card and table row scale to strictly 1.0 across press, hold, and drag.
- **Visual Distinction via Borders & Shadow**: The active held card now solely displays the green dashed border (`border-2 border-dashed border-emerald-500`) and elevated drop shadow (`shadow-xl z-40 bg-white relative`) with zero dimensional warping.
- **Verification**: 339/339 tests passing, 0 TypeScript errors, 0 ESLint warnings.

### 21. Custom Categories for Income & Expense with Quick Inline Add & Unused Deletion (Option A)
- **Dynamic Category Architecture (`lib/categories.ts`)**: Built a robust category registry supporting default categories and user custom categories stored in `thelife-custom-categories` (localStorage).
- **Open Union Types (`lib/types.ts`)**: Upgraded `ExpenseCategory` and `IncomeCategory` to `Default*Category | (string & {})` for autocomplete with dynamic string support.
- **Option A UI/UX (`app/finance/page.tsx`)**:
  * Quick inline `+ Add` category pill transforms into a sleek input with `Check` and `X` buttons.
  * Supports `Enter` to commit, `Escape` to cancel, with instant auto-selection of newly added category and haptic feedback.
  * Subtle `X` delete button on non-default custom category pills.
  * Unused categories can be deleted cleanly; categories currently used by transactions are protected from deletion to preserve financial integrity.
- **Deterministic Statistics & Pie Chart**: Dynamically gathers active categories and ensures `categoryTotals` and `pieData` calculate without `NaN`.
- **Comprehensive Testing**: Authored 24 unit tests in `tests/finance/categories.test.ts` verifying all invariants, duplicate rejection, and sync persistence. All 363 tests passing across 21 test suites.

### 22. Complete Removal of Fingerprint / WebAuthn Biometrics in Favor of Pure, Fast Master PIN (Option 1)
- **Zero-Latency Lockscreen (`MasterPinLockscreen.tsx`)**: Removed all WebAuthn sensor checks, async platform authenticator detection, auto-trigger prompts, setup dialogs, and biometric scan buttons.
- **Pure Keypad Alignment**: Digit `"0"` is centered in the 3x4 tactile keypad with empty slot on left and Backspace on right.
- **Legacy Storage Auto-Purge (`lib/security.ts`)**: Auto-cleans legacy `thelife-biometric-enabled` and `thelife-webauthn-id` keys from `localStorage`.
- **Comprehensive Security Testing (`tests/finance/security.test.ts`)**: Expanded to 17 unit tests verifying deterministic PIN verification, brute-force lockout, idle auto-lock, and legacy key isolation. All 367 tests passing across 21 test suites.

### 23. "Trust this device (Stay unlocked)" Persistent Device Authorization
- **Persistent Device Trust Architecture (`lib/security.ts`)**: Added `thelife-device-trusted` key in `localStorage`. When enabled, personal devices stay unlocked permanently across app process kills, browser restarts, and reboots, bypassing the 15-minute idle timeout.
- **Temporary Session Security**: When unselected (for borrowed or temporary devices), session lives strictly in `sessionStorage` and automatically locks upon closing the tab/killing the app or after 15 minutes of inactivity.
- **Tactile UI Control (`MasterPinLockscreen.tsx`)**: Clean checkbox toggle ("Trust this device (stay unlocked)") with vector `Check` icon, defaulting to true for friction-free personal smartphone usage.
- **Manual Revocation**: Explicit manual lock via header button immediately purges `thelife-device-trusted` and locks the vault.
- **Expanded Verification**: 9 new unit tests in `tests/finance/security.test.ts` verifying persistent vs temporary sessions, timeout behavior, and manual revocation. All 376/376 tests passing.

### 24. 1-Day "Trust This Device" with Day-Change Expiry & Default Unchecked
- **1-Day Calendar Limit ("Ganti Hari Harus Masukin PIN Lagi")**: Bounded `thelife-device-trusted` in `localStorage` strictly to the local calendar day string (`YYYY-MM-DD`).
- **Midnight Expiration**: Upon date change, `isDeviceTrusted()` strictly returns `false`, prompting for PIN re-entry on new-day cold starts. Stale yesterday entries are automatically purged.
- **Default Unchecked**: Checkbox starts unselected (`false`) so temporary session security is the default unless explicitly checked by the user.
- **Complete Test Coverage**: Added 5 new unit tests in `tests/finance/security.test.ts`. 100% test pass rate across 21 test suites (**381/381 tests passing**).

### 25. Ledger Table Month Separator Redesign (Option 4: Deep Slate Blue Bar)
- **High-Contrast Ledger Separator (`app/finance/page.tsx`)**: Replaced pale `bg-amber-50/70` month divider with deep slate blue ribbon `bg-slate-800 text-slate-100 border-y border-slate-900 shadow-inner`.
- **Center Alignment & Ultra-Bold Typography**: Spans all 6 table columns (`colSpan={6}`) with `text-center`, `font-black`, and `tracking-widest`.
- **Zero Semantic Clashing**: Distinct slate palette separates months clearly without conflicting with transaction credit/debit/transfer color indicators.

### 26. Activity Freeze Panes & Cascading Sticky Date Headers
- **Dynamic Freeze Pane Header (`app/finance/page.tsx`)**: Pinned the active filter banner, search input, type/category chips, and Card/Ledger view toggles at `top-0` with `backdrop-blur-md` and soft elevation.
- **Table Ledger Header Freeze (`app/finance/page.tsx`)**: Table header row 1 (`Date`, `Description`, `Account`, `In (+)`, `Out (-)`, `Category`) sticks directly beneath the freeze pane at `top: [freezeHeight]` with rounded corners and seamless background alignment.
- **Card View Cascading Sticky Date Badges (`app/finance/page.tsx`, `lib/finance.ts`)**: Pure `groupCardEventsByDate` groups transactions into date units. Each date badge stays frozen at `top: [freezeHeight]` while scrolling through that date's cards. When the date's cards end, the parent container pushes the badge up naturally as the next date's badge takes its place at `top: [freezeHeight]`.
- **CSS Containing Block Trap Fix (`hooks/useSwipeableTabs.ts`)**: Cleared Framer Motion CSS `transform` on settled tabs (`style={isTransitioning ? { x } : { transform: 'none' }}`), restoring native compositor-level window sticky scrolling at 120 FPS.
- **100% Automated Test Coverage**: Added tests in `tests/finance/freeze-panes.test.ts` (389/389 tests passing).

### 27. Freeze Panes Stickiness Overhaul, Synchronized Table Header & Mobile E2E Testing
- **Ghost Touch Elimination**: Replaced unstable dynamic `hidden` carousel layout with pure native DOM flow and touch-end angle guards (`useSwipeableTabs.ts`), completely eliminating spontaneous auto-swiping.
- **Table Ledger Header Synchronization**: Placed Table Ledger column headers directly inside the Sticky Freeze Pane (`top: 0`), bidirectionally synchronized with the table data body via `scrollLeft` when swiping horizontally.
- **Automated Mobile Browser Subagent**: Created `scripts/test-mobile-e2e.mjs` (`npm run test:e2e:mobile`) using Puppeteer with real Chrome emulating iPhone 14 Pro touch physics, verifying 100% passage on both local build and live Vercel production.

### 28. Table Ledger Default Auto-Scroll to Bottom & Latest Transactions Focus
- **Instant Bottom Scroll Engine (`app/finance/page.tsx`)**: Placed bottom sentinel anchor `tableBottomAnchorRef` and staged `scrollToLedgerBottom` helper with immediate + 40ms/120ms frame fallbacks, ensuring all dynamic rows settle at the true bottom.
- **View Mode Switcher Integration**: Switching to Table Ledger scrolls to the bottom (where newest transactions sit), and switching to Card View scrolls to top: 0 (where newest cards sit), ensuring both modes always highlight latest transactions first.
- **Mobile Subagent Verification**: Verified on iPhone 14 Pro emulation via Puppeteer with `scrollY: 9504 / maxScroll: 9616` and all 8/8 assertions passing. 22 test suites, 392/392 unit tests passing.

### 29. Default Nominal Masking with Session-Persisted Eye Toggle (Langkah 46)
- **Default Masking Invariant**: All nominal amounts across Overview, Accounts, Card View, and Table Ledger default to masked as `Rp ••••••` (with sign/suffix support: `+Rp ••••••`, `-Rp ••••••`, `Rp ••••••/day`, `Net: Rp ••••••`).
- **Session-Scoped Persistence**: State is stored in `sessionStorage` (`thelife-hide-nominals`), persisting revealed state during the active browsing session across tabs and refreshes, but cleanly reverting to hidden upon application kill or tab close.
- **Dual Vector Eye Toggles**: Tactile `Eye` / `EyeOff` button in the sticky top navigation header bar and companion eye button on `HeroVaultCard`.
- **Comprehensive Quality Verification**: 12 new unit tests in `tests/finance/privacy.test.ts` (404/404 total tests passing across 23 test suites) and automated mobile browser subagent verifying nominal masking and toggle states on live Vercel production.

### 30. Independent Scroll Shell Prototype (Langkah 47)
- **Static Upper Shell (`shrink-0`)**: Explored fixed viewport architecture where header and search controls remained frozen. Tested bottom table auto-scrolling and nominal masking.
- **Verification**: 405/405 unit tests passing across 23 test suites and mobile browser subagent verification on iPhone 14 Pro emulation.

### 31. Sticky Search Bar Freeze with Natural Header Hide & Clean Date Headers (Langkah 48)
- **Sticky Search Bar Freeze Invariant**: Pinned `activityFreezeRef` (search bar, filter chips, category dropdown, view switcher, and Table Ledger headers) at `sticky top-0 z-30 bg-[#FBF9F4]/95 backdrop-blur-xs -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-3 border-b border-stone-200/80 shadow-2xs`.
- **Natural Header Hide ("Bisa Kehide")**: Main `<header>` (Logo, + Add button, tabs) scrolls off naturally into the upper page flow to maximize vertical space. Once `activityFreezeRef` reaches `top: 0`, it freezes and stays accessible at all times without having to scroll back to the top.
- **Clean Static Date Headers (Card View)**: Replaced sticky translucent badges with clean, quiet static section headers in normal document flow (`pt-2 pb-0.5 text-xs font-bold text-stone-500 tracking-wide`). Completely eliminated overlapping text and badge collision jitter.
- **Dedicated Table Ledger Container**: Wrapped Table Ledger in `max-h-[62vh] sm:max-h-[70vh] overflow-y-auto overflow-x-auto` with sticky `thead` (`sticky top-0 z-10 bg-stone-100`). Opening Table Ledger auto-scrolls to the bottom (`tableBottomAnchorRef`), displaying latest transactions while `window.scrollY` strictly stays at `0`.
- **Centered Floating "Top" Pill Button**: When the user scrolls down (`window.scrollY > 350`), a sleek tactile floating pill (`↑ Top`) appears smoothly via Framer Motion at `fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-stone-900/95 text-white`. Tapping it smoothly scrolls `window.scrollTo({ top: 0, behavior: 'smooth' })`. Centered placement ensures zero collision with the green `+ Add` button (`bottom-6 right-6`) and provides equal ergonomics for left- and right-handed users.
- **Mandatory Visual Inspection Protocol**: Visual screenshot inspection executed across 5 scroll states on iPhone 14 Pro emulation (`1-card-top.png`, `2-card-scrolled-350.png`, `3-card-scrolled-750.png`, `4-table-ledger.png`, `5-table-ledger-scrolled.png`) confirming design hierarchy before handoff.
- **Verification**: 406/406 unit tests passing across 23 test suites, 0 TypeScript/ESLint errors, and 100% automated mobile browser subagent pass rate.
- **User Sign-Off**: Formally verified and approved by the user on their smartphone: *"oke ini lebih baik"* (2026-10-19). Live in production.

---

## Finance Domain Backlog (For Future Sessions)

Whenever you return to this session, we can pick up any of the following enhancements:

1. **Monthly Category Budgets & Spending Limits:**
   - Define monthly budget caps per expense category (e.g. Dining, Shopping, Utilities).
   - Visual progress bars showing % spent with warning colors (amber at 80%, red at 100%).

2. **Data Export & Reporting (PDF / CSV):**
   - One-click monthly expense summary export as formatted PDF statement.
   - Raw transaction history export to CSV for external spreadsheet modeling.

3. **Recurring Transactions & Subscriptions:**
   - Template manager for fixed recurring monthly expenses (streaming services, utilities, internet).
   - Fast one-tap batch logging on due dates.

4. **Category Spending Trends & Month-over-Month Comparisons:**
   - Visual comparison charts comparing current month vs previous month per category.
   - Weekend vs weekday burn rate analytics.

5. **Investment Account Adjustments (Manual NAV Update):**
   - Quick valuation adjustments for investment accounts (`k`, `h`, `sb`, `poe`, etc.) to update Net Worth without skewing monthly cashflow.
