import { describe, expect, it } from 'vitest';
import { calculateFinanceStats, getAccountBalances } from '@/lib/finance';
import type { FinancialEvent } from '@/lib/types';
import {
  createCashback,
  createExpense,
  createIncome,
  createRefund,
  createTransfer,
} from './helpers/fixtures';

describe('Balance Calculations (Rule F)', () => {
  it('calculates single account balance accurately from inflows and outflows', () => {
    const events: FinancialEvent[] = [
      createIncome({ id: 'inc-1', accountId: 'g', amount: 1_000_000 }),
      createExpense({ id: 'exp-1', accountId: 'g', amount: 300_000 }),
    ];
    const balances = getAccountBalances(events);
    expect(balances['g']).toBe(700_000);
  });

  it('calculates independent balances for multiple accounts', () => {
    const events: FinancialEvent[] = [
      createIncome({ id: 'inc-g', accountId: 'g', amount: 1_000_000 }),
      createExpense({ id: 'exp-s', accountId: 's', amount: 200_000 }),
      createIncome({ id: 'inc-b', accountId: 'b', amount: 500_000 }),
    ];
    const balances = getAccountBalances(events);
    expect(balances['g']).toBe(1_000_000);
    expect(balances['s']).toBe(-200_000);
    expect(balances['b']).toBe(500_000);
  });

  it('transfers preserve total balance across accounts', () => {
    const events: FinancialEvent[] = [
      createIncome({ id: 'inc-g', accountId: 'g', amount: 2_000_000 }),
      createIncome({ id: 'inc-s', accountId: 's', amount: 500_000 }),
      createTransfer({ id: 'trf-1', sourceAccountId: 'g', destinationAccountId: 's', amount: 600_000 }),
    ];
    const balances = getAccountBalances(events);
    expect(balances['g']).toBe(1_400_000);
    expect(balances['s']).toBe(1_100_000);

    const stats = calculateFinanceStats(events, '2026-10-01');
    expect(stats.totalBalance).toBe(2_500_000);
  });

  it('multiple incomes and expenses correctly contribute to account balance and total balance', () => {
    const events: FinancialEvent[] = [
      createIncome({ id: 'inc-g', accountId: 'g', amount: 3_000_000 }),
      createIncome({ id: 'inc-b', accountId: 'b', amount: 100_000 }),
      createExpense({ id: 'exp-s', accountId: 's', amount: 400_000 }),
    ];
    const balances = getAccountBalances(events);
    expect(balances['g']).toBe(3_000_000);
    expect(balances['b']).toBe(100_000);
    expect(balances['s']).toBe(-400_000);

    const stats = calculateFinanceStats(events, '2026-10-01');
    expect(stats.totalBalance).toBe(2_700_000);
  });

  it('cashback and refunds contribute positively to account and total balance', () => {
    const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 500_000 });
    const cashback = createCashback({ id: 'cb-1', relatedEventId: 'exp-1', accountId: 'g', amount: 50_000 });
    const refund = createRefund({ id: 'ref-1', relatedEventId: 'exp-1', accountId: 'g', amount: 100_000 });

    const events: FinancialEvent[] = [expense, cashback, refund];
    const balances = getAccountBalances(events);
    // Net: -500,000 + 50,000 + 100,000 = -350,000
    expect(balances['g']).toBe(-350_000);

    const stats = calculateFinanceStats(events, '2026-10-01');
    expect(stats.totalBalance).toBe(-350_000);
  });

  it('cross-account refund updates both accounts and net monthly expense correctly', () => {
    // Expense paid from GoPay ('g'): 100,000
    const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 100_000, date: '2026-10-10' });
    // Refund received into ShopeePay ('s'): 60,000
    const refund = createRefund({ id: 'ref-1', relatedEventId: 'exp-1', accountId: 's', amount: 60_000, date: '2026-10-12' });

    const events: FinancialEvent[] = [expense, refund];
    const balances = getAccountBalances(events);

    // Parent expense account 'g' has -100,000
    expect(balances['g']).toBe(-100_000);
    // Refund destination account 's' has +60,000
    expect(balances['s']).toBe(60_000);

    const stats = calculateFinanceStats(events, '2026-10-01');
    // Net expense contribution adjusted to 40,000 (100,000 - 60,000)
    expect(stats.monthlyExpense).toBe(40_000);
    // Refund does NOT count as income
    expect(stats.monthlyIncome).toBe(0);
    // Total balance reflects net change: -100,000 + 60,000 = -40,000
    expect(stats.totalBalance).toBe(-40_000);
  });

  it('total balance matches sum of individual account balances and derived ledger entries', () => {
    const events: FinancialEvent[] = [
      createIncome({ id: 'init-1', accountId: 'g', amount: 1_000_000 }),
      createIncome({ id: 'inc-1', accountId: 'g', amount: 500_000 }),
      createExpense({ id: 'exp-1', accountId: 's', amount: 200_000 }),
      createTransfer({ id: 'trf-1', sourceAccountId: 'g', destinationAccountId: 's', amount: 150_000 }),
    ];
    const balances = getAccountBalances(events);
    const sumBalances = Object.values(balances).reduce((sum, b) => sum + b, 0);
    const stats = calculateFinanceStats(events, '2026-10-01');

    expect(stats.totalBalance).toBe(sumBalances);
    expect(stats.totalBalance).toBe(1_300_000);
  });
});
