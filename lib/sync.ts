import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import {
  validateFinancialEvents,
  writeFinancialEvents,
  readFinancialEvents,
} from './finance';
import type {
  FinancialEvent,
  IncomeEvent,
  ExpenseEvent,
  TransferEvent,
  RefundEvent,
  AccountId,
  ExpenseCategory,
  IncomeCategory,
} from './types';
import { isAccountId } from './accounts';
import { isExpenseCategory, isIncomeCategory } from './finance';

export const PENDING_DELETIONS_KEY = 'thelife-pending-deleted-ids';
export const PENDING_UPSERTS_KEY = 'thelife-pending-upsert-ids';
export const LAST_SYNCED_KEY = 'thelife-last-synced-at';
export const SYNC_STATUS_EVENT = 'thelife-sync-status-change';

export const getStorage = (): Storage | null => {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
};

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'unconfigured';

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  errorMessage: string | null;
}

export interface FinancialEventDbRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer' | 'refund';
  category: string | null;
  account_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  admin_fee: number | null;
  related_event_id: string | null;
  within_day_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  user_id: string;
}

/**
 * Maps a domain FinancialEvent to a database row.
 */
export const eventToDbRow = (
  event: FinancialEvent,
  withinDayOrder = 0,
  updatedAt: string = new Date().toISOString()
): FinancialEventDbRow => {
  const base = {
    id: event.id,
    date: event.date,
    description: event.description || '',
    amount: event.amount,
    type: event.type,
    within_day_order: withinDayOrder,
    created_at: updatedAt,
    updated_at: updatedAt,
    deleted_at: null,
    user_id: 'single-user',
  };

  switch (event.type) {
    case 'income':
      return {
        ...base,
        category: event.category,
        account_id: event.accountId,
        source_account_id: null,
        destination_account_id: null,
        admin_fee: null,
        related_event_id: event.relatedEventId || null,
      };
    case 'expense':
      return {
        ...base,
        category: event.category,
        account_id: event.accountId,
        source_account_id: null,
        destination_account_id: null,
        admin_fee: null,
        related_event_id: null,
      };
    case 'transfer':
      return {
        ...base,
        category: null,
        account_id: null,
        source_account_id: event.sourceAccountId,
        destination_account_id: event.destinationAccountId,
        admin_fee: event.adminFee && event.adminFee > 0 ? event.adminFee : null,
        related_event_id: null,
      };
    case 'refund':
      return {
        ...base,
        category: null,
        account_id: event.accountId,
        source_account_id: null,
        destination_account_id: null,
        admin_fee: null,
        related_event_id: event.relatedEventId,
      };
  }
};

/**
 * Defensive deserializer from database row to domain FinancialEvent.
 * Returns null if the row violates domain schema.
 */
export const dbRowToEvent = (row: FinancialEventDbRow): FinancialEvent | null => {
  if (!row || typeof row !== 'object') return null;
  if (!row.id || typeof row.id !== 'string') return null;
  if (!row.date || typeof row.date !== 'string') return null;
  if (typeof row.amount !== 'number' || !Number.isSafeInteger(row.amount) || row.amount <= 0) return null;

  const base = {
    id: row.id,
    date: row.date,
    description: typeof row.description === 'string' ? row.description : '',
    amount: row.amount,
  };

  if (row.type === 'income') {
    if (!row.account_id || !isAccountId(row.account_id)) return null;
    if (!row.category || !isIncomeCategory(row.category)) return null;
    const event: IncomeEvent = {
      ...base,
      type: 'income',
      accountId: row.account_id as AccountId,
      category: row.category as IncomeCategory,
    };
    if (row.related_event_id && typeof row.related_event_id === 'string') {
      event.relatedEventId = row.related_event_id;
    }
    return event;
  }

  if (row.type === 'expense') {
    if (!row.account_id || !isAccountId(row.account_id)) return null;
    if (!row.category || !isExpenseCategory(row.category)) return null;
    const event: ExpenseEvent = {
      ...base,
      type: 'expense',
      accountId: row.account_id as AccountId,
      category: row.category as ExpenseCategory,
    };
    return event;
  }

  if (row.type === 'transfer') {
    if (!row.source_account_id || !isAccountId(row.source_account_id)) return null;
    if (!row.destination_account_id || !isAccountId(row.destination_account_id)) return null;
    if (row.source_account_id === row.destination_account_id) return null;
    const event: TransferEvent = {
      ...base,
      type: 'transfer',
      sourceAccountId: row.source_account_id as AccountId,
      destinationAccountId: row.destination_account_id as AccountId,
    };
    if (typeof row.admin_fee === 'number' && Number.isSafeInteger(row.admin_fee) && row.admin_fee > 0) {
      event.adminFee = row.admin_fee;
    }
    return event;
  }

  if (row.type === 'refund') {
    if (!row.account_id || !isAccountId(row.account_id)) return null;
    if (!row.related_event_id || typeof row.related_event_id !== 'string') return null;
    const event: RefundEvent = {
      ...base,
      type: 'refund',
      accountId: row.account_id as AccountId,
      relatedEventId: row.related_event_id,
    };
    return event;
  }

  return null;
};

