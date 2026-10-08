# System Patterns & Architecture

## Financial Event Single Source of Truth
Only events conforming to `FinancialEvent` union are stored in state/persistence:
- `IncomeEvent`: `id`, `date`, `description`, `amount`, `accountId`, `category`, `relatedEventId?` (required if Cashback).
- `ExpenseEvent`: `id`, `date`, `description`, `amount`, `accountId`, `category`.
- `TransferEvent`: `id`, `date`, `description`, `amount`, `sourceAccountId`, `destinationAccountId`.
- `RefundEvent`: `id`, `date`, `description`, `amount`, `accountId`, `relatedEventId` (must point to parent Expense).
- `OpeningBalanceEvent`: `id`, `date: '2026-09-30'`, `description`, `amount` (integer, can be positive/negative/zero), `accountId`.

All other financial representations are **purely derived**:
- `deriveLedgerEntries(events)`: Transforms events into double-entry ledger rows.
  - Opening balance: 1 entry (positive = in, negative = out).
  - Transfer: 2 entries (source = out, destination = in).
  - Expense: 1 entry (out).
  - Income/Refund: 1 entry (in).
- `getAccountBalances(events)`: Sum of ledger entries per account.
- `calculateFinanceStats(events, date)`: Monthly income, expense (net of refunds), category aggregates, pie chart data.
- `calculateNetExpenseForDate(events, date)`: Day-level expense minus refunds for 7-day line chart.

## Reordering Architecture
- Managed via `hooks/useTransactionReorder.ts` and `getAtomicReorderUnits(events)`.
- Units keep parent Expense + linked Cashback bonded together as a single draggable item.
- Reordering is strictly allowed only between transactions of the same calendar date.
- Card view displays newest date first and newest recorded transaction first (DESC).
- Ledger view displays oldest date first and recording sequence (ASC).
- Visual drop targets translate appropriately based on view mode.
- 8-second undo mechanism allows reverting reorder actions without data corruption.

## Persistence & Validation Boundary
- `FINANCE_STORAGE_KEY = 'thelife-finance'`, schema version `FINANCE_STORAGE_VERSION = 2`.
- `validateFinancialEvents(events)` strictly enforces:
  - Account existence from `accounts` list (17 registered accounts: S, B, G, K, E, C, Q, JY, H, J, P, SB, SEA, POE, CLA, KB, I).
  - Unique IDs.
  - Exactly 1 opening balance per account, strictly dated `2026-09-30`.
  - Normal transaction dates `>= 2026-10-01`.
  - Cashback & Refund parent link validity and amounts.
- React state synchronization is bound via `useSyncExternalStore` listening to storage and local dispatch events (`thelife-finance-change`).
