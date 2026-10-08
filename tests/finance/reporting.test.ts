import { describe, expect, it } from 'vitest';
import { calculateFinanceStats, calculateNetExpenseForDate } from '@/lib/finance';
import type { FinancialEvent } from '@/lib/types';
import {
  createCashback,
  createExpense,
  createIncome,
  createRefund,
  createTransfer,
} from './helpers/fixtures';

describe('Financial Reporting & Stats (Rule G)', () => {
  it('aggregates monthly income and net expense within the target month', () => {
    const events: FinancialEvent[] = [
      createIncome({ id: 'inc-oct', date: '2026-10-02', amount: 3_000_000, category: 'Salary' }),
      createExpense({ id: 'exp-oct', date: '2026-10-03', amount: 500_000, category: 'Food & Drinks' }),
      createIncome({ id: 'inc-sep', date: '2026-09-25', amount: 2_000_000, category: 'Others' }), // Different month
    ];

    const stats = calculateFinanceStats(events, '2026-10-01');
    expect(stats.monthlyIncome).toBe(3_000_000);
    expect(stats.monthlyExpense).toBe(500_000);
  });

  it('includes Cashback in monthly Income and does NOT reduce monthly Expense', () => {
    const expense = createExpense({ id: 'exp-1', date: '2026-10-05', amount: 200_000, category: 'Personal Care' });
    const cashback = createCashback({ id: 'cb-1', relatedEventId: 'exp-1', date: '2026-10-05', amount: 30_000 });

    const stats = calculateFinanceStats([expense, cashback], '2026-10-01');
    expect(stats.monthlyIncome).toBe(30_000);
    expect(stats.monthlyExpense).toBe(200_000); // Expense is NOT reduced by cashback
  });

  it('excludes Refund from monthly Income and reduces Net Expense', () => {
    const expense = createExpense({ id: 'exp-1', date: '2026-10-05', amount: 300_000, category: 'Home & Family' });
    const refund = createRefund({ id: 'ref-1', relatedEventId: 'exp-1', date: '2026-10-08', amount: 100_000 });

    const stats = calculateFinanceStats([expense, refund], '2026-10-01');
    expect(stats.monthlyIncome).toBe(0); // Refund is NOT income
    expect(stats.monthlyExpense).toBe(200_000); // 300,000 - 100,000
    expect(stats.categoryTotals['Home & Family']).toBe(200_000);
  });

  it('explicitly tests cross-month refund policy', () => {
    // Expense in September
    const expense = createExpense({
      id: 'exp-sep',
      date: '2026-09-30',
      amount: 100_000,
      category: 'Personal Care',
    });
    // Refund occurs in October
    const refund = createRefund({
      id: 'ref-oct',
      relatedEventId: 'exp-sep',
      date: '2026-10-05',
      amount: 100_000,
    });

    const events: FinancialEvent[] = [expense, refund];

    // September stats: expense remains Rp 100,000, category = 100,000
    const sepStats = calculateFinanceStats(events, '2026-09-30');
    expect(sepStats.monthlyExpense).toBe(100_000);
    expect(sepStats.categoryTotals['Personal Care']).toBe(100_000);

    // October stats: receives refund adjustment (-100,000)
    const octStats = calculateFinanceStats(events, '2026-10-01');
    expect(octStats.monthlyExpense).toBe(-100_000);
    expect(octStats.categoryTotals['Personal Care']).toBe(-100_000);
  });

  it('attributes refund reduction to original Expense category', () => {
    const expense = createExpense({ id: 'exp-1', date: '2026-10-01', amount: 500_000, category: 'Medical' });
    const refund = createRefund({ id: 'ref-1', relatedEventId: 'exp-1', date: '2026-10-02', amount: 200_000 });

    const stats = calculateFinanceStats([expense, refund], '2026-10-01');
    expect(stats.categoryTotals['Medical']).toBe(300_000);
  });

  it('excludes Transfer from monthly Income, Expense, and Category Totals', () => {
    const events: FinancialEvent[] = [
      createTransfer({ id: 'trf-1', amount: 2_000_000, date: '2026-10-01' }),
    ];

    const statsOct = calculateFinanceStats(events, '2026-10-01');
    expect(statsOct.monthlyIncome).toBe(0);
    expect(statsOct.monthlyExpense).toBe(0);
    expect(statsOct.pieData).toHaveLength(0);
  });

  it('calculates net expense for a specific date using calculateNetExpenseForDate', () => {
    const events: FinancialEvent[] = [
      createExpense({ id: 'exp-1', date: '2026-10-05', amount: 150_000 }),
      createRefund({ id: 'ref-1', relatedEventId: 'exp-1', date: '2026-10-05', amount: 50_000 }),
      createExpense({ id: 'exp-2', date: '2026-10-06', amount: 100_000 }),
    ];

    expect(calculateNetExpenseForDate(events, '2026-10-05')).toBe(100_000);
    expect(calculateNetExpenseForDate(events, '2026-10-06')).toBe(100_000);
    expect(calculateNetExpenseForDate(events, '2026-10-07')).toBe(0);
  });
});
