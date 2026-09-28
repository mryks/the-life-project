import { describe, expect, it } from 'vitest';
import { isPrototypeSeedEvent, parseStoredEvents } from '@/lib/finance';
import { OPENING_BALANCE_DATE } from '@/lib/types';

describe('Opening Balance Migration & Legacy Compatibility (Rule I)', () => {
  it('seeds an OpeningBalanceEvent rather than Income when storage is empty (null)', () => {
    const parsed = parseStoredEvents(null);
    expect(parsed.shouldPersist).toBe(true);
    expect(parsed.events).toHaveLength(1);

    const seed = parsed.events[0];
    expect(seed.type).toBe('opening-balance');
    if (seed.type === 'opening-balance') {
      expect(seed.accountId).toBe('g');
      expect(seed.amount).toBe(18_565_800);
      expect(seed.date).toBe(OPENING_BALANCE_DATE);
    }
  });

  it('detects legacy prototype seed events with isPrototypeSeedEvent', () => {
    const seed1 = {
      id: 'prototype-initial-balance',
      date: '2026-09-28',
      description: 'initial balance',
      amount: 18_565_800,
      type: 'income' as const,
      accountId: 'g' as const,
      category: 'Others' as const,
    };
    expect(isPrototypeSeedEvent(seed1)).toBe(true);

    const seed2 = {
      ...seed1,
      id: '1',
    };
    expect(isPrototypeSeedEvent(seed2)).toBe(true);

    const normalIncome = {
      ...seed1,
      id: 'custom-inc-1',
      description: 'Regular salary',
    };
    expect(isPrototypeSeedEvent(normalIncome)).toBe(false);
  });

  it('migrates legacy prototype seed from Income to OpeningBalanceEvent while preserving original ID', () => {
    const v1Storage = JSON.stringify({
      version: 1,
      events: [
        {
          id: 'prototype-initial-balance',
          date: '2026-09-28',
          description: 'initial balance',
          amount: 18_565_800,
          type: 'income',
          accountId: 'g',
          category: 'Others',
        },
      ],
    });

    const parsed = parseStoredEvents(v1Storage);
    expect(parsed.shouldPersist).toBe(true);
    expect(parsed.events).toHaveLength(1);

    const migrated = parsed.events[0];
    expect(migrated.type).toBe('opening-balance');
    expect(migrated.id).toBe('prototype-initial-balance'); // ID preserved
    expect(migrated.amount).toBe(18_565_800);
    expect(migrated.date).toBe(OPENING_BALANCE_DATE);
  });

  it('explicitly migrates legacy stored IncomeEvent with category "Other" to "Others"', () => {
    // Legacy stored unversioned array with "Other"
    const legacyArray = JSON.stringify([
      {
        id: 'legacy-inc-other',
        date: '2026-10-02',
        description: 'Old freelancing',
        amount: 500_000,
        type: 'income',
        accountId: 'b',
        category: 'Other', // Legacy string
      },
    ]);

    const parsed = parseStoredEvents(legacyArray);
    expect(parsed.shouldPersist).toBe(true);
    expect(parsed.events).toHaveLength(1);
    const event = parsed.events[0];
    expect(event.type).toBe('income');
    if (event.type === 'income') {
      expect(event.category).toBe('Others'); // Normalized to 'Others'
    }
  });

  it('safely migrates version 1 storage with legacy "Other" income category to version 2 "Others"', () => {
    const v1Storage = JSON.stringify({
      version: 1,
      events: [
        {
          id: 'v1-inc-other',
          date: '2026-10-02',
          description: 'Consulting',
          amount: 1_200_000,
          type: 'income',
          accountId: 'g',
          category: 'Other',
        },
      ],
    });

    const parsed = parseStoredEvents(v1Storage);
    expect(parsed.shouldPersist).toBe(true);
    expect(parsed.events).toHaveLength(1);
    const event = parsed.events[0];
    expect(event.type).toBe('income');
    if (event.type === 'income') {
      expect(event.category).toBe('Others');
    }
  });

  it('preserves valid normal transactions unchanged during V1 -> V2 migration', () => {
    const v1Storage = JSON.stringify({
      version: 1,
      events: [
        {
          id: 'exp-1',
          date: '2026-10-02',
          description: 'Groceries',
          amount: 150_000,
          type: 'expense',
          accountId: 'g',
          category: 'Food & Drinks',
        },
      ],
    });

    const parsed = parseStoredEvents(v1Storage);
    expect(parsed.shouldPersist).toBe(true);
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0]).toEqual({
      id: 'exp-1',
      date: '2026-10-02',
      description: 'Groceries',
      amount: 150_000,
      type: 'expense',
      accountId: 'g',
      category: 'Food & Drinks',
    });
  });

  it('fails safely when stored legacy data is corrupt or invalid', () => {
    const corruptLegacy = JSON.stringify([{ id: 'bad', type: 'unknown-type' }]);
    const parsed = parseStoredEvents(corruptLegacy);
    expect(parsed.events).toHaveLength(0);
    expect(parsed.shouldPersist).toBe(false);
  });
});
