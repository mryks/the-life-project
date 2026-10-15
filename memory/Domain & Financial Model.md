# Domain & Financial Model

> Hub: [[00 - Atlas (Index)]] | Related: [[Accounts & Portfolio]], [[Refunds & Relations]], [[Cloud Sync & Supabase]], [[UI & Design System]]

---

## 🏛️ FinancialEvent as Single Source of Truth

The entire financial system is built on an immutable event-sourcing paradigm.
- **Only `FinancialEvent` records are persisted.**
- Ledgers, account balances, monthly summaries, category allocations, and charts are **100% derived deterministically**.
- No derived balance is ever stored as a separate source of truth.

---

## 📦 Domain Discriminated Union

Implemented strictly in `lib/types.ts`:

```typescript
export type FinancialEvent =
  | IncomeEvent
  | ExpenseEvent
  | TransferEvent
  | RefundEvent;
```

### 1. IncomeEvent (`type: 'income'`)
- Fields: `id`, `date`, `description`, `amount`, `accountId`, `category` (IncomeCategory), optional `relatedEventId`.
- **Cashback**: Represented as an income event with `category: 'Cashback'` and a required `relatedEventId` pointing to an existing `ExpenseEvent`.
- Impact: Increases balance of `accountId`.

### 2. ExpenseEvent (`type: 'expense'`)
- Fields: `id`, `date`, `description`, `amount`, `accountId`, `category` (ExpenseCategory).
- Impact: Decreases balance of `accountId`.
- Can have linked child events:
  - At most one Cashback event.
  - Zero or more Refund events, whose sum cannot exceed the expense amount.

### 3. TransferEvent (`type: 'transfer'`)
- Fields: `id`, `date`, `description`, `amount`, `sourceAccountId`, `destinationAccountId`, optional `adminFee`.
- **Constraint**: `sourceAccountId !== destinationAccountId`.
- Impact:
  - Source account decreases by `amount + (adminFee ?? 0)`.
  - Destination account increases by `amount`.
  - Admin fee is treated as an expense fee on the source account.

### 4. RefundEvent (`type: 'refund'`)
- For comprehensive rules, see dedicated note: [[Refunds & Relations]].
- Fields: `id`, `date`, `description`, `amount`, `accountId`, `relatedEventId`.
- **Fundamental Rule**:
  - **Refund is NOT Income.** It must never be aggregated into monthly income totals.
  - **Refund reduces Net Expense**: If an expense of Rp 100,000 has a refund of Rp 60,000, net expense is Rp 40,000.
  - Money returns to the user-selected destination account (`accountId` can be any valid account, e.g. paid via BCA, refunded to GoPay).
  - Parent expense retains original outflow on its account; refund destination account receives incoming funds.
  - Total refunds for an expense must never exceed the parent expense amount (`totalRefunds <= parentExpense.amount`).

---

## 🧮 Balance & Reporting Derivation

All calculations are pure functions located in `lib/finance.ts`:

1. **Account Balances** (`getAccountBalances`):
   - Computes exact balance per account across all 17 accounts (see [[Accounts & Portfolio]]) by scanning ledger entries chronologically.
2. **Monthly Summary** (`calculateFinanceStats`):
   - Total Income = $\sum \text{Income events in month}$
   - Total Expense = $\sum \text{Expense events} - \sum \text{Refund events} + \sum \text{Admin fees}$
   - Net Cashflow = $\text{Total Income} - \text{Total Expense}$
   - Savings Rate = $\frac{\text{Net Cashflow}}{\text{Total Income}} \times 100\%$ (clamped to 0% if income is 0).
   - Daily Average = $\frac{\text{Total Expense}}{\text{Days in Month}}$.
3. **Pie Chart Data Guard (`pieData`)**:
   - `pieData` filters strictly for positive category spending (`categoryTotals[category] > 0`). If a cross-month refund causes a category's monthly net spending to be negative, it is excluded from the pie chart, protecting Recharts from SVG arc NaN crashes.
4. **Within-Day Reordering**:
   - Transactions within the same date can be reordered via drag-and-drop.
   - Preserves Atomic Reorder Units (expense + linked cashback are tied together). Reordering is strictly constrained within the same calendar date.

---

## 🛡️ Validation Invariants (`validateFinancialEvents`)

1. Every event must have a valid positive integer amount (`amount > 0`).
2. Event date must match strict `YYYY-MM-DD` calendar format.
3. Every ID must be unique across the entire dataset.
4. Child events (`refund` or `cashback`) must have a valid parent expense event.
5. Child cashback event `accountId` matches parent `accountId`. Refund event `accountId` can be any valid account selected by the user.
6. Sum of refunds on an expense cannot exceed parent expense amount.
