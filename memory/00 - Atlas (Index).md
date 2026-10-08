# 00 - Atlas (Index)

> **The Life Project — Second Brain & System Memory Vault**
> Modeled after Obsidian knowledge vaults with networked thought, bi-directional linking (`[[Wikilinks]]`), and evergreen reference notes.

---

## 🧭 Vault Navigation & Map of Content (MOC)

- [[Domain & Financial Model]] — The core financial events architecture, accounting rules, formulas, and validations.
- [[Cloud Sync & Supabase]] — Multi-device synchronization engine, database schema, tombstone deletions, and conflict resolution.
- [[Security & Master PIN]] — Single-user privacy shield, Web Crypto SHA-256 hashing, rate limiting, and 15-minute auto-lock.
- [[UI & Design System]] — Tactile Duolingo-inspired aesthetics, micro-interactions, color matrix, and typography standards.
- [[Deployment & Vercel]] — Production deployment pipeline targeting `https://the-life-project-os.vercel.app/`.
- [[Changelog & Step Log]] — Chronological progress tracker and engineering log across all development sprints.

---

## 🎯 Production Target & Scope

- **Live Application URL**: [`https://the-life-project-os.vercel.app/`](https://the-life-project-os.vercel.app/)
- **Target Audience**: Single-user personal life operating system, actively used daily on both Desktop (PC) and Mobile (Smartphone).
- **Primary Domain**: Personal Finance OS (daily expense logging, multi-account ledger, net worth tracking, financial analytics).
- **Standard Currency**: IDR (Indonesian Rupiah, `Rp`).
- **Core Stance**: **Financial data integrity is sacred.** UI conveniences must never compromise arithmetic correctness or cause transaction loss.

---

## 🔗 Architecture Topology

```
+-----------------------------------------------------------+
|                      User Devices                         |
|   +-----------------------+     +---------------------+   |
|   |  Desktop Web Browser  |     |  Mobile Smartphone  |   |
|   +-----------+-----------+     +----------+----------+   |
|               |                            |              |
+---------------|----------------------------|--------------+
                |                            |
                v                            v
+-----------------------------------------------------------+
|             Client Layer (Local-First Offline)            |
|   - localStorage caching (readFinancialEvents)            |
|   - useSyncExternalStore reactive data binding            |
|   - Outbox Queues: pending-upserts & pending-deletions    |
+-----------------------------+-----------------------------+
                              | Proactive 2-way sync
                              v
+-----------------------------------------------------------+
|               Cloud Database (Supabase PostgreSQL)        |
|   - URL: https://peydzblrtfgdoaisljkm.supabase.co        |
|   - Table: financial_events (Tombstone soft-delete)       |
|   - Table: vault_security (Master PIN salt & hash)        |
+-----------------------------------------------------------+
```

---

## 💡 How to Maintain this Vault (Obsidian Rules)
1. **Evergreen Notes**: Keep domain knowledge up to date whenever features or rules evolve.
2. **Networked Links**: Always link related concepts using `[[Note Name]]` syntax.
3. **Traceability**: Record major architectural decisions in [[Changelog & Step Log]].
