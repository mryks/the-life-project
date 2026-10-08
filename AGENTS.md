<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# The Life Project — Development Rules

## Project Purpose

The Life Project is a 100% personal life-management application.

The current active domain is personal finance (daily expense tracker and financial dashboard).
- User Target: Single-user personal finance tracker used daily on both Desktop (PC) and Mobile (smartphone).
- Currency Standard: IDR (Indonesian Rupiah).
- Access Control & Security: Single-user encrypted personal Master PIN protection for go-live online access.
- Target Database: Supabase (PostgreSQL free tier) to enable seamless synchronization between PC and Mobile, migrating cleanly from the current localStorage prototype.

## General Development Principles

- Preserve existing functionality unless the current task explicitly requires changing it.
- Prefer small, focused changes over large rewrites.
- Do not rewrite the project from scratch.
- Do not introduce unnecessary abstractions.
- Do not add dependencies unless they are genuinely necessary.
- Do not modify unrelated files or features.
- Before making a significant architectural change, explain the reason and expected impact.
- Prefer existing project dependencies and patterns when they are sufficient.

## Financial Data Integrity

Financial correctness is more important than UI convenience or visual polish.

- Never silently change financial calculations.
- Never change the meaning of an existing financial field without explicitly explaining the migration/impact.
- Income, expense, transfer, opening balance, and refund/cashback are conceptually different financial events.
- Transfers must preserve both source and destination accounts.
- Financial calculations should be implemented as deterministic, testable pure functions where appropriate.
- Do not use `any` for financial domain models.
- Validate financial input before storing it.
- Do not use AI-generated reasoning as the source of truth for arithmetic or financial calculations.
- Prefer deterministic code for balances, totals, aggregation, and reporting.

## Transaction Model

- Transactions must have a strongly typed model.
- Transfer destination must be represented in the TypeScript model rather than attached dynamically.
- Editing a transaction must update the existing transaction rather than create a duplicate.
- Deleting a transaction must persist the deletion.
- Transaction IDs must be unique and stable.
- Related financial records such as refunds/cashback must have explicitly defined relationships.
- Do not introduce new transaction types without documenting their accounting behavior.

## Data Persistence & Target Database

- The current prototype runs on localStorage.
- Target production database is Supabase (PostgreSQL free tier) to enable daily multi-device sync between PC and Mobile.
- Migration to Supabase must be executed carefully: retain the FinancialEvent single-source-of-truth model.
- Data loaded from localStorage or Supabase must not be blindly trusted as valid application data.
- Schema changes should consider backward compatibility and migration.
- Empty transaction collections must be persisted correctly.
- Corrupt or invalid persisted data must fail safely rather than crashing the application.
- Real financial data and database secrets (.env) must never be added to the public repository.

## TypeScript

- Maintain strict TypeScript.
- Avoid `any`.
- Prefer explicit domain types and discriminated unions where appropriate.
- Do not weaken types merely to make an error disappear.
- `JSON.parse` results must be validated before being treated as domain data.

## UI and UX Standards

- Language: 100% English for all UI labels, navigation, headers, forms, placeholders, and error messages.
- Aesthetic Vibe: "Simple, casual, engaging, not boring, friendly but mature" — clean, polished, thoughtful micro-interactions.
- Strictly NO default keyboard/phone Unicode emojis (e.g. no 💰, 💳, 📈, 🍔). Use `lucide-react` icons, custom SVG design elements, or curated 3D vector icons (3dicons.co).
- Account Labels: Do NOT display intrusive "Liquid" vs "Non-Liquid" badges on transaction cards or transfer forms. Keep account selectors clean.
- Typography: Use clean modern casual sans (Plus Jakarta Sans, Geist Sans, Inter) + tabular numbers (JetBrains Mono/Geist Mono) for currency amounts. Strictly avoid childlike handwriting fonts (Caveat, Patrick Hand).
- Theme: Clean, warm light mode (soft light canvas, subtle 1px border, soft elevations, thoughtful micro-interactions).
- Financial actions such as delete, edit, transfer, and refund should have clear and understandable behavior.
- Accessibility should be considered when introducing interactive controls.

## Testing and Verification

After implementing a change:

1. Run TypeScript type checking.
2. Run ESLint.
3. Run the appropriate tests if tests exist.
4. Report what was changed.
5. Report what was verified.
6. Report any remaining warnings, errors, or known risks.

Do not claim a feature is complete if verification has not been performed.

## AI Agent Behavior

Before modifying code:

- Inspect the relevant existing implementation.
- Explain the planned changes when the task is non-trivial.
- Identify potential side effects.
- Do not modify unrelated functionality.

When uncertain about business or financial behavior, ask for clarification rather than inventing a rule.

Do not make product decisions that have not been specified by the user.

For financial calculations, prioritize correctness and explicit business rules over convenience.

Keep changes minimal and reviewable.

- Before modifying files, state what will be changed for non-trivial tasks.
- After modifying files, summarize the exact files changed and why.
- Never hide or revert unrelated user changes.
- Do not commit or push changes unless explicitly requested.

## Financial Data Architecture

- FinancialEvent is the single source of truth for financial data.
- Only FinancialEvent data is persisted as financial state.
- Ledger entries, account balances, totals, reports, charts, card views, and ledger views are derived data.
- Do not persist derived financial data as a separate source of truth.
- Any financial change, including edit, delete, refund, cashback, or related-event changes, must be reflected through FinancialEvent data.
- Derived data must be recalculated deterministically from FinancialEvent.
- FinancialEvent data must remain sufficient to reconstruct all financial views and calculations.

## Memory Bank & Session Continuity

- The agent must maintain and reference `.agents/memory/` across all development sessions.
- Core memory files:
  * `projectBrief.md`: Core requirements, goals, and constraints.
  * `activeContext.md`: Current sprint focus and immediate next steps.
  * `systemPatterns.md`: System architecture, database schemas, and component structure.
  * `techContext.md`: Tech stack, dependencies, and environment setup.
  * `progress.md`: Completed features vs backlog.
- At the start of tasks, consult the Memory Bank before performing redundant codebase rescans.
- When finishing major milestones, update the relevant Memory Bank files.