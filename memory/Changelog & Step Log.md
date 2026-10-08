# Changelog & Step Log

> Hub: [[00 - Atlas (Index)]] | Related: [[Deployment & Vercel]], [[Domain & Financial Model]]

---

## 📜 Sprint & Evolution Log

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
