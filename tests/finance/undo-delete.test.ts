import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  calculateFinanceStats,
  createInitialBalanceEvents,
  getAccountBalances,
  getInvestmentBalance,
  getLiquidBalance,
  getNetWorth,
  readFinancialEvents,
  writeFinancialEvents,
} from '@/lib/finance';
import {
  deleteFinancialEventWithSync,
  getPendingDeletedIds,
  clearPendingDeletions,
} from '@/lib/sync';
import type {
  FinancialEvent,
  ExpenseEvent,
  IncomeEvent,
  RefundEvent,
  TransferEvent,
} from '@/lib/types';
import {
  createCashback,
  createExpense,
  createIncome,
  createRefund,
  createTransfer,
} from './helpers/fixtures';

class StorageMock {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const mockStorage = new StorageMock();

/**
 * Deterministic test harness representing the Undo Delete lifecycle in app/finance/page.tsx
 */
interface PendingDeleteSnapshot {
  event: FinancialEvent;
  previousEvents: FinancialEvent[];
  relatedEvents: FinancialEvent[];
}

class UndoDeleteSessionManager {
  private pending: PendingDeleteSnapshot | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private activeEvents: FinancialEvent[];
  readonly durationMs: number;

  constructor(initialEvents: FinancialEvent[], durationMs = 4000) {
    this.activeEvents = [...initialEvents];
    this.durationMs = durationMs;
    writeFinancialEvents(this.activeEvents);
  }

  getEvents(): FinancialEvent[] {
    return [...this.activeEvents];
  }

  getPending(): PendingDeleteSnapshot | null {
    return this.pending;
  }

  delete(targetId: string): FinancialEvent[] {
    const targetEvent = this.activeEvents.find((e) => e.id === targetId);
    if (!targetEvent) return this.activeEvents;

    // Rule 5: Flush any previous pending delete before starting a new one
    if (this.pending) {
      this.commit();
    }

    const previousEvents = [...this.activeEvents];
    const relatedEvents = this.activeEvents.filter(
      (e) => 'relatedEventId' in e && e.relatedEventId === targetEvent.id
    );

    const snapshot: PendingDeleteSnapshot = {
      event: targetEvent,
      previousEvents,
      relatedEvents,
    };

    const optimisticEvents = this.activeEvents.filter(
      (e) => e.id !== targetEvent.id && ('relatedEventId' in e ? e.relatedEventId !== targetEvent.id : true)
    );

    this.pending = snapshot;
    this.activeEvents = optimisticEvents;
    writeFinancialEvents(optimisticEvents);

    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.commit();
    }, this.durationMs);

    return this.activeEvents;
  }

  undo(): FinancialEvent[] | null {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const pending = this.pending;
    if (!pending) return null;
    this.pending = null;

    this.activeEvents = [...pending.previousEvents];
    writeFinancialEvents(pending.previousEvents);
    return this.activeEvents;
  }

  commit(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;

    deleteFinancialEventWithSync(pending.event.id, pending.previousEvents).catch(() => {});
  }
}