/**
 * Pure equality check between two domain FinancialEvents.
 */
export const areEventsEqual = (a: FinancialEvent, b: FinancialEvent): boolean => {
  if (
    a.id !== b.id ||
    a.date !== b.date ||
    a.description !== b.description ||
    a.amount !== b.amount ||
    a.type !== b.type
  ) {
    return false;
  }
  if (a.type === 'income' && b.type === 'income') {
    return (
      a.accountId === b.accountId &&
      a.category === b.category &&
      (a.relatedEventId || null) === (b.relatedEventId || null)
    );
  }
  if (a.type === 'expense' && b.type === 'expense') {
    return a.accountId === b.accountId && a.category === b.category;
  }
  if (a.type === 'transfer' && b.type === 'transfer') {
    return (
      a.sourceAccountId === b.sourceAccountId &&
      a.destinationAccountId === b.destinationAccountId &&
      (a.adminFee || null) === (b.adminFee || null)
    );
  }
  if (a.type === 'refund' && b.type === 'refund') {
    return (
      a.accountId === b.accountId &&
      (a.relatedEventId || null) === (b.relatedEventId || null)
    );
  }
  return false;
};

/**
 * Computes deterministic within-day order index for each event in an array.
 * Higher index within the day = recorded later = rendered higher in Card View.
 */
export const computeWithinDayOrders = (events: FinancialEvent[]): Map<string, number> => {
  const dateCounters = new Map<string, number>();
  const orderMap = new Map<string, number>();
  for (const ev of events) {
    const current = dateCounters.get(ev.date) ?? 0;
    orderMap.set(ev.id, current);
    dateCounters.set(ev.date, current + 1);
  }
  return orderMap;
};

/**
 * Pure reconcile & merge algorithm.
 * Reconciles local events with cloud database rows using Last-Write-Wins and Tombstones.
 * Retains local edits and reorders when flagged in pendingUpsertIds.
 */
