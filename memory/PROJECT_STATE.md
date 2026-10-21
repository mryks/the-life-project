# Project State & Quick Context

> **Persistent Memory Entry Point for Agents & Developers**  
> *Hub:* [[00 - Atlas (Index)]] | *Codebase is the ultimate source of truth if discrepancies exist.*

---

## 📌 Current Status (At a Glance)
- **Active Domain:** Personal Finance OS (daily expense tracker & financial dashboard).
- **Git Branch:** `finance-foundation` | **Production:** https://the-life-project-os.vercel.app/finance
- **Health:** 25 test suites, **440/440 tests passing (100%)**, TypeScript strict 0 errors, ESLint clean (0 errors, 0 warnings).
- **Latest Completed Sprint:** **Langkah 52** (Custom Categories Ordering before 'Other'/'Others' & Delete Icon Conditional Visibility).

- **Immediate Next Steps (Finance Backlog):**
  1. Multi-device sync verification & cloud sync backup envelope parity for custom accounts.
  2. Monthly category budgets & spending caps with tactile progress bars.
  3. Data export & reporting (PDF statement / CSV export).
  4. Recurring transactions / subscriptions tracker.

---

## 🧭 Knowledge Map (Where to Look)
Open **ONLY** the note relevant to your immediate task. Do not read the entire vault into context:
- 🏛️ **Financial Model & Validation:** [[Domain & Financial Model]] (`memory/Domain & Financial Model.md`)
- 💳 **Accounts & Partitions (17 Defaults + Custom Accounts):** [[Accounts & Portfolio]] (`memory/Accounts & Portfolio.md`)
- 🔄 **Refunds & Relational Integrity:** [[Refunds & Relations]] (`memory/Refunds & Relations.md`)
- ☁️ **Cloud Sync & Supabase Local-First:** [[Cloud Sync & Supabase]] (`memory/Cloud Sync & Supabase.md`)
- 🔒 **Master PIN & Rate Limiting:** [[Security & Master PIN]] (`memory/Security & Master PIN.md`)
- 🎨 **UI, Gestures & Tactile Design:** [[UI & Design System]] (`memory/UI & Design System.md`)
- 📜 **Durable User Agreements & Decisions:** [[Agreements & Historical Context]] (`memory/Agreements & Historical Context.md`)
- 📋 **Full Sprint Changelog (Langkah 1–50):** [[Changelog & Step Log]] (`memory/Changelog & Step Log.md`)

---

## ⚡ Non-Negotiable Invariants & Critical Gotchas
1. **Single Source of Truth:** `FinancialEvent` union (`income`, `expense`, `transfer`, `refund`) is the only persisted financial state. Balances, ledgers, charts, and KPI totals are pure deterministic derived data. Opening balance on new accounts is logged as a first-class `IncomeEvent` under category `'Others'`.
2. **Account Classification:** 17 system default accounts + user custom accounts partitioned dynamically into `liquid` (Total Balance) vs `investment` (Holdings / Net Worth). Default accounts can NEVER be deleted. Custom accounts can only be deleted if they have 0 transactions (`!isAccountInUse`).
3. **Single-Step Swipe Invariant:** Horizontal tab swipe (Overview $\leftrightarrow$ Accounts $\leftrightarrow$ Activity) must advance by at most $\pm 1$ tab per gesture. Fast flicks or large drags must never skip adjacent tabs.
4. **Nominal Privacy by Default:** All amounts across all views default to masked (`Rp ••••••`). Revealed state persists per session via `sessionStorage`.
5. **Aesthetic Law:** 100% English copy, zero default keyboard emojis (strictly Lucide/Phosphor vector icons), and tabular numerals (`Sora`).
6. **Codebase Over Memory:** If memory notes contradict the actual codebase or test suites, trust the code and update the memory note.
7. **Public Repo Privacy:** NEVER write secrets, API keys, tokens, `.env` values, or private user financial figures to any Markdown or tracked code.
