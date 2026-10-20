# Cloud Sync & Supabase

> Hub: [[00 - Atlas (Index)]] | Related: [[Domain & Financial Model]], [[Security & Master PIN]], [[Deployment & Vercel]]

---

## ☁️ Cloud Infrastructure Overview

- **Provider**: Supabase (PostgreSQL free tier).
- **Project URL**: `https://peydzblrtfgdoaisljkm.supabase.co`
- **Tables**:
  1. `financial_events`: Contains all income, expense, transfer, and refund records with soft-delete tombstones.
  2. `vault_security`: Universal single-user vault storage used for Master PIN salt/hash (`id: 'master-vault'`), Custom Accounts metadata (`id: 'vault-custom-accounts'`), and Custom Categories metadata (`id: 'vault-custom-categories'`).

---

## 📦 Cloud Metadata Storage Envelopes (`vault_security`)

To avoid schema migrations while guaranteeing multi-device sync for user-defined configuration:
- `vault-custom-accounts`: Stores JSON payload of user-created custom accounts (`id`, `name`, `fullName`, `group`, `colorClass`, `colorStyle`, `isCustom`).
- `vault-custom-accounts`: Stores JSON payload of user-created custom accounts with explicit deletion tombstones: `{ accounts: Account[], deletedIds: string[] }`.
- `vault-custom-categories`: Stores JSON payload of custom expense and income category arrays.
- **Tombstone-Safe Custom Accounts Sync**: When an account is deleted on Mobile, its ID is recorded in `deletedIds` in `vault-custom-accounts`. When PC syncs, it checks `tombstoneSet` and removes the account from local storage rather than resurrecting it. Furthermore, cloud accounts take precedence over stale local caches to guarantee color/name edits apply across devices.
- **Orphan Prevention & Poisoning Guard**: Supabase `financial_events` must not contain orphaned test events referencing deleted/unregistered account IDs, as schema validation would abort full batch merging. Test rows must be soft-deleted (`deleted_at = now()`).
- **Sync Order Invariant**: In `syncWithCloud`, custom accounts and categories are synchronized *before* processing transaction rows. This ensures that when incoming transactions referencing custom accounts (or categories) are deserialized, their account visual definitions are already loaded in memory and localStorage, preventing valid financial events from being dropped.
- **Defensive Deserialization**: `dbRowToEvent` uses `isAccountId(id) || isValidAccountIdFormat(id)` so transactions with valid account slugs are never discarded even if metadata sync is momentarily in flight.

---

## 📊 Database Schema (`financial_events`)

```sql
CREATE TABLE IF NOT EXISTS financial_events (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount BIGINT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'refund')),
  category TEXT,
  account_id TEXT,
  source_account_id TEXT,
  destination_account_id TEXT,
  admin_fee BIGINT,
  related_event_id TEXT,
  within_day_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ,
  user_id TEXT NOT NULL DEFAULT 'single-user'
);
```

---

## 🔄 Synchronization Lifecycle & Reconcile Algorithm

The synchronization engine in `lib/sync.ts` is designed for seamless, multi-device daily usage:

### 1. Proactive Multi-Device Triggers
Sync runs automatically without requiring manual user interaction:
- **On Mount**: Pulls latest cloud events immediately so fresh devices/incognito tabs populate transactions before the user even finishes unlocking.
- **On Visibility Change (`visibilitychange`)**: Fires whenever the user switches back from another app on their phone or switches browser tabs.
- **On Window Focus (`focus`)**: Re-synchronizes when the user returns to the browser window.
- **On Vault Unlock**: Triggers full synchronization when the Master PIN lockscreen is unlocked.
- **On Every Mutation**: Any create, edit, or delete action immediately queues cloud upsert/tombstone.

### 2. Concurrency Safety (`inFlightSync`)
To prevent duplicate overlapping HTTP requests when multiple events fire simultaneously (e.g. mount + focus), `syncWithCloud` maintains an in-flight promise cache. Subsequent calls await the active sync.

### 3. Conflict Resolution (Last-Write-Wins + Tombstones)
- **Soft Deletions**: Deletions are recorded in `thelife-pending-deleted-ids` and written to cloud with `deleted_at = now()`. Tombstoned events are stripped from local storage and not resurrected.
- **Offline Deletion Tombstone Shield**: In `mergeLocalAndCloudEvents`, the active `pendingDeletedIds` queue is checked *before* adding any non-deleted cloud rows. Even if an offline client or network hiccup delays writing the tombstone to Supabase, the deleted event is **never resurrected** on subsequent cloud fetches.
- **Within-Day Ordering**: Maintained via `within_day_order`, ensuring manual card reordering persists across devices.
- **Outbox Persistence**: Pending changes are queued in `localStorage` under `thelife-pending-upsert-ids` and retried automatically if the network is temporarily offline.

### 4. Direct Force Upload & Parity Soft-Delete (`forceUploadAllToCloud`)
- When transactions are present locally (e.g. entered while offline or restored from a JSON backup), `forceUploadAllToCloud()` directly pushes all active domain events to Supabase with `{ onConflict: 'id' }`.
- **Parity Soft-Delete**: Before upserting, it queries cloud records and automatically marks any cloud events *missing* from the local snapshot as `deleted_at = now()`. This prevents old ghost records from contaminating a freshly restored backup.
- Available in the Cloud Sync Modal as a manual action and triggered automatically upon JSON backup restore.

---

## 💾 Why LocalStorage + Database? (Local-First Paradigm)
1. **Instant App Launch (Zero Latency)**: Financial data loads immediately from local cache on mobile without waiting for round-trip network latency or database cold-starts.
2. **Offline Resilience**: Allows adding expenses even with poor mobile reception (e.g., in basements, transit, elevators); events are queued in the outbox and synced as soon as connectivity resumes.
3. **Database as Single Source of Truth**: Supabase PostgreSQL is the authoritative master. LocalStorage acts solely as a high-speed read cache and offline staging area.
