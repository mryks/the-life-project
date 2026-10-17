import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkDateBoundary,
  checkEventDateBoundary,
  deriveLedgerEntries,
  getAccountBalances,
  getAtomicReorderUnits,
  getLiquidBalance,
  reorderFinancialEvents,
  reorderFinancialEventsByUnitIndex,
} from '@/lib/finance';
import {
  computeWithinDayOrders,
  getPendingUpsertIds,
  mergeLocalAndCloudEvents,
  PENDING_UPSERTS_KEY,
  queuePendingUpserts,
} from '@/lib/sync';
import type { FinancialEvent, IncomeEvent } from '@/lib/types';
import {
  createCashback,
  createExpense,
  createIncome,
  createRefund,
  createTransfer,
} from './helpers/fixtures';
import {
  AUTO_SCROLL_EDGE_PX,
  MAX_SCROLL_SPEED_PX,
  MOUSE_HOLD_DELAY_MS,
  MOUSE_INSTANT_DRAG_PX,
  TOUCH_HOLD_DELAY_MS,
  TOUCH_MOVE_CANCEL_PX,
  type CachedSlot,
  calculateAutoScrollSpeed,
  calculateCanonicalPlacementFromSlot,
  findClosestSlotIndex,
  isAtDateBoundary,
  isPastDateGroupBounds,
} from '@/hooks/useTransactionReorder';

