import { describe, expect, it } from 'vitest';
import { validateFinancialEvents } from '@/lib/finance';
import type { FinancialEvent } from '@/lib/types';
import {
  createCashback,
  createExpense,
  createIncome,
  createRefund,
  createTransfer,
} from './helpers/fixtures';

describe('Relationship Integrity (Rule B)', () => {
  describe('Cashback Relationships', () => {
    it('accepts cashback correctly linked to parent expense on the same account', () => {
      const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 200_000 });
      const cashback = createCashback({ id: 'cb-1', relatedEventId: 'exp-1', accountId: 'g', amount: 20_000 });
      expect(validateFinancialEvents([expense, cashback])).toBe(true);
    });

    it('rejects cashback pointing to another income event', () => {
      const income = createIncome({ id: 'inc-1', accountId: 'g', amount: 500_000 });
      const cashback = createCashback({ id: 'cb-1', relatedEventId: 'inc-1', accountId: 'g' });
      expect(validateFinancialEvents([income, cashback])).toBe(false);
    });

    it('rejects cashback pointing to a transfer event', () => {
      const transfer = createTransfer({ id: 'trf-1', sourceAccountId: 'g', destinationAccountId: 's' });
      const cashback = createCashback({ id: 'cb-1', relatedEventId: 'trf-1', accountId: 'g' });
      expect(validateFinancialEvents([transfer, cashback])).toBe(false);
    });


    it('rejects orphan cashback when parent expense does not exist', () => {
      const cashback = createCashback({ id: 'cb-1', relatedEventId: 'non-existent-exp', accountId: 'g' });
      expect(validateFinancialEvents([cashback])).toBe(false);
    });

    it('rejects cashback when account differs from parent expense account', () => {
      const expense = createExpense({ id: 'exp-1', accountId: 'g' });
      const cashback = createCashback({ id: 'cb-1', relatedEventId: 'exp-1', accountId: 's' }); // Account S != G
      expect(validateFinancialEvents([expense, cashback])).toBe(false);
    });

    it('enforces maximum one cashback per expense event', () => {
      const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 200_000 });
      const cb1 = createCashback({ id: 'cb-1', relatedEventId: 'exp-1', accountId: 'g', amount: 10_000 });
      const cb2 = createCashback({ id: 'cb-2', relatedEventId: 'exp-1', accountId: 'g', amount: 15_000 });
      expect(validateFinancialEvents([expense, cb1, cb2])).toBe(false);
    });
  });

  describe('Refund Relationships', () => {
    it('accepts multiple refunds pointing to the same expense when sum <= expense amount', () => {
      const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 100_000 });
      const ref1 = createRefund({ id: 'ref-1', relatedEventId: 'exp-1', accountId: 'g', amount: 30_000 });
      const ref2 = createRefund({ id: 'ref-2', relatedEventId: 'exp-1', accountId: 'g', amount: 50_000 });
      const ref3 = createRefund({ id: 'ref-3', relatedEventId: 'exp-1', accountId: 'g', amount: 20_000 });
      expect(validateFinancialEvents([expense, ref1, ref2, ref3])).toBe(true);
    });

    it('rejects refunds when total refunds exceed expense amount', () => {
      const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 100_000 });
      const ref1 = createRefund({ id: 'ref-1', relatedEventId: 'exp-1', accountId: 'g', amount: 60_000 });
      const ref2 = createRefund({ id: 'ref-2', relatedEventId: 'exp-1', accountId: 'g', amount: 45_000 });
      expect(validateFinancialEvents([expense, ref1, ref2])).toBe(false);
    });

    it('rejects refund pointing to an income event', () => {
      const income = createIncome({ id: 'inc-1', accountId: 'g' });
      const refund = createRefund({ id: 'ref-1', relatedEventId: 'inc-1', accountId: 'g' });
      expect(validateFinancialEvents([income, refund])).toBe(false);
    });

    it('rejects refund pointing to a transfer event', () => {
      const transfer = createTransfer({ id: 'trf-1', sourceAccountId: 'g', destinationAccountId: 's' });
      const refund = createRefund({ id: 'ref-1', relatedEventId: 'trf-1', accountId: 'g' });
      expect(validateFinancialEvents([transfer, refund])).toBe(false);
    });


    it('rejects orphan refund when parent expense does not exist', () => {
      const refund = createRefund({ id: 'ref-1', relatedEventId: 'non-existent-exp', accountId: 'g' });
      expect(validateFinancialEvents([refund])).toBe(false);
    });

    it('rejects refund when account differs from parent expense account', () => {
      const expense = createExpense({ id: 'exp-1', accountId: 'g' });
      const refund = createRefund({ id: 'ref-1', relatedEventId: 'exp-1', accountId: 's' }); // S != G
      expect(validateFinancialEvents([expense, refund])).toBe(false);
    });

    it('rejects invalid or empty relatedEventId', () => {
      const expense = createExpense({ id: 'exp-1', accountId: 'g' });
      const badRefund = { ...createRefund({ id: 'ref-1', accountId: 'g' }), relatedEventId: '' } as unknown as FinancialEvent;
      expect(validateFinancialEvents([expense, badRefund])).toBe(false);
    });
  });
});
