# Progress Tracking — Finance Domain

## Overall Status: STABLE PRODUCTION (OFFICIALLY GO-LIVE 🚀)
- **Live Production URL:** [https://the-life-project-os.vercel.app/finance](https://the-life-project-os.vercel.app/finance)
- **Backend Database:** Supabase PostgreSQL (`peydzblrtfgdoaisljkm.supabase.co`)
- **Automated Test Suite:** 16 test suites, **191/191 tests passing (100%)**
- **Code Quality:** 0 ESLint errors, 0 TypeScript errors (`npx tsc --noEmit`)
- **Session Boundary:** Permanently assigned as **Finance Domain Specialist**. All non-finance life domains (Habits, Journal, Tasks) are developed in separate dedicated chat sessions.

---

## Completed Milestones (Verified in Production)

### 1. Financial Domain Model & Invariants
- Strongly-typed `FinancialEvent` union (`income`, `expense`, `transfer`, `refund`).
- Full historical calendar support without arbitrary date restrictions.
- Starting balances recorded as regular income (`category: 'Others'`).
- Transfer `adminFee` support: automatically deducted from source account and recorded in monthly expense calculations under `'Other'`.
- Relational integrity: Cashback and Refunds linked to parent expense on identical account; refund sum capped at parent expense amount; cascading deletions.

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

### 5. Single-User Master PIN & Biometric Security
- Server-side fixed Master PIN verification via `/api/auth/verify-pin` + Vercel secret `MASTER_PIN`.
- Anti-brute-force rate limiting (5 failed attempts -> 30s lockout returning HTTP 429).
- WebAuthn Biometric quick-unlock strictly gated: fingerprint key is hidden on new/untrusted devices until valid Master PIN is authenticated.
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
