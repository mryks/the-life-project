import { describe, expect, it } from 'vitest';
import {
  createInitialBalanceEvents,
  getAccountBalances,
  validateFinancialEvents,
} from '@/lib/finance';
import { accounts } from '@/lib/accounts';
import { createIncome } from './helpers/fixtures';

describe('Initial Balance & General Income Tests', () => {
  it('creates initial balance income events for all accounts', () => {
    const initialEvents = createInitialBalanceEvents();
    expect(initialEvents).toHaveLength(accounts.length);
    expect(initialEvents.every((e) => e.type === 'income' && e.category === 'Others')).toBe(true);
    expect(validateFinancialEvents(initialEvents)).toBe(true);
  });

  it('calculates initial balance income correctly into account balances', () => {
    const events = [
      createIncome({
        id: 'init-g',
        accountId: 'g',
        amount: 1_000_000,
        category: 'Others',
        description: 'Initial balance',
      }),
      createIncome({
        id: 'init-s',
        accountId: 's',
        amount: 250_000,
        category: 'Others',
        description: 'Initial balance',
      }),
    ];

    const balances = getAccountBalances(events);
    expect(balances['g']).toBe(1_000_000);
    expect(balances['s']).toBe(250_000);
    expect(balances['b']).toBe(0);
  });
});