export const mergeLocalAndCloudEvents = (
  localEvents: FinancialEvent[],
  cloudRows: FinancialEventDbRow[],
  pendingUpsertIds?: string[]
): {
  mergedEvents: FinancialEvent[];
  rowsToUpsert: FinancialEventDbRow[];
} => {
  const effectivePendingUpsertIds = pendingUpsertIds !== undefined ? pendingUpsertIds : getPendingUpsertIds();
  const pendingUpsertSet = new Set<string>(effectivePendingUpsertIds);

  const localEventMap = new Map<string, FinancialEvent>(localEvents.map((e) => [e.id, e]));
  const cloudRowMap = new Map<string, FinancialEventDbRow>(cloudRows.map((r) => [r.id, r]));
  const localOrderMap = computeWithinDayOrders(localEvents);

  const rowsToUpsert: FinancialEventDbRow[] = [];
  const candidateEventsMap = new Map<string, { event: FinancialEvent; order: number }>();

  // 1. Process cloud rows
  const nonDeletedCloudIds = new Set<string>(
    cloudRows.filter((r) => !r.deleted_at).map((r) => r.id)
  );

  for (const row of cloudRows) {
    // If tombstoned (soft-deleted), ensure it's removed from local
    if (row.deleted_at) {
      localEventMap.delete(row.id);
      continue;
    }

    // Guard against orphaned related events in cloud (parent was deleted/tombstoned)
    if (row.related_event_id && !nonDeletedCloudIds.has(row.related_event_id)) {
      continue;
    }

    const cloudEvent = dbRowToEvent(row);
    if (!cloudEvent) continue;

    const localMatch = localEventMap.get(row.id);
    if (!localMatch) {
      // New event from cloud (e.g. created on another device)
      candidateEventsMap.set(row.id, { event: cloudEvent, order: row.within_day_order || 0 });
    } else {
      // Exists in both local and cloud
      if (pendingUpsertSet.has(row.id)) {
        // Local has pending mutations (edited or reordered) -> local wins and gets queued for cloud upsert
        const localOrder = localOrderMap.get(localMatch.id) ?? 0;
        candidateEventsMap.set(row.id, { event: localMatch, order: localOrder });
        rowsToUpsert.push(eventToDbRow(localMatch, localOrder));
      } else {
        // No pending mutation: if identical, preserve cloud order; otherwise cloud is authoritative
        if (areEventsEqual(localMatch, cloudEvent)) {
          candidateEventsMap.set(row.id, {
            event: cloudEvent,
            order: typeof row.within_day_order === 'number' ? row.within_day_order : (localOrderMap.get(localMatch.id) ?? 0),
          });
        } else {
          candidateEventsMap.set(row.id, { event: cloudEvent, order: row.within_day_order || 0 });
        }
      }
    }
  }

  // 2. Process local events not yet in cloud
  for (const localEvt of localEvents) {
    if (!cloudRowMap.has(localEvt.id)) {
      const localOrder = localOrderMap.get(localEvt.id) ?? 0;
      candidateEventsMap.set(localEvt.id, { event: localEvt, order: localOrder });
      rowsToUpsert.push(eventToDbRow(localEvt, localOrder));
    }
  }

  // 3. Assemble and validate final merged list
  const mergedList = Array.from(candidateEventsMap.values())
    .sort((a, b) => {
      const dateCmp = b.event.date.localeCompare(a.event.date); // newest date first
      if (dateCmp !== 0) return dateCmp;
      return a.order - b.order;
    })
    .map((item) => item.event);

  if (validateFinancialEvents(mergedList)) {
    return { mergedEvents: mergedList, rowsToUpsert };
  }

  // Fallback: if validation fails, preserve safe local events
  return { mergedEvents: localEvents, rowsToUpsert: [] };
};

