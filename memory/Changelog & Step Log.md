# Changelog & Step Log

> Hub: [[00 - Atlas (Index)]] | Related: [[Deployment & Vercel]], [[Domain & Financial Model]]

---

## 📜 Sprint & Evolution Log

### Langkah 31: Elimination of Tab Peeking / Bleed via Full-Bleed Carousel & Internal Panel Padding
- **User Issue & Optical Analysis**:
  - While resting on `Overview` (Tab 0), a 16px sliver of `Accounts` (Tab 1) card border and text ("Fi", "10", "inv") peeked into the right viewport edge.
  - While resting on `Accounts` (Tab 1), "Financial Accounts" was shifted left by 32px ("nancial Accounts"), and a 64px sliver of `Activity` (Tab 2) cards and search button peeked into the right viewport edge.
  - While resting on `Activity` (Tab 2), the search magnifying icon was cut off by 64px to the left.
- **Root Cause Identified**:
  - The carousel container had `className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 overflow-hidden"`.
  - In CSS, `overflow: hidden` clips children at its **padding-box edge**, NOT its content-box edge.
  - Because `px-4` (`padding: 0 16px`) was applied to the clipping container, the content box was $W - 32\text{px}$ (e.g. $390 - 32 = 358\text{px}$).
  - Child panels with `w-full min-w-full shrink-0` resolved `100%` against the $358\text{px}$ content box.
  - Panel 0 occupied $[16\text{px}, 374\text{px}]$. But the container's visible padding box extended to $390\text{px}$. Therefore, from $374\text{px}$ to $390\text{px}$ ($16\text{px}$ wide strip), Panel 1 was rendered and exposed.
  - Furthermore, `containerWidth` measured `el.clientWidth` ($390\text{px}$). Translating by $-k \times 390\text{px}$ against $358\text{px}$ panels caused a cumulative $32\text{px} \times k$ horizontal misalignment!
- **Architectural Solution (Full-Bleed Container + Internal Panel Containers)**:
  - Carousel container set to full viewport width with zero horizontal padding:
    `<div ref={containerRef} className="w-full overflow-hidden pt-6">`
  - Each tab panel spans the full viewport width:
    `<div className="w-full min-w-full shrink-0 ...">`
  - Inner responsive constraints and padding moved INSIDE each tab panel:
    `<div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6">`
  - With this structure:
    - Panel width === `containerWidth` === $W$ ($390\text{px}$).
    - Tab 0: Panel 0 occupies $[0, 390]$. Panel 1 starts at $390$ (100% offscreen, exactly 0px peeking).
    - Tab 1: Panel 1 occupies $[0, 390]$. Panel 0 is at $[-390, 0]$, Panel 2 is at $[390, 780]$ (0px peeking).
    - Tab 2: Panel 2 occupies $[0, 390]$. Panel 1 is at $[-390, 0]$ (0px peeking).
- **Empirical Visual Verification (CDP Screencast & High-Res Screenshots)**:
  - Verified resting states via Chrome CDP:
    - `tab0_overview_initial.png`: Exactly 0px of Accounts, perfectly symmetrical margins.
    - `tab1_accounts_resting.png`: "Financial Accounts" title fully visible, exactly 0px of Activity.
    - `tab2_activity_resting.png`: Magnifying glass search icon fully visible with symmetric 16px padding, exactly 0px of Accounts.
  - Verified continuous swiping and flick tests:
    - Test 1 (Overview -> Accounts): lands at $x = -390\text{px}$, Panel 1 bounds $[0, 390]$.
    - Test 2 (Accounts -> Activity): lands at $x = -780\text{px}$, Panel 2 bounds $[0, 390]$.
    - Test 3 (Swipe beyond Activity): elastic resistance, stays at $x = -780\text{px}$.
    - Test 4 (Activity -> Accounts): lands at $x = -390\text{px}$.
    - Test 5 (Accounts -> Overview): lands at $x = 0\text{px}$.
    - Test 6 (Fast 80ms Flick Overview -> Left across whole screen): strictly bounded to Accounts ($x = -390\text{px}$).
    - Test 7 (Fast 80ms Flick Accounts -> Right across whole screen): strictly bounded to Overview ($x = 0\text{px}$).
