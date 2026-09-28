import assert from 'node:assert/strict';
import {
  calculateFinanceStats,
  calculateNetExpenseForDate,
  clearOpeningBalance,
  deriveLedgerEntries,
  getAccountBalances,
  getOpeningBalances,
  hasNormalTransactionsForAccount,
  hasOpeningBalanceEvents,
  isPrototypeSeedEvent,
  setOpeningBalance,
  validateFinancialEvents,
  validateNormalTransactionDate,
} from '../lib/finance';
import type { FinancialEvent } from '../lib/types';
import { GO_LIVE_DATE, OPENING_BALANCE_DATE } from '../lib/types';

console.log('--- RUNNING OPENING BALANCE VERIFICATION SUITE ---');

// 1. Positive opening balance
{
  const events: FinancialEvent[] = [{
    id: 'op-1',
    date: OPENING_BALANCE_DATE,
    description: 'Opening balance',
    amount: 18565800,
    type: 'opening-balance',
    accountId: 'g',
  }];
  assert.equal(validateFinancialEvents(events), true, 'Scenario 1 failed: valid positive opening balance rejected');
  const balances = getAccountBalances(events);
  assert.equal(balances['g'], 18565800, 'Scenario 1 failed: account balance does not match positive opening balance');
  console.log('✓ Scenario 1: Positive opening balance accepted and balance calculated');
}

// 2. Zero opening balance
{
  const events: FinancialEvent[] = [{
    id: 'op-zero',
    date: OPENING_BALANCE_DATE,
    description: 'Opening balance',
    amount: 0,
    type: 'opening-balance',
    accountId: 'b',
  }];
  assert.equal(validateFinancialEvents(events), true, 'Scenario 2 failed: zero opening balance rejected');
  const balances = getAccountBalances(events);
  assert.equal(balances['b'], 0, 'Scenario 2 failed: account balance for zero opening balance is not 0');
  console.log('✓ Scenario 2: Zero opening balance accepted and balance is 0');
}

// 3. Negative opening balance
{
  const events: FinancialEvent[] = [{
    id: 'op-neg',
    date: OPENING_BALANCE_DATE,
    description: 'Opening balance',
    amount: -500000,
    type: 'opening-balance',
    accountId: 's',
  }];
  assert.equal(validateFinancialEvents(events), true, 'Scenario 3 failed: negative opening balance rejected');
  const balances = getAccountBalances(events);
  assert.equal(balances['s'], -500000, 'Scenario 3 failed: negative opening balance did not reduce balance');
  const ledger = deriveLedgerEntries(events);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].direction, 'out', 'Scenario 3 failed: negative opening balance should derive out direction');
  assert.equal(ledger[0].amount, 500000, 'Scenario 3 failed: ledger entry amount must be positive absolute');
  console.log('✓ Scenario 3: Negative opening balance accepted and balance is negative');
}

// 4. Multiple accounts with different opening balances
{
  const events: FinancialEvent[] = [
    { id: 'op-g', date: OPENING_BALANCE_DATE, description: 'Opening g', amount: 1000000, type: 'opening-balance', accountId: 'g' },
    { id: 'op-b', date: OPENING_BALANCE_DATE, description: 'Opening b', amount: 0, type: 'opening-balance', accountId: 'b' },
    { id: 'op-s', date: OPENING_BALANCE_DATE, description: 'Opening s', amount: -250000, type: 'opening-balance', accountId: 's' },
  ];
  assert.equal(validateFinancialEvents(events), true, 'Scenario 4 failed: multiple opening balances rejected');
  const balances = getAccountBalances(events);
  assert.equal(balances['g'], 1000000);
  assert.equal(balances['b'], 0);
  assert.equal(balances['s'], -250000);
  console.log('✓ Scenario 4: Multiple accounts calculated independently');
}

