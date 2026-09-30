import { describe, expect, it } from 'vitest';
import { deriveLedgerEntries } from '@/lib/finance';
import {
  createCashback,
  createExpense,
  createIncome,
  createOpeningBalance,
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
    const expense = createExpense({ id: 'exp-1', accountId: 's', amount: 150_000, category: 'Food & Drinks' });
    const ledger = deriveLedgerEntries([expense]);

    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toEqual({
      eventId: 'exp-1',
      date: expense.date,
      description: expense.description,
      accountId: 's',
      amount: 150_000,
      direction: 'out',
      eventType: 'expense',
      category: 'Food & Drinks',
    });
  });

  it('derives exactly two entries for Transfer sharing the same eventId with net zero system effect', () => {
    const transfer = createTransfer({
      id: 'trf-1',
      sourceAccountId: 'g',
      destinationAccountId: 's',
      amount: 300_000,
      description: 'Transfer G to S',
    });
    const ledger = deriveLedgerEntries([transfer]);

    expect(ledger).toHaveLength(2);

    const outLeg = ledger.find((e) => e.direction === 'out');
    const inLeg = ledger.find((e) => e.direction === 'in');

    expect(outLeg).toBeDefined();
    expect(outLeg!.accountId).toBe('g');
    expect(outLeg!.counterpartyAccountId).toBe('s');
    expect(outLeg!.amount).toBe(300_000);
    expect(outLeg!.eventId).toBe('trf-1');

    expect(inLeg).toBeDefined();
    expect(inLeg!.accountId).toBe('s');
    expect(inLeg!.counterpartyAccountId).toBe('g');
    expect(inLeg!.amount).toBe(300_000);
    expect(inLeg!.eventId).toBe('trf-1');

    // Net balance effect across system is 0
    const netEffect = ledger.reduce((sum, e) => sum + (e.direction === 'in' ? e.amount : -e.amount), 0);
    expect(netEffect).toBe(0);
  });

  it('derives one inflow entry for Cashback that contributes positively to balance', () => {
    const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 200_000 });
    const cashback = createCashback({ id: 'cb-1', relatedEventId: 'exp-1', accountId: 'g', amount: 20_000 });
    const ledger = deriveLedgerEntries([expense, cashback]);

    const cbEntry = ledger.find((e) => e.eventId === 'cb-1');
    expect(cbEntry).toBeDefined();
    expect(cbEntry!.direction).toBe('in');
    expect(cbEntry!.amount).toBe(20_000);
    expect(cbEntry!.accountId).toBe('g');
  });

  it('derives one inflow entry for Refund attributed to the original Expense category', () => {
    const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 150_000, category: 'Shopping' });
    const refund = createRefund({ id: 'ref-1', relatedEventId: 'exp-1', accountId: 'g', amount: 50_000 });
    const ledger = deriveLedgerEntries([expense, refund]);

    const refEntry = ledger.find((e) => e.eventId === 'ref-1');
    expect(refEntry).toBeDefined();
    expect(refEntry!.direction).toBe('in');
    expect(refEntry!.amount).toBe(50_000);
    expect(refEntry!.category).toBe('Shopping');
  });

  describe('Opening Balance ledger derivation', () => {
    it('derives inflow entry with positive amount for positive opening balance', () => {
      const op = createOpeningBalance({ id: 'op-1', accountId: 'g', amount: 5_000_000 });
      const ledger = deriveLedgerEntries([op]);

      expect(ledger).toHaveLength(1);
      expect(ledger[0].direction).toBe('in');
      expect(ledger[0].amount).toBe(5_000_000);
    });

    it('derives inflow entry with amount 0 for zero opening balance', () => {
      const op = createOpeningBalance({ id: 'op-zero', accountId: 'b', amount: 0 });
      const ledger = deriveLedgerEntries([op]);

      expect(ledger).toHaveLength(1);
      expect(ledger[0].direction).toBe('in');
      expect(ledger[0].amount).toBe(0);
    });

    it('derives outflow entry with absolute amount for negative opening balance', () => {
      const op = createOpeningBalance({ id: 'op-neg', accountId: 's', amount: -750_000 });
      const ledger = deriveLedgerEntries([op]);

      expect(ledger).toHaveLength(1);
      expect(ledger[0].direction).toBe('out');
      expect(ledger[0].amount).toBe(750_000); // Positive absolute amount
    });
  });

  describe('Ledger Entry Ordering', () => {
    it('orders entries in ascending recording order with opening balances as starting balances', () => {
      const e1 = createIncome({ id: 'event-a', date: '2026-10-01' });
      const e2 = createExpense({ id: 'event-b', date: '2026-10-05' });
      const e3 = createIncome({ id: 'event-c', date: '2026-10-05' });
      const op = createOpeningBalance({ id: 'op-1', accountId: 'g' });

      const ledger = deriveLedgerEntries([e1, op, e2, e3]);
      expect(ledger).toHaveLength(4);
      expect(ledger[0].eventId).toBe('op-1');
      expect(ledger[0].eventType).toBe('opening-balance');
      expect(ledger[1].eventId).toBe('event-a');
      expect(ledger[2].eventId).toBe('event-b');
      expect(ledger[3].eventId).toBe('event-c');
    });
  });
});
