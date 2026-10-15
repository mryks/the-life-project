# Agreements & Historical Context

> Hub: [[00 - Atlas (Index)]] | Related: [[Changelog & Step Log]], [[Domain & Financial Model]], [[Cloud Sync & Supabase]], [[UI & Design System]]

---

## 📜 Complete Evolution & User Agreements

This document provides a permanent, faithful record of every user request, resolved pain point, explicit decision, and binding agreement made across the project's lifetime. Future agent invocations must consult this note before proposing changes.

---

### 1. Color Coding Matrix & Activity Filters
- **User Request**: Standardize colors across the creation form and activity search filters.
- **Agreement**:
  - **Expense**: Crimson / Red (`rose-600`, `bg-rose-500`).
  - **Income**: Emerald / Green (`emerald-600`, `bg-emerald-500`).
  - **Transfer**: **Blue** (`blue-600`, `bg-blue-600`). Previously black/dark; user explicitly requested blue.
  - **Refund**: **Purple / Violet** (`violet-600`, `bg-violet-600`). User requested matching the purple refund label.

---

### 2. Category Filter & EasyUI Gooey Menu
- **User Request**: The category filter in the Activity section previously used the browser's native `<select>` dropdown, which looked plain and unstyled.
- **Evolution**:
  1. Built a custom dropdown.
  2. Evaluated EasyUI library (`https://easyui.site/`) per user prompt.
  3. User requested implementation of the **Gooey Menu** (`https://easyui.site/components/gooey-menu`).
  4. Implemented liquid SVG metaballs filter (`feGaussianBlur` + `feColorMatrix`), spring physics (`cubic-bezier(0.16, 1, 0.3, 1)`), active amber selection highlight, and layered typography.
  5. User noted that on PC, the Gooey Menu had a boxy default browser scrollbar. Added `.gooey-scrollbar` with a sleek, minimalist dark gray thumb (`#52525b`, zinc-600) and transparent track.

---

### 3. Refund Accounting & Cross-Account Destination
- **User Request**:
  - Allow refunds to be edited if an amount was entered incorrectly.
  - Ensure refunds are **never counted as income**.
  - Ensure refunds reduce the **actual/net expense** of the parent expense transaction.
  - Allow refunds to be deposited into a **different account** than the original expense account.
- **Explicit Alignment & Decisions**:
  - User instructed: *"tanyain deh yang bingung ke saya, jangan asumsi sendiri"*.
  - Clarification interview conducted:
    * **Account Selection Default**: In `RefundModal`, new refunds start with destination account **unselected (`null`)**, forcing explicit user tap. Editing existing refunds defaults to the current refund account.
    * **Accounting Behavior**: Parent expense retains full deduction on its account (e.g. BCA `-Rp 100.000`), refund destination account receives funds (e.g. GoPay `+Rp 60.000`), and net expense contribution adjusts to `Rp 40.000`.
    * **Parent Account Edit**: If the parent expense account is edited later, linked refunds **retain their own selected account** without being overwritten.
    * **Amount & Date Standardization**: Replaced raw number and native date box in `RefundModal` with live dot-delimited IDR (`toLocaleString('id-ID')`) and formatted tactile date card (`15 October 2026`).

---

### 4. Vercel Projects, Domain Isolation & Data Safety
- **User Finding**: User saw two Vercel projects: `the-life-project-eta.vercel.app` and `the-life-project-os.vercel.app`, and experienced transaction count discrepancies (57 transactions vs more on phone).
- **Investigation & Resolution**:
  - Discovered `the-life-project-eta` was a duplicate that lacked Supabase environment variables, trapping mobile records solely in local browser storage.
  - Provided a safe migration guide: export JSON backup on phone, restore into `the-life-project-os`, then safely delete the legacy `eta` project on Vercel.
  - User confirmed backup restoration, verified data update across all devices, and deleted the `eta` deployment.
  - **Binding Rule**: All updates and deployments are strictly targeted to `https://the-life-project-os.vercel.app/`.

---

### 5. Why LocalStorage + Supabase? (Local-First Sync Architecture)
- **User Question**: *"Apa guna local storage sebenarnya, kenapa perlu simpan atau butuh local storage? Kenapa ga otomatis sinkron ke database saja?"*
- **Resolution & Agreement**:
  - Explained the **Local-First Architecture**:
    1. **Instant App Launch**: Loading instantly from local storage eliminates network latency and cold-start spinners on mobile.
    2. **Offline Resilience**: User can record an expense immediately in areas with poor cellular reception (transit, elevators, basements); the transaction is saved locally and synced automatically once online.
    3. **Cloud as Authoritative Master**: Supabase PostgreSQL is the permanent multi-device sync hub. LocalStorage is an acceleration cache.
  - Proactive background sync wired to: app mount, window focus, app visibility change (`visibilitychange`), vault unlock, and mutations.
  - Added "Force Push All Records to Cloud" button in the Cloud Sync Modal for one-click manual synchronization.