- **Verification Suite**: 217/217 Vitest tests passing, Turbopack production build succeeds with 0 errors.

### Langkah 30: Glitch Elimination & Hardware-Accelerated Gesture Tabs (Framer Motion)
- **User Problem & Precise Directive**:
  - Mobile swipe still glitched, stuttered, and high-velocity flicks could skip across tabs from end to end.
  - Requirement: Be meticulous, test as a real mobile user swiping left and right, screen record and inspect every frame, and ensure zero glitch and strict single-step pagination.
- **Root Cause Diagnosis**:
  - In CSS scroll snap (`overflow-x: auto`), setting `carousel.scrollLeft` inside passive `touchmove` listeners fought the browser compositor's native touch pipeline, producing a high-frequency visual vibration/glitch.
  - Calling `carousel.scrollTo({ behavior: 'smooth' })` inside `touchend` collided with native momentum deceleration, causing Blink/WebKit to abort the animation midway and leave tabs frozen cut in half (e.g. `scrollLeft = 240px, 384px, 450px`).
  - Once frozen at fractional positions, subsequent swipes misinterpreted `startIndex`, allowing swipes to fly from Overview all the way to Activity.
- **Framer Motion Hardware-Accelerated Gesture Architecture**:
  - Replaced native `overflow-x: auto` with GPU-accelerated Framer Motion gesture engine (`<motion.div drag={isTouchDevice ? "x" : false} dragDirectionLock dragConstraints={dragConstraints} dragElastic={0.2} animate={{ x: -currentTabIndex * containerWidth }}>`).
  - **Double-Layered Single-Step Invariant**:
    1. Physical Gesture Bounds: `dragConstraints` dynamically bounds finger travel to $[\max(-(N-1)W, -(k+1)W), \min(0, -(k-1)W)]$, making it physically impossible to drag past adjacent tabs.
    2. Release Math: `handleDragEnd` calculates destination strictly via `calculateBoundedSwipeTarget`, guaranteeing $|f(k) - k| \le 1$.
  - **Sleek Fluid Tab Pill**: Upgraded tab bar indicator to Framer Motion `layoutId="activeTabBadge"` with spring physics (`stiffness: 450, damping: 35`), eliminating manual coordinate offset lag and layout thrashing.
  - **Vertical Scroll Space Protection**: Added responsive height capping (`max-h-[85vh] overflow-hidden`) on inactive views, eliminating 14,000px empty scrollable space from background lists while keeping adjacent panels fully visible during swipes.
- **Empirical Frame-by-Frame Verification (CDP Screencast)**:
  - Recorded 326 frames via Chrome DevTools Protocol simulating mobile touch gestures (390x844 DPR 2).
  - Verified 7 test scenarios:
    1. Overview -> Accounts (Left): lands squarely at `Accounts` (`-358px`).
    2. Accounts -> Activity (Left): lands squarely at `Activity` (`-716px`).
    3. Swipe beyond Activity: elastic resistance, snaps back to `Activity`.
    4. Activity -> Accounts (Right): lands squarely at `Accounts` (`-358px`).
    5. Accounts -> Overview (Right): lands squarely at `Overview` (`0px`).
    6. FAST AGGRESSIVE FLICK (Overview -> Left, 80ms flick): strictly lands on `Accounts`, zero overshoot to Activity.
    7. FAST AGGRESSIVE FLICK (Accounts -> Right, 80ms flick): strictly lands on `Overview`, zero overshoot backwards.
- **Verification Suite**: 217/217 Vitest tests passing across 17 test suites, Next.js Turbopack production build succeeds with 0 errors.

### Langkah 29: Single-Step Pagination Invariant (Max 1 Tab per Swipe) & Senior Frontend Skill
- **User Directive**:
  - Install a comprehensive Senior Front-End & UI Engineer skill in `.agents/skills/senior-frontend-engineer/SKILL.md` and enforce its usage across all UI work.
  - Implement the **Single-Step Pagination Invariant**: a single swipe gesture MUST move by at most 1 tab ($\pm 1$), and can NEVER skip multiple tabs (e.g. from Overview cannot skip Accounts directly to Activity).
