import { describe, expect, it } from 'vitest';
import { deleteFinancialEvent, replaceFinancialEvent } from '@/lib/finance';
import type { FinancialEvent } from '@/lib/types';
import {
  createCashback,
  createExpense,
  createIncome,
  createOpeningBalance,
  createRefund,
  createTransfer,
} from './helpers/fixtures';

describe('CRUD, Event Replacement & Cascade Deletion (Rules C & D)', () => {
  describe('Event Replacement (Rule C)', () => {
    it('preserves the event ID when replacing an event', () => {
      const original = createIncome({ id: 'stable-inc-1', amount: 1_000_000, description: 'Freelance' });
      const replacement = createIncome({ id: 'stable-inc-1', amount: 1_200_000, description: 'Updated Freelance' });

      const updated = replaceFinancialEvent([original], replacement);
      expect(updated).not.toBeNull();
      expect(updated).toHaveLength(1);
      expect(updated![0].id).toBe('stable-inc-1');
      expect(updated![0].amount).toBe(1_200_000);
      expect(updated![0].description).toBe('Updated Freelance');
    });

    it('does not create duplicate events when replacing an income or expense', () => {
      const inc = createIncome({ id: 'inc-1', amount: 500_000 });
      const exp = createExpense({ id: 'exp-1', amount: 200_000 });
      const events: FinancialEvent[] = [inc, exp];

      const updatedInc = replaceFinancialEvent(events, createIncome({ id: 'inc-1', amount: 600_000 }));
      expect(updatedInc).toHaveLength(2);
      expect(updatedInc!.filter((e) => e.id === 'inc-1')).toHaveLength(1);

      const updatedExp = replaceFinancialEvent(events, createExpense({ id: 'exp-1', amount: 250_000 }));
      expect(updatedExp).toHaveLength(2);
      expect(updatedExp!.filter((e) => e.id === 'exp-1')).toHaveLength(1);
    });

    it('allows Income -> Expense transition when no related Cashback or Refund exists', () => {
      const original = createIncome({ id: 'tx-1', amount: 100_000, accountId: 'g', category: 'Others' });
      const replacement = createExpense({ id: 'tx-1', amount: 100_000, accountId: 'g', category: 'Food & Drinks' });

      const next = replaceFinancialEvent([original], replacement);
      expect(next).not.toBeNull();
      const event = next![0];
      expect(event.type).toBe('expense');
      if (event.type === 'expense') {
        expect(event.category).toBe('Food & Drinks');
      }
    });

    it('allows Expense -> Income transition when no related Cashback or Refund exists', () => {
      const original = createExpense({ id: 'tx-1', amount: 100_000, accountId: 'g', category: 'Shopping' });
      const replacement = createIncome({ id: 'tx-1', amount: 100_000, accountId: 'g', category: 'Salary' });

      const next = replaceFinancialEvent([original], replacement);
      expect(next).not.toBeNull();
      const event = next![0];
      expect(event.type).toBe('income');
      if (event.type === 'income') {
        expect(event.category).toBe('Salary');
      }
    });

    it('rejects Expense -> Income transition when Expense has an associated Cashback', () => {
      const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 300_000 });
      const cashback = createCashback({ id: 'cb-1', relatedEventId: 'exp-1', accountId: 'g', amount: 30_000 });
      const events: FinancialEvent[] = [expense, cashback];

      const attempt = createIncome({ id: 'exp-1', accountId: 'g', amount: 300_000, category: 'Others' });
      const next = replaceFinancialEvent(events, attempt);
      expect(next).toBeNull();
    });

    it('rejects Expense -> Income transition when Expense has an associated Refund', () => {
      const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 300_000 });
      const refund = createRefund({ id: 'ref-1', relatedEventId: 'exp-1', accountId: 'g', amount: 50_000 });
      const events: FinancialEvent[] = [expense, refund];

      const attempt = createIncome({ id: 'exp-1', accountId: 'g', amount: 300_000, category: 'Salary' });
      const next = replaceFinancialEvent(events, attempt);
      expect(next).toBeNull();
    });

    it('ensures Transfer can only remain Transfer and cannot become Income or Expense', () => {
      const transfer = createTransfer({ id: 'trf-1', amount: 100_000, sourceAccountId: 'g', destinationAccountId: 's' });
      const events: FinancialEvent[] = [transfer];

      // Transfer -> Income forbidden
      expect(replaceFinancialEvent(events, createIncome({ id: 'trf-1', accountId: 'g', category: 'Salary' }))).toBeNull();

      // Transfer -> Expense forbidden
      expect(replaceFinancialEvent(events, createExpense({ id: 'trf-1', accountId: 'g', category: 'Shopping' }))).toBeNull();

      // Income -> Transfer forbidden
      const inc = createIncome({ id: 'inc-1', accountId: 'g' });
      expect(replaceFinancialEvent([inc], createTransfer({ id: 'inc-1', sourceAccountId: 'g', destinationAccountId: 's' }))).toBeNull();
    });

    it('ensures Opening Balance can only remain Opening Balance', () => {
      const op = createOpeningBalance({ id: 'op-1', accountId: 'g', amount: 1_000_000 });
      const events: FinancialEvent[] = [op];

      expect(replaceFinancialEvent(events, createIncome({ id: 'op-1', accountId: 'g', category: 'Salary' }))).toBeNull();
      expect(replaceFinancialEvent(events, createExpense({ id: 'op-1', accountId: 'g', category: 'Food & Drinks' }))).toBeNull();
    });

    it('rejects replacement when replacement data is invalid', () => {
      const original = createIncome({ id: 'inc-1', amount: 100_000 });
      // Negative amount is invalid
      const badAmount = { ...original, amount: -50_000 } as unknown as FinancialEvent;
      expect(replaceFinancialEvent([original], badAmount)).toBeNull();

      // Invalid category "Other" is rejected for current IncomeEvent replacement
      const badCategory = { ...original, category: 'Other' } as unknown as FinancialEvent;
      expect(replaceFinancialEvent([original], badCategory)).toBeNull();
    });

    it('returns null when trying to replace a non-existent event ID', () => {
      const inc = createIncome({ id: 'inc-1' });
      const orphan = createIncome({ id: 'non-existent-id' });
      expect(replaceFinancialEvent([inc], orphan)).toBeNull();
    });
  });

  describe('Delete & Cascade (Rule D)', () => {
    it('deleting an Income removes only that event', () => {
      const inc1 = createIncome({ id: 'inc-1' });
      const inc2 = createIncome({ id: 'inc-2' });
      const events = [inc1, inc2];

      const remaining = deleteFinancialEvent(events, 'inc-1');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('inc-2');
    });

    it('deleting an Expense cascades and removes related Cashback', () => {
      const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 200_000 });
      const cashback = createCashback({ id: 'cb-1', relatedEventId: 'exp-1', accountId: 'g', amount: 20_000 });
      const other = createIncome({ id: 'inc-1' });
      const events: FinancialEvent[] = [expense, cashback, other];

      const remaining = deleteFinancialEvent(events, 'exp-1');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('inc-1');
      expect(remaining.some((e) => e.id === 'cb-1')).toBe(false);
    });

    it('deleting an Expense cascades and removes all related Refunds', () => {
      const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 200_000 });
      const ref1 = createRefund({ id: 'ref-1', relatedEventId: 'exp-1', accountId: 'g', amount: 50_000 });
      const ref2 = createRefund({ id: 'ref-2', relatedEventId: 'exp-1', accountId: 'g', amount: 70_000 });
      const events: FinancialEvent[] = [expense, ref1, ref2];

      const remaining = deleteFinancialEvent(events, 'exp-1');
      expect(remaining).toHaveLength(0);
    });

    it('deleting a Cashback leaves the parent Expense intact', () => {
      const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 200_000 });
      const cashback = createCashback({ id: 'cb-1', relatedEventId: 'exp-1', accountId: 'g', amount: 20_000 });
      const events: FinancialEvent[] = [expense, cashback];

      const remaining = deleteFinancialEvent(events, 'cb-1');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('exp-1');
    });

    it('deleting a Refund leaves the parent Expense and sibling Refunds intact', () => {
      const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 200_000 });
      const ref1 = createRefund({ id: 'ref-1', relatedEventId: 'exp-1', accountId: 'g', amount: 50_000 });
      const ref2 = createRefund({ id: 'ref-2', relatedEventId: 'exp-1', accountId: 'g', amount: 70_000 });
      const events: FinancialEvent[] = [expense, ref1, ref2];

      const remaining = deleteFinancialEvent(events, 'ref-1');
      expect(remaining).toHaveLength(2);
      expect(remaining.map((e) => e.id)).toEqual(['exp-1', 'ref-2']);
    });

    it('deleting a Transfer removes the event cleanly', () => {
      const transfer = createTransfer({ id: 'trf-1' });
      const inc = createIncome({ id: 'inc-1' });
      const events: FinancialEvent[] = [transfer, inc];

      const remaining = deleteFinancialEvent(events, 'trf-1');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('inc-1');
    });

    it('deleting a non-existent ID safely returns unchanged collection', () => {
      const inc = createIncome({ id: 'inc-1' });
      const remaining = deleteFinancialEvent([inc], 'non-existent');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('inc-1');
    });
  });
});