// 5. Opening balance increases/changes account balance correctly with normal transactions
{
  const events: FinancialEvent[] = [
    { id: 'op-g', date: OPENING_BALANCE_DATE, description: 'Opening g', amount: 1000000, type: 'opening-balance', accountId: 'g' },
    { id: 'tx-inc', date: '2026-10-02', description: 'Salary', amount: 500000, type: 'income', accountId: 'g', category: 'Other' },
    { id: 'tx-exp', date: '2026-10-03', description: 'Groceries', amount: 200000, type: 'expense', accountId: 'g', category: 'Food & Drinks' },
  ];
  const balances = getAccountBalances(events);
  assert.equal(balances['g'], 1300000, 'Scenario 5 failed: account balance arithmetic incorrect');
  console.log('✓ Scenario 5: Account balance equals Opening Balance + Inflows - Outflows');
}

// 6. Opening balance changes total balance correctly
{
  const events: FinancialEvent[] = [
    { id: 'op-g', date: OPENING_BALANCE_DATE, description: 'Opening g', amount: 1000000, type: 'opening-balance', accountId: 'g' },
    { id: 'op-s', date: OPENING_BALANCE_DATE, description: 'Opening s', amount: -200000, type: 'opening-balance', accountId: 's' },
  ];
  const stats = calculateFinanceStats(events, '2026-10-01');
  assert.equal(stats.totalBalance, 800000, 'Scenario 6 failed: total balance does not equal sum of account balances');
  console.log('✓ Scenario 6: Total balance reflects sum of all account opening balances');
}

// 7. Opening balance does not increase reported income
{
  const events: FinancialEvent[] = [
    { id: 'op-g', date: OPENING_BALANCE_DATE, description: 'Opening g', amount: 5000000, type: 'opening-balance', accountId: 'g' },
  ];
  const statsOct = calculateFinanceStats(events, '2026-10-01');
  assert.equal(statsOct.monthlyIncome, 0, 'Scenario 7 failed: opening balance counted as income in October');
  const statsSep = calculateFinanceStats(events, '2026-09-30');
  assert.equal(statsSep.monthlyIncome, 0, 'Scenario 7 failed: opening balance counted as income in September');
  console.log('✓ Scenario 7: Opening balance does not increase reported income');
}

// 8. Opening balance does not increase reported expense
{
  const events: FinancialEvent[] = [
    { id: 'op-s', date: OPENING_BALANCE_DATE, description: 'Opening s', amount: -500000, type: 'opening-balance', accountId: 's' },
  ];
  const stats = calculateFinanceStats(events, '2026-10-01');
  assert.equal(stats.monthlyExpense, 0, 'Scenario 8 failed: negative opening balance counted as expense');
  const statsSep = calculateFinanceStats(events, '2026-09-30');
  assert.equal(statsSep.monthlyExpense, 0, 'Scenario 8 failed: negative opening balance counted as expense in September');
  console.log('✓ Scenario 8: Opening balance does not increase reported expense');
}

// 9. Opening balance does not affect income chart
{
  const events: FinancialEvent[] = [
    { id: 'op-g', date: OPENING_BALANCE_DATE, description: 'Opening g', amount: 10000000, type: 'opening-balance', accountId: 'g' },
  ];
  const stats = calculateFinanceStats(events, '2026-10-01');
  assert.equal(stats.monthlyIncome, 0);
  console.log('✓ Scenario 9: Income charts and metrics ignore opening balance');
}

// 10. Opening balance does not affect expense chart/category totals
{
  const events: FinancialEvent[] = [
    { id: 'op-g', date: OPENING_BALANCE_DATE, description: 'Opening g', amount: 10000000, type: 'opening-balance', accountId: 'g' },
    { id: 'op-s', date: OPENING_BALANCE_DATE, description: 'Opening s', amount: -1000000, type: 'opening-balance', accountId: 's' },
  ];
  const stats = calculateFinanceStats(events, '2026-10-01');
  assert.equal(stats.pieData.length, 0, 'Scenario 10 failed: pieData has entries from opening balance');
  for (const cat of Object.keys(stats.categoryTotals)) {
    assert.equal(stats.categoryTotals[cat as keyof typeof stats.categoryTotals], 0);
  }
  const dayExpense = calculateNetExpenseForDate(events, OPENING_BALANCE_DATE);
  assert.equal(dayExpense, 0, 'Scenario 10 failed: 7-day expense trend affected by opening balance');
  console.log('✓ Scenario 10: Expense charts and category totals exclude opening balances');
}