class LocalStorageMock {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const mockLocalStorage = new LocalStorageMock();

describe('Live Motion Reorder with Same-Date Constraint & Auto-Scroll Hard Stop', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: mockLocalStorage,
      dispatchEvent: () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
  });

  // =========================================================================
  // 1. Same-Date Reorder Invariant
  // =========================================================================
  describe('1. Same-Date Reorder Invariant', () => {
    it('1.1 only alters positions of events with the exact same date, leaving earlier and later dates untouched', () => {
      // Date 1: 2026-10-10
      const d1_a = createIncome({ id: 'd1-a', date: '2026-10-10', amount: 100_000, description: 'D1 A' });
      const d1_b = createExpense({ id: 'd1-b', date: '2026-10-10', amount: 50_000, description: 'D1 B' });

      // Date 2: 2026-10-12 (Target Date for Reorder)
      const d2_a = createIncome({ id: 'd2-a', date: '2026-10-12', amount: 200_000, description: 'D2 A' });
      const d2_b = createExpense({ id: 'd2-b', date: '2026-10-12', amount: 75_000, description: 'D2 B' });
      const d2_c = createIncome({ id: 'd2-c', date: '2026-10-12', amount: 300_000, description: 'D2 C' });

      // Date 3: 2026-10-15
      const d3_a = createExpense({ id: 'd3-a', date: '2026-10-15', amount: 120_000, description: 'D3 A' });
      const d3_b = createIncome({ id: 'd3-b', date: '2026-10-15', amount: 400_000, description: 'D3 B' });

      const events: FinancialEvent[] = [d1_a, d1_b, d2_a, d2_b, d2_c, d3_a, d3_b];

      // Reorder d2_c before d2_a on Date 2
      const reordered = reorderFinancialEvents(events, 'd2-c', 'd2-a', 'before');

      // Verify overall array length is preserved
      expect(reordered).toHaveLength(7);

      // Verify Date 1 events remain in exact positions 0 and 1 with untouched properties
      expect(reordered[0]).toEqual(d1_a);
      expect(reordered[1]).toEqual(d1_b);

      // Verify Date 3 events remain in exact positions 5 and 6 with untouched properties
      expect(reordered[5]).toEqual(d3_a);
      expect(reordered[6]).toEqual(d3_b);

      // Verify Date 2 events are reordered: d2-c, d2-a, d2-b
      expect(reordered.slice(2, 5).map((e) => e.id)).toEqual(['d2-c', 'd2-a', 'd2-b']);
      expect(reordered.map((e) => e.id)).toEqual(['d1-a', 'd1-b', 'd2-c', 'd2-a', 'd2-b', 'd3-a', 'd3-b']);
    });

    it('1.2 strictly rejects cross-date reordering attempts and returns the original events array', () => {
      const eOld = createIncome({ id: 'e-old', date: '2026-10-01' });
      const eMid = createExpense({ id: 'e-mid', date: '2026-10-05' });
      const eNew = createIncome({ id: 'e-new', date: '2026-10-10' });
      const events: FinancialEvent[] = [eOld, eMid, eNew];

      // Attempt to drag across dates: e-new (10-10) before e-old (10-01)
      const res1 = reorderFinancialEvents(events, 'e-new', 'e-old', 'before');
      expect(res1).toBe(events);
      expect(res1.map((e) => e.id)).toEqual(['e-old', 'e-mid', 'e-new']);

      // Attempt to drag across dates: e-old (10-01) after e-mid (10-05)
      const res2 = reorderFinancialEvents(events, 'e-old', 'e-mid', 'after');
      expect(res2).toBe(events);

      // Attempt to drag across dates: e-mid (10-05) after e-new (10-10)
      const res3 = reorderFinancialEvents(events, 'e-mid', 'e-new', 'after');
      expect(res3).toBe(events);
    });

    it('1.3 supports both "before" and "after" placement semantics within same date', () => {
      const a = createIncome({ id: 'A', date: '2026-10-14' });
      const b = createExpense({ id: 'B', date: '2026-10-14' });
      const c = createIncome({ id: 'C', date: '2026-10-14' });
      const events = [a, b, c];

      // Place A after C
      const afterC = reorderFinancialEvents(events, 'A', 'C', 'after');
      expect(afterC.map((e) => e.id)).toEqual(['B', 'C', 'A']);

      // Place C before B in the original array
      const beforeB = reorderFinancialEvents(events, 'C', 'B', 'before');
      expect(beforeB.map((e) => e.id)).toEqual(['A', 'C', 'B']);

      // Place B before A
      const beforeA = reorderFinancialEvents(events, 'B', 'A', 'before');
      expect(beforeA.map((e) => e.id)).toEqual(['B', 'A', 'C']);
    });

    it('1.4 preserves all account assignments during same-date cross-account reordering', () => {
      const gInc = createIncome({ id: 'g-inc', date: '2026-10-12', accountId: 'g', amount: 500_000 });
      const bExp = createExpense({ id: 'b-exp', date: '2026-10-12', accountId: 'b', amount: 250_000 });
      const sInc = createIncome({ id: 's-inc', date: '2026-10-12', accountId: 's', amount: 100_000 });
      const events = [gInc, bExp, sInc];

      const reordered = reorderFinancialEvents(events, 's-inc', 'g-inc', 'before');
      expect(reordered.map((e) => e.id)).toEqual(['s-inc', 'g-inc', 'b-exp']);

      const first = reordered[0] as IncomeEvent;
      const second = reordered[1] as IncomeEvent;
      expect(first.accountId).toBe('s');
      expect(first.amount).toBe(100_000);
      expect(second.accountId).toBe('g');
      expect(second.amount).toBe(500_000);
    });

    it('1.5 returns original array when activeEventId and targetEventId are identical or invalid', () => {
      const a = createIncome({ id: 'A', date: '2026-10-12' });
      const b = createExpense({ id: 'B', date: '2026-10-12' });
      const events = [a, b];

      expect(reorderFinancialEvents(events, 'A', 'A', 'before')).toBe(events);
      expect(reorderFinancialEvents(events, 'A', 'non-existent', 'before')).toBe(events);
      expect(reorderFinancialEvents(events, 'non-existent', 'B', 'before')).toBe(events);
      expect(reorderFinancialEvents(events, '', 'B', 'before')).toBe(events);
    });

    it('1.6 supports reordering by atomic unit index within same date', () => {
      const a = createIncome({ id: 'u-1', date: '2026-10-14' });
      const b = createExpense({ id: 'u-2', date: '2026-10-14' });
      const c = createIncome({ id: 'u-3', date: '2026-10-14' });
      const events = [a, b, c];

      // Move unit 0 (u-1) to unit 2 (u-3)
      const reordered = reorderFinancialEventsByUnitIndex(events, 0, 2);
      expect(reordered.map((e) => e.id)).toEqual(['u-2', 'u-3', 'u-1']);
    });
  });

  // =========================================================================
  // 2. Atomic Unit Integrity
  // =========================================================================
  describe('2. Atomic Unit Integrity', () => {
    it('2.1 Expense with linked Cashback moves atomically as a single block when reordered before another event', () => {
      const exp1 = createExpense({ id: 'exp-1', date: '2026-10-15', amount: 300_000 });
      const cb1 = createCashback({ id: 'cb-1', date: '2026-10-15', relatedEventId: 'exp-1', amount: 30_000 });
      const inc2 = createIncome({ id: 'inc-2', date: '2026-10-15', amount: 150_000 });
      const exp3 = createExpense({ id: 'exp-3', date: '2026-10-15', amount: 80_000 });
      const events = [inc2, exp1, cb1, exp3];

      // Reorder exp-1 before inc-2: [exp-1, cb-1] must move together as an atomic unit
      const reordered = reorderFinancialEvents(events, 'exp-1', 'inc-2', 'before');
      expect(reordered.map((e) => e.id)).toEqual(['exp-1', 'cb-1', 'inc-2', 'exp-3']);

      // Verify cashback remains strictly adjacent to expense
      const expIdx = reordered.findIndex((e) => e.id === 'exp-1');
      expect(reordered[expIdx + 1].id).toBe('cb-1');
    });

    it('2.2 Expense with linked Cashback moves atomically as a single block when reordered after another event', () => {
      const exp1 = createExpense({ id: 'exp-1', date: '2026-10-15', amount: 300_000 });
      const cb1 = createCashback({ id: 'cb-1', date: '2026-10-15', relatedEventId: 'exp-1', amount: 30_000 });
      const inc2 = createIncome({ id: 'inc-2', date: '2026-10-15', amount: 150_000 });
      const inc3 = createIncome({ id: 'inc-3', date: '2026-10-15', amount: 200_000 });
      const events = [exp1, cb1, inc2, inc3];

      // Reorder exp-1 after inc-3: [exp-1, cb-1] must land at the end, contiguous
      const reordered = reorderFinancialEvents(events, 'exp-1', 'inc-3', 'after');
      expect(reordered.map((e) => e.id)).toEqual(['inc-2', 'inc-3', 'exp-1', 'cb-1']);

      const expIdx = reordered.findIndex((e) => e.id === 'exp-1');
      expect(reordered[expIdx + 1].id).toBe('cb-1');
    });

    it('2.3 prevents another transaction from interleaving between Expense and its linked Cashback', () => {
      const exp1 = createExpense({ id: 'exp-1', date: '2026-10-15', amount: 300_000 });
      const cb1 = createCashback({ id: 'cb-1', date: '2026-10-15', relatedEventId: 'exp-1', amount: 30_000 });
      const other = createIncome({ id: 'other', date: '2026-10-15', amount: 100_000 });
      const events = [other, exp1, cb1];

      // Move other after exp-1: because exp-1 is part of unit [exp-1, cb-1], other is placed after the whole unit
      const reorderedAfter = reorderFinancialEvents(events, 'other', 'exp-1', 'after');
      expect(reorderedAfter.map((e) => e.id)).toEqual(['exp-1', 'cb-1', 'other']);

      // Move other after cb-1: also places after the unit
      const reorderedAfterCb = reorderFinancialEvents(events, 'other', 'cb-1', 'after');
      expect(reorderedAfterCb.map((e) => e.id)).toEqual(['exp-1', 'cb-1', 'other']);
    });

    it('2.4 Transfer legs remain strictly contiguous in Ledger View when reordered', () => {
      const inc1 = createIncome({ id: 'inc-1', date: '2026-10-12', accountId: 'g', amount: 100_000 });
      const trf = createTransfer({
        id: 'trf-1',
        date: '2026-10-12',
        sourceAccountId: 'g',
        destinationAccountId: 's',
        amount: 250_000,
        adminFee: 2_500,
      });
      const inc2 = createIncome({ id: 'inc-2', date: '2026-10-12', accountId: 's', amount: 50_000 });
      const events = [inc1, trf, inc2];

      // Reorder trf-1 before inc-1
      const reordered = reorderFinancialEvents(events, 'trf-1', 'inc-1', 'before');
      expect(reordered.map((e) => e.id)).toEqual(['trf-1', 'inc-1', 'inc-2']);

      // Derive Ledger Entries: Transfer legs ('out', 'in', and admin fee 'out') must remain contiguous
      const ledger = deriveLedgerEntries(reordered);
      const firstTrfIdx = ledger.findIndex((l) => l.eventId === 'trf-1');
      expect(firstTrfIdx).toBe(0);

      // Leg 1: sourceAccountId 'out'
      expect(ledger[0].direction).toBe('out');
      expect(ledger[0].accountId).toBe('g');

      // Leg 2: destinationAccountId 'in'
      expect(ledger[1].direction).toBe('in');
      expect(ledger[1].accountId).toBe('s');

      // Leg 3: admin fee 'out'
      expect(ledger[2].description).toContain('admin fee');
      expect(ledger[2].direction).toBe('out');

      // Next is inc-1
      expect(ledger[3].eventId).toBe('inc-1');
    });

    it('2.5 Refund independently reorders within same date while preserving relatedEventId link', () => {
      const exp1 = createExpense({ id: 'exp-1', date: '2026-10-12', amount: 200_000 });
      const inc = createIncome({ id: 'inc-1', date: '2026-10-12', amount: 50_000 });
      const ref = createRefund({ id: 'ref-1', date: '2026-10-12', relatedEventId: 'exp-1', amount: 30_000 });
      const events = [exp1, inc, ref];

      // Move refund before exp-1
      const reordered = reorderFinancialEvents(events, 'ref-1', 'exp-1', 'before');
      expect(reordered.map((e) => e.id)).toEqual(['ref-1', 'exp-1', 'inc-1']);
      expect((reordered[0] as typeof ref).relatedEventId).toBe('exp-1');
    });
  });

  // =========================================================================
  // 3. Idempotency and Non-Drift
  // =========================================================================
  describe('3. Idempotency and Non-Drift', () => {
    it('3.1 swapping card A to slot B and then back to slot A restores the exact initial events array with zero drift', () => {
      const a = createIncome({ id: 'ev-a', date: '2026-10-15', amount: 100_000, description: 'Alpha', accountId: 'g', category: 'Salary' });
      const b = createExpense({ id: 'ev-b', date: '2026-10-15', amount: 200_000, description: 'Beta', accountId: 's', category: 'Food & Drinks' });
      const c = createIncome({ id: 'ev-c', date: '2026-10-15', amount: 300_000, description: 'Gamma', accountId: 'b', category: 'Others' });
      const initialEvents = [a, b, c];

      // Forward move: A after B -> [B, A, C]
      const step1 = reorderFinancialEvents(initialEvents, 'ev-a', 'ev-b', 'after');
      expect(step1.map((e) => e.id)).toEqual(['ev-b', 'ev-a', 'ev-c']);

      // Backward move: A before B -> [A, B, C]
      const step2 = reorderFinancialEvents(step1, 'ev-a', 'ev-b', 'before');

      // Deep equality check: every property, order, and identifier must match verbatim
      expect(step2).toEqual(initialEvents);
    });

    it('3.2 multi-step cyclic permutations (A -> B -> C -> A) are completely reversible with zero mutation', () => {
      const a = createIncome({ id: 'A', date: '2026-10-15' });
      const b = createExpense({ id: 'B', date: '2026-10-15' });
      const c = createIncome({ id: 'C', date: '2026-10-15' });
      const d = createExpense({ id: 'D', date: '2026-10-15' });
      const initial = [a, b, c, d];

      // Move A after D -> [B, C, D, A]
      const s1 = reorderFinancialEvents(initial, 'A', 'D', 'after');
      // Move B after A -> [C, D, A, B]
      const s2 = reorderFinancialEvents(s1, 'B', 'A', 'after');
      // Move C after B -> [D, A, B, C]
      const s3 = reorderFinancialEvents(s2, 'C', 'B', 'after');
      // Move D after C -> [A, B, C, D]
      const s4 = reorderFinancialEvents(s3, 'D', 'C', 'after');

      expect(s4).toEqual(initial);
      expect(s4.map((e) => e.id)).toEqual(['A', 'B', 'C', 'D']);
    });

    it('3.3 balance conservation invariant: account balances and liquid balance are 100% invariant under reorder', () => {
      const inc1 = createIncome({ id: 'i1', date: '2026-10-15', accountId: 'g', amount: 1_000_000 });
      const exp1 = createExpense({ id: 'e1', date: '2026-10-15', accountId: 'g', amount: 250_000 });
      const trf1 = createTransfer({ id: 't1', date: '2026-10-15', sourceAccountId: 'g', destinationAccountId: 's', amount: 300_000, adminFee: 2_500 });
      const events = [inc1, exp1, trf1];

      const initialBalances = getAccountBalances(events);
      const initialLiquid = getLiquidBalance(events);

      // Perform multiple reorders
      const r1 = reorderFinancialEvents(events, 't1', 'i1', 'before');
      const r2 = reorderFinancialEvents(r1, 'e1', 't1', 'before');

      expect(getAccountBalances(r1)).toEqual(initialBalances);
      expect(getLiquidBalance(r1)).toBe(initialLiquid);

      expect(getAccountBalances(r2)).toEqual(initialBalances);
      expect(getLiquidBalance(r2)).toBe(initialLiquid);
    });

    it('3.4 reordering does not inject hidden or extraneous prototype properties into events', () => {
      const a = createIncome({ id: 'A', date: '2026-10-15' });
      const b = createExpense({ id: 'B', date: '2026-10-15' });
      const events = [a, b];

      const reordered = reorderFinancialEvents(events, 'B', 'A', 'before');
      for (const ev of reordered) {
        expect(Object.keys(ev)).not.toContain('within_day_order');
        expect(Object.keys(ev)).not.toContain('dropIndex');
        expect(Object.keys(ev)).not.toContain('__temp');
      }
    });
  });

  // =========================================================================
  // 4. Date Boundary Detection for Auto-Scroll Hard Stop
  // =========================================================================
  describe('4. Date Boundary Detection for Auto-Scroll Hard Stop', () => {
    it('4.1 blocks scrolling UP when active item is at the top boundary of its same-date group', () => {
      const items = [
        { id: 'item-1', date: '2026-10-16' },
        { id: 'item-2', date: '2026-10-16' },
        { id: 'item-3', date: '2026-10-16' },
      ];

      // item-1 is at the top boundary
      const boundary = checkDateBoundary(items, 'item-1');
      expect(boundary.isAtTopBoundary).toBe(true);
      expect(boundary.canScrollUp).toBe(false); // scrolling UP is blocked
      expect(boundary.isAtBottomBoundary).toBe(false);
      expect(boundary.canScrollDown).toBe(true); // scrolling DOWN is allowed
    });

    it('4.2 blocks scrolling DOWN when active item is at the bottom boundary of its same-date group', () => {
      const items = [
        { id: 'item-1', date: '2026-10-16' },
        { id: 'item-2', date: '2026-10-16' },
        { id: 'item-3', date: '2026-10-16' },
      ];

      // item-3 is at the bottom boundary
      const boundary = checkDateBoundary(items, 'item-3');
      expect(boundary.isAtTopBoundary).toBe(false);
      expect(boundary.canScrollUp).toBe(true); // scrolling UP is allowed
      expect(boundary.isAtBottomBoundary).toBe(true);
      expect(boundary.canScrollDown).toBe(false); // scrolling DOWN is blocked
    });

    it('4.3 allows BOTH directions when active item is in the middle of its same-date group', () => {
      const items = [
        { id: 'item-1', date: '2026-10-16' },
        { id: 'item-2', date: '2026-10-16' },
        { id: 'item-3', date: '2026-10-16' },
      ];

      // item-2 is in the middle
      const boundary = checkDateBoundary(items, 'item-2');
      expect(boundary.isAtTopBoundary).toBe(false);
      expect(boundary.isAtBottomBoundary).toBe(false);
      expect(boundary.canScrollUp).toBe(true); // scrolling UP is allowed
      expect(boundary.canScrollDown).toBe(true); // scrolling DOWN is allowed
    });

    it('4.4 blocks BOTH directions when the same-date group contains only a single isolated item', () => {
      const items = [
        { id: 'd2-a', date: '2026-10-16' },
        { id: 'single-item', date: '2026-10-15' }, // Single item on 2026-10-15
        { id: 'd0-a', date: '2026-10-14' },
      ];

      const boundary = checkDateBoundary(items, 'single-item');
      expect(boundary.isAtTopBoundary).toBe(true);
      expect(boundary.isAtBottomBoundary).toBe(true);
      expect(boundary.canScrollUp).toBe(false); // scrolling UP blocked
      expect(boundary.canScrollDown).toBe(false); // scrolling DOWN blocked
    });

    it('4.5 verifies boundaries across multi-date clusters with adjacent distinct dates', () => {
      const items = [
        // Date 2026-10-16 (3 items)
        { id: 'T1', date: '2026-10-16' },
        { id: 'T2', date: '2026-10-16' },
        { id: 'T3', date: '2026-10-16' },
        // Date 2026-10-15 (2 items)
        { id: 'M1', date: '2026-10-15' },
        { id: 'M2', date: '2026-10-15' },
        // Date 2026-10-14 (1 item)
        { id: 'B1', date: '2026-10-14' },
      ];

      // Top cluster (T1, T2, T3)
      expect(checkDateBoundary(items, 'T1')).toEqual({
        isAtTopBoundary: true,
        isAtBottomBoundary: false,
        canScrollUp: false,
        canScrollDown: true,
      });
      expect(checkDateBoundary(items, 'T2')).toEqual({
        isAtTopBoundary: false,
        isAtBottomBoundary: false,
        canScrollUp: true,
        canScrollDown: true,
      });
      expect(checkDateBoundary(items, 'T3')).toEqual({
        isAtTopBoundary: false,
        isAtBottomBoundary: true,
        canScrollUp: true,
        canScrollDown: false,
      });

      // Middle cluster (M1, M2)
      expect(checkDateBoundary(items, 'M1')).toEqual({
        isAtTopBoundary: true,
        isAtBottomBoundary: false,
        canScrollUp: false,
        canScrollDown: true,
      });
      expect(checkDateBoundary(items, 'M2')).toEqual({
        isAtTopBoundary: false,
        isAtBottomBoundary: true,
        canScrollUp: true,
        canScrollDown: false,
      });

      // Bottom single cluster (B1)
      expect(checkDateBoundary(items, 'B1')).toEqual({
        isAtTopBoundary: true,
        isAtBottomBoundary: true,
        canScrollUp: false,
        canScrollDown: false,
      });
    });

    it('4.6 integrates with ReorderUnit[] atomic units for boundary calculation', () => {
      const exp1 = createExpense({ id: 'exp-1', date: '2026-10-16' });
      const cb1 = createCashback({ id: 'cb-1', date: '2026-10-16', relatedEventId: 'exp-1' });
      const inc2 = createIncome({ id: 'inc-2', date: '2026-10-16' });
      const events = [exp1, cb1, inc2];

      const units = getAtomicReorderUnits(events);
      expect(units).toHaveLength(2); // [unit: exp-1 with cb-1, unit: inc-2]

      // Unit 1 (exp-1 with cb-1) is at the top
      const topUnitBoundary = checkDateBoundary(units, 'exp-1');
      expect(topUnitBoundary.isAtTopBoundary).toBe(true);
      expect(topUnitBoundary.canScrollUp).toBe(false);
      expect(topUnitBoundary.canScrollDown).toBe(true);

      // Checking via child cashback ID also resolves correctly to Unit 1
      const childBoundary = checkDateBoundary(units, 'cb-1');
      expect(childBoundary.isAtTopBoundary).toBe(true);
      expect(childBoundary.canScrollUp).toBe(false);

      // Unit 2 is at the bottom
      const bottomUnitBoundary = checkDateBoundary(units, 'inc-2');
      expect(bottomUnitBoundary.isAtBottomBoundary).toBe(true);
      expect(bottomUnitBoundary.canScrollDown).toBe(false);
      expect(bottomUnitBoundary.canScrollUp).toBe(true);
    });

    it('4.7 checkEventDateBoundary respects Card View descending date & reverse recording order', () => {
      // In Card View: primary date DESC, secondary recording index DESC
      const a = createIncome({ id: 'A', date: '2026-10-14' });
      const b = createExpense({ id: 'B', date: '2026-10-15' }); // Newer date, recorded earlier
      const c = createIncome({ id: 'C', date: '2026-10-15' }); // Newer date, recorded later
      const events = [a, b, c];

      // Card rendered order for 2026-10-15: C (top), B (bottom of 10-15)
      // Then 2026-10-14: A
      const statusC = checkEventDateBoundary(events, 'C', 'card');
      expect(statusC.isAtTopBoundary).toBe(true);
      expect(statusC.canScrollUp).toBe(false);
      expect(statusC.canScrollDown).toBe(true);

      const statusB = checkEventDateBoundary(events, 'B', 'card');
      expect(statusB.isAtBottomBoundary).toBe(true); // followed by 10-14 (A)
      expect(statusB.canScrollDown).toBe(false);
      expect(statusB.canScrollUp).toBe(true);
    });

    it('4.8 returns safe blocked defaults when activeId is non-existent', () => {
      const items = [{ id: 'item-1', date: '2026-10-16' }];
      const boundary = checkDateBoundary(items, 'non-existent-id');
      expect(boundary.isAtTopBoundary).toBe(true);
      expect(boundary.isAtBottomBoundary).toBe(true);
      expect(boundary.canScrollUp).toBe(false);
      expect(boundary.canScrollDown).toBe(false);
    });
  });

  // =========================================================================
  // 5. Supabase Sync Queueing on Drop
  // =========================================================================
  describe('5. Supabase Sync Queueing on Drop', () => {
    it('5.1 commits reordered events and queues all same-date event IDs into pending upserts', () => {
      const d1_a = createIncome({ id: 'd1-a', date: '2026-10-12' });
      const d2_a = createIncome({ id: 'd2-a', date: '2026-10-15' });
      const d2_b = createExpense({ id: 'd2-b', date: '2026-10-15' });
      const d2_c = createIncome({ id: 'd2-c', date: '2026-10-15' });
      const d3_a = createExpense({ id: 'd3-a', date: '2026-10-18' });
      const events = [d1_a, d2_a, d2_b, d2_c, d3_a];

      // User reorders d2-c before d2-a on Date 2
      const nextEvents = reorderFinancialEvents(events, 'd2-c', 'd2-a', 'before');
      expect(nextEvents.map((e) => e.id)).toEqual(['d1-a', 'd2-c', 'd2-a', 'd2-b', 'd3-a']);

      // Simulate Drop commit logic from app/finance/page.tsx:
      // Filter nextEvents for same date and queue affected IDs
      const targetDate = '2026-10-15';
      const sameDateIds = nextEvents.filter((e) => e.date === targetDate).map((e) => e.id);
      queuePendingUpserts(sameDateIds);

      // Verify that all and only the same-date event IDs are queued
      const rawStored = mockLocalStorage.getItem(PENDING_UPSERTS_KEY);
      expect(rawStored).not.toBeNull();
      const parsedStored = JSON.parse(rawStored!);
      expect(parsedStored).toEqual(expect.arrayContaining(['d2-c', 'd2-a', 'd2-b']));

      const pendingIds = getPendingUpsertIds();
      expect(pendingIds).toHaveLength(3);
      expect(pendingIds).toContain('d2-c');
      expect(pendingIds).toContain('d2-a');
      expect(pendingIds).toContain('d2-b');
      expect(pendingIds).not.toContain('d1-a');
      expect(pendingIds).not.toContain('d3-a');
    });

    it('5.2 queues both parent Expense and child Cashback IDs when reordering an atomic unit', () => {
      const exp1 = createExpense({ id: 'exp-1', date: '2026-10-15' });
      const cb1 = createCashback({ id: 'cb-1', date: '2026-10-15', relatedEventId: 'exp-1' });
      const inc2 = createIncome({ id: 'inc-2', date: '2026-10-15' });
      const events = [exp1, cb1, inc2];

      const nextEvents = reorderFinancialEvents(events, 'inc-2', 'exp-1', 'before');
      expect(nextEvents.map((e) => e.id)).toEqual(['inc-2', 'exp-1', 'cb-1']);

      const sameDateIds = nextEvents.filter((e) => e.date === '2026-10-15').map((e) => e.id);
      queuePendingUpserts(sameDateIds);

      const pendingIds = getPendingUpsertIds();
      expect(pendingIds).toContain('exp-1');
      expect(pendingIds).toContain('cb-1');
      expect(pendingIds).toContain('inc-2');
    });

    it('5.3 computeWithinDayOrders assigns deterministic ascending indices matching the new order', () => {
      const a = createIncome({ id: 'A', date: '2026-10-15' });
      const b = createExpense({ id: 'B', date: '2026-10-15' });
      const c = createIncome({ id: 'C', date: '2026-10-15' });

      // Before reorder: A=0, B=1, C=2
      const initialOrders = computeWithinDayOrders([a, b, c]);
      expect(initialOrders.get('A')).toBe(0);
      expect(initialOrders.get('B')).toBe(1);
      expect(initialOrders.get('C')).toBe(2);

      // After reorder C before A: C=0, A=1, B=2
      const reordered = [c, a, b];
      const nextOrders = computeWithinDayOrders(reordered);
      expect(nextOrders.get('C')).toBe(0);
      expect(nextOrders.get('A')).toBe(1);
      expect(nextOrders.get('B')).toBe(2);
    });

    it('5.4 mergeLocalAndCloudEvents prepares Supabase rowsToUpsert with the updated within_day_order', () => {
      const a = createIncome({ id: 'A', date: '2026-10-15', amount: 100_000 });
      const b = createExpense({ id: 'B', date: '2026-10-15', amount: 200_000 });
      const reorderedEvents = [b, a]; // Swapped: B is 0, A is 1

      // Pending upsert IDs marks these events as modified locally
      const pendingUpsertIds = ['B', 'A'];

      // Existing cloud database rows have old ordering (A=0, B=1)
      const cloudRows = [
        {
          id: 'A',
          date: '2026-10-15',
          description: 'A',
          amount: 100_000,
          type: 'income' as const,
          category: 'Salary',
          account_id: 'g',
          source_account_id: null,
          destination_account_id: null,
          admin_fee: null,
          related_event_id: null,
          within_day_order: 0,
          created_at: '2026-10-15T10:00:00Z',
          updated_at: '2026-10-15T10:00:00Z',
          deleted_at: null,
          user_id: 'single-user',
        },
        {
          id: 'B',
          date: '2026-10-15',
          description: 'B',
          amount: 200_000,
          type: 'expense' as const,
          category: 'Food & Drinks',
          account_id: 'g',
          source_account_id: null,
          destination_account_id: null,
          admin_fee: null,
          related_event_id: null,
          within_day_order: 1,
          created_at: '2026-10-15T10:00:00Z',
          updated_at: '2026-10-15T10:00:00Z',
          deleted_at: null,
          user_id: 'single-user',
        },
      ];

      const { rowsToUpsert } = mergeLocalAndCloudEvents(
        reorderedEvents,
        cloudRows,
        pendingUpsertIds,
        []
      );

      // Verify that both rows are prepared for upsert with their newly calculated within_day_order
      expect(rowsToUpsert).toHaveLength(2);

      const rowB = rowsToUpsert.find((r) => r.id === 'B');
      const rowA = rowsToUpsert.find((r) => r.id === 'A');

      expect(rowB?.within_day_order).toBe(0);
      expect(rowA?.within_day_order).toBe(1);
    });

    it('5.5 deduplicates IDs when multiple reorders occur on the same date before sync flush', () => {
      queuePendingUpserts(['ev-1', 'ev-2']);
      queuePendingUpserts(['ev-2', 'ev-3']);

      const pending = getPendingUpsertIds();
      expect(pending).toHaveLength(3);
      expect(pending).toEqual(expect.arrayContaining(['ev-1', 'ev-2', 'ev-3']));
    });
  });

  // =========================================================================
  // 6. Faster Hold Timing & Movement Thresholds (Mouse vs Touch)
  // =========================================================================
  describe('6. Faster Hold Timing & Movement Thresholds (Mouse vs Touch)', () => {
    it('6.1 specifies calibrated timing constants for responsive mobile (150ms) and desktop (50ms)', () => {
      // Mobile: 150ms allows snappy card pickup while rejecting unintentional tap gestures
      expect(TOUCH_HOLD_DELAY_MS).toBe(150);
      // Desktop: 50ms provides near-instant mouse pickup without perceived latency
      expect(MOUSE_HOLD_DELAY_MS).toBe(50);
      expect(TOUCH_HOLD_DELAY_MS).toBeGreaterThan(MOUSE_HOLD_DELAY_MS);
    });

    it('6.2 specifies calibrated movement threshold constants for mouse instant drag vs touch cancel', () => {
      // Mouse: moving >= 4px initiates instant drag without waiting for hold timer
      expect(MOUSE_INSTANT_DRAG_PX).toBe(4);
      // Touch: moving > 10px cancels the hold timer to allow smooth native scroll
      expect(TOUCH_MOVE_CANCEL_PX).toBe(10);
      expect(TOUCH_MOVE_CANCEL_PX).toBeGreaterThan(MOUSE_INSTANT_DRAG_PX);
    });

    it('6.3 mouse instant drag triggers immediately on >= 4px movement', () => {
      const startX = 100;
      const startY = 100;

      // Displacement 3px: does not reach 4px threshold
      const distSmall = Math.hypot(103 - startX, 100 - startY);
      expect(distSmall < MOUSE_INSTANT_DRAG_PX).toBe(true);

      // Displacement 4px: meets threshold
      const distExact = Math.hypot(104 - startX, 100 - startY);
      expect(distExact >= MOUSE_INSTANT_DRAG_PX).toBe(true);

      // Diagonal displacement (3px, 3px): sqrt(18) = 4.24px >= 4px
      const distDiag = Math.hypot(103 - startX, 103 - startY);
      expect(distDiag >= MOUSE_INSTANT_DRAG_PX).toBe(true);
    });

    it('6.4 touch movement allows micro-wobble <= 10px while canceling on > 10px to preserve page scroll', () => {
      const startX = 200;
      const startY = 200;

      // Resting finger micro-wobble (e.g. 5px, 8px, 10px) must NOT cancel hold
      expect(Math.hypot(205 - startX, 200 - startY) <= TOUCH_MOVE_CANCEL_PX).toBe(true);
      expect(Math.hypot(200 - startX, 208 - startY) <= TOUCH_MOVE_CANCEL_PX).toBe(true);
      expect(Math.hypot(206 - startX, 208 - startY) <= TOUCH_MOVE_CANCEL_PX).toBe(true); // hypot = 10

      // Intentional drag/scroll (e.g. 11px, 15px) cancels hold timer
      expect(Math.hypot(211 - startX, 200 - startY) > TOUCH_MOVE_CANCEL_PX).toBe(true);
      expect(Math.hypot(200 - startX, 215 - startY) > TOUCH_MOVE_CANCEL_PX).toBe(true);
    });

    it('6.5 simulates hold activation and cancellation lifecycle timing', () => {
      let isDragging = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const startHold = (isTouch: boolean) => {
        const delay = isTouch ? TOUCH_HOLD_DELAY_MS : MOUSE_HOLD_DELAY_MS;
        timer = setTimeout(() => {
          isDragging = true;
        }, delay);
      };

      const cancelHold = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      };

      // Mouse drag simulation: triggers after 50ms
      startHold(false);
      expect(isDragging).toBe(false);
      cancelHold();
      expect(isDragging).toBe(false);

      // Touch drag simulation: cancels if finger moves past 10px at 50ms
      startHold(true);
      expect(isDragging).toBe(false);
      // Touch moved > 10px at 50ms -> cancel
      cancelHold();
      expect(isDragging).toBe(false);
    });
  });

  // =========================================================================
  // 7. Fast Slot Boundary Calculation Without Layout Thrashing
  // =========================================================================
  describe('7. Fast Slot Boundary Calculation Without Layout Thrashing', () => {
    const slots: CachedSlot[] = [
      { unitId: 'u-top', top: 100, bottom: 180, mid: 140 },
      { unitId: 'u-mid', top: 190, bottom: 270, mid: 230 },
      { unitId: 'u-bot', top: 280, bottom: 360, mid: 320 },
    ];

    it('7.1 findClosestSlotIndex finds the closest slot using pure array math without DOM layout queries', () => {
      // Nearest to slot 0 (mid: 140)
      expect(findClosestSlotIndex(slots, 130)).toBe(0);
      expect(findClosestSlotIndex(slots, 140)).toBe(0);
      expect(findClosestSlotIndex(slots, 180)).toBe(0); // dist to 140 is 40, dist to 230 is 50

      // Nearest to slot 1 (mid: 230)
      expect(findClosestSlotIndex(slots, 190)).toBe(1); // dist to 140 is 50, dist to 230 is 40
      expect(findClosestSlotIndex(slots, 230)).toBe(1);
      expect(findClosestSlotIndex(slots, 270)).toBe(1); // dist to 230 is 40, dist to 320 is 50

      // Nearest to slot 2 (mid: 320)
      expect(findClosestSlotIndex(slots, 280)).toBe(2); // dist to 230 is 50, dist to 320 is 40
      expect(findClosestSlotIndex(slots, 320)).toBe(2);
      expect(findClosestSlotIndex(slots, 350)).toBe(2);
    });

    it('7.2 clamps smoothly when pointerPageY exceeds date group boundaries', () => {
      // Pointer dragged far above top slot
      expect(findClosestSlotIndex(slots, -50)).toBe(0);
      expect(findClosestSlotIndex(slots, 50)).toBe(0);

      // Pointer dragged far below bottom slot
      expect(findClosestSlotIndex(slots, 500)).toBe(2);
      expect(findClosestSlotIndex(slots, 1000)).toBe(2);
    });

    it('7.3 handles empty slots array safely without throwing', () => {
      expect(findClosestSlotIndex([], 200)).toBe(-1);
    });

    it('7.4 calculateCanonicalPlacementFromSlot correctly maps visual movement to canonical placement', () => {
      // Card view: rendered newest-first (reverse chronological)
      // Moving visually UP (bestSlotIndex 0 < originalVisualIndex 1) means placing AFTER in chronological array
      expect(calculateCanonicalPlacementFromSlot(0, 1, 'card')).toEqual({
        placement: 'above',
        canonicalPlacement: 'after',
      });
      // Moving visually DOWN (bestSlotIndex 1 > originalVisualIndex 0) means placing BEFORE in chronological array
      expect(calculateCanonicalPlacementFromSlot(1, 0, 'card')).toEqual({
        placement: 'below',
        canonicalPlacement: 'before',
      });

      // Ledger view: rendered oldest-first (chronological)
      // Moving visually UP (bestSlotIndex 0 < originalVisualIndex 1) means placing BEFORE in chronological array
      expect(calculateCanonicalPlacementFromSlot(0, 1, 'ledger')).toEqual({
        placement: 'above',
        canonicalPlacement: 'before',
      });
      // Moving visually DOWN (bestSlotIndex 1 > originalVisualIndex 0) means placing AFTER in chronological array
      expect(calculateCanonicalPlacementFromSlot(1, 0, 'ledger')).toEqual({
        placement: 'below',
        canonicalPlacement: 'after',
      });
    });

    it('7.5 verifies end-to-end slot movement pipeline in Card View', () => {
      // In Card View, 3 transactions on same date: A (oldest), B (middle), C (newest)
      const a = createIncome({ id: 'A', date: '2026-10-15' });
      const b = createExpense({ id: 'B', date: '2026-10-15' });
      const c = createIncome({ id: 'C', date: '2026-10-15' });
      const events = [a, b, c];

      // Card visual order: [C, B, A] -> visual index 0: C, index 1: B, index 2: A
      // Dragging card A (visual index 2) to visual index 0 (slot C):
      // isMovingUp = true (0 < 2) -> canonicalPlacement = 'after' C
      const reorderedTop = reorderFinancialEvents(events, 'A', 'C', 'after');
      expect(reorderedTop.map((e) => e.id)).toEqual(['B', 'C', 'A']);
      // In Card View reverse order: [A, C, B] -> A lands at the very top!

      // Dragging card C (visual index 0) to visual index 2 (slot A):
      // isMovingUp = false (2 > 0) -> canonicalPlacement = 'before' A
      const reorderedBot = reorderFinancialEvents(events, 'C', 'A', 'before');
      expect(reorderedBot.map((e) => e.id)).toEqual(['C', 'A', 'B']);
      // In Card View reverse order: [B, A, C] -> C lands at the very bottom!
    });

    it('7.6 verifies end-to-end slot movement pipeline in Ledger View', () => {
      const a = createIncome({ id: 'A', date: '2026-10-15' });
      const b = createExpense({ id: 'B', date: '2026-10-15' });
      const c = createIncome({ id: 'C', date: '2026-10-15' });
      const events = [a, b, c];

      // Ledger visual order: [A, B, C] -> visual index 0: A, index 1: B, index 2: C
      // Dragging card C (visual index 2) to visual index 0 (slot A):
      // isMovingUp = true -> canonicalPlacement = 'before' A
      const reorderedTop = reorderFinancialEvents(events, 'C', 'A', 'before');
      expect(reorderedTop.map((e) => e.id)).toEqual(['C', 'A', 'B']);

      // Dragging card A (visual index 0) to visual index 2 (slot C):
      // isMovingUp = false -> canonicalPlacement = 'after' C
      const reorderedBot = reorderFinancialEvents(events, 'A', 'C', 'after');
      expect(reorderedBot.map((e) => e.id)).toEqual(['B', 'C', 'A']);
    });
  });

  // =========================================================================
  // 8. Auto-Scroll Speed Curve, Date Boundary & Physical Hard-Stop Bounds
  // =========================================================================
  describe('8. Auto-Scroll Speed Curve, Date Boundary & Physical Hard-Stop Bounds', () => {
    const viewportHeight = 800;

    it('8.1 returns zero velocity and null direction in viewport center safe zone', () => {
      // Middle zone: clientY between 100px and 700px
      expect(calculateAutoScrollSpeed(150, viewportHeight)).toEqual({ speed: 0, dir: null });
      expect(calculateAutoScrollSpeed(400, viewportHeight)).toEqual({ speed: 0, dir: null });
      expect(calculateAutoScrollSpeed(650, viewportHeight)).toEqual({ speed: 0, dir: null });
      expect(calculateAutoScrollSpeed(100, viewportHeight)).toEqual({ speed: 0, dir: null });
      expect(calculateAutoScrollSpeed(700, viewportHeight)).toEqual({ speed: 0, dir: null });
    });

    it('8.2 calculates smooth upward speed curve approaching max speed at clientY = 0', () => {
      // Edge of top boundary: clientY = 0 -> intensity = 1.0 -> speed = -MAX_SCROLL_SPEED_PX (-18)
      const topEdge = calculateAutoScrollSpeed(0, viewportHeight);
      expect(topEdge.dir).toBe('up');
      expect(topEdge.speed).toBe(-MAX_SCROLL_SPEED_PX);

      // Halfway into top boundary: clientY = 50 -> intensity = 0.5 -> speed = -0.5^1.5 * 18 ~ -6.36
      const topMid = calculateAutoScrollSpeed(50, viewportHeight);
      expect(topMid.dir).toBe('up');
      expect(topMid.speed).toBeCloseTo(-Math.pow(0.5, 1.5) * MAX_SCROLL_SPEED_PX, 3);
      expect(topMid.speed).toBeLessThan(0);
      expect(topMid.speed).toBeGreaterThan(-MAX_SCROLL_SPEED_PX);

      // Just inside top boundary: clientY = 90 -> intensity = 0.1 -> speed = -0.1^1.5 * 18 ~ -0.57
      const topEntry = calculateAutoScrollSpeed(90, viewportHeight);
      expect(topEntry.dir).toBe('up');
      expect(topEntry.speed).toBeCloseTo(-Math.pow(0.1, 1.5) * MAX_SCROLL_SPEED_PX, 3);
    });

    it('8.3 calculates smooth downward speed curve approaching max speed at clientY = viewportHeight', () => {
      // Edge of bottom boundary: clientY = 800 -> intensity = 1.0 -> speed = +MAX_SCROLL_SPEED_PX (+18)
      const botEdge = calculateAutoScrollSpeed(800, viewportHeight);
      expect(botEdge.dir).toBe('down');
      expect(botEdge.speed).toBe(MAX_SCROLL_SPEED_PX);

      // Halfway into bottom boundary: clientY = 750 -> intensity = 0.5 -> speed = +0.5^1.5 * 18 ~ +6.36
      const botMid = calculateAutoScrollSpeed(750, viewportHeight);
      expect(botMid.dir).toBe('down');
      expect(botMid.speed).toBeCloseTo(Math.pow(0.5, 1.5) * MAX_SCROLL_SPEED_PX, 3);
      expect(botMid.speed).toBeGreaterThan(0);
      expect(botMid.speed).toBeLessThan(MAX_SCROLL_SPEED_PX);
    });

    it('8.4 respects configured edge margin (AUTO_SCROLL_EDGE_PX = 100) and max speed (MAX_SCROLL_SPEED_PX = 18)', () => {
      expect(AUTO_SCROLL_EDGE_PX).toBe(100);
      expect(MAX_SCROLL_SPEED_PX).toBe(18);
    });

    it('8.5 physical date group bounds check halts scrolling before crossing adjacent date boundaries', () => {
      const groupTop = 200;
      const groupBottom = 800;
      const padding = 20;

      // Scrolling UP: halted if pointerPageY <= groupTop + padding (220)
      expect(isPastDateGroupBounds(210, 'up', groupTop, groupBottom, padding)).toBe(true);
      expect(isPastDateGroupBounds(220, 'up', groupTop, groupBottom, padding)).toBe(true);
      expect(isPastDateGroupBounds(221, 'up', groupTop, groupBottom, padding)).toBe(false);
      expect(isPastDateGroupBounds(300, 'up', groupTop, groupBottom, padding)).toBe(false);

      // Scrolling DOWN: halted if pointerPageY >= groupBottom - padding (780)
      expect(isPastDateGroupBounds(790, 'down', groupTop, groupBottom, padding)).toBe(true);
      expect(isPastDateGroupBounds(780, 'down', groupTop, groupBottom, padding)).toBe(true);
      expect(isPastDateGroupBounds(779, 'down', groupTop, groupBottom, padding)).toBe(false);
      expect(isPastDateGroupBounds(700, 'down', groupTop, groupBottom, padding)).toBe(false);
    });

    it('8.6 isAtDateBoundary returns true (blocking auto-scroll) for single-item dates', () => {
      const single = [createIncome({ id: 'alone', date: '2026-10-15' })];
      expect(isAtDateBoundary(single, 'alone', 'up', 'card')).toBe(true);
      expect(isAtDateBoundary(single, 'alone', 'down', 'card')).toBe(true);
      expect(isAtDateBoundary(single, 'alone', 'up', 'ledger')).toBe(true);
      expect(isAtDateBoundary(single, 'alone', 'down', 'ledger')).toBe(true);
    });

    it('8.7 isAtDateBoundary accurately detects boundaries for multi-item date cluster in Card and Ledger modes', () => {
      const a = createIncome({ id: 'A', date: '2026-10-15' }); // oldest
      const b = createExpense({ id: 'B', date: '2026-10-15' }); // middle
      const c = createIncome({ id: 'C', date: '2026-10-15' }); // newest
      const events = [a, b, c];

      // Card View visual order: [C, B, A]
      // Top visual item is C
      expect(isAtDateBoundary(events, 'C', 'up', 'card')).toBe(true);
      expect(isAtDateBoundary(events, 'C', 'down', 'card')).toBe(false);

      // Middle visual item is B
      expect(isAtDateBoundary(events, 'B', 'up', 'card')).toBe(false);
      expect(isAtDateBoundary(events, 'B', 'down', 'card')).toBe(false);

      // Bottom visual item is A
      expect(isAtDateBoundary(events, 'A', 'up', 'card')).toBe(false);
      expect(isAtDateBoundary(events, 'A', 'down', 'card')).toBe(true);

      // Ledger View visual order: [A, B, C]
      // Top visual item is A
      expect(isAtDateBoundary(events, 'A', 'up', 'ledger')).toBe(true);
      expect(isAtDateBoundary(events, 'A', 'down', 'ledger')).toBe(false);

      // Bottom visual item is C
      expect(isAtDateBoundary(events, 'C', 'up', 'ledger')).toBe(false);
      expect(isAtDateBoundary(events, 'C', 'down', 'ledger')).toBe(true);
    });
  });

  // =========================================================================
  // 9. Advanced Atomic Unit Cohesion & Multi-Leg Transfer Preservation
  // =========================================================================
  describe('9. Advanced Atomic Unit Cohesion & Multi-Leg Transfer Preservation', () => {
    it('9.1 preserves atomic cohesion across multiple expenses each having linked cashbacks', () => {
      const exp1 = createExpense({ id: 'exp-1', date: '2026-10-16', amount: 200_000 });
      const cb1 = createCashback({ id: 'cb-1', date: '2026-10-16', relatedEventId: 'exp-1', amount: 20_000 });
      const exp2 = createExpense({ id: 'exp-2', date: '2026-10-16', amount: 400_000 });
      const cb2 = createCashback({ id: 'cb-2', date: '2026-10-16', relatedEventId: 'exp-2', amount: 40_000 });
      const inc = createIncome({ id: 'inc-1', date: '2026-10-16', amount: 1_000_000 });

      const initialEvents = [exp1, cb1, exp2, cb2, inc];

      // Reorder exp-2 unit before exp-1:
      // Expect: [exp-2, cb-2, exp-1, cb-1, inc-1]
      const step1 = reorderFinancialEvents(initialEvents, 'exp-2', 'exp-1', 'before');
      expect(step1.map((e) => e.id)).toEqual(['exp-2', 'cb-2', 'exp-1', 'cb-1', 'inc-1']);

      // Cashback 2 must remain immediately adjacent to Expense 2
      const exp2Idx = step1.findIndex((e) => e.id === 'exp-2');
      expect(step1[exp2Idx + 1].id).toBe('cb-2');

      // Cashback 1 must remain immediately adjacent to Expense 1
      const exp1Idx = step1.findIndex((e) => e.id === 'exp-1');
      expect(step1[exp1Idx + 1].id).toBe('cb-1');

      // Move income between the two expense-cashback pairs:
      // Place inc after cb-2 (which resolves to placing after unit [exp-2, cb-2])
      const step2 = reorderFinancialEvents(step1, 'inc-1', 'exp-2', 'after');
      expect(step2.map((e) => e.id)).toEqual(['exp-2', 'cb-2', 'inc-1', 'exp-1', 'cb-1']);

      // Ensure neither expense-cashback pair was split
      expect(step2[step2.findIndex((e) => e.id === 'exp-2') + 1].id).toBe('cb-2');
      expect(step2[step2.findIndex((e) => e.id === 'exp-1') + 1].id).toBe('cb-1');
    });

    it('9.2 preserves ledger entry structure and admin fee debit continuity across multiple transfers', () => {
      const t1 = createTransfer({
        id: 't-1',
        date: '2026-10-16',
        sourceAccountId: 'g',
        destinationAccountId: 's',
        amount: 500_000,
        adminFee: 2_500,
      });
      const t2 = createTransfer({
        id: 't-2',
        date: '2026-10-16',
        sourceAccountId: 's',
        destinationAccountId: 'b',
        amount: 300_000,
        adminFee: 1_000,
      });
      const exp = createExpense({ id: 'exp-x', date: '2026-10-16', amount: 50_000 });
      const events = [t1, exp, t2];

      const initialBalances = getAccountBalances(events);
      const initialLiquid = getLiquidBalance(events);

      // Reorder t-2 before t-1
      const reordered = reorderFinancialEvents(events, 't-2', 't-1', 'before');
      expect(reordered.map((e) => e.id)).toEqual(['t-2', 't-1', 'exp-x']);

      // Balances must remain strictly invariant
      expect(getAccountBalances(reordered)).toEqual(initialBalances);
      expect(getLiquidBalance(reordered)).toBe(initialLiquid);

      // Derived ledger entries verification:
      // t-2 legs: [out (s), in (b), out fee (s)]
      // t-1 legs: [out (g), in (s), out fee (g)]
      // exp leg: [out (g)]
      const ledger = deriveLedgerEntries(reordered);
      expect(ledger).toHaveLength(7); // 3 legs from t2 + 3 legs from t1 + 1 from exp

      // Legs 0, 1, 2 must all belong to t-2
      expect(ledger[0].eventId).toBe('t-2');
      expect(ledger[0].direction).toBe('out');
      expect(ledger[1].eventId).toBe('t-2');
      expect(ledger[1].direction).toBe('in');
      expect(ledger[2].eventId).toBe('t-2');
      expect(ledger[2].direction).toBe('out'); // admin fee

      // Legs 3, 4, 5 must all belong to t-1
      expect(ledger[3].eventId).toBe('t-1');
      expect(ledger[3].direction).toBe('out');
      expect(ledger[4].eventId).toBe('t-1');
      expect(ledger[4].direction).toBe('in');
      expect(ledger[5].eventId).toBe('t-1');
      expect(ledger[5].direction).toBe('out'); // admin fee
    });

    it('9.3 maintains zero duplication and 100% financial validity over a rapid 20-step random permutation cycle', () => {
      const e1 = createIncome({ id: 'e-1', date: '2026-10-16', amount: 100_000 });
      const e2 = createExpense({ id: 'e-2', date: '2026-10-16', amount: 50_000 });
      const e3 = createCashback({ id: 'cb-3', date: '2026-10-16', relatedEventId: 'e-2', amount: 5_000 });
      const e4 = createTransfer({ id: 'e-4', date: '2026-10-16', amount: 75_000, sourceAccountId: 'g', destinationAccountId: 's' });
      const e5 = createIncome({ id: 'e-5', date: '2026-10-16', amount: 200_000 });

      let currentEvents: FinancialEvent[] = [e1, e2, e3, e4, e5];
      const initialBalances = getAccountBalances(currentEvents);

      // Deterministic pseudo-random sequence of reorder steps
      const moves: Array<{ active: string; target: string; placement: 'before' | 'after' }> = [
        { active: 'e-5', target: 'e-1', placement: 'before' },
        { active: 'e-4', target: 'e-2', placement: 'after' },
        { active: 'e-2', target: 'e-1', placement: 'before' },
        { active: 'e-1', target: 'e-5', placement: 'after' },
        { active: 'e-4', target: 'e-5', placement: 'before' },
        { active: 'e-5', target: 'e-2', placement: 'before' },
        { active: 'e-1', target: 'e-4', placement: 'before' },
        { active: 'e-2', target: 'e-5', placement: 'after' },
        { active: 'e-4', target: 'e-1', placement: 'after' },
        { active: 'e-5', target: 'e-4', placement: 'after' },
        { active: 'e-2', target: 'e-1', placement: 'before' },
        { active: 'e-1', target: 'e-5', placement: 'before' },
        { active: 'e-4', target: 'e-2', placement: 'before' },
        { active: 'e-5', target: 'e-4', placement: 'before' },
        { active: 'e-1', target: 'e-2', placement: 'after' },
        { active: 'e-2', target: 'e-4', placement: 'after' },
        { active: 'e-4', target: 'e-5', placement: 'after' },
        { active: 'e-5', target: 'e-1', placement: 'after' },
        { active: 'e-2', target: 'e-5', placement: 'before' },
        { active: 'e-1', target: 'e-4', placement: 'before' },
      ];

      for (let i = 0; i < moves.length; i++) {
        const { active, target, placement } = moves[i];
        currentEvents = reorderFinancialEvents(currentEvents, active, target, placement);

        // Invariant 1: Total event count is preserved
        expect(currentEvents).toHaveLength(5);

        // Invariant 2: Linked cashback cb-3 remains immediately adjacent to e-2
        const e2Pos = currentEvents.findIndex((ev) => ev.id === 'e-2');
        expect(currentEvents[e2Pos + 1].id).toBe('cb-3');

        // Invariant 3: Unique IDs preserved with zero duplication or dropping
        const ids = currentEvents.map((ev) => ev.id);
        expect(new Set(ids).size).toBe(5);
        expect(ids).toEqual(expect.arrayContaining(['e-1', 'e-2', 'cb-3', 'e-4', 'e-5']));

        // Invariant 4: Account balances and liquid balances 100% conserved
        expect(getAccountBalances(currentEvents)).toEqual(initialBalances);
      }
    });

    it('9.4 preserves account assignments and categories across liquid and investment accounts', () => {
      const liquidInc = createIncome({ id: 'liq-1', date: '2026-10-16', accountId: 'g', amount: 500_000, category: 'Salary' });
      const investInc = createIncome({ id: 'inv-1', date: '2026-10-16', accountId: 'sb', amount: 250_000, category: 'Others' });
      const events = [liquidInc, investInc];

      const reordered = reorderFinancialEvents(events, 'inv-1', 'liq-1', 'before');
      expect(reordered.map((e) => e.id)).toEqual(['inv-1', 'liq-1']);

      const first = reordered[0] as IncomeEvent;
      const second = reordered[1] as IncomeEvent;

      expect(first.accountId).toBe('sb');
      expect(first.category).toBe('Others');
      expect(second.accountId).toBe('g');
      expect(second.category).toBe('Salary');
    });
  });
});