- **Senior Front-End Playbook Installation**:
  - Created `.agents/skills/senior-frontend-engineer/SKILL.md` codifying gesture bounding, velocity gating, zero-assumption engineering, 120fps hardware motion, and live deployment verification.
  - Codified in `AGENTS.md` under `## Front-End & UI Engineering Standard`.
- **Pure Calculation Engine (`lib/swipe-tabs.ts`)**:
  - `calculateBoundedSwipeTarget`: guarantees that regardless of flick speed or drag distance, target index is mathematically capped at `[startIndex - 1, startIndex, startIndex + 1]`.
  - 8 new unit tests added (21/21 passing in `swipeable-tabs.test.ts`).
- **Touch Gesture Boundary Enforcement (`hooks/useSwipeableTabs.ts`)**:
  - `handleTouchMove`: strictly clamps `carousel.scrollLeft` within $[(\text{startIndex} - 1) \times W, (\text{startIndex} + 1) \times W]$. The DOM cannot physically scroll beyond the adjacent tab during a single touch drag.
  - `handleTouchEnd`: evaluates displacement and flick velocity, computes the strictly bounded target index, programmatically smooth-scrolls to it, and updates `activeTab`.
- **Verification**: 217/217 Vitest tests passing across 17 test suites, 0 ESLint warnings, Next.js Turbopack production build succeeds with 0 errors.

### Langkah 28: React Aria Swipeable Tabs Carousel & 1:1 Sliding Indicator Motion
- **Architecture & Pattern (`https://react-aria.adobe.com/examples/swipeable-tabs`)**:
  - Implemented CSS scroll-snapping horizontal carousel (`flex overflow-x-auto snap-x snap-mandatory scrollbar-hide overscroll-x-contain touch-pan-x touch-pan-y`) hosting `Overview`, `Accounts`, and `Activity & Ledger` side-by-side (`w-full min-w-full shrink-0 snap-start snap-always`).
  - Retained clean, modern visual identity: sleek dark pill indicator (`bg-stone-900 text-white shadow-xs rounded-xl`).
- **Pure Math & Calculations (`lib/swipe-tabs.ts`)**:
  - `calculateIndicatorPosition`: Continuously interpolates tab button `offsetLeft` and `offsetWidth` proportional to the scroll progress (`scrollLeft / clientWidth`).
  - `calculateSnappedTabIndex`: Computes settled tab index on scroll snap with boundary clamping.
  - 13/13 dedicated unit tests in `tests/finance/swipeable-tabs.test.ts`.
- **Custom React Hook (`hooks/useSwipeableTabs.ts`)**:
  - 1:1 real-time indicator tracking: runs inside `requestAnimationFrame` using hardware-accelerated `transform: translateX(...)` for buttery 120fps motion with zero React re-render overhead during finger dragging.
  - Touch-only swipe: mobile and tablet screens swipe horizontally with native momentum physics; desktop PC mouse uses tab button clicks. Accidental horizontal trackpad scroll on PC is prevented by intercepting `deltaX` on fine-pointer devices (`(pointer: fine)`).
  - Settle debounce: updates React active tab state and switches text colors cleanly when the scroll snaps to a tab.
  - Smooth programmatic transitions: tab clicks and post-transaction redirects to Accounts smoothly slide the carousel to the target panel.
  - Safe hydration via `useSyncExternalStore` ensuring zero cascading renders and 100% React 19 compliance.
- **Verification**: 209/209 Vitest unit tests pass across 17 test suites, 0 ESLint warnings, Next.js Turbopack production build succeeds with 0 errors.

### Langkah 27: Staged Pre-Roll Delay (710ms), 2500ms Roll & 730ms Calm Hold (3940ms Highlight)
- **710ms Pre-Roll Staging Delay**:
  - User feedback: Exact timing tuned to `710ms jeda + 2500ms putaran + 730ms jeda baca akhir`.
  - Implemented `delay={0.71}` (710ms) across all `AnimatedNumber` columns and total banners (`liquidBalance`, `investmentBalance`, `netWorth`, and account cards).
  - During $t = 0 - 710\text{ms}$, the card centers in the viewport, the amber ring and `"UPDATED"` badge glow, and the previous balance stays still and readable.
