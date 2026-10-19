import { describe, expect, it } from 'vitest';
import {
  calculateFinanceStats,
  calculateNetExpenseForDate,
  computeAllRefundBreakdowns,
  deriveLedgerEntries,
  getRefundBreakdown,
  validateFinancialEvents,
} from '@/lib/finance';
import type { FinancialEvent } from '@/lib/types';
import { createExpense, createRefund } from './helpers/fixtures';

describe('Refunds Exceeding Original Expense (Profit in Category Others)', () => {
  it('allows single refund exceeding parent expense and credits excess to monthly income under Others', () => {
    const expense = createExpense({
      id: 'exp-1',
      date: '2026-10-05',
      amount: 100_000,
      category: 'Food & Drinks',
      accountId: 'b',
    });
    const refund = createRefund({
      id: 'ref-1',
      date: '2026-10-06',
      amount: 150_000,
      relatedEventId: 'exp-1',
      accountId: 'b',
    });

    const events: FinancialEvent[] = [expense, refund];
    expect(validateFinancialEvents(events)).toBe(true);

    const breakdown = getRefundBreakdown(events, 'ref-1');
    expect(breakdown.expenseReversal).toBe(100_000);
    expect(breakdown.profit).toBe(50_000);

    const stats = calculateFinanceStats(events, '2026-10-01');
    // Expense: 100,000 - 100,000 reversal = 0
    expect(stats.monthlyExpense).toBe(0);
    expect(stats.categoryTotals['Food & Drinks']).toBe(0);
    // Profit: 50,000 credited to income
    expect(stats.monthlyIncome).toBe(50_000);
    // Net cashflow: 50,000 - 0 = +50,000
    expect(stats.netCashflow).toBe(50_000);
    // Account balance: -100,000 + 150,000 = +50,000
    expect(stats.liquidBalance).toBe(50_000);
  });

  it('handles multiple refunds on the same expense with chronological absorption', () => {
    const expense = createExpense({
      id: 'exp-1',
      date: '2026-10-05',
      amount: 100_000,
      category: 'Personal Care',
      accountId: 'g',
    });
    const ref1 = createRefund({
      id: 'ref-1',
      date: '2026-10-06',
      amount: 60_000,
      relatedEventId: 'exp-1',
      accountId: 'g',
    });
    const ref2 = createRefund({
      id: 'ref-2',
      date: '2026-10-07',
      amount: 70_000,
      relatedEventId: 'exp-1',
      accountId: 'g',
    });

    const events: FinancialEvent[] = [expense, ref1, ref2];
    expect(validateFinancialEvents(events)).toBe(true);

    const breakdowns = computeAllRefundBreakdowns(events);
    expect(breakdowns.get('ref-1')).toEqual({ expenseReversal: 60_000, profit: 0 });
    expect(breakdowns.get('ref-2')).toEqual({ expenseReversal: 40_000, profit: 30_000 });

    const stats = calculateFinanceStats(events, '2026-10-01');
    expect(stats.monthlyExpense).toBe(0);
    expect(stats.categoryTotals['Personal Care']).toBe(0);
    expect(stats.monthlyIncome).toBe(30_000);
    expect(stats.netCashflow).toBe(30_000);
  });

  it('allocates 100% of refund to profit when parent expense was already fully refunded', () => {
    const expense = createExpense({
      id: 'exp-1',
      date: '2026-10-01',
      amount: 200_000,
      category: 'Leisure',
      accountId: 'b',
    });
    const ref1 = createRefund({
      id: 'ref-1',
      date: '2026-10-02',
      amount: 200_000,
      relatedEventId: 'exp-1',
      accountId: 'b',
    });
    const ref2 = createRefund({
      id: 'ref-2',
      date: '2026-10-03',
      amount: 80_000,
      relatedEventId: 'exp-1',
      accountId: 'b',
    });

    const events: FinancialEvent[] = [expense, ref1, ref2];
    const breakdowns = computeAllRefundBreakdowns(events);

    expect(breakdowns.get('ref-1')).toEqual({ expenseReversal: 200_000, profit: 0 });
    expect(breakdowns.get('ref-2')).toEqual({ expenseReversal: 0, profit: 80_000 });

    const stats = calculateFinanceStats(events, '2026-10-01');
    expect(stats.monthlyExpense).toBe(0);
    expect(stats.categoryTotals['Leisure']).toBe(0);
    expect(stats.monthlyIncome).toBe(80_000);
    expect(stats.netCashflow).toBe(80_000);
  });

  it('handles cross-month refund with excess correctly', () => {
    // September expense
    const expense = createExpense({
      id: 'exp-sep',
      date: '2026-09-20',
      amount: 100_000,
      category: 'Medical',
      accountId: 'b',
    });
    // October refund exceeding September expense
    const refund = createRefund({
      id: 'ref-oct',
      date: '2026-10-05',
      amount: 140_000,
      relatedEventId: 'exp-sep',
      accountId: 'b',
    });

    const events: FinancialEvent[] = [expense, refund];

    // September stats: expense remains Rp 100,000
    const sepStats = calculateFinanceStats(events, '2026-09-01');
    expect(sepStats.monthlyExpense).toBe(100_000);
    expect(sepStats.categoryTotals['Medical']).toBe(100_000);
    expect(sepStats.monthlyIncome).toBe(0);

    // October stats: 100,000 reversal + 40,000 profit
    const octStats = calculateFinanceStats(events, '2026-10-01');
    expect(octStats.monthlyExpense).toBe(-100_000);
    expect(octStats.categoryTotals['Medical']).toBe(-100_000);
    expect(octStats.monthlyIncome).toBe(40_000);
    expect(octStats.netCashflow).toBe(140_000); // 40,000 - (-100,000) = 140,000
  });

  it('ensures calculateNetExpenseForDate does not produce negative expense for profit', () => {
    const expense = createExpense({
      id: 'exp-1',
      date: '2026-10-05',
      amount: 100_000,
    });
    const refund = createRefund({
      id: 'ref-1',
      date: '2026-10-05',
      amount: 150_000,
      relatedEventId: 'exp-1',
    });

    const events: FinancialEvent[] = [expense, refund];
    // On 2026-10-05, net expense is 100,000 - 100,000 reversal = 0 (not -50,000)
    expect(calculateNetExpenseForDate(events, '2026-10-05')).toBe(0);
  });

  it('generates informative category in deriveLedgerEntries', () => {
    const expense = createExpense({
      id: 'exp-1',
      date: '2026-10-05',
      amount: 100_000,
      category: 'Food & Drinks',
    });
    const refPartialProfit = createRefund({
      id: 'ref-1',
      date: '2026-10-06',
      amount: 150_000,
      relatedEventId: 'exp-1',
    });
    const refFullProfit = createRefund({
      id: 'ref-2',
      date: '2026-10-07',
      amount: 25_000,
      relatedEventId: 'exp-1',
    });

    const events: FinancialEvent[] = [expense, refPartialProfit, refFullProfit];
    const entries = deriveLedgerEntries(events);

    const entry1 = entries.find((e) => e.eventId === 'ref-1');
    expect(entry1?.category).toBe('Food & Drinks / Others');
    expect(entry1?.amount).toBe(150_000);
    expect(entry1?.direction).toBe('in');

    const entry2 = entries.find((e) => e.eventId === 'ref-2');
    expect(entry2?.category).toBe('Others');
    expect(entry2?.amount).toBe(25_000);
    expect(entry2?.direction).toBe('in');
  });
});
