# Cloud Sync & Supabase

> Hub: [[00 - Atlas (Index)]] | Related: [[Domain & Financial Model]], [[Security & Master PIN]], [[Deployment & Vercel]]

---

## ☁️ Cloud Infrastructure Overview

- **Provider**: Supabase (PostgreSQL free tier).
- **Project URL**: `https://peydzblrtfgdoaisljkm.supabase.co`
- **Tables**:
  1. `financial_events`: Contains all income, expense, transfer, and refund records with soft-delete tombstones.
  2. `vault_security`: Stores single-user Master PIN salt and SHA-256 hash.

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
- **Within-Day Ordering**: Maintained via `within_day_order`, ensuring manual card reordering persists across devices.
- **Outbox Persistence**: Pending changes are queued in `localStorage` under `thelife-pending-upsert-ids` and retried automatically if the network is temporarily offline.