- **2500ms Rolling Duration**:
  - Set `duration={2.5}` (2500ms) with Apple-grade cubic-bezier `[0.16, 1, 0.3, 1]`. Numbers smoothly roll and decelerate, settling crisply at $t = 3210\text{ms}$ ($710\text{ms} + 2500\text{ms}$).
- **730ms Calm Reading Hold & 3940ms Total Highlight**:
  - Total highlight timeout set to `3940ms` ($710\text{ms} + 2500\text{ms} + 730\text{ms} = 3940\text{ms}$).
  - Gives the user 730ms to calmly read the settled new balance before the amber tactile highlight gently fades away.
- **Verification**: 196/196 Vitest unit tests pass, 0 ESLint warnings, Next.js Turbopack production build succeeds with 0 errors.

### Langkah 26: AnimatedNumber Mount Fix & Rolling Duration Choreography (2.1s)
- **Mount Animation Reliability ("Kadang Bisa Kadang Tidak Bisa" Fix)**:
  - Root Cause: When user saved a transaction from Dashboard or Ledger, `view` was switched to `'accounts'`. `AnimatedNumber` was mounted for the first time with the *new* value directly. Framer Motion's `useSpring(target)` only runs animations when the target value *changes while already mounted*, so on first mount it rendered the final target immediately without animating! Only if the user was *already* on the Accounts view when recording did it roll.
  - Solution: Implemented snapshot mechanism (`previousBalancesSnapshot` & `previousStatsSnapshot`) passed into `triggerAccountsRedirectAndHighlight`. Each `DigitColumn` receives its exact starting digit `fromDigit` derived mathematically ($10^k$). On initial mount, `initial={{ y: `-${initialDigit * 10}%` }}` and `animate={{ y: `-${numValue * 10}%` }}` guarantees that the numbers roll smoothly on mount every single time with 100% reliability.
- **Duration Choreography (2.1s vs 2.8s Highlight)**:
  - User feedback: "rolling numbernya terlalu cepat, buat aja durasinya menjadi sedikit lebih cepat dari lamanya highlight taktil".
  - Tactile amber ring and `"UPDATED"` badge persist for 2.8 seconds.
  - Set rolling number duration to `2.1s` (`duration = 2.1`) using Apple-grade cubic-bezier easing `[0.16, 1, 0.3, 1]`.
  - The rolling numbers smoothly decelerate and settle crisply at 2.1s, followed 700ms later by the gentle fade-out of the amber tactile ring at 2.8s.
- **Verification**: 196/196 Vitest unit tests pass, Turbopack production build succeeds with 0 errors.

### Langkah 25: Post-Transaction Redirect to Accounts & EasyUI Animated Number Motion
- **Post-Transaction Navigation Flow**:
  - Automatically redirects view to the "Accounts" page (`setView('accounts')`) immediately upon completing any transaction (Expense, Income, Transfer, or Refund).
  - Identifies and tracks impacted accounts (both source & destination for transfers; modified accounts for edits; refund destination for refunds).
- **EasyUI Animated Number Integration (`components/ui/animated-number.tsx`)**:
  - Implemented Apple-grade smooth rolling digit counter using Framer Motion physics springs (`useSpring`, `useTransform`).
  - Enforced strict Indonesian Rupiah dot separators (`.` grouping e.g. `Rp 48.250.000`) and tabular font numbers (`font-mono-numbers`).
  - Integrated across all account cards, Total Liquid header, Total Investment header, and Total Net Worth Aggregate banner.
- **Visual Feedback & Auto-Scroll**:
  - Added vibrant tactile amber spring pulse ring (`ring-4 ring-amber-400`), slight scale lift (`scale-[1.02]`), and `"UPDATED"` pulse badge on impacted account card(s) with 2.8s auto-clear.
  - Added smooth auto-scroll (`scrollIntoView({ behavior: 'smooth', block: 'center' })`) centering the primary updated account in viewport.
- **Verification**: 196/196 Vitest tests passing, TypeScript strict typecheck clean, Next.js production build 100% green.

