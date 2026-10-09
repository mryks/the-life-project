# Changelog & Step Log

> Hub: [[00 - Atlas (Index)]] | Related: [[Deployment & Vercel]], [[Domain & Financial Model]]

---

## 📜 Sprint & Evolution Log

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
