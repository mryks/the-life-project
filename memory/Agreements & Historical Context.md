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
  6. **Mount Animation Reliability & Staged Choreography (710ms Jeda + 2500ms Roll + 730ms Hold)**:
     - Resolved "kadang bisa kadang tidak bisa" root cause: passing snapshot of `previousBalancesSnapshot` and `previousStatsSnapshot` ensures `initial={{ y: -fromDigit * 10% }}` animates on initial mount when redirecting from Dashboard/Ledger.
     - **Exact Choreography Specification**:
       * **710ms Jeda Awal (`delay = 0.71`)**: Modal closing, page switching to Accounts, and viewport auto-scroll finish completely before digits roll; initial balance is calm and readable.
       * **2500ms Putaran (`duration = 2.5`)**: Numbers roll with Apple-grade cubic-bezier `[0.16, 1, 0.3, 1]`, settling at $t = 3210\text{ms}$.
       * **730ms Jeda Baca Akhir**: Final settled balance is cleanly visible for 730ms before the amber highlight ring clears.
       * **3940ms Total Highlight**: Amber ring and `"UPDATED"` badge persist for exactly 3940ms ($710\text{ms} + 2500\text{ms} + 730\text{ms} = 3940\text{ms}$).



---

### 10. Live Motion Transaction Reordering & Zero Rubber Scaling
- **User Directives**:
  - *"jangan bikin selama itu untuk suatu transaksi bisa digeser"* (Hold delay too long).
  - *"saya merasa live reorder (draggingnya) lemot atau delay"* (Sluggish drag).
  - *"saat saya hold ada efek bounce/squiishy sedikit. kenapa bisa begitu ya? saya tidak ada pernah minta"* (Remove unwanted bounce/squishy effect).
- **Binding Agreements**:
  1. **Hold Delays**: Desktop mouse hold is snappy at 50ms (or instant drag on $\ge 4\text{px}$ movement); mobile touch hold is 150ms with subtle 40ms haptic tap.
  2. **120 FPS GPU Tracking**: Held card follows pointer via direct GPU translation (`translate3d(0, y, 0)`) without main-thread layout thrashing or calling `getBoundingClientRect()` on every pixel.
  3. **No Squishy/Rubbery Scale**: Card scale is permanently locked to flat 1.0 (no `scale(0.98)` or `scale(1.02)`). Dragged state is indicated cleanly by `border-2 border-dashed border-emerald-500 shadow-xl z-40 bg-white`.
  4. **Same-Date Hard Stop**: Reordering is strictly restricted within the same date. Auto-scroll hard-stops when the pointer reaches the top or bottom of that date's transactions.

---

### 11. Dynamic Custom Categories & In-Use Transaction Guard
- **User Directive**: Allow adding custom categories inline for Income and Expense, and deleting unused ones, without breaking existing financial history.
- **Binding Agreements**:
  1. **Quick Inline Creation**: Users can add a custom category directly from the category pill list via `+ Add`.
  2. **Immutable System Defaults**: Built-in default categories (Food & Drinks, Salary, etc.) can never be deleted.
  3. **Financial Integrity Guard**: A custom category can only be deleted if it has 0 associated transactions. If in use, deletion is rejected with an explanatory notice.
  4. **Open TypeScript Modeling**: Uses `DefaultExpenseCategory | (string & {})` for full autocomplete while allowing arbitrary persisted custom strings.

---

### 12. Master PIN Security & 1-Day Trusted Device Policy
- **User Directives**:
  - Remove fingerprint / WebAuthn biometrics entirely in favor of instant Master PIN keypad.
  - *"tolong buat trust this device itu hanya untuk 1 hari, ganti hari harus masukin pin lagi, dan tombol trust this device jangan default checked"*.
- **Binding Agreements**:
  1. **Pure Keypad**: WebAuthn and biometric prompts are permanently removed. Keypad is immediately ready for input on launch.
  2. **1-Day Calendar Limit**: Device trust is bounded strictly to local calendar day `YYYY-MM-DD`. Trust expires automatically at midnight ("ganti hari").
  3. **Default Unchecked**: "Trust this device for today" starts unchecked (`false`), enforcing temporary session security unless explicitly opted in.
  4. **Manual Revocation**: Tapping the Lock button immediately clears all session keys and trust tokens.

---

### 13. Table Ledger Month Separator (Option 4: Deep Slate Blue Bar)
- **User Directive**: Table ledger month name must be center-aligned, bold, and distinct in color to clearly mark monthly boundaries. User selected Option 4.
- **Binding Agreements**:
  1. Row is styled with Deep Slate Blue (`bg-slate-800 text-slate-100 border-y border-slate-900 shadow-inner`).
  2. Cell spans all 6 columns with `text-center`, `font-black`, and `tracking-widest`.
  3. Provides authoritative high contrast without colliding with semantic transaction colors (green income, red expense, blue transfer, purple refund).

---

### 14. Activity Freeze Panes, Cascading Date Badges & Automated Mobile Subagent Testing
- **User Directives**:
  - Search bar down to Card View / Table Ledger must freeze on scroll. Table Ledger row 1 headers (`Date`, `Description`, `Account`, etc.) must be frozen. Card View date badge must freeze until pushed by the next date group.
  - Fix ghost touch auto-swipe glitch.
  - Subagent must test every feature change in a real mobile browser (iPhone touch emulation) before delivery.