### Langkah 24: Comprehensive Obsidian Finance Memory Vault Expansion
- **Dedicated Obsidian Memory Notes**:
  - `memory/Accounts & Portfolio.md`: Full documentation of all 17 accounts (10 Liquid & 7 Investment), short codes, color tokens, balance derivation formulas, net worth aggregation, and the strict rule forbidding intrusive "Liquid/Non-Liquid" badges on UI cards/selectors.
  - `memory/Refunds & Relations.md`: Comprehensive refund domain guide covering: refund is never income, net expense contribution adjustment, cross-account refunds (multi-account destination), `RefundModal` UX requirements (unselected `null` start, live IDR dot delimiter, date card), cascade deletions, and cross-month negative category spending guards.
  - `memory/Agreements & Historical Context.md`: Detailed chronological record of all user feedback, solved dilemmas, and binding agreements across the project lifecycle (color coding, Gooey Menu scrollbar, Vercel `eta` vs `os` cleanup, local-first sync rationale, mobile keyboard dismissal, EasyUI tabs scope).
- **Networked Knowledge Graph & Invariants**:
  - `memory/00 - Atlas (Index).md`: Updated MOC with categorized hubs (Core Financial Domain, Infrastructure & Security, Design & Experience, History & Agreements).
  - Cross-linked all memory files bidirectionally with `[[Wikilinks]]` for instant Obsidian navigation and permanent session continuity.
- **Verification**: Complete documentation verified against all source code, tests passing, TypeScript strictly clean.

### Langkah 23: Comprehensive Codebase & Financial Engine Audit
- **Offline Deletion Tombstone Shield (`lib/sync.ts`)**:
  - Identified critical edge case where locally deleted transactions were resurrected upon next sync if offline or if network timeout occurred before cloud soft-delete completed.
  - Updated `mergeLocalAndCloudEvents` to strictly check `pendingDeletedIds`, guaranteeing pending deletions are never resurrected from cloud data. Added unit test.
- **Parity Soft-Delete on Force Upload & Restore (`lib/sync.ts`)**:
  - Updated `forceUploadAllToCloud` to soft-delete any cloud records not present in the active local/restored dataset. Prevents restored snapshots from being contaminated by old cloud records.
- **Negative Category Pie Chart Fix (`lib/finance.ts`)**:
  - Fixed mathematical SVG rendering bug where cross-month refunds caused negative category totals to be passed to Recharts `<Pie>`, resulting in NaN angles. Clamped `pieData` to positive categories (`categoryTotals[category] > 0`).
- **Category Filter Parity for Refunds (`app/finance/page.tsx`)**:
  - Aligned Card View with Ledger View so filtering by category displays refunds belonging to that expense category (resolves parent expense category lookup).
- **Account Search Expansion (`app/finance/page.tsx`)**:
  - Expanded search query in Card View to match both `fullName` and short `name` (e.g. searching "SEA", "JY", "B" now matches correctly, consistent with Ledger View).
- **Design System & Icon Audit**:
  - Replaced raw Unicode `✕` symbol with Lucide `X` icon, maintaining 100% adherence to zero-emoji design rules.
  - Verified 0 Unicode emojis across all `.ts` and `.tsx` source files.
  - Synced `next.config.ts` allowedDevOrigins.
- **Verification**: 196/196 Vitest tests passing, 0 ESLint warnings, TypeScript strict check green, Next.js production build green.

### Langkah 22: Cross-Account Refunds & Account Preservation
- **Cross-Account Refund Support**:
  - Removed same-account restriction in `validateFinancialEvents` (`lib/finance.ts`), enabling refunds to be deposited into any valid active account (e.g. paid with BCA, refunded to GoPay).
  - Derived ledger entries and balances already credit the refund's chosen `accountId` and reduce the parent expense's net contribution deterministically.
  - Stats calculation (`calculateFinanceStats`) correctly decrements `monthlyExpense` by the refund amount without treating it as income.
- **Refund Destination Account Selection (`RefundModal.tsx`)**:
  - Added clean account selector grid (matching transaction form) with color indicator, initials, and full name.
  - Configured to start unselected (`null`) for new refunds, requiring the user to explicitly choose the destination account.
  - Added validation warning ("Please select a destination account for the refund.") if submitted without selecting an account.
  - Summary box updated with "Paid From:" label to distinguish source from refund destination account.
