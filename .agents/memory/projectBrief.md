# The Life Project — Project Brief

## Project Identity & Vision
- **Project Name:** The Life Project
- **Current Active Domain:** Personal Finance Tracker & Financial Dashboard
- **Future Domains:** Habits, Tasks (visible in navigation shell)
- **Target Audience:** Single-user personal life-management application for daily, long-term personal use.
- **Form Factors:** Dual primary usage — Desktop (PC) and Smartphone (Mobile responsive web app).
- **Standard Currency:** IDR (Indonesian Rupiah).

## Primary Goals
1. **Financial Integrity & Peace of Mind:** Zero arithmetic errors, zero phantom balances, 100% deterministic recalculations.
2. **Seamless Dual-Device Sync:** Enable daily quick-entry on Mobile (on-the-go expenses) and detailed review/planning on PC (at desk) via cloud synchronization (Supabase PostgreSQL free tier).
3. **Data Security & Privacy:** Single-user encrypted personal Master PIN protection for go-live online access; database secrets never committed to repository.
4. **Resilient Local Prototype to Cloud Transition:** Cleanly migrate the existing robust `localStorage` engine and backup/restore mechanisms to Supabase while preserving the `FinancialEvent` single-source-of-truth architecture.

## Core Constraints & Non-Negotiables
- **Single Source of Truth:** `FinancialEvent` is the only persisted financial state. All ledger entries, balances, charts, totals, and views are derived pure functions.
- **Strict Invariants:**
  - Date flexibility: Any valid calendar date (past, present) is supported without arbitrary future-date restrictions.
  - Starting balances are recorded manually by user as regular income transactions (category: 'Others').
  - Transaction amounts must be positive integers (`Number.isSafeInteger(amount) && amount > 0`).
  - Transfers require distinct source and destination accounts, and support optional positive integer `adminFee`.
  - Cashbacks and refunds must be strictly bound to an existing expense on the same account.
  - Total refunds cannot exceed parent expense amount.
- **Account Classification:** 17 accounts partitioned into 10 Liquid Accounts (`c`, `b`, `g`, `s`, `jy`, `e`, `sea`, `q`, `j`, `cla`) and 7 Investment Accounts (`k`, `h`, `sb`, `poe`, `kb`, `i`, `p`). Headline total balance represents liquid cashflow funds.
- **Reorder Consistency:** User-controlled transaction ordering is preserved atomically within the same calendar day.