- **Binding Agreements**:
  1. **CSS Overflow & Containing Block Law**: `<main>` must use `overflow-x: clip` (never `hidden`) so vertical scrolling does not compute to `auto` and break window `position: sticky`. Active views must render in normal DOM flow with `transform: none`.
  2. **Synchronized Table Ledger Header Bar**: Table header row is placed directly inside the viewport-sticky freeze pane (`top: 0`) and synchronizes horizontal `scrollLeft` bidirectionally with the table body on swipe.
  3. **Cascading Date Badges**: In Card View, date badges stick at `top: [freezeHeight]` and stay pinned until pushed up by the subsequent date group.
  4. **Gesture Disambiguation & Touch Isolation**: Swipeable tab navigation is guarded by strict angle thresholds (`|deltaX| > |deltaY| * 1.5`), min distance (50px), and element immunity (`table`, `button`, `input`). Tab widths must remain static without dynamic `display: none` layout shifts during touch.
  5. **Mandatory Automated Mobile Subagent Testing**: No mobile touch, layout, or freeze pane feature is considered complete until verified by `scripts/test-mobile-e2e.mjs` (`npm run test:e2e:mobile`) on both local and live Vercel production.

---

### 15. Continuous Knowledge & Memory Synchronization Law (Every Chat Interaction)
- **User Directive**:
  - *"oke, tolong lakukan update skill, memory, rule, dan lain lain setiap kali chat ya"*
- **Binding Agreement**:
  - In **EVERY single chat interaction**, regardless of task type (feature, bugfix, UI design, questions, or clarification), the agent must proactively update and synchronize all 4 knowledge tiers:
    1. **Obsidian Vault (`memory/`)**: Update `Changelog & Step Log.md`, `Agreements & Historical Context.md`, `UI & Design System.md`, and `00 - Atlas (Index).md`.
    2. **Agent Memory Bank (`.agents/memory/`)**: Update `activeContext.md` and `progress.md`.
    3. **Engineering Rules (`AGENTS.md` & `GEMINI.md`)**: Codify any newly emerged invariant, user rule, or anti-pattern.
    4. **Domain Skills (`.agents/skills/`)**: Expand recipes, test scripts, and guidelines in relevant skill files.
  - A task or chat turn is never complete until documentation has been updated, verified, committed, and pushed.

---

### 16. Table Ledger Default Auto-Scroll to Bottom & Latest Transactions Focus
- **User Directive**:
  - *"sekarang saya mau default dari table ledger tuh scrolled ke paling bawah, agar saya bisa langsung liat latest transaction dan ga harus scroll scroll setiap kali membuka table ledger"*
- **Binding Agreement**:
  1. **Dual Sorting Alignment**:
     - **Card View**: Sorted reverse-chronological (newest at top). Opening Card View defaults to `scrollY: 0` (top).
     - **Table Ledger**: Sorted chronologically ascending (newest at bottom). Opening Table Ledger defaults to `scrollY: bottom` (scrolled all the way to the bottom).
  2. **Staged Execution Engine**: Uses `tableBottomAnchorRef` with immediate execution + staged `requestAnimationFrame` + timeout fallbacks (40ms, 120ms) so all dynamic rows and fonts settle at the true bottom.
  3. **Trigger Invariants**: Auto-scroll to bottom activates when switching to Table Ledger or navigating to Activity in Table Ledger mode. Reading, typing in search, or editing existing records maintains the current scroll position without disruptive jumps.

---

### 17. Default Nominal Masking (`Rp ••••••`) with Session-Persisted Eye Toggle
- **User Directive**:
  - *"sekarang saya mau by default, nominal tidak ditampilkan. mau ada icon mata untuk hide and show. maunya tidak ke menjadi hidden selama tidak dikill. silakan berikan rencana kerjanya dulu"*
- **Binding Agreement**:
  1. **Default Privacy Invariant**: All nominal amounts across the entire application (Total Balance, Investment Balance, Net Worth, Income, Expenses, Cashflow, Burn Rate, Chart Tooltips, Account Cards, Card View, and Table Ledger) MUST default to masked (`Rp ••••••`).
  2. **Session Persistence via `sessionStorage`**:
     - Key: `thelife-hide-nominals`.
     - Toggling nominals to visible (`false`) persists across tab navigation, view switches, and page refreshes as long as the application session is active.
     - When the application process is terminated/killed (tab closed, mobile app swiped away from RAM), the operating system/browser purges `sessionStorage`, automatically reverting nominals to masked (`true`) on the next cold start.
  3. **Visual Standard**: 6 uniform bullet dots (`Rp ••••••`, `+Rp ••••••`, `-Rp ••••••`, `Rp ••••••/day`, `Net: Rp ••••••`). Maintains monospaced tabular layout without card distortion.
  4. **Dual Toggle Controls**:
     - Primary toggle: Tactile `Eye` / `EyeOff` button in the sticky top header bar beside `Lock`, `Backup`, and `Cloud`.
     - Secondary companion toggle: Small eye icon button beside `TOTAL BALANCE` on `HeroVaultCard`.
  5. **Arithmetic & State Non-Interference**: Masking is strictly presentational. Underlying numbers, financial ledger records, calculations, and sync operations remain 100% deterministic and unmodified.