describe('Undo Delete Transaction Test Suite (Invariants 1 - 5)', () => {
  beforeEach(() => {
    mockStorage.clear();
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: mockStorage,
      dispatchEvent: () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    clearPendingDeletions(getPendingDeletedIds());
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // INVARIANT 1: Optimistic delete removes parent and all cascading children
  // =========================================================================
  describe('Invariant 1: Optimistic delete removes parent and cascading children from active events state', () => {
    it('1.1 optimistic delete of a standard Expense removes that expense from active events', () => {
      const exp1 = createExpense({ id: 'exp-1', amount: 150_000, description: 'Lunch' });
      const inc1 = createIncome({ id: 'inc-1', amount: 500_000, description: 'Freelance' });
      const initial = [exp1, inc1];

      const session = new UndoDeleteSessionManager(initial);
      const remaining = session.delete('exp-1');

      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('inc-1');
      expect(session.getEvents().map((e) => e.id)).toEqual(['inc-1']);
      expect(session.getPending()?.event.id).toBe('exp-1');
      expect(session.getPending()?.relatedEvents).toEqual([]);
    });

    it('1.2 optimistic delete of an Expense with linked Cashback cascades and removes BOTH', () => {
      const expense = createExpense({ id: 'exp-cb', accountId: 'g', amount: 200_000, description: 'Online shopping' });
      const cashback = createCashback({ id: 'cb-1', relatedEventId: 'exp-cb', accountId: 'g', amount: 20_000 });
      const other = createIncome({ id: 'inc-other', amount: 1_000_000 });
      const initial = [expense, cashback, other];

      const session = new UndoDeleteSessionManager(initial);
      const remaining = session.delete('exp-cb');

      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('inc-other');
      expect(remaining.some((e) => e.id === 'exp-cb')).toBe(false);
      expect(remaining.some((e) => e.id === 'cb-1')).toBe(false);
      expect(session.getPending()?.relatedEvents.map((e) => e.id)).toEqual(['cb-1']);
    });

    it('1.3 optimistic delete of an Expense with multiple linked Refunds cascades and removes ALL', () => {
      const expense = createExpense({ id: 'exp-ref', accountId: 'g', amount: 500_000, description: 'Apparel' });
      const refund1 = createRefund({ id: 'ref-1', relatedEventId: 'exp-ref', accountId: 'g', amount: 150_000 });
      const refund2 = createRefund({ id: 'ref-2', relatedEventId: 'exp-ref', accountId: 's', amount: 100_000 });
      const unaffected = createExpense({ id: 'exp-safe', amount: 50_000 });
      const initial = [expense, refund1, refund2, unaffected];

      const session = new UndoDeleteSessionManager(initial);
      const remaining = session.delete('exp-ref');

      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('exp-safe');
      expect(remaining.some((e) => e.id === 'ref-1')).toBe(false);
      expect(remaining.some((e) => e.id === 'ref-2')).toBe(false);
      expect(session.getPending()?.relatedEvents.map((e) => e.id)).toEqual(['ref-1', 'ref-2']);
    });

    it('1.4 optimistic delete of an Expense with BOTH Cashback and multiple Refunds cascades and removes all children', () => {
      const expense = createExpense({ id: 'exp-multi', accountId: 'g', amount: 800_000 });
      const cashback = createCashback({ id: 'cb-multi', relatedEventId: 'exp-multi', accountId: 'g', amount: 50_000 });
      const refund1 = createRefund({ id: 'ref-m1', relatedEventId: 'exp-multi', accountId: 'g', amount: 200_000 });
      const refund2 = createRefund({ id: 'ref-m2', relatedEventId: 'exp-multi', accountId: 'b', amount: 150_000 });
      const sentinel = createIncome({ id: 'inc-sentinel' });
      const initial = [expense, cashback, refund1, refund2, sentinel];

      const session = new UndoDeleteSessionManager(initial);
      const remaining = session.delete('exp-multi');

      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('inc-sentinel');
      expect(session.getPending()?.relatedEvents).toHaveLength(3);
      expect(session.getPending()?.relatedEvents.map((e) => e.id).sort()).toEqual(['cb-multi', 'ref-m1', 'ref-m2'].sort());
    });

    it('1.5 optimistic delete of an Income removes only that Income and leaves unrelated events unaffected', () => {
      const inc1 = createIncome({ id: 'inc-1', amount: 3_000_000 });
      const inc2 = createIncome({ id: 'inc-2', amount: 2_000_000 });
      const exp1 = createExpense({ id: 'exp-1', amount: 100_000 });
      const initial = [inc1, inc2, exp1];

      const session = new UndoDeleteSessionManager(initial);
      const remaining = session.delete('inc-1');

      expect(remaining).toHaveLength(2);
      expect(remaining.map((e) => e.id)).toEqual(['inc-2', 'exp-1']);
    });

    it('1.6 optimistic delete of a Transfer removes only that Transfer event', () => {
      const trf = createTransfer({ id: 'trf-1', sourceAccountId: 'g', destinationAccountId: 's', amount: 250_000, adminFee: 2_500 });
      const inc = createIncome({ id: 'inc-1' });
      const initial = [trf, inc];

      const session = new UndoDeleteSessionManager(initial);
      const remaining = session.delete('trf-1');

      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('inc-1');
    });

    it('1.7 optimistic delete of a Cashback child event directly leaves the parent Expense intact', () => {
      const expense = createExpense({ id: 'exp-parent', accountId: 'g', amount: 300_000 });
      const cashback = createCashback({ id: 'cb-child', relatedEventId: 'exp-parent', accountId: 'g', amount: 30_000 });
      const initial = [expense, cashback];

      const session = new UndoDeleteSessionManager(initial);
      const remaining = session.delete('cb-child');

      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('exp-parent');
      expect(session.getPending()?.event.id).toBe('cb-child');
      expect(session.getPending()?.relatedEvents).toEqual([]);
    });

    it('1.8 optimistic delete of a Refund child event directly leaves parent Expense and sibling Refunds intact', () => {
      const expense = createExpense({ id: 'exp-parent', accountId: 'g', amount: 400_000 });
      const ref1 = createRefund({ id: 'ref-target', relatedEventId: 'exp-parent', accountId: 'g', amount: 100_000 });
      const ref2 = createRefund({ id: 'ref-sibling', relatedEventId: 'exp-parent', accountId: 'g', amount: 50_000 });
      const initial = [expense, ref1, ref2];

      const session = new UndoDeleteSessionManager(initial);
      const remaining = session.delete('ref-target');

      expect(remaining).toHaveLength(2);
      expect(remaining.map((e) => e.id)).toEqual(['exp-parent', 'ref-sibling']);
    });

    it('1.9 deleting a non-existent ID leaves active events state completely unchanged', () => {
      const inc = createIncome({ id: 'inc-exist' });
      const initial = [inc];

      const session = new UndoDeleteSessionManager(initial);
      const remaining = session.delete('non-existent-id');

      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('inc-exist');
      expect(session.getPending()).toBeNull();
    });
  });

  // =========================================================================
  // INVARIANT 2: Undo restores exact previous state without data loss
  // =========================================================================
  describe('Invariant 2: Clicking "Undo" restores exact previous state without data loss', () => {
    it('2.1 restoring state after optimistic delete restores exact array and ordering', () => {
      const e1 = createIncome({ id: 'e1', date: '2026-10-01', amount: 100_000 });
      const e2 = createExpense({ id: 'e2', date: '2026-10-02', amount: 50_000 });
      const e3 = createTransfer({ id: 'e3', date: '2026-10-03', amount: 25_000 });
      const initial = [e1, e2, e3];

      const session = new UndoDeleteSessionManager(initial);
      session.delete('e2');
      expect(session.getEvents().map((e) => e.id)).toEqual(['e1', 'e3']);

      const restored = session.undo();
      expect(restored).not.toBeNull();
      expect(restored).toEqual(initial);
      expect(restored!.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
      expect(readFinancialEvents()).toEqual(initial);
    });

    it('2.2 restoring an Expense with linked Cashback and Refunds preserves all IDs, dates, descriptions, categories, accounts, and relationships', () => {
      const expense = createExpense({
        id: 'exp-detailed',
        date: '2026-10-05',
        description: 'Electronic gadget purchase',
        amount: 1_250_000,
        accountId: 'b',
        category: 'Personal Care',
      });
      const cashback = createCashback({
        id: 'cb-detailed',
        date: '2026-10-05',
        description: 'Cashback B',
        amount: 75_000,
        accountId: 'b',
        category: 'Cashback',
        relatedEventId: 'exp-detailed',
      });
      const refund = createRefund({
        id: 'ref-detailed',
        date: '2026-10-07',
        description: 'Refund for accessory returned',
        amount: 200_000,
        accountId: 's',
        relatedEventId: 'exp-detailed',
      });
      const other = createIncome({ id: 'inc-steady', amount: 5_000_000 });
      const initial = [expense, cashback, refund, other];

      const session = new UndoDeleteSessionManager(initial);
      session.delete('exp-detailed');
      expect(session.getEvents()).toEqual([other]);

      const restored = session.undo();
      expect(restored).toEqual(initial);

      const restoredExp = restored!.find((e): e is ExpenseEvent => e.id === 'exp-detailed')!;
      expect(restoredExp.id).toBe('exp-detailed');
      expect(restoredExp.date).toBe('2026-10-05');
      expect(restoredExp.description).toBe('Electronic gadget purchase');
      expect(restoredExp.amount).toBe(1_250_000);
      expect(restoredExp.accountId).toBe('b');
      expect(restoredExp.category).toBe('Personal Care');

      const restoredCb = restored!.find((e): e is IncomeEvent => e.id === 'cb-detailed')!;
      expect(restoredCb.relatedEventId).toBe('exp-detailed');
      expect(restoredCb.accountId).toBe('b');
      expect(restoredCb.amount).toBe(75_000);
      expect(restoredCb.category).toBe('Cashback');

      const restoredRef = restored!.find((e): e is RefundEvent => e.id === 'ref-detailed')!;
      expect(restoredRef.relatedEventId).toBe('exp-detailed');
      expect(restoredRef.accountId).toBe('s');
      expect(restoredRef.amount).toBe(200_000);
    });

    it('2.3 restoring a Transfer event preserves sourceAccountId, destinationAccountId, amount, and adminFee', () => {
      const transfer = createTransfer({
        id: 'trf-specific',
        date: '2026-10-08',
        description: 'Wallet top-up',
        amount: 300_000,
        sourceAccountId: 'b',
        destinationAccountId: 'g',
        adminFee: 1_500,
      });
      const initial = [transfer];

      const session = new UndoDeleteSessionManager(initial);
      session.delete('trf-specific');
      expect(session.getEvents()).toHaveLength(0);

      const restored = session.undo();
      expect(restored).toEqual(initial);
      const restoredTrf = restored![0] as TransferEvent;
      expect(restoredTrf.sourceAccountId).toBe('b');
      expect(restoredTrf.destinationAccountId).toBe('g');
      expect(restoredTrf.amount).toBe(300_000);
      expect(restoredTrf.adminFee).toBe(1_500);
    });

    it('2.4 restoring a child event directly restores it without modifying the parent event', () => {
      const parent = createExpense({ id: 'exp-p', amount: 500_000 });
      const refund = createRefund({ id: 'ref-c', relatedEventId: 'exp-p', amount: 100_000 });
      const initial = [parent, refund];

      const session = new UndoDeleteSessionManager(initial);
      session.delete('ref-c');
      expect(session.getEvents()).toEqual([parent]);

      const restored = session.undo();
      expect(restored).toEqual(initial);
      expect(restored![0]).toEqual(parent);
      expect(restored![1]).toEqual(refund);
    });

    it('2.5 calling undo when no deletion is pending safely returns null and does not corrupt state', () => {
      const initial = [createIncome({ id: 'inc-1' })];
      const session = new UndoDeleteSessionManager(initial);

      const result = session.undo();
      expect(result).toBeNull();
      expect(session.getEvents()).toEqual(initial);
    });
  });

  // =========================================================================
  // INVARIANT 3: Deterministic Financial Metrics Restoration
  // =========================================================================
  describe('Invariant 3: Starting balances, net cashflow, and liquid totals restored deterministically', () => {
    it('3.1 individual account balances return 100% identically to pre-delete values upon undo', () => {
      const initial: FinancialEvent[] = [
        createIncome({ id: 'inc-g', accountId: 'g', amount: 1_000_000 }),
        createExpense({ id: 'exp-g', accountId: 'g', amount: 300_000 }),
        createIncome({ id: 'inc-b', accountId: 'b', amount: 2_500_000 }),
        createTransfer({ id: 'trf-1', sourceAccountId: 'b', destinationAccountId: 's', amount: 500_000, adminFee: 2_500 }),
      ];

      const beforeBalances = getAccountBalances(initial);
      expect(beforeBalances['g']).toBe(700_000);
      expect(beforeBalances['b']).toBe(1_997_500);
      expect(beforeBalances['s']).toBe(500_000);

      const session = new UndoDeleteSessionManager(initial);
      // Optimistically delete exp-g (300k)
      const afterDelete = session.delete('exp-g');
      const duringBalances = getAccountBalances(afterDelete);
      expect(duringBalances['g']).toBe(1_000_000); // 300k expense temporarily gone

      // Click Undo
      const restored = session.undo()!;
      const restoredBalances = getAccountBalances(restored);
      expect(restoredBalances).toEqual(beforeBalances);
      expect(restoredBalances['g']).toBe(700_000);
      expect(restoredBalances['b']).toBe(1_997_500);
      expect(restoredBalances['s']).toBe(500_000);
    });

    it('3.2 liquid balance, investment balance, and net worth restore deterministically upon undo', () => {
      const initial: FinancialEvent[] = [
        createIncome({ id: 'inc-liquid', accountId: 'g', amount: 1_000_000 }), // Liquid
        createExpense({ id: 'exp-liquid', accountId: 's', amount: 200_000 }), // Liquid
        createIncome({ id: 'inc-inv', accountId: 'sb', amount: 5_000_000 }),  // Investment (Bibit)
      ];

      const beforeLiquid = getLiquidBalance(initial);
      const beforeInvest = getInvestmentBalance(initial);
      const beforeNetWorth = getNetWorth(initial);

      expect(beforeLiquid).toBe(800_000);
      expect(beforeInvest).toBe(5_000_000);
      expect(beforeNetWorth).toBe(5_800_000);

      const session = new UndoDeleteSessionManager(initial);
      // Optimistically delete liquid income
      session.delete('inc-liquid');
      expect(getLiquidBalance(session.getEvents())).toBe(-200_000);
      expect(getNetWorth(session.getEvents())).toBe(4_800_000);

      // Undo
      const restored = session.undo()!;
      expect(getLiquidBalance(restored)).toBe(beforeLiquid);
      expect(getInvestmentBalance(restored)).toBe(beforeInvest);
      expect(getNetWorth(restored)).toBe(beforeNetWorth);
    });

    it('3.3 monthly cashflow, savings rate, and category totals restore deterministically upon undo', () => {
      const monthDate = '2026-10-10';
      const initial: FinancialEvent[] = [
        createIncome({ id: 'inc-1', date: monthDate, amount: 10_000_000, category: 'Salary' }),
        createExpense({ id: 'exp-food', date: monthDate, amount: 1_500_000, category: 'Food & Drinks' }),
        createExpense({ id: 'exp-transport', date: monthDate, amount: 500_000, category: 'Transportation' }),
      ];

      const beforeStats = calculateFinanceStats(initial, monthDate);
      expect(beforeStats.monthlyIncome).toBe(10_000_000);
      expect(beforeStats.monthlyExpense).toBe(2_000_000);
      expect(beforeStats.netCashflow).toBe(8_000_000);
      expect(beforeStats.savingsRate).toBe(80);
      expect(beforeStats.categoryTotals['Food & Drinks']).toBe(1_500_000);
      expect(beforeStats.categoryTotals['Transportation']).toBe(500_000);

      const session = new UndoDeleteSessionManager(initial);
      // Delete food expense
      session.delete('exp-food');
      const duringStats = calculateFinanceStats(session.getEvents(), monthDate);
      expect(duringStats.monthlyExpense).toBe(500_000);
      expect(duringStats.netCashflow).toBe(9_500_000);
      expect(duringStats.categoryTotals['Food & Drinks']).toBe(0);

      // Undo
      const restored = session.undo()!;
      const restoredStats = calculateFinanceStats(restored, monthDate);
      expect(restoredStats).toEqual(beforeStats);
    });

    it('3.4 starting balance / initial balance events restore deterministically with 0 discrepancy upon undo', () => {
      const seedEvents = createInitialBalanceEvents(); // 17 accounts * 50,000 = 850,000
      const targetInitialEvent = seedEvents[0] as IncomeEvent; // initial-balance-bca (b)
      const session = new UndoDeleteSessionManager(seedEvents);

      const beforeBalances = getAccountBalances(seedEvents);
      const beforeLiquid = getLiquidBalance(seedEvents);

      // Optimistically delete one of the initial balances
      session.delete(targetInitialEvent.id);
      expect(getAccountBalances(session.getEvents())[targetInitialEvent.accountId as 'b']).toBe(0);
      expect(getLiquidBalance(session.getEvents())).toBe(beforeLiquid - targetInitialEvent.amount);

      // Undo restoration
      const restored = session.undo()!;
      expect(getAccountBalances(restored)).toEqual(beforeBalances);
      expect(getLiquidBalance(restored)).toBe(beforeLiquid);
    });

    it('3.5 Expense with linked Cashback and partial Refund restores net expense and account balances without discrepancy', () => {
      const date = '2026-10-15';
      // Expense 600,000 on GoPay
      const expense = createExpense({ id: 'exp-combo', date, accountId: 'g', amount: 600_000, category: 'Food & Drinks' });
      // Cashback 60,000 to GoPay
      const cashback = createCashback({ id: 'cb-combo', date, accountId: 'g', amount: 60_000, relatedEventId: 'exp-combo' });
      // Refund 150,000 to ShopeePay
      const refund = createRefund({ id: 'ref-combo', date, accountId: 's', amount: 150_000, relatedEventId: 'exp-combo' });
      const initial = [expense, cashback, refund];

      const beforeStats = calculateFinanceStats(initial, date);
      const beforeBalances = getAccountBalances(initial);

      // Net expense calculation: 600,000 - 150,000 (refund offset) = 450,000
      expect(beforeStats.monthlyExpense).toBe(450_000);
      // Cashback is income: 60,000
      expect(beforeStats.monthlyIncome).toBe(60_000);
      // GoPay balance: -600k + 60k = -540k
      expect(beforeBalances['g']).toBe(-540_000);
      // ShopeePay balance: +150k
      expect(beforeBalances['s']).toBe(150_000);

      const session = new UndoDeleteSessionManager(initial);
      // Optimistic delete parent expense
      session.delete('exp-combo');
      expect(session.getEvents()).toHaveLength(0);
      expect(getAccountBalances(session.getEvents())['g']).toBe(0);
      expect(getAccountBalances(session.getEvents())['s']).toBe(0);

      // Undo
      const restored = session.undo()!;
      expect(calculateFinanceStats(restored, date)).toEqual(beforeStats);
      expect(getAccountBalances(restored)).toEqual(beforeBalances);
    });
  });

  // =========================================================================
  // INVARIANT 4: Timer expiration commits permanent delete via deleteFinancialEventWithSync
  // =========================================================================
  describe('Invariant 4: Timer expiration permanently commits deletion and queues tombstones', () => {
    it('4.1 if undo timer expires, permanent deletion is committed with deleteFinancialEventWithSync', async () => {
      vi.useFakeTimers();

      const exp = createExpense({ id: 'exp-perm', amount: 200_000 });
      const inc = createIncome({ id: 'inc-perm', amount: 500_000 });
      const initial = [exp, inc];

      const session = new UndoDeleteSessionManager(initial, 4000);
      session.delete('exp-perm');
      expect(session.getPending()).not.toBeNull();
      expect(getPendingDeletedIds()).toEqual([]); // Not tombstoned yet during undo window!

      // Advance timer past duration
      vi.advanceTimersByTime(4000);

      // Pending state is cleared
      expect(session.getPending()).toBeNull();

      // Permanent deletion committed: tombstone is recorded in pending deletions queue
      expect(getPendingDeletedIds()).toContain('exp-perm');

      // Persistence storage only retains remaining events
      const stored = readFinancialEvents();
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('inc-perm');
    });

    it('4.2 timer expiration on Expense with cascading children queues tombstones for parent AND all children', async () => {
      vi.useFakeTimers();

      const expense = createExpense({ id: 'exp-root', amount: 400_000 });
      const cashback = createCashback({ id: 'cb-leaf', relatedEventId: 'exp-root', amount: 40_000 });
      const refund = createRefund({ id: 'ref-leaf', relatedEventId: 'exp-root', amount: 100_000 });
      const initial = [expense, cashback, refund];

      const session = new UndoDeleteSessionManager(initial, 4000);
      session.delete('exp-root');

      // Still in undo window -> zero tombstones queued
      expect(getPendingDeletedIds()).toEqual([]);

      // Timer expires
      vi.advanceTimersByTime(4000);

      // Tombstones for exp-root, cb-leaf, and ref-leaf are ALL queued
      const pendingTombstones = getPendingDeletedIds();
      expect(pendingTombstones).toContain('exp-root');
      expect(pendingTombstones).toContain('cb-leaf');
      expect(pendingTombstones).toContain('ref-leaf');
      expect(readFinancialEvents()).toHaveLength(0);
    });

    it('4.3 once timer expires and deletion is committed, calling undo is a no-op', async () => {
      vi.useFakeTimers();

      const expense = createExpense({ id: 'exp-unrecoverable', amount: 100_000 });
      const session = new UndoDeleteSessionManager([expense], 4000);
      session.delete('exp-unrecoverable');

      vi.advanceTimersByTime(4000); // Expiration

      const undoResult = session.undo();
      expect(undoResult).toBeNull();
      expect(session.getEvents()).toHaveLength(0);
      expect(readFinancialEvents()).toHaveLength(0);
      expect(getPendingDeletedIds()).toContain('exp-unrecoverable');
    });

    it('4.4 explicit commit (e.g. user dismisses toast) immediately commits deletion without waiting for timer', () => {
      vi.useFakeTimers();

      const inc = createIncome({ id: 'inc-dismiss', amount: 300_000 });
      const session = new UndoDeleteSessionManager([inc], 4000);
      session.delete('inc-dismiss');

      // Explicitly commit (dismiss clicked)
      session.commit();

      expect(session.getPending()).toBeNull();
      expect(getPendingDeletedIds()).toContain('inc-dismiss');
      expect(readFinancialEvents()).toHaveLength(0);
    });
  });

  // =========================================================================
  // INVARIANT 5: Consecutive delete behavior
  // =========================================================================
  describe('Invariant 5: Consecutive delete flushes transaction A before transaction B enters undo window', () => {
    it('5.1 deleting transaction B while transaction A is in undo window commits A immediately', () => {
      vi.useFakeTimers();

      const txA = createIncome({ id: 'tx-A', amount: 1_000_000, description: 'Income A' });
      const txB = createExpense({ id: 'tx-B', amount: 200_000, description: 'Expense B' });
      const txC = createIncome({ id: 'tx-C', amount: 500_000, description: 'Income C' });
      const initial = [txA, txB, txC];

      const session = new UndoDeleteSessionManager(initial, 4000);

      // Step 1: Delete Transaction A
      session.delete('tx-A');
      expect(session.getPending()?.event.id).toBe('tx-A');
      expect(session.getEvents().map((e) => e.id)).toEqual(['tx-B', 'tx-C']);
      expect(getPendingDeletedIds()).not.toContain('tx-A'); // A is still in undo window!

      // Step 2: Before 4000ms passes, user deletes Transaction B!
      vi.advanceTimersByTime(1500); // 1.5s elapsed
      session.delete('tx-B');

      // Invariant: Transaction A must be permanently committed BEFORE B enters undo window!
      expect(getPendingDeletedIds()).toContain('tx-A'); // A tombstone committed!
      expect(getPendingDeletedIds()).not.toContain('tx-B'); // B is now the active pending delete!
      expect(session.getPending()?.event.id).toBe('tx-B');
      expect(session.getEvents().map((e) => e.id)).toEqual(['tx-C']);
    });

    it('5.2 clicking "Undo" after consecutive delete restores ONLY transaction B, leaving A permanently deleted', () => {
      vi.useFakeTimers();

      const txA = createIncome({ id: 'tx-A', amount: 1_000_000 });
      const txB = createExpense({ id: 'tx-B', amount: 200_000 });
      const txC = createIncome({ id: 'tx-C', amount: 500_000 });
      const initial = [txA, txB, txC];

      const session = new UndoDeleteSessionManager(initial, 4000);

      session.delete('tx-A');
      vi.advanceTimersByTime(1000);
      session.delete('tx-B'); // Commits A, B enters window

      // User clicks Undo!
      const restored = session.undo()!;

      // Invariant: ONLY B is restored! A was committed and remains deleted!
      expect(restored.map((e) => e.id)).toEqual(['tx-B', 'tx-C']);
      expect(restored.some((e) => e.id === 'tx-A')).toBe(false);
      expect(getPendingDeletedIds()).toContain('tx-A');
      expect(getPendingDeletedIds()).not.toContain('tx-B');
    });

    it('5.3 consecutive delete where transaction A has cascading children commits all children of A before B enters window', () => {
      vi.useFakeTimers();

      const expA = createExpense({ id: 'exp-A', amount: 500_000 });
      const cbA = createCashback({ id: 'cb-A', relatedEventId: 'exp-A', amount: 50_000 });
      const refA = createRefund({ id: 'ref-A', relatedEventId: 'exp-A', amount: 150_000 });
      const txB = createTransfer({ id: 'trf-B', amount: 300_000 });
      const txC = createIncome({ id: 'inc-C', amount: 2_000_000 });
      const initial = [expA, cbA, refA, txB, txC];

      const session = new UndoDeleteSessionManager(initial, 4000);

      // Delete Expense A (and cascading cbA, refA)
      session.delete('exp-A');
      expect(session.getEvents().map((e) => e.id)).toEqual(['trf-B', 'inc-C']);
      expect(getPendingDeletedIds()).toEqual([]);

      // Delete Transfer B before A's timer expires
      vi.advanceTimersByTime(2000);
      session.delete('trf-B');

      // A and ALL its cascading children must be committed to tombstones!
      const tombstones = getPendingDeletedIds();
      expect(tombstones).toContain('exp-A');
      expect(tombstones).toContain('cb-A');
      expect(tombstones).toContain('ref-A');
      expect(tombstones).not.toContain('trf-B');

      // Undo B
      const restored = session.undo()!;
      expect(restored.map((e) => e.id)).toEqual(['trf-B', 'inc-C']);
      expect(tombstones).toContain('exp-A');
    });

    it('5.4 if consecutive delete sequence completes and transaction B timer expires, both A and B are permanently committed', () => {
      vi.useFakeTimers();

      const txA = createIncome({ id: 'tx-A', amount: 100_000 });
      const txB = createExpense({ id: 'tx-B', amount: 50_000 });
      const txC = createIncome({ id: 'tx-C', amount: 20_000 });
      const initial = [txA, txB, txC];

      const session = new UndoDeleteSessionManager(initial, 4000);

      session.delete('tx-A');
      vi.advanceTimersByTime(1000);
      session.delete('tx-B'); // Commits A

      // Now let B's timer expire as well
      vi.advanceTimersByTime(4000);

      expect(session.getPending()).toBeNull();
      expect(getPendingDeletedIds()).toContain('tx-A');
      expect(getPendingDeletedIds()).toContain('tx-B');
      expect(session.getEvents().map((e) => e.id)).toEqual(['tx-C']);
      expect(readFinancialEvents().map((e) => e.id)).toEqual(['tx-C']);
    });
  });
});
