import { describe, expect, it } from 'vitest';
import { parseEvent, validateFinancialEvents } from '@/lib/finance';
import type { FinancialEvent } from '@/lib/types';
import {
  createExpense,
  createIncome,
  createOpeningBalance,
  createRefund,
  createTransfer,
} from './helpers/fixtures';

describe('Event Validation (Rule A)', () => {
  describe('Income Event Validation', () => {
    it('accepts a valid income event with positive integer amount', () => {
      const event = createIncome({ amount: 5_000_000, category: 'Salary' });
      expect(parseEvent(event)).not.toBeNull();
      expect(validateFinancialEvents([event])).toBe(true);
    });

    it('rejects zero amount for income', () => {
      const event = createIncome({ amount: 0 });
      expect(parseEvent(event)).toBeNull();
      expect(validateFinancialEvents([event])).toBe(false);
    });

    it('rejects negative amount for income', () => {
      const event = createIncome({ amount: -100_000 });
      expect(parseEvent(event)).toBeNull();
      expect(validateFinancialEvents([event])).toBe(false);
    });

    it('rejects decimal / non-integer amount for income', () => {
      const event = createIncome({ amount: 100_000.5 });
      expect(parseEvent(event)).toBeNull();
      expect(validateFinancialEvents([event])).toBe(false);
    });

    it('requires a known account from the accounts registry', () => {
      const badAccount = { ...createIncome(), accountId: 'unknown-account' } as unknown as FinancialEvent;
      expect(parseEvent(badAccount)).toBeNull();
      expect(validateFinancialEvents([badAccount])).toBe(false);
    });

    it('rejects empty or whitespace-only description', () => {
      const emptyDesc = createIncome({ description: '' });
      expect(parseEvent(emptyDesc)).toBeNull();
      expect(validateFinancialEvents([emptyDesc])).toBe(false);

      const whitespaceDesc = createIncome({ description: '   ' });
      expect(parseEvent(whitespaceDesc)).toBeNull();
      expect(validateFinancialEvents([whitespaceDesc])).toBe(false);
    });

    it('rejects invalid date strings and non-existent calendar dates', () => {
      const badFormat = createIncome({ date: '10-02-2026' });
      expect(parseEvent(badFormat)).toBeNull();

      const nonExistentDate = createIncome({ date: '2026-02-30' });
      expect(parseEvent(nonExistentDate)).toBeNull();

      const invalidMonth = createIncome({ date: '2026-13-01' });
      expect(parseEvent(invalidMonth)).toBeNull();
    });

    it('accepts all valid current IncomeCategory values: Salary, Investment, Allowance, Others', () => {
      for (const category of ['Salary', 'Investment', 'Allowance', 'Others'] as const) {
        const event = createIncome({ category });
        expect(parseEvent(event)).not.toBeNull();
        expect(validateFinancialEvents([event])).toBe(true);
      }
    });

    it('rejects NEW IncomeEvent with legacy category "Other"', () => {
      const legacyOther = {
        ...createIncome(),
        category: 'Other',
      } as unknown as FinancialEvent;
      expect(parseEvent(legacyOther)).toBeNull();
      expect(validateFinancialEvents([legacyOther])).toBe(false);
    });

    it('rejects expense categories on an IncomeEvent', () => {
      const foodIncome = {
        ...createIncome(),
        category: 'Food & Drinks',
      } as unknown as FinancialEvent;
      expect(parseEvent(foodIncome)).toBeNull();
      expect(validateFinancialEvents([foodIncome])).toBe(false);
    });

    it('rejects Cashback category if relatedEventId is missing', () => {
      const orphanCashback = {
        ...createIncome(),
        category: 'Cashback',
        relatedEventId: undefined,
      } as unknown as FinancialEvent;
      expect(parseEvent(orphanCashback)).toBeNull();
      expect(validateFinancialEvents([orphanCashback])).toBe(false);
    });

    it('rejects non-Cashback income having relatedEventId attached', () => {
      const salaryWithParent = {
        ...createIncome({ category: 'Salary' }),
        relatedEventId: 'some-parent-id',
      } as unknown as FinancialEvent;
      expect(parseEvent(salaryWithParent)).toBeNull();
      expect(validateFinancialEvents([salaryWithParent])).toBe(false);
    });
  });

  describe('Expense Event Validation', () => {
    it('accepts a valid expense event with positive integer amount', () => {
      const event = createExpense({ amount: 150_000, category: 'Food & Drinks' });
      expect(parseEvent(event)).not.toBeNull();
      expect(validateFinancialEvents([event])).toBe(true);
    });

    it('rejects zero, negative, or decimal amount for expense', () => {
      expect(parseEvent(createExpense({ amount: 0 }))).toBeNull();
      expect(parseEvent(createExpense({ amount: -50_000 }))).toBeNull();
      expect(parseEvent(createExpense({ amount: 50_000.75 }))).toBeNull();
    });

    it('rejects unknown or Income-only categories for expense', () => {
      const salaryExpense = { ...createExpense(), category: 'Salary' } as unknown as FinancialEvent;
      expect(parseEvent(salaryExpense)).toBeNull();

      const cashbackExpense = { ...createExpense(), category: 'Cashback' } as unknown as FinancialEvent;
      expect(parseEvent(cashbackExpense)).toBeNull();
    });

    it('requires valid account, date, and description for expense', () => {
      expect(parseEvent({ ...createExpense(), accountId: 'invalid' } as unknown as FinancialEvent)).toBeNull();
      expect(parseEvent(createExpense({ description: '' }))).toBeNull();
      expect(parseEvent(createExpense({ date: 'bad-date' }))).toBeNull();
    });
  });

  describe('Transfer Event Validation', () => {
    it('accepts valid transfer between two distinct accounts', () => {
      const event = createTransfer({ sourceAccountId: 'g', destinationAccountId: 's', amount: 200_000 });
      expect(parseEvent(event)).not.toBeNull();
      expect(validateFinancialEvents([event])).toBe(true);
    });

    it('rejects transfer when source and destination are the same account', () => {
      const event = createTransfer({ sourceAccountId: 'g', destinationAccountId: 'g' });
      expect(parseEvent(event)).toBeNull();
      expect(validateFinancialEvents([event])).toBe(false);
    });

    it('rejects transfer with category attached', () => {
      const event = { ...createTransfer(), category: 'Other' } as unknown as FinancialEvent;
      expect(parseEvent(event)).toBeNull();
      expect(validateFinancialEvents([event])).toBe(false);
    });

    it('rejects transfer with zero, negative, or decimal amount', () => {
      expect(parseEvent(createTransfer({ amount: 0 }))).toBeNull();
      expect(parseEvent(createTransfer({ amount: -10_000 }))).toBeNull();
      expect(parseEvent(createTransfer({ amount: 50_000.25 }))).toBeNull();
    });
  });

  describe('Refund Event Validation', () => {
    it('accepts valid refund matching existing parent expense and account', () => {
      const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 100_000 });
      const refund = createRefund({ id: 'ref-1', relatedEventId: 'exp-1', accountId: 'g', amount: 40_000 });
      expect(parseEvent(refund)).not.toBeNull();
      expect(validateFinancialEvents([expense, refund])).toBe(true);
    });

    it('rejects refund with zero or negative amount', () => {
      const expense = createExpense({ id: 'exp-1', amount: 100_000 });
      const refundZero = createRefund({ id: 'ref-1', relatedEventId: 'exp-1', amount: 0 });
      expect(parseEvent(refundZero)).toBeNull();
      expect(validateFinancialEvents([expense, refundZero])).toBe(false);

      const refundNeg = createRefund({ id: 'ref-2', relatedEventId: 'exp-1', amount: -20_000 });
      expect(parseEvent(refundNeg)).toBeNull();
    });

    it('rejects refund if single refund exceeds original expense amount', () => {
      const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 100_000 });
      const refund = createRefund({ id: 'ref-1', relatedEventId: 'exp-1', accountId: 'g', amount: 100_001 });
      expect(validateFinancialEvents([expense, refund])).toBe(false);
    });

    it('rejects refund if cumulative refunds exceed original expense amount', () => {
      const expense = createExpense({ id: 'exp-1', accountId: 'g', amount: 100_000 });
      const refund1 = createRefund({ id: 'ref-1', relatedEventId: 'exp-1', accountId: 'g', amount: 60_000 });
      const refund2 = createRefund({ id: 'ref-2', relatedEventId: 'exp-1', accountId: 'g', amount: 50_000 });
      expect(validateFinancialEvents([expense, refund1, refund2])).toBe(false);
    });

    it('rejects refund with category field attached', () => {
      const expense = createExpense({ id: 'exp-1', amount: 100_000 });
      const refund = { ...createRefund({ relatedEventId: 'exp-1' }), category: 'Shopping' } as unknown as FinancialEvent;
      expect(parseEvent(refund)).toBeNull();
      expect(validateFinancialEvents([expense, refund])).toBe(false);
    });
  });

  describe('Opening Balance Validation', () => {
    it('accepts opening balance with fixed date 2026-09-30 and positive amount', () => {
      const event = createOpeningBalance({ amount: 18_565_800 });
      expect(parseEvent(event)).not.toBeNull();
      expect(validateFinancialEvents([event])).toBe(true);
    });

    it('accepts opening balance with zero amount', () => {
      const event = createOpeningBalance({ amount: 0 });
      expect(parseEvent(event)).not.toBeNull();
      expect(validateFinancialEvents([event])).toBe(true);
    });

    it('accepts opening balance with negative amount (overdraft / debt)', () => {
      const event = createOpeningBalance({ amount: -500_000 });
      expect(parseEvent(event)).not.toBeNull();
      expect(validateFinancialEvents([event])).toBe(true);
    });

    it('rejects opening balance on any date other than 2026-09-30', () => {
      const badDate = { ...createOpeningBalance(), date: '2026-10-01' } as unknown as FinancialEvent;
      expect(parseEvent(badDate)).toBeNull();
      expect(validateFinancialEvents([badDate])).toBe(false);
    });

    it('rejects decimal amount for opening balance', () => {
      const decimalEvent = { ...createOpeningBalance(), amount: 1000.5 } as unknown as FinancialEvent;
      expect(parseEvent(decimalEvent)).toBeNull();
      expect(validateFinancialEvents([decimalEvent])).toBe(false);
    });

    it('rejects multiple opening balances for the same account', () => {
      const op1 = createOpeningBalance({ id: 'op-1', accountId: 'g', amount: 100_000 });
      const op2 = createOpeningBalance({ id: 'op-2', accountId: 'g', amount: 200_000 });
      expect(validateFinancialEvents([op1, op2])).toBe(false);
    });

    it('forbids category, relatedEventId, and transfer fields on opening balance', () => {
      expect(parseEvent({ ...createOpeningBalance(), category: 'Other' } as unknown as FinancialEvent)).toBeNull();
      expect(parseEvent({ ...createOpeningBalance(), relatedEventId: 'some-id' } as unknown as FinancialEvent)).toBeNull();
      expect(parseEvent({ ...createOpeningBalance(), sourceAccountId: 'g' } as unknown as FinancialEvent)).toBeNull();
      expect(parseEvent({ ...createOpeningBalance(), destinationAccountId: 's' } as unknown as FinancialEvent)).toBeNull();
    });
  });
});
