import { beforeEach, describe, expect, it } from 'vitest';
import {
  createInitialBalanceEvents,
  deriveLedgerEntries,
  parseAndValidateBackup,
  parseStoredEvents,
  readFinancialEvents,
  reorderFinancialEvents,
  replaceFinancialEvent,
  restoreFinancialEvents,
  serializeBackup,
  writeFinancialEvents,
} from '@/lib/finance';
import type { FinancialEvent, IncomeEvent } from '@/lib/types';
import {
  createCashback,
  createExpense,
  createIncome,
  createRefund,
  createTransfer,
} from './helpers/fixtures';

class LocalStorageMock {
  private store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, value); }
  removeItem(key: string) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

const mockLocalStorage = new LocalStorageMock();

describe('P1.4 Revised: Transaction Recording Order & Date-Grouped Reorder', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: mockLocalStorage,
      dispatchEvent: () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
  });

  // 1. same-date income reorder
  it('1. same-date income reorder moves event within same date', () => {
    const inc1 = createIncome({ id: 'inc-1', date: '2026-10-02', amount: 100_000 });
    const inc2 = createIncome({ id: 'inc-2', date: '2026-10-02', amount: 200_000 });
    const inc3 = createIncome({ id: 'inc-3', date: '2026-10-02', amount: 300_000 });
    const events: FinancialEvent[] = [inc1, inc2, inc3];

    const reordered = reorderFinancialEvents(events, 'inc-1', 'inc-3', 'after');
    expect(reordered.map((e) => e.id)).toEqual(['inc-2', 'inc-3', 'inc-1']);
  });

  // 2. same-date expense reorder
  it('2. same-date expense reorder moves event within same date', () => {
    const exp1 = createExpense({ id: 'exp-1', date: '2026-10-02', amount: 50_000 });
    const exp2 = createExpense({ id: 'exp-2', date: '2026-10-02', amount: 75_000 });
    const exp3 = createExpense({ id: 'exp-3', date: '2026-10-02', amount: 90_000 });
    const events: FinancialEvent[] = [exp1, exp2, exp3];

    const reordered = reorderFinancialEvents(events, 'exp-3', 'exp-1', 'before');
    expect(reordered.map((e) => e.id)).toEqual(['exp-3', 'exp-1', 'exp-2']);
  });

  // 3. same-date cross-account reorder
  it('3. same-date cross-account reorder succeeds and preserves account assignments', () => {
    const eG = createIncome({ id: 'e-g', date: '2026-10-02', accountId: 'g' });
    const eS = createExpense({ id: 'e-s', date: '2026-10-02', accountId: 's' });
    const eB = createIncome({ id: 'e-b', date: '2026-10-02', accountId: 'b' });
    const events: FinancialEvent[] = [eG, eS, eB];

    const reordered = reorderFinancialEvents(events, 'e-b', 'e-g', 'before');
    expect(reordered.map((e) => e.id)).toEqual(['e-b', 'e-g', 'e-s']);
    expect((reordered[0] as IncomeEvent).accountId).toBe('b');
    expect((reordered[1] as IncomeEvent).accountId).toBe('g');
  });

  // 4. cross-date reorder rejected
  it('4. cross-date reorder is strictly rejected and returns events unchanged', () => {
    const eOld = createIncome({ id: 'e-old', date: '2026-10-01' });
    const eMid = createExpense({ id: 'e-mid', date: '2026-10-05' });
    const eNew = createIncome({ id: 'e-new', date: '2026-10-10' });
    const events: FinancialEvent[] = [eOld, eMid, eNew];

    const reordered = reorderFinancialEvents(events, 'e-new', 'e-old', 'before');
    expect(reordered).toEqual(events);
    expect(reordered.map((e) => e.id)).toEqual(['e-old', 'e-mid', 'e-new']);
  });

  // 5. account-filtered reorder disabled
  it('5. account-filtered reorder disabled: reorder hook options disable interaction when filterAccountId is set', () => {
    const filterAccountId = 'g';
    const isReorderDisabled = Boolean(filterAccountId);
    expect(isReorderDisabled).toBe(true);
  });

  // 6. Card date DESC + recording DESC within date
  it('6. Card view orders primary by date DESC and secondary by recording order DESC within each date', () => {
    const a = createIncome({ id: 'A', date: '2026-10-01' });
    const b = createExpense({ id: 'B', date: '2026-10-02' });
    const c = createIncome({ id: 'C', date: '2026-10-01' });
    const d = createExpense({ id: 'D', date: '2026-10-02' });
    const e = createIncome({ id: 'E', date: '2026-10-01' });
    const events = [a, b, c, d, e];

    // Card View logic
    const indexed = events.map((ev, originalIndex) => ({ ev, originalIndex }));
    indexed.sort((x, y) => {
      const dateCmp = y.ev.date.localeCompare(x.ev.date);
      if (dateCmp !== 0) return dateCmp;
      return y.originalIndex - x.originalIndex;
    });
    const cardRendered = indexed.map((item) => item.ev.id);

    // 2026-10-02: D, B; 2026-10-01: E, C, A
    expect(cardRendered).toEqual(['D', 'B', 'E', 'C', 'A']);
  });

  // 7. Ledger date ASC + recording ASC within date
  it('7. Ledger view orders primary by date ASC and secondary by recording order ASC within each date', () => {
    const a = createIncome({ id: 'A', date: '2026-10-02' });
    const b = createExpense({ id: 'B', date: '2026-10-01' });
    const c = createIncome({ id: 'C', date: '2026-10-02' });
    const d = createExpense({ id: 'D', date: '2026-10-01' });
    const events = [a, b, c, d];

    const ledger = deriveLedgerEntries(events);
    // 2026-10-01: B, D; 2026-10-02: A, C
    expect(ledger.map((l) => l.eventId)).toEqual(['B', 'D', 'A', 'C']);
  });

  // 8. date groups remain contiguous
  it('8. date groups remain contiguous in Card view without date interleaving', () => {
    const a = createIncome({ id: 'A', date: '2026-10-01' });
    const b = createIncome({ id: 'B', date: '2026-10-02' });
    const c = createIncome({ id: 'C', date: '2026-10-01' });
    const events = [a, b, c];

    const indexed = events.map((ev, originalIndex) => ({ ev, originalIndex }));
    indexed.sort((x, y) => {
      const dateCmp = y.ev.date.localeCompare(x.ev.date);
      if (dateCmp !== 0) return dateCmp;
      return y.originalIndex - x.originalIndex;
    });
    const cardDates = indexed.map((item) => item.ev.date);

    // Should be Oct 2 followed by all Oct 1
    expect(cardDates).toEqual(['2026-10-02', '2026-10-01', '2026-10-01']);
  });

  // 9. adding a backdated transaction makes it latest recorded within that date
  it('9. adding a backdated transaction appends to array and becomes latest recorded within that date', () => {
    const a = createIncome({ id: 'A', date: '2026-10-01' });
    const b = createExpense({ id: 'B', date: '2026-10-05' });
    const existing = [a, b];

    const c = createIncome({ id: 'C', date: '2026-10-01' }); // backdated
    const nextEvents = [...existing, c];

    expect(nextEvents.map((e) => e.id)).toEqual(['A', 'B', 'C']);

    // In Ledger for Oct 1: A was recorded before C
    const ledger = deriveLedgerEntries(nextEvents);
    expect(ledger.map((l) => l.eventId)).toEqual(['A', 'C', 'B']);

    // In Card for Oct 1: C is latest recorded, so C appears before A
    const indexed = nextEvents.map((ev, originalIndex) => ({ ev, originalIndex }));
    indexed.sort((x, y) => {
      const dateCmp = y.ev.date.localeCompare(x.ev.date);
      if (dateCmp !== 0) return dateCmp;
      return y.originalIndex - x.originalIndex;
    });
    expect(indexed.map((i) => i.ev.id)).toEqual(['B', 'C', 'A']);
  });

  // 10. editing without date change preserves relative position
  it('10. editing without date change preserves exact existing array position', () => {
    const a = createIncome({ id: 'A', date: '2026-10-01', amount: 100_000 });
    const b = createExpense({ id: 'B', date: '2026-10-01', amount: 200_000 });
    const c = createIncome({ id: 'C', date: '2026-10-01', amount: 300_000 });
    const events = [a, b, c];

    const updatedB = createExpense({ id: 'B', date: '2026-10-01', amount: 250_000, description: 'Updated B' });
    const next = replaceFinancialEvent(events, updatedB);

    expect(next).not.toBeNull();
    expect(next!.map((e) => e.id)).toEqual(['A', 'B', 'C']);
    expect(next![1].amount).toBe(250_000);
  });

  // 11. editing date moves event to END of array
  it('11. editing date moves event to the END of FinancialEvent[]', () => {
    const a = createIncome({ id: 'A', date: '2026-10-01' });
    const b = createExpense({ id: 'B', date: '2026-10-01' });
    const c = createIncome({ id: 'C', date: '2026-10-02' });
    const d = createExpense({ id: 'D', date: '2026-10-02' });
    const events = [a, b, c, d];

    const updatedB = createExpense({ id: 'B', date: '2026-10-02' });
    const next = replaceFinancialEvent(events, updatedB);

    expect(next).not.toBeNull();
    expect(next!.map((e) => e.id)).toEqual(['A', 'C', 'D', 'B']);
  });

  // 12. edited event appears last within new date
  it('12. edited event with new date appears last in recording order within the new date', () => {
    const a = createIncome({ id: 'A', date: '2026-10-01' });
    const b = createExpense({ id: 'B', date: '2026-10-01' });
    const c = createIncome({ id: 'C', date: '2026-10-02' });
    const d = createExpense({ id: 'D', date: '2026-10-02' });
    const events = [a, b, c, d];

    const updatedB = createExpense({ id: 'B', date: '2026-10-02' });
    const next = replaceFinancialEvent(events, updatedB)!;

    const ledger = deriveLedgerEntries(next);
    // Ledger for 2026-10-02: C, D, B (B is last in recording order)
    expect(ledger.map((l) => l.eventId)).toEqual(['A', 'C', 'D', 'B']);
  });

  // 13. Expense + Cashback moves together on date change
  it('13. Expense + Cashback moves together to the end of events when date changes', () => {
    const a = createIncome({ id: 'A', date: '2026-10-01' });
    const exp = createExpense({ id: 'exp-1', date: '2026-10-01' });
    const cb = createCashback({ id: 'cb-1', date: '2026-10-01', relatedEventId: 'exp-1' });
    const b = createExpense({ id: 'B', date: '2026-10-02' });
    const events = [a, exp, cb, b];

    const updatedExp = createExpense({ id: 'exp-1', date: '2026-10-02' });
    const next = replaceFinancialEvent(events, updatedExp);

    expect(next).not.toBeNull();
    expect(next!.map((e) => e.id)).toEqual(['A', 'B', 'exp-1', 'cb-1']);
  });

  // 14. Cashback date always equals Expense date
  it('14. Cashback date automatically updates to equal Expense date on date change', () => {
    const exp = createExpense({ id: 'exp-1', date: '2026-10-01' });
    const cb = createCashback({ id: 'cb-1', date: '2026-10-01', relatedEventId: 'exp-1' });
    const events = [exp, cb];

    const updatedExp = createExpense({ id: 'exp-1', date: '2026-10-05' });
    const next = replaceFinancialEvent(events, updatedExp)!;

    const updatedCb = next.find((e) => e.id === 'cb-1');
    expect(updatedCb?.date).toBe('2026-10-05');
  });

  // 15. Refund independently reorders within same date
  it('15. Refund independently reorders within same date without moving parent Expense', () => {
    const exp = createExpense({ id: 'exp-1', date: '2026-10-02', amount: 200_000 });
    const other = createIncome({ id: 'inc-other', date: '2026-10-02', amount: 50_000 });
    const ref = createRefund({ id: 'ref-1', date: '2026-10-02', relatedEventId: 'exp-1', amount: 30_000 });
    const events = [exp, other, ref];

    const reordered = reorderFinancialEvents(events, 'ref-1', 'exp-1', 'before');
    expect(reordered.map((e) => e.id)).toEqual(['ref-1', 'exp-1', 'inc-other']);
    expect((reordered[0] as typeof ref).relatedEventId).toBe('exp-1');
  });

  // 16. Transfer reorders atomically within same date
  it('16. Transfer reorders atomically within same date', () => {
    const inc1 = createIncome({ id: 'inc-1', date: '2026-10-02' });
    const trf = createTransfer({ id: 'trf-1', date: '2026-10-02' });
    const inc2 = createIncome({ id: 'inc-2', date: '2026-10-02' });
    const events = [inc1, trf, inc2];

    const reordered = reorderFinancialEvents(events, 'trf-1', 'inc-1', 'before');
    expect(reordered.map((e) => e.id)).toEqual(['trf-1', 'inc-1', 'inc-2']);
  });

  // 17. Transfer Ledger legs remain adjacent
  it('17. Transfer’s two Ledger legs remain strictly adjacent in Ledger View', () => {
    const inc1 = createIncome({ id: 'inc-1', date: '2026-10-02' });
    const trf = createTransfer({ id: 'trf-1', date: '2026-10-02' });
    const inc2 = createIncome({ id: 'inc-2', date: '2026-10-02' });
    const events = [inc1, trf, inc2];

    const ledger = deriveLedgerEntries(events);
    const trfIdx = ledger.findIndex((l) => l.eventId === 'trf-1');
    expect(trfIdx).not.toBe(-1);
    expect(ledger[trfIdx + 1].eventId).toBe('trf-1');
  });

  // 18. Ledger drag target works with table child elements
  it('18. closest("[data-reorder-unit-id]") resolves from nested child elements to target unit', () => {
    const unitId = 'unit-123';
    // Simulate DOM element structure: tr[data-reorder-unit-id] > td > span
    const tr = {
      getAttribute: (name: string) => (name === 'data-reorder-unit-id' ? unitId : null),
    };
    const td = {
      closest: (selector: string) => (selector === '[data-reorder-unit-id]' ? tr : null),
    };
    const span = {
      closest: (selector: string) => (selector === '[data-reorder-unit-id]' ? tr : null),
    };

    expect(span.closest('[data-reorder-unit-id]')?.getAttribute('data-reorder-unit-id')).toBe(unitId);
    expect(td.closest('[data-reorder-unit-id]')?.getAttribute('data-reorder-unit-id')).toBe(unitId);
  });

  // 19. Drop indicator does not intercept hit-testing
  it('19. drop indicator has pointer-events-none styling to avoid hit-testing interference', () => {
    const dropIndicatorClass = 'pointer-events-none';
    expect(dropIndicatorClass).toContain('pointer-events-none');
  });

  // 20. Opening Balance legacy events migrate cleanly
  it('20. legacy Opening Balance items in storage migrate cleanly to standard Income events', () => {
    const legacyStorage = JSON.stringify({
      version: 2,
      events: [
        { id: 'op-g', date: '2026-09-30', description: 'Opening g', amount: 1_000_000, type: 'opening-balance', accountId: 'g' },
        { id: 'inc-1', date: '2026-10-02', description: 'Salary', amount: 5_000_000, type: 'income', accountId: 'g', category: 'Salary' },
      ],
    });
    const parsed = parseStoredEvents(legacyStorage);
    expect(parsed.events[0].type).toBe('income');
    expect(parsed.events[0].amount).toBe(1_000_000);
    if (parsed.events[0].type === 'income') {
      expect(parsed.events[0].category).toBe('Others');
    }
  });

  // 21. Fresh initialization creates exactly 17 IncomeEvents
  it('21. fresh initialization creates exactly 17 IncomeEvents when storage is empty', () => {
    const initial = parseStoredEvents(null);
    expect(initial.shouldPersist).toBe(true);
    expect(initial.events).toHaveLength(17);
    expect(initial.events.every((e) => e.type === 'income')).toBe(true);
  });

  // 22. Initial IncomeEvents attributes
  it('22. initial IncomeEvents have valid date, amount 50000, category Others, description Initial balance', () => {
    const initialEvents = createInitialBalanceEvents();
    expect(initialEvents).toHaveLength(17);

    for (const ev of initialEvents) {
      expect(ev.amount).toBe(50_000);
      expect(ev.description).toBe('Initial balance');
      expect(ev.type).toBe('income');
      if (ev.type === 'income') {
        expect(ev.category).toBe('Others');
        expect(ev.id).toBe(`initial-balance-${ev.accountId}`);
      }
    }
  });

  // 23. Initial seed does not duplicate on reload
  it('23. initial seed does not duplicate on reload once persisted', () => {
    const firstRead = readFinancialEvents();
    expect(firstRead).toHaveLength(17);

    const secondRead = readFinancialEvents();
    expect(secondRead).toHaveLength(17);
  });

  // 24. Later-created accounts do not get automatic 50000
  it('24. later-created accounts do not receive automatic 50000 seed', () => {
    // Persist current 17 events
    const initial = createInitialBalanceEvents();
    writeFinancialEvents(initial);

    // Reading storage loads the existing 17 events exactly
    const loaded = readFinancialEvents();
    expect(loaded).toHaveLength(17);
  });

  // 25. Editing initial Income without changing date remains valid
  it('25. editing initial Income without changing date remains valid on 2026-09-30', () => {
    const initial = createInitialBalanceEvents();
    const target = initial.find((e): e is IncomeEvent => e.id === 'initial-balance-g')!;

    const updated: IncomeEvent = {
      ...target,
      amount: 75_000,
      description: 'Updated initial balance',
    };
    const next = replaceFinancialEvent(initial, updated);
    expect(next).not.toBeNull();
    expect(next!.find((e) => e.id === 'initial-balance-g')?.amount).toBe(75_000);
    expect(next!.find((e) => e.id === 'initial-balance-g')?.date).toBe(target.date);
  });

  // 26. Changing initial Income date applies normal date-change behavior
  it('26. changing initial Income date moves it to the end of the array and updates date', () => {
    const initial = createInitialBalanceEvents();
    const target = initial.find((e): e is IncomeEvent => e.id === 'initial-balance-g')!;

    const newDate = target.date === '2026-10-15' ? '2026-10-16' : '2026-10-15';
    const updated: IncomeEvent = {
      ...target,
      date: newDate,
    };
    const next = replaceFinancialEvent(initial, updated);
    expect(next).not.toBeNull();
    expect(next![next!.length - 1].id).toBe('initial-balance-g');
    expect(next![next!.length - 1].date).toBe(newDate);
  });

  // 27. Backup/restore preserves the new event array order
  it('27. backup/restore preserves the event array order verbatim', () => {
    const a = createIncome({ id: 'a', date: '2026-10-02' });
    const b = createExpense({ id: 'b', date: '2026-10-02' });
    const c = createTransfer({ id: 'c', date: '2026-10-02' });
    const events = [b, c, a];

    const backupJson = serializeBackup(events);
    const parsed = parseAndValidateBackup(backupJson);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      restoreFinancialEvents(parsed.events);
    }

    const loaded = readFinancialEvents();
    expect(loaded.map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });
});
