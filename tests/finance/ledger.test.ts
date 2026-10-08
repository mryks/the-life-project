import { describe, expect, it } from 'vitest';
import { deriveLedgerEntries } from '@/lib/finance';
import {
  createCashback,
  createExpense,
  createIncome,
  createRefund,
  createTransfer,
} from './helpers/fixtures';

describe('Ledger Derivation (Rule E)', () => {
  it('derives exactly one entry for Income with direction "in"', () => {
    const income = createIncome({ id: 'inc-1', accountId: 'g', amount: 500_000, category: 'Salary' });
    const ledger = deriveLedgerEntries([income]);

    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toEqual({
      eventId: 'inc-1',
      date: income.date,
      description: income.description,
      accountId: 'g',
      amount: 500_000,
      direction: 'in',
      eventType: 'income',
      category: 'Salary',
    });
  });

  it('derives exactly one entry for Expense with direction "out"', () => {
    const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 250_000, category: 'Food & Drinks' });
    const ledger = deriveLedgerEntries([expense]);

    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toEqual({
      eventId: 'exp-1',
      date: expense.date,
      description: expense.description,
      accountId: 'g',
      amount: 250_000,
      direction: 'out',
      eventType: 'expense',
      category: 'Food & Drinks',
    });
  });

  it('derives exactly two entries for Transfer: one "out" from source, one "in" to destination', () => {
    const transfer = createTransfer({
      id: 'trf-1',
      sourceAccountId: 'g',
      destinationAccountId: 's',
      amount: 100_000,
    });
    const ledger = deriveLedgerEntries([transfer]);

    expect(ledger).toHaveLength(2);

    const sourceEntry = ledger.find((e) => e.accountId === 'g');
    expect(sourceEntry).toBeDefined();
    expect(sourceEntry).toMatchObject({
      eventId: 'trf-1',
      direction: 'out',
      amount: 100_000,
      eventType: 'transfer',
      counterpartyAccountId: 's',
    });

    const destEntry = ledger.find((e) => e.accountId === 's');
    expect(destEntry).toBeDefined();
    expect(destEntry).toMatchObject({
      eventId: 'trf-1',
      direction: 'in',
      amount: 100_000,
      eventType: 'transfer',
      counterpartyAccountId: 'g',
    });
  });

  it('derives one outflow entry for Expense, and one inflow entry for Cashback', () => {
    const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 100_000 });
    const cashback = createCashback({ id: 'cb-1', relatedEventId: 'exp-1', accountId: 'g', amount: 10_000 });
    const ledger = deriveLedgerEntries([expense, cashback]);

    expect(ledger).toHaveLength(2);
    expect(ledger[0]).toMatchObject({ eventId: 'exp-1', direction: 'out', amount: 100_000 });
    expect(ledger[1]).toMatchObject({ eventId: 'cb-1', direction: 'in', amount: 10_000, category: 'Cashback' });
  });

  it('derives one inflow entry for Refund attributed to the original Expense category', () => {
    const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 150_000, category: 'Personal Care' });
    const refund = createRefund({ id: 'ref-1', relatedEventId: 'exp-1', accountId: 'g', amount: 50_000 });
    const ledger = deriveLedgerEntries([expense, refund]);

    const refEntry = ledger.find((e) => e.eventId === 'ref-1');
    expect(refEntry).toBeDefined();
    expect(refEntry!.direction).toBe('in');
    expect(refEntry!.amount).toBe(50_000);
    expect(refEntry!.category).toBe('Personal Care');
  });

  describe('Ledger Entry Ordering', () => {
    it('orders entries primarily by date ASC and secondarily by recording order ASC within equal dates', () => {
      const oct5First = createIncome({ id: 'oct-5-first', date: '2026-10-05' });
      const oct1First = createExpense({ id: 'oct-1-first', date: '2026-10-01' });
      const oct5Second = createExpense({ id: 'oct-5-second', date: '2026-10-05' });
      const oct1Second = createIncome({ id: 'oct-1-second', date: '2026-10-01' });

      const ledger = deriveLedgerEntries([oct5First, oct1First, oct5Second, oct1Second]);
      expect(ledger.map((l) => l.eventId)).toEqual([
        'oct-1-first',
        'oct-1-second',
        'oct-5-first',
        'oct-5-second',
      ]);
    });
  });
});
