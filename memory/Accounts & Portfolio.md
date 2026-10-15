# Accounts & Portfolio

> Hub: [[00 - Atlas (Index)]] | Related: [[Domain & Financial Model]], [[UI & Design System]]

---

## 🏦 Account Architecture Overview

The Life Project manages financial liquidity and net worth across **17 predefined accounts**, split into two distinct accounting groups:
1. **Liquid Accounts (10 accounts)**: Immediate liquidity, physical cash, daily checking bank accounts, and digital e-wallets.
2. **Investment Accounts (7 accounts)**: Securities, brokerage equities, mutual funds, crypto holdings, and wealth portfolios.

Defined strictly in `lib/accounts.ts` and typed with `AccountId` in `lib/types.ts`:

```typescript
export type AccountId = 'c' | 'b' | 'g' | 's' | 'jy' | 'e' | 'sea' | 'q' | 'j' | 'cla' | 'k' | 'h' | 'sb' | 'poe' | 'kb' | 'i' | 'p';
```

---

## 📋 Comprehensive Account Directory

### Group 1: Liquid Accounts (10 Accounts)

| ID | Short Code | Full Name | Color Token / Gradient | Category / Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `c` | **C** | Cash | `bg-amber-800` | Physical physical currency & cash wallet |
| `b` | **B** | BNI | `bg-gradient-to-br from-blue-500 to-teal-400` | Primary checking & daily bank account |
| `g` | **G** | GoPay | `bg-green-500` | Gojek e-wallet & digital payments |
| `s` | **S** | ShopeePay | `bg-gradient-to-br from-orange-400 to-red-500` | Shopee e-wallet & marketplace purchases |
| `jy` | **JY** | Jago Yoel | `bg-gradient-to-br from-purple-500 to-pink-400` | Bank Jago dedicated personal pocket |
| `e` | **E** | e-money | `bg-gradient-to-br from-gray-200 to-gray-400` | Mandiri e-money / toll card |
| `sea` | **SEA** | SeaBank | `bg-gradient-to-br from-pink-100 to-orange-100` | SeaBank high-yield digital checking |
| `q` | **Q** | Bank Saqu | `bg-gradient-to-br from-pink-400 to-orange-400` | Astra / Bank Saqu digital pocket |
| `j` | **J** | Jago | `bg-gradient-to-br from-orange-400 to-yellow-400` | Bank Jago secondary pocket |
| `cla` | **CLA** | Clara | `bg-lime-400` | Clara shared / joint personal fund |

### Group 2: Investment Accounts (7 Accounts)

| ID | Short Code | Full Name | Color Token / Gradient | Category / Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `k` | **K** | KOINS | `bg-gradient-to-br from-amber-700 to-gray-500` | Cryptocurrency & coin investments |
| `h` | **H** | HP | `bg-sky-300` | Henan Putihrai Sekuritas / equities |
| `sb` | **SB** | Stockbit | `bg-emerald-800` | Stockbit IDX stock brokerage portfolio |
| `poe` | **POE** | POEMS | `bg-red-900` | Phillip's On-line Electronic Mart System |
| `kb` | **KB** | KB | `bg-yellow-400` | KB Valbury Sekuritas |
| `i` | **I** | IPOT | `bg-gradient-to-br from-red-800 to-amber-900` | Indo Premier Sekuritas stock & mutual funds |
| `p` | **P** | Portfolio | `bg-purple-600` | General wealth & alternative portfolio |

---

## 🧮 Balance & Net Worth Derivation

Accounts do **not** store mutable balances directly in the database. Instead, balances are derived pure functions scanning `FinancialEvent` records:

```typescript
// Deterministic calculation in lib/finance.ts
export const getAccountBalances = (events: FinancialEvent[]): Record<AccountId, number> => {
  const balances = Object.fromEntries(accounts.map((acc) => [acc.id, 0])) as Record<AccountId, number>;
  for (const entry of deriveLedgerEntries(events)) {
    balances[entry.accountId] += entry.direction === 'in' ? entry.amount : -entry.amount;
  }
  return balances;
};
```

### Metrics:
1. **Liquid Balance (`stats.liquidBalance`)**:
   $$\text{Liquid Balance} = \sum_{id \in \text{liquidAccountIds}} \text{balance}[id]$$
2. **Investment Balance (`stats.investmentBalance`)**:
   $$\text{Investment Balance} = \sum_{id \in \text{investmentAccountIds}} \text{balance}[id]$$
3. **Total Net Worth (`stats.netWorth`)**:
   $$\text{Net Worth} = \text{Liquid Balance} + \text{Investment Balance}$$

---

## 🚫 Design Invariant: Clean Account Selectors (No Noisy Badges)

- **Binding Rule**: Do **NOT** display intrusive "Liquid" or "Non-Liquid" badges on transaction cards, transfer source/destination selectors, or filter chips.
- Account selectors must always remain clean: display only the round color icon with short code (`acc.name`) and the clear account full name (`acc.fullName`).
- Filtering by an account in Card View or Ledger View highlights the card subtly and displays the active filter banner with a one-click "Clear Filter" button.
