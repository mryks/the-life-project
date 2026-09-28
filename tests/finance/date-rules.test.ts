import { describe, expect, it } from 'vitest';
import { validateFinancialEvents, validateNormalTransactionDate } from '@/lib/finance';
import type { FinancialEvent } from '@/lib/types';
import { GO_LIVE_DATE } from '@/lib/types';
import { createExpense, createOpeningBalance } from './helpers/fixtures';

describe('Date & Go-Live Transition Rules (Rule H)', () => {
  it('allows normal transaction on the go-live date 2026-10-01', () => {
    expect(validateNormalTransactionDate(GO_LIVE_DATE, true)).toBe(true);
    expect(validateNormalTransactionDate('2026-10-01', false)).toBe(true);
  });

  it('allows normal transaction after 2026-10-01', () => {
    expect(validateNormalTransactionDate('2026-10-02', true)).toBe(true);
    expect(validateNormalTransactionDate('2026-11-15', true)).toBe(true);
  });

  it('rejects normal transaction before 2026-10-01 when Opening Balance setup is active', () => {
    expect(validateNormalTransactionDate('2026-09-30', true)).toBe(false);
    expect(validateNormalTransactionDate('2026-09-15', true)).toBe(false);
    expect(validateNormalTransactionDate('2026-01-01', true)).toBe(false);
  });

  it('permits normal transaction before 2026-10-01 if Opening Balance is not active', () => {
    expect(validateNormalTransactionDate('2026-09-30', false)).toBe(true);
    expect(validateNormalTransactionDate('2026-09-15', false)).toBe(true);
  });

  it('rejects malformed date strings in validateNormalTransactionDate', () => {
    expect(validateNormalTransactionDate('invalid-date', true)).toBe(false);
    expect(validateNormalTransactionDate('2026/10/01', true)).toBe(false);
    expect(validateNormalTransactionDate('2026-02-30', true)).toBe(false);
  });

  it('allows legacy pre-go-live normal events to survive collection validation', () => {
    const events: FinancialEvent[] = [
      createOpeningBalance({ id: 'op-g', accountId: 'g', amount: 18_565_800 }),
      createExpense({
        id: 'legacy-tx-1',
        date: '2026-09-20', // Pre-go-live date
        description: 'Historical coffee',
        amount: 35_000,
        accountId: 'g',
        category: 'Food & Drinks',
      }),
    ];

    expect(validateFinancialEvents(events)).toBe(true);
  });
});