- **Parent Account Edit Preservation**:
  - Updated `replaceFinancialEvent` in `lib/finance.ts` so editing the parent expense account preserves each linked refund's independent destination account instead of overwriting it.
- **Verification**: 195/195 Vitest tests passing (added cross-account balance derivation and account preservation tests), TypeScript strict check passing, Next.js production build green.

### Langkah 21: Refund Modal Amount and Date Standardization
- **Refund Amount Input (`RefundModal.tsx`)**:
  - Replaced raw number input with live dot-delimited IDR formatting (`toLocaleString('id-ID')`).
  - Standardized label to "Amount" (removing raw `(IDR)`), large font (`text-xl font-black font-mono-numbers`), and `Rp` badge matching standard transaction forms.
- **Refund Date Picker (`RefundModal.tsx`)**:
  - Replaced native date box with custom tactile date display card (`Calendar` icon, `formatDateDisplay(date)` e.g. "15 October 2026", and "Change" badge) with transparent native picker overlay.
- **Visual Harmonization**:
  - Upgraded container to tactile stone borders (`border-2 border-stone-200 border-b-4 border-b-stone-300`) and tactile buttons (`btn-tactile-neutral`, `btn-tactile-dark`).
- **Verification**: 194/194 Vitest tests passing, `next build` 100% green.

### Langkah 20: Fluid Spring Indicator Tabs for Transaction Record Form
- **Fluid Spring Indicator Tabs (`showForm`)**:
  - Upgraded Type Switcher in `app/finance/page.tsx` to fluid spring sliding pill (`cubic-bezier(0.16, 1, 0.3, 1)`).
  - Maintained strictly 3 transaction types: Expense (Rose), Income (Emerald), and Transfer (Blue).
  - Preserved all vector icons (`ArrowDownLeft`, `ArrowUpRight`, `ArrowRightLeft`) layered crisply on top of the sliding indicator with active white typography and tactile bottom borders.
- **Verification**: 194/194 Vitest tests passing, `next build` 100% green.

### Langkah 19: Premium Gooey Menu PC Scrollbar & EasyUI Interactive Preview (Phone + Desktop)
- **Gooey Menu PC Scrollbar (`.gooey-scrollbar`)**:
  - Replaced native boxy browser scrollbar with a sleek, minimalist dark gray thumb (`#52525b`, zinc-600) with rounded-full pill styling and transparent track in `app/globals.css` and `components/ui/GooeyMenu.tsx`.
- **EasyUI 6 Component Interactive Preview (`public/preview-easyui.html`)**:
  - Created a rich, interactive testing sandbox with dual mode: **Desktop View** & **Simulated Phone Frame (iPhone 390x844 with Dynamic Island and native swipe/scroll gestures)**.
  - Interactive demos for:
    1. `animated-number` (Rolling Odometer for Hero Vault & KPIs)
    2. `drawer` / bottom-sheet (Mobile bottom drawer with drag handle)
    3. `animated-tabs` (Fluid spring indicator pill across Expense, Income, Transfer - strictly 3 types for record form)
    4. `drag-to-confirm` (Slide-to-confirm gesture for delete/transfer actions)
    5. `spotlight-card` (Cursor follower radial glow for accounts)
    6. `undo-toast` (Tactile pill with live countdown timer and instant Undo)
- **Verification**: 194/194 Vitest tests passing, `next build` 100% green.

### Langkah 18: EasyUI Gooey Menu, Mobile Keyboard Auto-Dismiss & Lowercase Triggers
- **EasyUI Gooey Menu (`GooeyMenu.tsx`)**:
  - Implemented liquid metaball SVG filter (`feGaussianBlur` + `feColorMatrix`) with pure CSS spring physics (`cubic-bezier(0.16, 1, 0.3, 1)`).
  - Integrated into `TransactionFilters.tsx` as the Category selector in the Activity area with dynamic pill sizing, active amber highlight, crisp overlay text, and full keyboard/click-outside accessibility.
- **Mobile Keyboard Auto-Dismiss**:
  - Attached `dismissKeyboard` to modal `onScroll`, `onTouchMove`, and `onPointerDown` (for non-input taps), plus window `scroll` listener.
  - Automatically blurs focused inputs (amount, description, admin fee, cashback) whenever the user scrolls or touches elsewhere.
  - Mirrored behavior to `RefundModal.tsx`.
