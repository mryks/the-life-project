import { describe, expect, it } from 'vitest';
import { validateFinancialEvents, validateNormalTransactionDate } from '@/lib/finance';
import type { FinancialEvent } from '@/lib/types';
import { createExpense, createInitialBalance } from './helpers/fixtures';

describe('Date Flexibility Rules', () => {
  it('allows normal transactions on any valid date (past, present, future)', () => {
    expect(validateNormalTransactionDate('2024-01-15')).toBe(true);
    expect(validateNormalTransactionDate('2025-06-20')).toBe(true);
    expect(validateNormalTransactionDate('2026-10-01')).toBe(true);
    expect(validateNormalTransactionDate('2026-12-31')).toBe(true);
  });

  it('allows transactions from past years to survive collection validation', () => {
    const events: FinancialEvent[] = [
      createInitialBalance({ id: 'init-g', accountId: 'g', amount: 18_565_800, date: '2024-01-01' }),
      createExpense({
        id: 'hist-tx-1',
        date: '2024-05-12',
        description: 'Historical coffee 2024',
        amount: 35_000,
        accountId: 'g',
        category: 'Food & Drinks',
      }),
      createExpense({
        id: 'hist-tx-2',
        date: '2025-08-10',
        description: 'Historical grocery 2025',
        amount: 150_000,
        accountId: 'g',
        category: 'Food & Drinks',
      }),
    ];

    expect(validateFinancialEvents(events)).toBe(true);
  });

  it('rejects malformed date strings in validateNormalTransactionDate', () => {
    expect(validateNormalTransactionDate('invalid-date')).toBe(false);
    expect(validateNormalTransactionDate('2026/10/01')).toBe(false);
    expect(validateNormalTransactionDate('2026-02-30')).toBe(false);
    expect(validateNormalTransactionDate('2025-13-01')).toBe(false);
  });
});
