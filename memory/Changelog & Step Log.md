# Changelog & Step Log

> Hub: [[00 - Atlas (Index)]] | Related: [[Deployment & Vercel]], [[Domain & Financial Model]]

---

## 📜 Sprint & Evolution Log

### Langkah 27: Staged Pre-Roll Delay (770ms) & Synchronized Highlight (3.6s)
- **770ms Pre-Roll Staging Delay**:
  - User feedback: Modal closing, page switching, and viewport auto-scroll previously meant the rolling animation began before the user's eyes arrived on the target card.
  - Implemented `delay={0.77}` (770ms) across all `AnimatedNumber` columns and total banners (`liquidBalance`, `investmentBalance`, `netWorth`, and account cards).
  - During $t = 0 - 770\text{ms}$, the card centers in the viewport, the amber ring and `"UPDATED"` badge glow, and the previous balance stays still and readable.
  - At $t = 770\text{ms}$, the digits smoothly roll for 2.1 seconds (`[0.16, 1, 0.3, 1]`), finishing crisply at $t = 2870\text{ms}$.
- **Extended Highlight Lifecycle (3.6s)**:
  - Extended tactile amber ring and `"UPDATED"` badge from 2.8s to 3.6s (`3600ms`), ensuring the settled number remains highlighted for 730ms before fading away gently.
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
