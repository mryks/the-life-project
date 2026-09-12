<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# The Life Project — Development Rules

## Project Purpose

The Life Project is a 100% personal life-management application.

The current active domain is personal finance.

The application is currently a client-side prototype using localStorage.
Do not introduce authentication, multi-user architecture, or a backend unless explicitly requested.

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

## Data Persistence

- localStorage is the current persistence mechanism.
- Do not replace localStorage with a database unless explicitly requested.
- Data loaded from localStorage must not be blindly trusted as valid application data.
- Schema changes should consider backward compatibility and migration.
- Empty transaction collections must be persisted correctly.
- Corrupt or invalid persisted data must fail safely rather than crashing the application.
- Real financial data must never be added to the public repository.

## TypeScript

- Maintain strict TypeScript.
- Avoid `any`.
- Prefer explicit domain types and discriminated unions where appropriate.
- Do not weaken types merely to make an error disappear.
- `JSON.parse` results must be validated before being treated as domain data.

## UI and UX

- Preserve the existing visual language unless a UI redesign is explicitly requested.
- Do not change unrelated UI while implementing a feature.
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