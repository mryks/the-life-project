import { describe, expect, it } from 'vitest';
import {
  clearOpeningBalance,
  getOpeningBalances,
  hasNormalTransactionsForAccount,
  hasOpeningBalanceEvents,
  setOpeningBalance,
} from '@/lib/finance';
import type { FinancialEvent } from '@/lib/types';
import { OPENING_BALANCE_DATE } from '@/lib/types';
import {
  createExpense,
  createIncome,
  createOpeningBalance,
  createTransfer,
} from './helpers/fixtures';

describe('Opening Balance Domain Helpers & Invariants', () => {
  it('detects presence of opening balances using hasOpeningBalanceEvents', () => {
    const noOpening = [createIncome({ id: 'inc-1' })];
    expect(hasOpeningBalanceEvents(noOpening)).toBe(false);

    const withOpening = [createOpeningBalance({ id: 'op-1', accountId: 'g' })];
    expect(hasOpeningBalanceEvents(withOpening)).toBe(true);
  });

  it('maps opening balances by account using getOpeningBalances', () => {
    const events: FinancialEvent[] = [
      createOpeningBalance({ id: 'op-g', accountId: 'g', amount: 1_000_000 }),
      createOpeningBalance({ id: 'op-s', accountId: 's', amount: -200_000 }),
    ];
    const map = getOpeningBalances(events);

    expect(map['g']?.amount).toBe(1_000_000);
    expect(map['s']?.amount).toBe(-200_000);
    expect(map['b']).toBeUndefined();
  });

  it('creates a new opening balance when none exists for the account', () => {
    const initialEvents: FinancialEvent[] = [];
    const nextEvents = setOpeningBalance(initialEvents, 'b', 500_000);

    expect(nextEvents).toHaveLength(1);
    expect(nextEvents[0].type).toBe('opening-balance');
    expect(nextEvents[0].amount).toBe(500_000);
    expect(nextEvents[0].date).toBe(OPENING_BALANCE_DATE);
  });

  it('updates an existing opening balance while preserving stable event ID and preventing duplicates', () => {
    const existing = createOpeningBalance({ id: 'stable-op-id', accountId: 'g', amount: 1_000_000 });
    const updatedEvents = setOpeningBalance([existing], 'g', 2_500_000);

    const matches = updatedEvents.filter((e) => e.type === 'opening-balance' && e.accountId === 'g');
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('stable-op-id');
    expect(matches[0].amount).toBe(2_500_000);
  });

  it('rejects non-integer amount when setting opening balance', () => {
    expect(() => setOpeningBalance([], 'g', 100.5)).toThrow('Opening balance amount must be an integer.');
  });

  it('clears opening balance for an account cleanly', () => {
    const events: FinancialEvent[] = [
      createOpeningBalance({ id: 'op-g', accountId: 'g', amount: 500_000 }),
      createExpense({ id: 'exp-1', accountId: 'g' }),
    ];

    const cleared = clearOpeningBalance(events, 'g');
    expect(cleared).toHaveLength(1);
    expect(cleared[0].id).toBe('exp-1');
  });

  it('identifies accounts with normal transactions using hasNormalTransactionsForAccount', () => {
    const events: FinancialEvent[] = [
      createOpeningBalance({ id: 'op-g', accountId: 'g', amount: 500_000 }),
      createExpense({ id: 'exp-1', accountId: 'g' }),
      createTransfer({ id: 'trf-1', sourceAccountId: 'g', destinationAccountId: 's' }),
    ];

    expect(hasNormalTransactionsForAccount(events, 'g')).toBe(true);
    expect(hasNormalTransactionsForAccount(events, 's')).toBe(true); // involved in transfer
    expect(hasNormalTransactionsForAccount(events, 'b')).toBe(false);
  });
});
