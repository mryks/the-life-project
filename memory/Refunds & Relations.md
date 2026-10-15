# Refunds & Relations

> Hub: [[00 - Atlas (Index)]] | Related: [[Domain & Financial Model]], [[Accounts & Portfolio]], [[UI & Design System]]

---

## 🔁 The Core Philosophy of Refunds

In personal accounting, a **refund is an expense reversal**, never income.

1. **Refund is NOT Income**:
   - When you buy groceries for Rp 100,000 and return a defective item for Rp 60,000, you did not earn Rp 60,000. You merely recovered part of your spent capital.
   - Refunds must **never** be added to monthly income aggregates or inflate savings rate formulas.
2. **Refund Directly Reduces Net Expense**:
   - Contribution of the parent expense to monthly spending becomes:
     $$\text{Net Expense} = \text{Original Expense Amount} - \sum \text{Linked Refunds}$$
   - Example: Rp 100,000 expense with Rp 60,000 refund = **Rp 40,000 net expense**.
3. **Card Visualization**:
   - Parent expense cards display the original amount, a violet badge `Refunded: Rp 60.000`, and the adjusted net expense.
   - Individual refund cards are highlighted in violet (`text-violet-600`, `bg-violet-50`) and clearly marked with a `Refund` badge.

---

## 🔀 Cross-Account Refunds (Multi-Account Support)

A major user-requested feature and architectural rule:
**Refunds are allowed to be deposited into a DIFFERENT account than the parent expense account.**

- **Real-World Use Case**: User pays Rp 100,000 from BCA (`b`), but the merchant processes the refund to GoPay (`g`) or cash (`c`).
- **Accounting Invariant**:
  - The parent expense account retains its original outflow (BCA `-Rp 100.000`).
  - The refund destination account receives incoming funds (GoPay `+Rp 60.000`).
  - Net total expense across the system is adjusted to Rp 40,000.
  - Overall net worth change is accurately $-100,000 + 60,000 = -40,000$.
- **Validation**:
  In `lib/finance.ts`, `validateFinancialEvents` does **not** restrict `refund.accountId === parent.accountId`. Any valid active account can receive the refund.

---

## 🎨 Refund Modal UX Rules (`RefundModal.tsx`)

Following direct user agreements and specifications:

1. **Unselected Account on Open (`selectedAccount = null`)**:
   - For **new refunds**, the destination account grid starts with **no account pre-selected**.
   - The user must explicitly tap their desired receiving account.
   - If submitted without selecting an account, shows error: *"Please select a destination account for the refund."*
   - For **editing an existing refund**, it defaults to `editingRefund.accountId`.
2. **Amount Input with Live Dot Delimiter**:
   - Amount formatted live as Indonesian Rupiah with thousand dot separators (`toLocaleString('id-ID')`, e.g. `60.000`).
   - Labeled simply as **"Amount"** with a bold `Rp` prefix badge.
   - Helper text calculates remaining balance: *"Partial refund: remaining net expense balance will be Rp 40.000"*.
3. **Formatted Date Picker**:
   - Displays friendly formatted text (e.g. `15 October 2026`) with a `Calendar` icon and tactile `"Change"` badge.
   - Backed by an invisible native HTML5 date input overlay for universal mobile/desktop compatibility.
4. **Summary Box**:
   - Displays original expense description, original amount, already refunded amount, and maximum refundable limit.
   - Labeled with **"Paid From:"** to cleanly distinguish the expense payment source from the refund destination account.
5. **Mobile Keyboard Auto-Dismiss**:
   - Auto-blurs inputs on modal scroll, touch move, or taps on non-input areas.

---

## 🔄 Lifecycle Invariants & Cascades

### 1. Editing Parent Expense Account
- If a user edits the parent expense account later (e.g. changes paid account from BCA to BNI):
- **Linked refunds RETAIN their chosen destination account** (in `replaceFinancialEvent`, refunds keep `ref.accountId`). They are not overwritten by the parent's new account.

### 2. Deleting Parent Expense
- Deleting an expense automatically triggers a **cascading soft-delete** of all linked refunds (and cashbacks).
- The delete confirmation modal explicitly warns: *"Warning: X linked event(s) (cashback/refund) will also be deleted."*
- Both parent and linked child IDs are queued in `thelife-pending-deleted-ids` for cloud tombstone synchronization.

### 3. Deleting a Refund
- Deleting a refund restores the parent expense's refundable balance and net expense amount.
- Does not affect the parent expense transaction itself.

### 4. Cross-Month Refund Mathematical Guard
- If an expense occurs in September and its refund occurs in October, October's category spending could temporarily be negative if no other expenses occurred in that category.
- **Guard**: `calculateFinanceStats` filters `pieData` strictly with `categoryTotals[category] > 0`. This prevents passing negative values to Recharts `<Pie>`, protecting against SVG arc NaN rendering failures.
