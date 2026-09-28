import { describe, expect, it } from 'vitest';
import {
  FINANCE_STORAGE_VERSION,
  parseStoredEvents,
  serializeEvents,
} from '@/lib/finance';
import type { FinancialEvent } from '@/lib/types';
import { createExpense, createIncome } from './helpers/fixtures';

describe('Storage Persistence & Safety (Rule J)', () => {
  it('serializes events into valid v2 JSON format', () => {
    const events: FinancialEvent[] = [
      createIncome({ id: 'inc-1', amount: 500_000, category: 'Salary' }),
      createExpense({ id: 'exp-1', amount: 200_000, category: 'Food & Drinks' }),
    ];
    const serialized = serializeEvents(events);
    const parsed = JSON.parse(serialized);

    expect(parsed.version).toBe(FINANCE_STORAGE_VERSION);
    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[0].id).toBe('inc-1');
  });

  it('successfully loads and validates valid v2 storage', () => {
    const events: FinancialEvent[] = [
      createIncome({ id: 'inc-1', amount: 1_000_000, category: 'Salary' }),
    ];
    const v2Storage = JSON.stringify({ version: FINANCE_STORAGE_VERSION, events });

    const parsed = parseStoredEvents(v2Storage);
    expect(parsed.shouldPersist).toBe(false); // Valid v2 data already matches storage schema
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0].id).toBe('inc-1');
  });

  it('fails safely without throwing when JSON is invalid or malformed', () => {
    const invalidJson = '{ version: 2, events: [broken json';
    const parsed = parseStoredEvents(invalidJson);

    expect(parsed.events).toEqual([]);
    expect(parsed.shouldPersist).toBe(false);
  });

  it('fails safely when storage contains malformed events', () => {
    const badEventsStorage = JSON.stringify({
      version: FINANCE_STORAGE_VERSION,
      events: [{ id: '', amount: 'invalid-amount' }],
    });
    const parsed = parseStoredEvents(badEventsStorage);

    expect(parsed.events).toEqual([]);
    expect(parsed.shouldPersist).toBe(false);
  });

  it('fails safely when storage contains duplicate event IDs', () => {
    const duplicateStorage = JSON.stringify({
      version: FINANCE_STORAGE_VERSION,
      events: [
        createIncome({ id: 'duplicate-id' }),
        createExpense({ id: 'duplicate-id' }),
      ],
    });
    const parsed = parseStoredEvents(duplicateStorage);

    expect(parsed.events).toEqual([]);
    expect(parsed.shouldPersist).toBe(false);
  });

  it('loads empty event collections as valid empty arrays', () => {
    const emptyStorage = JSON.stringify({
      version: FINANCE_STORAGE_VERSION,
      events: [],
    });
    const parsed = parseStoredEvents(emptyStorage);

    expect(parsed.events).toEqual([]);
    expect(parsed.shouldPersist).toBe(false);
  });

  it('fails safely when storage version is unsupported (e.g. 0, 3, 99)', () => {
    for (const badVersion of [0, 3, 99]) {
      const unsupported = JSON.stringify({
        version: badVersion,
        events: [createIncome({ id: 'inc-1' })],
      });
      const parsed = parseStoredEvents(unsupported);

      expect(parsed.events).toEqual([]);
      expect(parsed.shouldPersist).toBe(false);
    }
  });

  it('fails safely when v2 storage contains legacy "Other" category for income', () => {
    // V2 storage must strictly conform to current IncomeCategory model; legacy "Other" fails validation
    const v2WithOther = JSON.stringify({
      version: 2,
      events: [
        {
          id: 'v2-bad-cat',
          date: '2026-10-02',
          description: 'Consulting',
          amount: 500_000,
          type: 'income',
          accountId: 'g',
          category: 'Other',
        },
      ],
    });
    const parsed = parseStoredEvents(v2WithOther);

    expect(parsed.events).toEqual([]);
    expect(parsed.shouldPersist).toBe(false);
  });
});
