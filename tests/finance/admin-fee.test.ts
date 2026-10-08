import { describe, expect, it } from 'vitest';
import {
  calculateFinanceStats,
  calculateNetExpenseForDate,
  deriveLedgerEntries,
  getAccountBalances,
  parseEvent,
  validateFinancialEvents,
} from '@/lib/finance';
import type { FinancialEvent, TransferEvent } from '@/lib/types';
import { createIncome, createTransfer } from './helpers/fixtures';

describe('Transfer Admin Fee Accounting', () => {
  it('parses valid transfer with positive integer adminFee', () => {
    const raw = {
      id: 'trf-fee-1',
      date: '2026-10-02',
      description: 'Topup GoPay via BNI',
      amount: 100_000,
      type: 'transfer',
      sourceAccountId: 'b',
      destinationAccountId: 'g',
      adminFee: 1_000,
    };
    const parsed = parseEvent(raw) as TransferEvent | null;
    expect(parsed).not.toBeNull();
    expect(parsed?.adminFee).toBe(1_000);
    expect(validateFinancialEvents([parsed as FinancialEvent])).toBe(true);
  });

  it('rejects transfer with non-positive or invalid adminFee', () => {
    const base = {
      id: 'trf-fee-bad',
      date: '2026-10-02',
      description: 'Transfer',
      amount: 100_000,
      type: 'transfer',
      sourceAccountId: 'b',
      destinationAccountId: 'g',
    };
    expect(parseEvent({ ...base, adminFee: 0 })).toBeNull();
    expect(parseEvent({ ...base, adminFee: -500 })).toBeNull();
    expect(parseEvent({ ...base, adminFee: 1000.5 })).toBeNull();
    expect(parseEvent({ ...base, adminFee: '1000' })).toBeNull();
  });

  it('derives ledger entries including admin fee on source account', () => {
    const transfer = createTransfer({
      id: 'trf-1',
      sourceAccountId: 'b',
      destinationAccountId: 'g',
      amount: 500_000,
      adminFee: 2_500,
      description: 'Transfer BNI to GoPay',
    });

    const entries = deriveLedgerEntries([transfer]);
    expect(entries).toHaveLength(3);

    // 1. Source principal out
    expect(entries[0]).toMatchObject({
      accountId: 'b',
      amount: 500_000,
      direction: 'out',
      eventType: 'transfer',
      counterpartyAccountId: 'g',
    });

    // 2. Destination principal in
    expect(entries[1]).toMatchObject({
      accountId: 'g',
      amount: 500_000,
      direction: 'in',
      eventType: 'transfer',
      counterpartyAccountId: 'b',
    });

    // 3. Admin fee out on source
    expect(entries[2]).toMatchObject({
      accountId: 'b',
      amount: 2_500,
      direction: 'out',
      eventType: 'expense',
      category: 'Other',
    });
  });

  it('deducts principal + admin fee from source balance and credits principal to destination', () => {
    const initialB = createIncome({ id: 'inc-b', accountId: 'b', amount: 1_000_000 });
    const transfer = createTransfer({
      id: 'trf-1',
      sourceAccountId: 'b',
      destinationAccountId: 'g',
      amount: 400_000,
      adminFee: 1_500,
    });

    const balances = getAccountBalances([initialB, transfer]);
    // BNI: 1,000,000 - 400,000 - 1,500 = 598,500
    expect(balances['b']).toBe(598_500);
    // GoPay: +400,000
    expect(balances['g']).toBe(400_000);
  });

  it('includes admin fee in monthly expense and category totals', () => {
    const income = createIncome({ id: 'inc-1', date: '2026-10-01', amount: 2_000_000 });
    const transfer = createTransfer({
      id: 'trf-1',
      date: '2026-10-05',
      sourceAccountId: 'b',
      destinationAccountId: 'g',
      amount: 300_000,
      adminFee: 1_000,
    });

    const stats = calculateFinanceStats([income, transfer], '2026-10-01');
    expect(stats.monthlyExpense).toBe(1_000);
    expect(stats.categoryTotals['Other']).toBe(1_000);
    expect(stats.netCashflow).toBe(2_000_000 - 1_000);
  });

  it('includes admin fee in calculateNetExpenseForDate', () => {
    const transfer = createTransfer({
      id: 'trf-1',
      date: '2026-10-15',
      sourceAccountId: 'b',
      destinationAccountId: 'g',
      amount: 200_000,
      adminFee: 1_000,
    });

    expect(calculateNetExpenseForDate([transfer], '2026-10-15')).toBe(1_000);
    expect(calculateNetExpenseForDate([transfer], '2026-10-16')).toBe(0);
  });
});