---

### 6. Mobile UX & Keyboard Hygiene
- **User Request**: When entering amount or text on a smartphone, scrolling or tapping elsewhere should automatically dismiss/hide the keyboard. Also, description fields should start in lowercase.
- **Agreement**:
  - Added global and modal touch/scroll event listeners that trigger `input.blur()`.
  - Added `autoCapitalize="none"` and `autoCorrect="off"` to description inputs across both transaction and refund modals.

---

### 7. EasyUI 6 Component Evaluation & Decisions
- **User Request**: Created interactive HTML preview sandbox at `public/preview-easyui.html` with dual Desktop & iPhone Phone Frame simulator.
- **Component Evaluated**: Fluid Spring Indicator Tabs (`animated-tabs`).
- **User Agreement**:
  - Approved implementation for the transaction record form type switcher.
  - **Strict Constraint**: Applies **only to the 3 transaction types (Expense, Income, Transfer)**. Strictly no refund option in the transaction creation switcher.
  - Vector icons (`ArrowDownLeft`, `ArrowUpRight`, `ArrowRightLeft`) preserved and layered crisply.

---

### 8. Comprehensive Audit Fixes
- **Audit Findings Resolved**:
  1. **Deletion Resurrection Shield**: If offline or during network timeouts, `pendingDeletedIds` is now checked by `mergeLocalAndCloudEvents`, guaranteeing deleted events are never resurrected from cloud data.
  2. **Force-Upload & Restore Parity**: `forceUploadAllToCloud` now soft-deletes any cloud records not present in the local active snapshot, preventing ghost records from re-appearing after restoring a backup.
  3. **Pie Chart Negative Arc Fix**: Clamped `pieData` to positive values (`categoryTotals[category] > 0`) to prevent Recharts SVG NaN angle crashes from cross-month refunds.
  4. **Card View Category Filter for Refunds**: Resolves parent expense category so refunds display consistently with Ledger View when filtered by category.
  5. **Account Search Expansion**: Card View search matches both short code (`name`) and `fullName`.
  6. **Zero-Emoji Enforcement**: Replaced raw Unicode `✕` symbol with Lucide `X` icon.

---

### 9. Post-Transaction Redirect to Accounts & EasyUI Animated Number Motion
- **User Request**: When completing any transaction (Expense, Income, Transfer, or Refund), automatically redirect to the "Accounts" page and animate the impacted account numbers and totals (Total Liquid, Total Investment, Total Net Worth) using EasyUI's `animated-number` (`https://www.easyui.site/components/animated-number`).
- **Explicit Alignment & Binding Agreements**:
  1. **Impacted Accounts Tracking**:
     - **Expense / Income**: Highlights the selected account (plus previous account if modified during edit).
     - **Transfer**: Highlights both source and destination accounts (plus previous accounts if modified during edit).
     - **Refund**: Highlights the user-selected refund destination account.
  2. **Tactile Spring Pulse & Visual Feedback**:
     - Impacted account card(s) display an amber tactile ring (`ring-4 ring-amber-400`), soft background tint, slight scale lift (`scale-[1.02]`), and a tactile `"UPDATED"` badge with a 2.8-second auto-clear timer.
  3. **Smooth Viewport Auto-Scroll**:
     - Automatically scrolls smoothly (`scrollIntoView({ behavior: 'smooth', block: 'center' })`) to the impacted account card, ensuring immediate visual focus on mobile devices and large screens.
  4. **Strict IDR Dot Delimiters**:
     - Digits roll vertically via Framer Motion physics springs while strictly preserving Indonesian Rupiah dot separators (e.g. `Rp 48.250.000`) and tabular monospaced numbers.
  5. **Totals Motion**:
     - Total Liquid, Total Investment, and Total Net Worth Aggregate cards/headers on the Accounts page smoothly morph their numbers using `AnimatedNumber`.
  6. **Mount Animation Reliability & Duration Choreography**:
     - Resolved "kadang bisa kadang tidak bisa" root cause: passing snapshot of `previousBalancesSnapshot` and `previousStatsSnapshot` ensures `initial={{ y: -fromDigit * 10% }}` animates on initial mount when redirecting from Dashboard/Ledger.
     - Tuned rolling animation duration to `2.1s` with Apple-grade cubic-bezier `[0.16, 1, 0.3, 1]`, fulfilling user requirement that the rolling number duration be slightly faster than the 2.8s tactile highlight ring.

