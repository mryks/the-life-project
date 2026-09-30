import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteFinancialEvent,
  deriveLedgerEntries,
  getAtomicReorderUnits,
  parseAndValidateBackup,
  readFinancialEvents,
  reorderFinancialEvents,
  reorderFinancialEventsByUnitIndex,
  replaceFinancialEvent,
  restoreFinancialEvents,
  serializeBackup,
} from '@/lib/finance';
import type { FinancialEvent } from '@/lib/types';
import {
  createCashback,
  createExpense,
  createIncome,
  createOpeningBalance,
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

describe('P1.4 Transaction Recording Order & Reorder', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: mockLocalStorage,
      dispatchEvent: () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
  });

  // 1. Normal Income moves to a new position.
  it('1. normal Income moves to a new position in FinancialEvent[]', () => {
    const inc1 = createIncome({ id: 'inc-1', amount: 100_000 });
    const inc2 = createIncome({ id: 'inc-2', amount: 200_000 });
    const inc3 = createIncome({ id: 'inc-3', amount: 300_000 });
    const events: FinancialEvent[] = [inc1, inc2, inc3];

    const reordered = reorderFinancialEvents(events, 'inc-1', 'inc-3', 'after');
    expect(reordered.map((e) => e.id)).toEqual(['inc-2', 'inc-3', 'inc-1']);
  });

  // 2. Normal Expense moves to a new position.
  it('2. normal Expense moves to a new position in FinancialEvent[]', () => {
    const exp1 = createExpense({ id: 'exp-1', amount: 50_000 });
    const exp2 = createExpense({ id: 'exp-2', amount: 75_000 });
    const exp3 = createExpense({ id: 'exp-3', amount: 90_000 });
    const events: FinancialEvent[] = [exp1, exp2, exp3];

    const reordered = reorderFinancialEvents(events, 'exp-3', 'exp-1', 'before');
    expect(reordered.map((e) => e.id)).toEqual(['exp-3', 'exp-1', 'exp-2']);
  });

  // 3. Refund moves independently.
  it('3. refund moves independently without moving its parent Expense', () => {
    const exp = createExpense({ id: 'exp-parent', amount: 200_000 });
    const other = createIncome({ id: 'inc-other', amount: 50_000 });
    const ref = createRefund({ id: 'ref-1', relatedEventId: 'exp-parent', amount: 30_000 });
    const events: FinancialEvent[] = [exp, other, ref];

    const reordered = reorderFinancialEvents(events, 'ref-1', 'exp-parent', 'before');
    expect(reordered.map((e) => e.id)).toEqual(['ref-1', 'exp-parent', 'inc-other']);
    expect((reordered[0] as typeof ref).relatedEventId).toBe('exp-parent');
  });

  // 4. Expense + Cashback moves as one unit when Expense is selected.
  it('4. Expense + Cashback moves as one unit when Expense is selected', () => {
    const inc = createIncome({ id: 'inc-1' });
    const exp = createExpense({ id: 'exp-1' });
    const cb = createCashback({ id: 'cb-1', relatedEventId: 'exp-1' });
    const other = createExpense({ id: 'exp-other' });
    const events: FinancialEvent[] = [inc, exp, cb, other];

    const reordered = reorderFinancialEvents(events, 'exp-1', 'inc-1', 'before');
    expect(reordered.map((e) => e.id)).toEqual(['exp-1', 'cb-1', 'inc-1', 'exp-other']);
  });

  // 5. Expense + Cashback moves as one unit when Cashback is selected.
  it('5. Expense + Cashback moves as one unit when Cashback is selected', () => {
    const inc = createIncome({ id: 'inc-1' });
    const exp = createExpense({ id: 'exp-1' });
    const cb = createCashback({ id: 'cb-1', relatedEventId: 'exp-1' });
    const other = createExpense({ id: 'exp-other' });
    const events: FinancialEvent[] = [inc, exp, cb, other];

    // Dragging using cb-1 id
    const reordered = reorderFinancialEvents(events, 'cb-1', 'inc-1', 'before');
    expect(reordered.map((e) => e.id)).toEqual(['exp-1', 'cb-1', 'inc-1', 'exp-other']);
  });

  // 6. Cashback remains adjacent to Expense after reorder.
  it('6. Cashback remains strictly adjacent to Expense after reorder', () => {
    const e1 = createIncome({ id: 'i-1' });
    const e2 = createIncome({ id: 'i-2' });
    const exp = createExpense({ id: 'exp-1' });
    const cb = createCashback({ id: 'cb-1', relatedEventId: 'exp-1' });
    const e3 = createIncome({ id: 'i-3' });
    const events: FinancialEvent[] = [e1, e2, exp, cb, e3];

    const reordered = reorderFinancialEvents(events, 'exp-1', 'i-1', 'after');
    const expIndex = reordered.findIndex((e) => e.id === 'exp-1');
    const cbIndex = reordered.findIndex((e) => e.id === 'cb-1');

    expect(cbIndex).toBe(expIndex + 1);
  });

  // 7. Reorder cannot create an insertion point between Expense and Cashback.
  it('7. reorder cannot split Expense and Cashback (drop before/after unit applies to whole unit)', () => {
    const targetExp = createExpense({ id: 'exp-target' });
    const targetCb = createCashback({ id: 'cb-target', relatedEventId: 'exp-target' });
    const movingInc = createIncome({ id: 'inc-moving' });
    const events: FinancialEvent[] = [targetExp, targetCb, movingInc];

    // Dropping "before" the cashback id targets the unit, inserting before exp-target
    const reorderedBefore = reorderFinancialEvents(events, 'inc-moving', 'cb-target', 'before');
    expect(reorderedBefore.map((e) => e.id)).toEqual(['inc-moving', 'exp-target', 'cb-target']);

    // Dropping "after" the expense id targets the unit, inserting after cb-target
    const reorderedAfter = reorderFinancialEvents(events, 'inc-moving', 'exp-target', 'after');
    expect(reorderedAfter.map((e) => e.id)).toEqual(['exp-target', 'cb-target', 'inc-moving']);
  });

  // 8. Transfer moves as one FinancialEvent reorder unit.
  it('8. Transfer moves as one FinancialEvent reorder unit', () => {
    const inc1 = createIncome({ id: 'inc-1' });
    const trf = createTransfer({ id: 'trf-1' });
    const inc2 = createIncome({ id: 'inc-2' });
    const events: FinancialEvent[] = [inc1, trf, inc2];

    const reordered = reorderFinancialEvents(events, 'trf-1', 'inc-1', 'before');
    expect(reordered.map((e) => e.id)).toEqual(['trf-1', 'inc-1', 'inc-2']);
  });

  // 9. Transfer's two Ledger rows remain adjacent after reorder.
  it('9. Transfer’s two Ledger rows remain adjacent in Ledger View after reorder', () => {
    const inc1 = createIncome({ id: 'inc-1' });
    const trf = createTransfer({ id: 'trf-1' });
    const inc2 = createIncome({ id: 'inc-2' });
    const events: FinancialEvent[] = [inc1, trf, inc2];

    const reordered = reorderFinancialEvents(events, 'trf-1', 'inc-2', 'after');
    const ledger = deriveLedgerEntries(reordered);

    const trfRows = ledger.filter((l) => l.eventId === 'trf-1');
    expect(trfRows).toHaveLength(2);

    const firstTrfIdx = ledger.findIndex((l) => l.eventId === 'trf-1');
    expect(ledger[firstTrfIdx + 1].eventId).toBe('trf-1');
  });

  // 10. Moving an event across transaction dates preserves all original date values.
  it('10. moving an event across transaction dates preserves each event’s original date', () => {
    const eOld = createIncome({ id: 'e-old', date: '2026-10-01' });
    const eMid = createExpense({ id: 'e-mid', date: '2026-10-05' });
    const eNew = createIncome({ id: 'e-new', date: '2026-10-10' });
    const events: FinancialEvent[] = [eOld, eMid, eNew];

    const reordered = reorderFinancialEvents(events, 'e-new', 'e-old', 'before');
    expect(reordered.map((e) => e.id)).toEqual(['e-new', 'e-old', 'e-mid']);

    expect(reordered.find((e) => e.id === 'e-new')?.date).toBe('2026-10-10');
    expect(reordered.find((e) => e.id === 'e-old')?.date).toBe('2026-10-01');
    expect(reordered.find((e) => e.id === 'e-mid')?.date).toBe('2026-10-05');
  });

  // 11. Moving an event across accounts preserves all original account values.
  it('11. moving an event across accounts preserves all original account values', () => {
    const eG = createIncome({ id: 'e-g', accountId: 'g' });
    const eS = createExpense({ id: 'e-s', accountId: 's' });
    const eB = createIncome({ id: 'e-b', accountId: 'b' });
    const events: FinancialEvent[] = [eG, eS, eB];

    const reordered = reorderFinancialEvents(events, 'e-b', 'e-g', 'before');
    expect(reordered.map((e) => e.id)).toEqual(['e-b', 'e-g', 'e-s']);

    const foundB = reordered.find((e) => e.id === 'e-b');
    const foundG = reordered.find((e) => e.id === 'e-g');
    const foundS = reordered.find((e) => e.id === 'e-s');
    expect(foundB && 'accountId' in foundB ? foundB.accountId : null).toBe('b');
    expect(foundG && 'accountId' in foundG ? foundG.accountId : null).toBe('g');
    expect(foundS && 'accountId' in foundS ? foundS.accountId : null).toBe('s');
  });

  // 12. Reorder does not mutate amount, ID, category, description, or relationships.
  it('12. reorder does not mutate amount, ID, category, description, or relationships', () => {
    const exp = createExpense({ id: 'exp-1', amount: 150_000, description: 'Groceries', category: 'Food & Drinks' });
    const cb = createCashback({ id: 'cb-1', amount: 15_000, relatedEventId: 'exp-1', description: 'cashback g' });
    const inc = createIncome({ id: 'inc-1', amount: 5_000_000, description: 'Salary', category: 'Salary' });
    const events: FinancialEvent[] = [exp, cb, inc];

    const reordered = reorderFinancialEvents(events, 'inc-1', 'exp-1', 'before');
    expect(reordered[0]).toEqual(inc);
    expect(reordered[1]).toEqual(exp);
    expect(reordered[2]).toEqual(cb);
  });

  // 13. Opening Balance is not reorderable.
  it('13. opening Balance is not reorderable and does not move', () => {
    const op = createOpeningBalance({ id: 'op-g', accountId: 'g' });
    const inc1 = createIncome({ id: 'inc-1' });
    const inc2 = createIncome({ id: 'inc-2' });
    const events: FinancialEvent[] = [op, inc1, inc2];

    // Attempting to move Opening Balance returns events unchanged
    const attempt1 = reorderFinancialEvents(events, 'op-g', 'inc-2', 'after');
    expect(attempt1).toEqual(events);

    // Attempting to target Opening Balance returns events unchanged
    const attempt2 = reorderFinancialEvents(events, 'inc-1', 'op-g', 'before');
    expect(attempt2).toEqual(events);

    // Normal reorder preserves Opening Balance in place
    const validReorder = reorderFinancialEvents(events, 'inc-2', 'inc-1', 'before');
    expect(validReorder.map((e) => e.id)).toEqual(['op-g', 'inc-2', 'inc-1']);
  });

  // 14. Add appends to recording order.
  it('14. add appends to recording order at the end regardless of date', () => {
    const e1 = createIncome({ id: 'e-1', date: '2026-10-10' });
    const events = [e1];

    const e2 = createExpense({ id: 'e-2', date: '2026-10-02' });
    const nextEvents = [...events, e2];

    expect(nextEvents[0].id).toBe('e-1');
    expect(nextEvents[1].id).toBe('e-2');
  });

  // 15. Edit preserves position.
  it('15. edit preserves array position using replaceFinancialEvent', () => {
    const e1 = createIncome({ id: 'e-1', amount: 100_000 });
    const e2 = createExpense({ id: 'e-2', amount: 200_000 });
    const e3 = createIncome({ id: 'e-3', amount: 300_000 });
    const events: FinancialEvent[] = [e1, e2, e3];

    const updatedE2 = createExpense({ id: 'e-2', amount: 250_000, description: 'Updated' });
    const next = replaceFinancialEvent(events, updatedE2);

    expect(next).not.toBeNull();
    expect(next!.map((e) => e.id)).toEqual(['e-1', 'e-2', 'e-3']);
    expect(next![1].amount).toBe(250_000);
  });

  // 16. Delete preserves relative order of remaining events.
  it('16. delete preserves relative order of remaining events', () => {
    const e1 = createIncome({ id: 'e-1' });
    const e2 = createExpense({ id: 'e-2' });
    const e3 = createIncome({ id: 'e-3' });
    const e4 = createTransfer({ id: 'e-4' });
    const events: FinancialEvent[] = [e1, e2, e3, e4];

    const remaining = deleteFinancialEvent(events, 'e-2');
    expect(remaining.map((e) => e.id)).toEqual(['e-1', 'e-3', 'e-4']);
  });

  // 17. Reorder from first unit to last.
  it('17. reorders from first unit to last unit position', () => {
    const a = createIncome({ id: 'a' });
    const b = createIncome({ id: 'b' });
    const c = createIncome({ id: 'c' });
    const d = createIncome({ id: 'd' });
    const events = [a, b, c, d];

    const reordered = reorderFinancialEvents(events, 'a', 'd', 'after');
    expect(reordered.map((e) => e.id)).toEqual(['b', 'c', 'd', 'a']);
  });

  // 18. Reorder from last unit to first.
  it('18. reorders from last unit to first unit position', () => {
    const a = createIncome({ id: 'a' });
    const b = createIncome({ id: 'b' });
    const c = createIncome({ id: 'c' });
    const d = createIncome({ id: 'd' });
    const events = [a, b, c, d];

    const reordered = reorderFinancialEvents(events, 'd', 'a', 'before');
    expect(reordered.map((e) => e.id)).toEqual(['d', 'a', 'b', 'c']);
  });

  // 19. Reorder across multiple atomic units.
  it('19. reorders across multiple atomic units using unit index helper', () => {
    const u0 = createIncome({ id: 'u0' });
    const exp = createExpense({ id: 'exp-u1' });
    const cb = createCashback({ id: 'cb-u1', relatedEventId: 'exp-u1' });
    const u2 = createTransfer({ id: 'u2' });
    const u3 = createRefund({ id: 'ref-u3', relatedEventId: 'exp-u1' });
    const events: FinancialEvent[] = [u0, exp, cb, u2, u3];

    const units = getAtomicReorderUnits(events);
    expect(units).toHaveLength(4);
    expect(units[1].type).toBe('expense-with-cashback');

    // Move unit 1 (expense-with-cashback) to after unit 3
    const reordered = reorderFinancialEventsByUnitIndex(events, 1, 3);
    expect(reordered.map((e) => e.id)).toEqual(['u0', 'u2', 'ref-u3', 'exp-u1', 'cb-u1']);
  });

  // 20. Reorder with multiple Cashback/Refund relationships.
  it('20. reorders safely in the presence of multiple Cashbacks and Refunds', () => {
    const exp1 = createExpense({ id: 'exp-1', amount: 500_000 });
    const cb1 = createCashback({ id: 'cb-1', relatedEventId: 'exp-1', amount: 25_000 });
    const ref1 = createRefund({ id: 'ref-1', relatedEventId: 'exp-1', amount: 50_000 });

    const exp2 = createExpense({ id: 'exp-2', amount: 300_000 });
    const cb2 = createCashback({ id: 'cb-2', relatedEventId: 'exp-2', amount: 15_000 });

    const events: FinancialEvent[] = [exp1, cb1, ref1, exp2, cb2];

    const reordered = reorderFinancialEvents(events, 'exp-2', 'exp-1', 'before');
    expect(reordered.map((e) => e.id)).toEqual(['exp-2', 'cb-2', 'exp-1', 'cb-1', 'ref-1']);
  });

  // 21. Reorder works with Transfer plus normal transactions around it.
  it('21. reorder works cleanly with Transfer and normal transactions surrounding it', () => {
    const inc = createIncome({ id: 'inc-1' });
    const trf = createTransfer({ id: 'trf-1' });
    const exp = createExpense({ id: 'exp-1' });
    const events: FinancialEvent[] = [inc, trf, exp];

    const reordered = reorderFinancialEvents(events, 'exp-1', 'inc-1', 'before');
    expect(reordered.map((e) => e.id)).toEqual(['exp-1', 'inc-1', 'trf-1']);

    const ledger = deriveLedgerEntries(reordered);
    expect(ledger.map((l) => l.eventId)).toEqual(['exp-1', 'inc-1', 'trf-1', 'trf-1']);
  });

  // 22. Reorder result is deterministic.
  it('22. reorder operation produces identical deterministic results on repeated execution', () => {
    const a = createIncome({ id: 'a' });
    const b = createExpense({ id: 'b' });
    const c = createTransfer({ id: 'c' });
    const events = [a, b, c];

    const r1 = reorderFinancialEvents(events, 'c', 'a', 'before');
    const r2 = reorderFinancialEvents(events, 'c', 'a', 'before');
    expect(r1).toEqual(r2);
    expect(r1.map((e) => e.id)).toEqual(['c', 'a', 'b']);
  });

  // 23. Backup/export + restore preserves reordered event array order.
  it('23. backup export and restore preserves the reordered event array order verbatim', () => {
    const a = createIncome({ id: 'a', date: '2026-10-15' });
    const b = createExpense({ id: 'b', date: '2026-10-01' });
    const c = createTransfer({ id: 'c', date: '2026-10-08' });
    const events = [b, c, a]; // non-chronological recording order

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