// 11. Editing an opening balance keeps the same event ID
{
  const initialEvents: FinancialEvent[] = [
    { id: 'stable-id-123', date: OPENING_BALANCE_DATE, description: 'Opening g', amount: 1000000, type: 'opening-balance', accountId: 'g' },
  ];
  const updatedEvents = setOpeningBalance(initialEvents, 'g', 2500000);
  const updated = updatedEvents.find((e) => e.type === 'opening-balance' && e.accountId === 'g');
  assert.ok(updated);
  assert.equal(updated.id, 'stable-id-123', 'Scenario 11 failed: ID did not remain stable on edit');
  assert.equal(updated.amount, 2500000);
  console.log('✓ Scenario 11: Editing an opening balance preserves stable event ID');
}

// 12. Editing does not create duplicate opening balance events
{
  const initialEvents: FinancialEvent[] = [
    { id: 'op-g', date: OPENING_BALANCE_DATE, description: 'Opening g', amount: 1000000, type: 'opening-balance', accountId: 'g' },
  ];
  const updatedEvents = setOpeningBalance(initialEvents, 'g', 3000000);
  const matches = updatedEvents.filter((e) => e.type === 'opening-balance' && e.accountId === 'g');
  assert.equal(matches.length, 1, 'Scenario 12 failed: duplicate opening balance created on edit');
  console.log('✓ Scenario 12: Editing opening balance does not create duplicate events');
}

// 13. Invalid opening balance data is rejected
{
  const decEvent = { id: 'bad-dec', date: OPENING_BALANCE_DATE, description: 'Bad', amount: 100.5, type: 'opening-balance', accountId: 'g' };
  assert.equal(validateFinancialEvents([decEvent as unknown as FinancialEvent]), false, 'Scenario 13 failed: decimal amount accepted');

  const badDateEvent = { id: 'bad-date', date: '2026-10-01', description: 'Bad', amount: 1000, type: 'opening-balance', accountId: 'g' };
  assert.equal(validateFinancialEvents([badDateEvent as unknown as FinancialEvent]), false, 'Scenario 13 failed: wrong date accepted');

  const badAccEvent = { id: 'bad-acc', date: OPENING_BALANCE_DATE, description: 'Bad', amount: 1000, type: 'opening-balance', accountId: 'unknown' };
  assert.equal(validateFinancialEvents([badAccEvent as unknown as FinancialEvent]), false, 'Scenario 13 failed: unknown account accepted');

  console.log('✓ Scenario 13: Invalid opening balance data (decimals, dates, accounts) rejected');
}

// 14. Duplicate opening balances for one account are rejected
{
  const duplicateEvents: FinancialEvent[] = [
    { id: 'op-1', date: OPENING_BALANCE_DATE, description: 'Opening 1', amount: 1000, type: 'opening-balance', accountId: 'g' },
    { id: 'op-2', date: OPENING_BALANCE_DATE, description: 'Opening 2', amount: 2000, type: 'opening-balance', accountId: 'g' },
  ];
  assert.equal(validateFinancialEvents(duplicateEvents), false, 'Scenario 14 failed: duplicate opening balance on same account accepted');
  console.log('✓ Scenario 14: Duplicate opening balances for same account rejected');
}

