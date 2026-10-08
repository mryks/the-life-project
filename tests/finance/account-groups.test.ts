import { describe, expect, it } from 'vitest';
import {
  calculateFinanceStats,
  getInvestmentBalance,
  getLiquidBalance,
  getNetWorth,
} from '@/lib/finance';
import {
  accounts,
  investmentAccountIds,
  isInvestmentAccount,
  isLiquidAccount,
  liquidAccountIds,
} from '@/lib/accounts';
import type { AccountId, FinancialEvent } from '@/lib/types';
import { createExpense, createIncome, createTransfer } from './helpers/fixtures';

describe('Account Grouping & Cashflow Metrics', () => {
  it('correctly categorizes all 17 accounts into 10 liquid and 7 investment accounts', () => {
    expect(accounts).toHaveLength(17);
    expect(liquidAccountIds).toHaveLength(10);
    expect(investmentAccountIds).toHaveLength(7);

    // Liquid accounts: C, B, G, S, JY, E, SEA, Q, J, CLA
    const expectedLiquid: AccountId[] = ['c', 'b', 'g', 's', 'jy', 'e', 'sea', 'q', 'j', 'cla'];
    for (const id of expectedLiquid) {
      expect(isLiquidAccount(id)).toBe(true);
      expect(isInvestmentAccount(id)).toBe(false);
    }

    // Investment accounts: K, H, SB, POE, KB, I, P
    const expectedInvestment: AccountId[] = ['k', 'h', 'sb', 'poe', 'kb', 'i', 'p'];
    for (const id of expectedInvestment) {
      expect(isInvestmentAccount(id)).toBe(true);
      expect(isLiquidAccount(id)).toBe(false);
    }
  });

  it('calculates liquid balance and investment balance separately', () => {
    const events: FinancialEvent[] = [
      createIncome({ id: 'inc-bni', accountId: 'b', amount: 5_000_000 }), // Liquid
      createIncome({ id: 'inc-gopay', accountId: 'g', amount: 500_000 }), // Liquid
      createIncome({ id: 'inc-stockbit', accountId: 'sb', amount: 20_000_000 }), // Investment
      createIncome({ id: 'inc-ipot', accountId: 'i', amount: 10_000_000 }), // Investment
    ];

    const liquid = getLiquidBalance(events);
    const investment = getInvestmentBalance(events);
    const netWorth = getNetWorth(events);

    expect(liquid).toBe(5_500_000);
    expect(investment).toBe(30_000_000);
    expect(netWorth).toBe(35_500_000);

    const stats = calculateFinanceStats(events, '2026-10-01');
    expect(stats.totalBalance).toBe(5_500_000); // Headline totalBalance is liquid
    expect(stats.liquidBalance).toBe(5_500_000);
    expect(stats.investmentBalance).toBe(30_000_000);
    expect(stats.netWorth).toBe(35_500_000);
  });

  it('transferring from liquid to investment decreases liquid balance and increases investment balance without affecting net worth', () => {
    const events: FinancialEvent[] = [
      createIncome({ id: 'inc-bni', accountId: 'b', amount: 10_000_000 }),
      createTransfer({
        id: 'trf-rdn',
        sourceAccountId: 'b',
        destinationAccountId: 'sb',
        amount: 3_000_000,
      }),
    ];

    const stats = calculateFinanceStats(events, '2026-10-01');
    // Liquid balance (BNI) = 7,000,000
    expect(stats.liquidBalance).toBe(7_000_000);
    // Investment balance (Stockbit) = 3,000,000
    expect(stats.investmentBalance).toBe(3_000_000);
    // Net worth = 10,000,000
    expect(stats.netWorth).toBe(10_000_000);
    expect(stats.totalBalance).toBe(7_000_000);
  });

  it('calculates net cashflow, savings rate, and daily average expense accurately', () => {
    const events: FinancialEvent[] = [
      createIncome({ id: 'inc-1', date: '2026-10-01', amount: 10_000_000 }),
      createExpense({ id: 'exp-1', date: '2026-10-05', amount: 3_100_000 }),
    ];

    const stats = calculateFinanceStats(events, '2026-10-01');
    expect(stats.monthlyIncome).toBe(10_000_000);
    expect(stats.monthlyExpense).toBe(3_100_000);
    expect(stats.netCashflow).toBe(6_900_000);
    // Savings rate: ((10,000,000 - 3,100,000) / 10,000,000) * 100 = 69%
    expect(stats.savingsRate).toBe(69);
    // October has 31 days: 3,100,000 / 31 = 100,000/day
    expect(stats.dailyAverageExpense).toBe(100_000);
  });

  it('handles zero income gracefully in savings rate calculation', () => {
    const events: FinancialEvent[] = [
      createExpense({ id: 'exp-1', date: '2026-10-02', amount: 500_000 }),
    ];

    const stats = calculateFinanceStats(events, '2026-10-01');
    expect(stats.netCashflow).toBe(-500_000);
    expect(stats.savingsRate).toBe(0);
  });
});
