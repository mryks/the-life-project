import { describe, it, expect, beforeEach } from 'vitest';
import {
  eventToDbRow,
  dbRowToEvent,
  mergeLocalAndCloudEvents,
  getPendingDeletedIds,
  queuePendingDeletion,
  clearPendingDeletions,
  getPendingUpsertIds,
  queuePendingUpserts,
  clearPendingUpserts,
  areEventsEqual,
  computeWithinDayOrders,
  getSyncState,
  type FinancialEventDbRow,
} from '../../lib/sync';
import type { IncomeEvent, ExpenseEvent, TransferEvent, RefundEvent } from '../../lib/types';

// Mock storage for Node test environment
class StorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

describe('Sync Engine & Supabase Data Mapper', () => {
  beforeEach(() => {
    const mockStorage = new StorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  describe('eventToDbRow & dbRowToEvent mapping', () => {
    it('correctly maps IncomeEvent back and forth', () => {
      const income: IncomeEvent = {
        id: 'inc-1',
        date: '2026-10-01',
        description: 'Monthly Salary',
        amount: 15000000,
        type: 'income',
        accountId: 'b',
        category: 'Salary',
      };

      const row = eventToDbRow(income, 0, '2026-10-01T08:00:00Z');
      expect(row.id).toBe('inc-1');
      expect(row.account_id).toBe('b');
      expect(row.category).toBe('Salary');
      expect(row.source_account_id).toBeNull();
      expect(row.destination_account_id).toBeNull();
      expect(row.deleted_at).toBeNull();

      const restored = dbRowToEvent(row);
      expect(restored).toEqual(income);
    });

    it('correctly maps ExpenseEvent back and forth', () => {
      const expense: ExpenseEvent = {
        id: 'exp-1',
        date: '2026-10-02',
        description: 'Groceries',
        amount: 350000,
        type: 'expense',
        accountId: 'g',
        category: 'Food & Drinks',
      };

      const row = eventToDbRow(expense, 1);
      expect(row.id).toBe('exp-1');
      expect(row.account_id).toBe('g');
      expect(row.category).toBe('Food & Drinks');

      const restored = dbRowToEvent(row);
      expect(restored).toEqual(expense);
    });

    it('correctly maps TransferEvent with adminFee back and forth', () => {
      const transfer: TransferEvent = {
        id: 'trf-1',
        date: '2026-10-03',
        description: 'Topup ShopeePay',
        amount: 200000,
        type: 'transfer',
        sourceAccountId: 'b',
        destinationAccountId: 's',
        adminFee: 2500,
      };

      const row = eventToDbRow(transfer, 2);
      expect(row.id).toBe('trf-1');
      expect(row.source_account_id).toBe('b');
      expect(row.destination_account_id).toBe('s');
      expect(row.admin_fee).toBe(2500);

      const restored = dbRowToEvent(row);
      expect(restored).toEqual(transfer);
    });

    it('correctly maps RefundEvent back and forth', () => {
      const refund: RefundEvent = {
        id: 'ref-1',
        date: '2026-10-04',
        description: 'Refund cancelled ride',
        amount: 45000,
        type: 'refund',
        accountId: 'g',
        relatedEventId: 'exp-ride-1',
      };

      const row = eventToDbRow(refund, 0);
      expect(row.id).toBe('ref-1');
      expect(row.account_id).toBe('g');
      expect(row.related_event_id).toBe('exp-ride-1');

      const restored = dbRowToEvent(row);
      expect(restored).toEqual(refund);
    });

    it('rejects malformed database rows safely without throwing', () => {
      const malformedRow = {
        id: 'bad-1',
        date: 'invalid-date',
        amount: -100, // Invalid negative
        type: 'expense',
      } as unknown as FinancialEventDbRow;

      expect(dbRowToEvent(malformedRow)).toBeNull();
    });
  });

  describe('mergeLocalAndCloudEvents algorithm', () => {
    it('merges new cloud events into local dataset and requests upload for local-only events', () => {
      const localEvent: ExpenseEvent = {
        id: 'local-1',
        date: '2026-10-05',
        description: 'Lunch on PC',
        amount: 50000,
        type: 'expense',
        accountId: 'c',
        category: 'Food & Drinks',
      };

      const cloudRow: FinancialEventDbRow = {
        id: 'mobile-1',
        date: '2026-10-05',
        description: 'Coffee on Mobile',
        amount: 28000,
        type: 'expense',
        category: 'Food & Drinks',
        account_id: 'g',
        source_account_id: null,
        destination_account_id: null,
        admin_fee: null,
        related_event_id: null,
        within_day_order: 1,
        created_at: '2026-10-05T09:00:00Z',
        updated_at: '2026-10-05T09:00:00Z',
        deleted_at: null,
        user_id: 'single-user',
      };

      const { mergedEvents, rowsToUpsert } = mergeLocalAndCloudEvents([localEvent], [cloudRow]);

      // Both events should be present in merged output
      expect(mergedEvents.length).toBe(2);
      expect(mergedEvents.some((e) => e.id === 'local-1')).toBe(true);
      expect(mergedEvents.some((e) => e.id === 'mobile-1')).toBe(true);

      // Local event was missing from cloud, so it must be queued for upsert
      expect(rowsToUpsert.length).toBe(1);
      expect(rowsToUpsert[0].id).toBe('local-1');
    });

    it('removes events that have a deleted_at tombstone in cloud', () => {
      const localEvent1: ExpenseEvent = {
        id: 'evt-to-keep',
        date: '2026-10-05',
        description: 'Dinner',
        amount: 80000,
        type: 'expense',
        accountId: 'c',
        category: 'Food & Drinks',
      };

      const localEvent2: ExpenseEvent = {
        id: 'evt-to-delete',
        date: '2026-10-05',
        description: 'Mistake expense',
        amount: 20000,
        type: 'expense',
        accountId: 'c',
        category: 'Other',
      };

      const cloudTombstoneRow: FinancialEventDbRow = {
        id: 'evt-to-delete',
        date: '2026-10-05',
        description: 'Mistake expense',
        amount: 20000,
        type: 'expense',
        category: 'Other',
        account_id: 'c',
        source_account_id: null,
        destination_account_id: null,
        admin_fee: null,
        related_event_id: null,
        within_day_order: 0,
        created_at: '2026-10-05T07:00:00Z',
        updated_at: '2026-10-05T07:10:00Z',
        deleted_at: '2026-10-05T07:10:00Z', // Tombstone!
        user_id: 'single-user',
      };

      const { mergedEvents } = mergeLocalAndCloudEvents(
        [localEvent1, localEvent2],
        [cloudTombstoneRow]
      );

      // evt-to-delete must be gone from mergedEvents
      expect(mergedEvents.length).toBe(1);
      expect(mergedEvents[0].id).toBe('evt-to-keep');
    });
  });

  describe('Pending deletions queue', () => {
    it('queues and clears pending deletion IDs', () => {
      expect(getPendingDeletedIds()).toEqual([]);

      queuePendingDeletion('del-1');
      queuePendingDeletion('del-2');
      queuePendingDeletion('del-1'); // Duplicate ignored
      expect(getPendingDeletedIds()).toEqual(['del-1', 'del-2']);

      clearPendingDeletions(['del-1']);
      expect(getPendingDeletedIds()).toEqual(['del-2']);

      clearPendingDeletions(['del-2']);
      expect(getPendingDeletedIds()).toEqual([]);
    });
  });

  describe('Pending upserts queue', () => {
    it('queues and clears pending upsert IDs', () => {
      expect(getPendingUpsertIds()).toEqual([]);

      queuePendingUpserts(['up-1', 'up-2']);
      queuePendingUpserts(['up-1']); // Duplicate ignored
      expect(getPendingUpsertIds()).toEqual(['up-1', 'up-2']);

      clearPendingUpserts(['up-1']);
      expect(getPendingUpsertIds()).toEqual(['up-2']);

      clearPendingUpserts(['up-2']);
      expect(getPendingUpsertIds()).toEqual([]);
    });
  });

  describe('Edit and Reorder reconciliation in mergeLocalAndCloudEvents', () => {
    it('persists edited local event when queued in pendingUpsertIds and includes it in rowsToUpsert', () => {
      const originalCloudRow: FinancialEventDbRow = {
        id: 'evt-edit-1',
        date: '2026-10-06',
        description: 'Original Lunch',
        amount: 45000,
        type: 'expense',
        category: 'Food & Drinks',
        account_id: 'g',
        source_account_id: null,
        destination_account_id: null,
        admin_fee: null,
        related_event_id: null,
        within_day_order: 0,
        created_at: '2026-10-06T12:00:00Z',
        updated_at: '2026-10-06T12:00:00Z',
        deleted_at: null,
        user_id: 'single-user',
      };

      const editedLocalEvent: ExpenseEvent = {
        id: 'evt-edit-1',
        date: '2026-10-06',
        description: 'Special Steak Lunch (Updated)',
        amount: 120000,
        type: 'expense',
        accountId: 'g',
        category: 'Food & Drinks',
      };

      // Flag this event as modified locally
      const { mergedEvents, rowsToUpsert } = mergeLocalAndCloudEvents(
        [editedLocalEvent],
        [originalCloudRow],
        ['evt-edit-1']
      );

      // Local edit must win!
      expect(mergedEvents.length).toBe(1);
      expect(mergedEvents[0].amount).toBe(120000);
      expect(mergedEvents[0].description).toBe('Special Steak Lunch (Updated)');

      // Must be queued for cloud upsert
      expect(rowsToUpsert.length).toBe(1);
      expect(rowsToUpsert[0].id).toBe('evt-edit-1');
      expect(rowsToUpsert[0].amount).toBe(120000);
    });

    it('persists within-day reorder when queued in pendingUpsertIds and preserves order across sync', () => {
      const rowA: FinancialEventDbRow = {
        id: 'evt-A',
        date: '2026-10-06',
        description: 'First Coffee',
        amount: 25000,
        type: 'expense',
        category: 'Food & Drinks',
        account_id: 'g',
        source_account_id: null,
        destination_account_id: null,
        admin_fee: null,
        related_event_id: null,
        within_day_order: 0,
        created_at: '2026-10-06T08:00:00Z',
        updated_at: '2026-10-06T08:00:00Z',
        deleted_at: null,
        user_id: 'single-user',
      };

      const rowB: FinancialEventDbRow = {
        id: 'evt-B',
        date: '2026-10-06',
        description: 'Second Coffee',
        amount: 30000,
        type: 'expense',
        category: 'Food & Drinks',
        account_id: 'g',
        source_account_id: null,
        destination_account_id: null,
        admin_fee: null,
        related_event_id: null,
        within_day_order: 1,
        created_at: '2026-10-06T09:00:00Z',
        updated_at: '2026-10-06T09:00:00Z',
        deleted_at: null,
        user_id: 'single-user',
      };

      const eventA = dbRowToEvent(rowA)!;
      const eventB = dbRowToEvent(rowB)!;

      // User reordered them locally: [eventB, eventA]
      const reorderedLocal = [eventB, eventA];

      // Both events queued for reorder update
      const { mergedEvents, rowsToUpsert } = mergeLocalAndCloudEvents(
        reorderedLocal,
        [rowA, rowB],
        ['evt-B', 'evt-A']
      );

      // Order must match local reorder: eventB (order 0), eventA (order 1)
      expect(mergedEvents.map((e) => e.id)).toEqual(['evt-B', 'evt-A']);

      // Both rows must be queued to update within_day_order in cloud
      expect(rowsToUpsert.length).toBe(2);
      const rowB_upsert = rowsToUpsert.find((r) => r.id === 'evt-B');
      const rowA_upsert = rowsToUpsert.find((r) => r.id === 'evt-A');
      expect(rowB_upsert?.within_day_order).toBe(0);
      expect(rowA_upsert?.within_day_order).toBe(1);
    });

    it('preserves cloud order on subsequent sync when pendingUpsertIds is cleared', () => {
      // Cloud now has the updated order from previous upsert
      const rowB_updated: FinancialEventDbRow = {
        id: 'evt-B',
        date: '2026-10-06',
        description: 'Second Coffee',
        amount: 30000,
        type: 'expense',
        category: 'Food & Drinks',
        account_id: 'g',
        source_account_id: null,
        destination_account_id: null,
        admin_fee: null,
        related_event_id: null,
        within_day_order: 0,
        created_at: '2026-10-06T09:00:00Z',
        updated_at: '2026-10-06T09:05:00Z',
        deleted_at: null,
        user_id: 'single-user',
      };

      const rowA_updated: FinancialEventDbRow = {
        id: 'evt-A',
        date: '2026-10-06',
        description: 'First Coffee',
        amount: 25000,
        type: 'expense',
        category: 'Food & Drinks',
        account_id: 'g',
        source_account_id: null,
        destination_account_id: null,
        admin_fee: null,
        related_event_id: null,
        within_day_order: 1,
        created_at: '2026-10-06T08:00:00Z',
        updated_at: '2026-10-06T09:05:00Z',
        deleted_at: null,
        user_id: 'single-user',
      };

      const eventB = dbRowToEvent(rowB_updated)!;
      const eventA = dbRowToEvent(rowA_updated)!;

      // On page refresh, local has [eventB, eventA], pendingUpsertIds is empty
      const { mergedEvents, rowsToUpsert } = mergeLocalAndCloudEvents(
        [eventB, eventA],
        [rowB_updated, rowA_updated],
        []
      );

      // The order remains [evt-B, evt-A] and does not revert!
      expect(mergedEvents.map((e) => e.id)).toEqual(['evt-B', 'evt-A']);
      expect(rowsToUpsert.length).toBe(0); // No unnecessary upserts
    });

    it('correctly compares events using areEventsEqual and calculates within-day orders', () => {
      const exp1: ExpenseEvent = {
        id: 'e-1',
        date: '2026-10-06',
        description: 'Snack',
        amount: 15000,
        type: 'expense',
        accountId: 'g',
        category: 'Food & Drinks',
      };
      const exp2: ExpenseEvent = { ...exp1, id: 'e-2', amount: 20000 };
      expect(areEventsEqual(exp1, exp1)).toBe(true);
      expect(areEventsEqual(exp1, exp2)).toBe(false);

      const orderMap = computeWithinDayOrders([exp1, exp2]);
      expect(orderMap.get('e-1')).toBe(0);
      expect(orderMap.get('e-2')).toBe(1);
      expect(orderMap.size).toBe(2);
    });
  });

  describe('Sync state reporting', () => {
    it('reports unconfigured status when Supabase environment variables are missing', () => {
      const state = getSyncState();
      expect(state.status).toBe('unconfigured');
    });
  });
});