// 15. Existing prototype seed does not remain classified as Income
{
  const legacySeed: FinancialEvent = {
    id: 'prototype-initial-balance',
    date: '2026-09-28',
    description: 'initial balance',
    amount: 18565800,
    type: 'income',
    accountId: 'g',
    category: 'Other',
  };
  assert.equal(isPrototypeSeedEvent(legacySeed), true, 'Scenario 15 failed: prototype seed not detected');

  const v1Storage = JSON.stringify({
    version: 1,
    events: [legacySeed],
  });
  const rawParsed = JSON.parse(v1Storage);
  const migratedEvents = rawParsed.events.map((e: FinancialEvent) => {
    if (isPrototypeSeedEvent(e)) {
      return {
        id: e.id,
        date: OPENING_BALANCE_DATE,
        description: 'Opening balance',
        amount: e.amount,
        type: 'opening-balance',
        accountId: 'g',
      };
    }
    return e;
  });
  assert.equal(migratedEvents[0].type, 'opening-balance');
  assert.equal(validateFinancialEvents(migratedEvents), true);
  console.log('✓ Scenario 15: Legacy prototype seed reclassified from Income to Opening Balance');
}

// 16. Existing valid financial events survive migration unchanged
{
  const normalTx: FinancialEvent = {
    id: 'tx-existing-1',
    date: '2026-09-25',
    description: 'Test Dinner',
    amount: 150000,
    type: 'expense',
    accountId: 'b',
    category: 'Food & Drinks',
  };
  const v1Events = [normalTx];
  assert.equal(isPrototypeSeedEvent(normalTx), false);
  assert.equal(validateFinancialEvents(v1Events), true);
  assert.equal(v1Events[0].id, 'tx-existing-1');
  assert.equal(v1Events[0].date, '2026-09-25');
  assert.equal(v1Events[0].amount, 150000);
  console.log('✓ Scenario 16: Existing valid financial events survive migration verbatim');
}

// 17. A normal transaction dated 2026-10-01 is allowed
{
  assert.equal(validateNormalTransactionDate(GO_LIVE_DATE, true), true, 'Scenario 17 failed: 2026-10-01 rejected');
  console.log('✓ Scenario 17: Normal transaction on 2026-10-01 allowed');
}

// 18. A normal transaction dated after 2026-10-01 is allowed
{
  assert.equal(validateNormalTransactionDate('2026-10-15', true), true, 'Scenario 18 failed: 2026-10-15 rejected');
  console.log('✓ Scenario 18: Normal transaction after 2026-10-01 allowed');
}

// 19. A normal transaction dated before 2026-10-01 is rejected once real opening-balance setup is active
{
  assert.equal(validateNormalTransactionDate('2026-09-30', true), false, 'Scenario 19 failed: 2026-09-30 allowed when active');
  assert.equal(validateNormalTransactionDate('2026-09-15', true), false, 'Scenario 19 failed: 2026-09-15 allowed when active');
  console.log('✓ Scenario 19: Normal transaction before 2026-10-01 rejected once opening balance is active');
}

// 20. Transfers still behave correctly after adding OpeningBalanceEvent
{
  const events: FinancialEvent[] = [
    { id: 'op-g', date: OPENING_BALANCE_DATE, description: 'Opening g', amount: 1000000, type: 'opening-balance', accountId: 'g' },
    { id: 'op-s', date: OPENING_BALANCE_DATE, description: 'Opening s', amount: 500000, type: 'opening-balance', accountId: 's' },
    { id: 'tf-1', date: '2026-10-02', description: 'Transfer to S', amount: 300000, type: 'transfer', sourceAccountId: 'g', destinationAccountId: 's' },
  ];
  assert.equal(validateFinancialEvents(events), true);
  const balances = getAccountBalances(events);
  assert.equal(balances['g'], 700000, 'Scenario 20 failed: transfer source account not decremented');
  assert.equal(balances['s'], 800000, 'Scenario 20 failed: transfer destination account not incremented');
  const stats = calculateFinanceStats(events, '2026-10-01');
  assert.equal(stats.totalBalance, 1500000, 'Scenario 20 failed: total balance changed after transfer');
  console.log('✓ Scenario 20: Transfers between accounts calculate correctly with opening balances');
}