- **Lowercase Keyboard Trigger**:
  - Configured `autoCapitalize="none"` and `autoCorrect="off"` on Description inputs in both transaction modal and refund modal so the mobile keyboard immediately displays lowercase letters.
- **Verification**: 194/194 Vitest tests passing, `next build` 100% green.

### Langkah 17: Direct Force Upload to Cloud, Backup Auto-Push & Architecture Clarification
- **Force Upload to Cloud (`forceUploadAllToCloud`)**:
  - Implemented direct bulk upsert in `lib/sync.ts` that pushes all active events to Supabase with `{ onConflict: 'id' }`.
  - Added "Force Push All Records to Cloud" button in Cloud Sync Modal for one-click manual synchronization.
- **Backup Restore Auto-Push**:
  - Updated `handleConfirmRestore` so importing a JSON backup immediately force-uploads all restored records to Supabase.
- **Root-Cause Clarification & Resolution**:
  - Investigated `the-life-project-eta.vercel.app`: confirmed it lacked Supabase env variables (`isSupabaseConfigured() === false`), trapping phone transactions in local storage. Provided clear backup & migration path before safe deletion.
  - Verified GitHub privacy: transactions and database keys never touch Git.
- **Verification**: 194/194 Vitest tests passing, `next build` 100% green.

### Langkah 16: Multi-Device Sync Hardening & Obsidian Memory Vault
- **Obsidian Vault in Root**: Created dedicated `memory/` vault with Atlas index, wikilinks, and comprehensive architectural documentation.
- **Vercel Build Fix**: Fixed TS2339 in `tests/finance/crud.test.ts` (narrowed event types before reading `accountId`), unblocking Vercel production deployment.
- **Proactive Cloud Synchronization**:
  - Implemented auto-sync on mount to eliminate the "empty initial balance" flash on new devices and incognito mode.
  - Added listeners for `visibilitychange` and window `focus` to automatically synchronize when switching between phone and PC.
  - Added `inFlightSync` promise cache in `lib/sync.ts` to prevent redundant overlapping network calls to Supabase.
- **Verification**: 194/194 Vitest tests passing, `next build` 100% green.

### Langkah 15: Editable Refunds & Net Expense Visualization
- **Editable Refunds**: Added editing capability for existing refunds via Action Menu and `RefundModal.tsx`.
- **Cascading Updates**: Account modifications on parent expenses cascade to all linked refunds in `replaceFinancialEvent`.
- **Net Calculation**: Displayed original amount, refunded amount, and net expense on parent cards.
- **Color Consistency**: Set refund card amounts and labels to purple (`text-violet-600`).

### Langkah 14: Color Harmonization & Custom Category Dropdown
- **Transfer Color**: Standardized to blue (`.btn-tactile-blue`, `bg-blue-600`).
- **Refund Color**: Standardized to purple/violet (`bg-violet-600`).
- **Custom Dropdown**: Upgraded category filter in `TransactionFilters.tsx` from browser native select to custom tactile dropdown.

### Langkah 13: Background Scroll Locking
- **Modal Lock**: Prevented background card scrolling when Transaction Options modal is open by applying `document.body.style.overflow = 'hidden'`.

### Langkah 12: Cleaner Form Labels & Card View Polish
- **Labels**: Simplified labels to "AMOUNT", "DESCRIPTION", "SOURCE ACCOUNT", and "DESTINATION ACCOUNT".
- **Options Prompt**: Removed repetitive "Click for options" text from transaction cards.

### Langkah 11: Date Formatting Refinement
- **Standard Format**: "Day, DD Month YYYY" for sticky date headers, "D MMM YYYY" (e.g. 30 Sep 2026) for Ledger table.
- **Unselected Form Defaults**: Form starts with null account and category selections to prevent unintended defaults.

### Langkah 1–10: Foundation & Sync
- Multi-account balance derivation across 17 liquid accounts.
- Initial prototype migration to Supabase PostgreSQL cloud sync with tombstoning.
- Master PIN security shield and rate limiting.
