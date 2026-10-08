# Domain & Financial Model

> Hub: [[00 - Atlas (Index)]] | Related: [[Cloud Sync & Supabase]], [[UI & Design System]]

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
- Fields: `id`, `date`, `description`, `amount`, `accountId`, `relatedEventId`.
- **Fundamental Rule**:
  - **Refund is NOT Income.** It must never be aggregated into monthly income totals.
  - **Refund reduces Net Expense**: If an expense of Rp 100,000 has a refund of Rp 60,000, net expense is Rp 40,000.
  - Money returns to the original expense account (`accountId === parentExpense.accountId`).
  - Total refunds for an expense must never exceed the parent expense amount (`totalRefunds <= parentExpense.amount`).

---

## 🧮 Balance & Reporting Derivation

All calculations are pure functions located in `lib/finance.ts`:

1. **Account Balances** (`deriveAccountBalances`):
   - Computes exact balance per account by scanning all events chronologically.
2. **Monthly Summary** (`deriveMonthlySummary`):
   - Total Income = $\sum \text{Income events in month}$
   - Total Expense = $\sum \text{Expense events} - \sum \text{Refund events} + \sum \text{Admin fees}$
   - Net Savings = $\text{Total Income} - \text{Total Expense}$
   - Savings Rate = $\frac{\text{Net Savings}}{\text{Total Income}} \times 100\%$ (clamped to 0% if income is 0).

---

## 🛡️ Validation Invariants (`validateFinancialEvents`)

1. Every event must have a valid positive integer amount (`amount > 0`).
2. Event date must match strict `YYYY-MM-DD` calendar format.
3. Every ID must be unique across the entire dataset.
4. Child events (`refund` or `cashback`) must have a valid parent expense event.
5. Child event `accountId` must strictly match parent `accountId`.
6. Sum of refunds on an expense cannot exceed parent expense amount.