// 21. Total balance remains consistent with derived ledger and account balances
{
  const events: FinancialEvent[] = [
    { id: 'op-g', date: OPENING_BALANCE_DATE, description: 'Opening g', amount: 5000000, type: 'opening-balance', accountId: 'g' },
    { id: 'op-b', date: OPENING_BALANCE_DATE, description: 'Opening b', amount: -500000, type: 'opening-balance', accountId: 'b' },
    { id: 'inc-1', date: '2026-10-05', description: 'Freelance', amount: 2000000, type: 'income', accountId: 'g', category: 'Other' },
    { id: 'exp-1', date: '2026-10-06', description: 'Groceries', amount: 300000, type: 'expense', accountId: 'b', category: 'Food & Drinks' },
  ];
  const balances = getAccountBalances(events);
  const sumBalances = Object.values(balances).reduce((a, b) => a + b, 0);
  const ledger = deriveLedgerEntries(events);
  const sumLedger = ledger.reduce((total, e) => total + (e.direction === 'in' ? e.amount : -e.amount), 0);
  const stats = calculateFinanceStats(events, '2026-10-01');

  assert.equal(sumBalances, sumLedger, 'Scenario 21 failed: sum of account balances != sum of ledger entries');
  assert.equal(sumBalances, stats.totalBalance, 'Scenario 21 failed: sum of account balances != stats.totalBalance');
  assert.equal(stats.totalBalance, 6200000);
  console.log('✓ Scenario 21: Total balance matches sum of derived ledger entries and sum of account balances');
}

// 22. Legacy pre-go-live normal events survive V1 -> V2 storage migration without rejection
{
  const eventsWithLegacy: FinancialEvent[] = [
    { id: 'op-g', date: OPENING_BALANCE_DATE, description: 'Opening balance', amount: 18565800, type: 'opening-balance', accountId: 'g' },
    { id: 'legacy-tx-1', date: '2026-09-20', description: 'Pre-go-live coffee', amount: 25000, type: 'expense', accountId: 'g', category: 'Food & Drinks' },
  ];
  assert.equal(validateFinancialEvents(eventsWithLegacy), true, 'Scenario 22 failed: legacy pre-go-live event caused collection validation to fail');
  console.log('✓ Scenario 22: Legacy pre-go-live normal events survive migration without collection failure');
}

// 23. Helper verification: hasOpeningBalanceEvents & getOpeningBalances
{
  const noOpening: FinancialEvent[] = [
    { id: 'tx-1', date: '2026-10-02', description: 'Food', amount: 10000, type: 'expense', accountId: 'g', category: 'Food & Drinks' },
  ];
  assert.equal(hasOpeningBalanceEvents(noOpening), false);

  const withOpening: FinancialEvent[] = [
    { id: 'op-g', date: OPENING_BALANCE_DATE, description: 'Opening g', amount: 50000, type: 'opening-balance', accountId: 'g' },
  ];
  assert.equal(hasOpeningBalanceEvents(withOpening), true);
  const map = getOpeningBalances(withOpening);
  assert.equal(map['g']?.amount, 50000);
  assert.equal(map['b'], undefined);
  console.log('✓ Scenario 23: hasOpeningBalanceEvents and getOpeningBalances verified');
}

// 24. Helper verification: clearOpeningBalance & hasNormalTransactionsForAccount
{
  const events: FinancialEvent[] = [
    { id: 'op-g', date: OPENING_BALANCE_DATE, description: 'Opening g', amount: 50000, type: 'opening-balance', accountId: 'g' },
    { id: 'tx-g', date: '2026-10-02', description: 'Coffee', amount: 20000, type: 'expense', accountId: 'g', category: 'Food & Drinks' },
  ];
  assert.equal(hasNormalTransactionsForAccount(events, 'g'), true);
  assert.equal(hasNormalTransactionsForAccount(events, 'b'), false);

  const cleared = clearOpeningBalance(events, 'g');
  assert.equal(cleared.filter((e) => e.type === 'opening-balance').length, 0);
  assert.equal(cleared.length, 1);
  console.log('✓ Scenario 24: clearOpeningBalance and hasNormalTransactionsForAccount verified');
}

console.log('--- ALL SCENARIOS VERIFIED SUCCESSFULLY ---');