// Pending upserts queue helpers
export const getPendingUpsertIds = (): string[] => {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(PENDING_UPSERTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const queuePendingUpserts = (ids: string[]): void => {
  const storage = getStorage();
  if (!storage || ids.length === 0) return;
  try {
    const current = getPendingUpsertIds();
    const set = new Set([...current, ...ids]);
    storage.setItem(PENDING_UPSERTS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Safe fallback
  }
};

export const clearPendingUpserts = (idsToRemove: string[]): void => {
  const storage = getStorage();
  if (!storage || idsToRemove.length === 0) return;
  try {
    const current = getPendingUpsertIds();
    const remaining = current.filter((id) => !idsToRemove.includes(id));
    storage.setItem(PENDING_UPSERTS_KEY, JSON.stringify(remaining));
  } catch {
    // Safe fallback
  }
};

// Pending deletions queue helpers
export const getPendingDeletedIds = (): string[] => {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(PENDING_DELETIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const queuePendingDeletion = (id: string): void => {
  const storage = getStorage();
  if (!storage) return;
  try {
    const current = getPendingDeletedIds();
    if (!current.includes(id)) {
      current.push(id);
      storage.setItem(PENDING_DELETIONS_KEY, JSON.stringify(current));
    }
  } catch {
    // Safe fallback
  }
};

export const clearPendingDeletions = (idsToRemove: string[]): void => {
  const storage = getStorage();
  if (!storage) return;
  try {
    const current = getPendingDeletedIds();
    const remaining = current.filter((id) => !idsToRemove.includes(id));
    storage.setItem(PENDING_DELETIONS_KEY, JSON.stringify(remaining));
  } catch {
    // Safe fallback
  }
};

let currentSyncState: SyncState = {
  status: 'idle',
  lastSyncedAt: null,
  errorMessage: null,
};

export const getSyncState = (): SyncState => {
  const storage = getStorage();
  if (storage && !currentSyncState.lastSyncedAt) {
    currentSyncState.lastSyncedAt = storage.getItem(LAST_SYNCED_KEY);
  }
  if (!isSupabaseConfigured()) {
    return { ...currentSyncState, status: 'unconfigured' };
  }
  return { ...currentSyncState };
};

const notifySyncState = (state: Partial<SyncState>): void => {
  currentSyncState = { ...currentSyncState, ...state };
  const storage = getStorage();
  if (storage && state.lastSyncedAt) {
    storage.setItem(LAST_SYNCED_KEY, state.lastSyncedAt);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: currentSyncState }));
  }
};

/**
 * Main Cloud Synchronization Function.
 * Runs in the background and is resilient to network failures.
 */
export const syncWithCloud = async (
  currentEvents?: FinancialEvent[]
): Promise<{ success: boolean; events: FinancialEvent[]; error?: string }> => {
  if (!isSupabaseConfigured()) {
    notifySyncState({ status: 'unconfigured' });
    return { success: false, events: currentEvents || readFinancialEvents(), error: 'Supabase is not configured' };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    notifySyncState({ status: 'offline' });
    return { success: false, events: currentEvents || readFinancialEvents(), error: 'Network offline' };
  }

  const client = getSupabaseClient();
  if (!client) {
    notifySyncState({ status: 'unconfigured' });
    return { success: false, events: currentEvents || readFinancialEvents() };
  }

  notifySyncState({ status: 'syncing', errorMessage: null });

  try {
    const local = currentEvents || readFinancialEvents();

    // 1. Process pending deletions to mark tombstones in cloud
    const pendingDeletedIds = getPendingDeletedIds();
    if (pendingDeletedIds.length > 0) {
      const { error: delError } = await client
        .from('financial_events')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', pendingDeletedIds);

      if (!delError) {
        clearPendingDeletions(pendingDeletedIds);
      }
    }

    // 2. Fetch all cloud rows
    const { data: cloudData, error: fetchError } = await client
      .from('financial_events')
      .select('*')
      .order('date', { ascending: false });

    if (fetchError) {
      notifySyncState({ status: 'error', errorMessage: fetchError.message });
      return { success: false, events: local, error: fetchError.message };
    }

    const cloudRows = (cloudData || []) as FinancialEventDbRow[];

    // 3. Reconcile local and cloud events
    const pendingUpsertIds = getPendingUpsertIds();
    const { mergedEvents, rowsToUpsert } = mergeLocalAndCloudEvents(local, cloudRows, pendingUpsertIds);

    // 4. Push local changes/new records up to cloud
    if (rowsToUpsert.length > 0) {
      const { error: upsertError } = await client
        .from('financial_events')
        .upsert(rowsToUpsert, { onConflict: 'id' });

      if (upsertError) {
        notifySyncState({ status: 'error', errorMessage: upsertError.message });
        return { success: false, events: local, error: upsertError.message };
      }

      // Upsert successful: clear synced IDs from pending outbox
      clearPendingUpserts(rowsToUpsert.map((r) => r.id));
    }

    // 5. Update local persistence with the merged dataset
    writeFinancialEvents(mergedEvents);

    const nowIso = new Date().toISOString();
    notifySyncState({ status: 'synced', lastSyncedAt: nowIso, errorMessage: null });

    return { success: true, events: mergedEvents };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown sync failure';
    notifySyncState({ status: 'error', errorMessage: message });
    return { success: false, events: currentEvents || readFinancialEvents(), error: message };
  }
};

/**
 * Mark an event as deleted both locally and in the cloud.
 */
export const deleteFinancialEventWithSync = async (
  eventId: string,
  events: FinancialEvent[]
): Promise<FinancialEvent[]> => {
  // Queue deletion for tombstone sync for parent and all cascading children (cashback / refunds)
  const relatedIds = events
    .filter((e) => 'relatedEventId' in e && e.relatedEventId === eventId)
    .map((e) => e.id);

  queuePendingDeletion(eventId);
  for (const relId of relatedIds) {
    queuePendingDeletion(relId);
  }

  // Compute updated local state (including cascading deletion of refunds/cashbacks)
  const remaining = events.filter((e) => e.id !== eventId && ('relatedEventId' in e ? e.relatedEventId !== eventId : true));
  writeFinancialEvents(remaining);

  // Trigger cloud soft-delete immediately in background
  if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
    syncWithCloud(remaining).catch(() => {
      // Background retry on next sync cycle
    });
  }

  return remaining;
};
