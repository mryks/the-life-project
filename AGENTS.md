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

## Continuous Memory, Rules & Skills Synchronization Law (Every Chat Interaction)

- **Mandatory End-of-Turn Synchronization**: At the conclusion of EVERY chat interaction (regardless of whether the task was a feature, bugfix, UI polish, design decision, or clarification), the agent MUST proactively update and synchronize all four knowledge repositories:
  1. **Obsidian Vault (`memory/`)**:
     * `00 - Atlas (Index).md`: Maintain complete Map of Content (MOC) and accurate sprint step ranges.
     * `Changelog & Step Log.md`: Chronologically record newly completed sprint steps, root cause analyses, architectural decisions, and verification metrics.
     * `Agreements & Historical Context.md`: Record every user preference, binding rule, design agreement, or constraint established in the turn.
     * Domain notes (`UI & Design System.md`, `Domain & Financial Model.md`, `Security & Master PIN.md`, etc.): Keep domain-specific sections evergreen.
  2. **Agent Memory Bank (`.agents/memory/`)**:
     * `activeContext.md`: Record current status, immediate next steps, and verified invariants.
     * `progress.md`: Update milestones, test counts, and completed backlog items.
  3. **Engineering Rules (`AGENTS.md` & `GEMINI.md`)**:
     * Enshrine any newly identified laws, user invariants, anti-patterns, or architectural requirements so mistakes are never repeated.
  4. **Domain Skills (`.agents/skills/`)**:
     * Update relevant skills (e.g. `senior-frontend-engineer`, `animate`, `casual-modern-ui`) with newly proven recipes, edge-case solutions, and automated test protocols.
- **Never Skip Documentation**: A task is NEVER complete until all 4 knowledge tiers have been updated, verified, and committed.

## Front-End & UI Engineering Standard

- The agent must strictly adhere to `.agents/skills/senior-frontend-engineer/SKILL.md` for all UI, layout, animation, and touch gesture tasks.
- **Single-Step Pagination Invariant**: Multi-view tab carousels must strictly advance by at most $\pm 1$ tab per swipe gesture. Fast flicks or large drags must never skip adjacent screens.
- **Mandatory Automated Mobile Subagent Verification**: Any change to mobile touch gestures, swipe carousels, or freeze panes MUST be verified by an automated mobile browser subagent (`scripts/test-mobile-e2e.mjs` / `npm run test:e2e:mobile`) testing real touch physics, bounding rects (`rect.top === 0`), and gesture disambiguation on both local build and live Vercel production before reporting completion.
- **CSS Overflow & Position Sticky Law**:
  * NEVER use `overflow-x: hidden` on page root or layout containers — use `overflow-x: clip` so vertical scroll does NOT compute to `auto` and break window-relative `position: sticky`.
  * **Containing Block Trap**: Never leave persistent CSS `transform` on containers hosting `position: sticky` or `fixed` children.
  * **Table Horizontal Scroll with Window Sticky Header**: An HTML `<table>` wrapper with `overflow-x: auto` computes `overflow-y: auto`, isolating table `thead` inside that wrapper. Window scroll will NOT stick the `thead`. The proven architecture: place the frozen table header directly inside the viewport-sticky freeze pane (`top: 0`), and synchronize horizontal `scrollLeft` bidirectionally with the table body on horizontal swipe.
- **Gesture Disambiguation & Touch Isolation**:
  * Multi-view tab swipe gestures must be guarded by strict angle thresholds (`|deltaX| > |deltaY| * 1.5`), min distance (50px), and element immunity (`table`, `button`, `input`, modal overlays).
  * Never dynamically expand container width (e.g. toggling `display: none` on inactive tabs) while a touch is in progress, as it causes violent layout-shift velocity jumps ("ghost touches").
- **Chronological Sorting & View Switch Scroll Invariant**:
  * **Table Ledger**: Sorted chronologically ascending (oldest at top, latest at bottom). When opening Table Ledger, the view MUST default to being scrolled to the very bottom (`tableBottomAnchorRef`) so latest transactions are immediately visible without manual scrolling.
  * **Card View**: Sorted reverse-chronologically descending (latest at top). When opening Card View, the view MUST default to `top: 0`.
  * Switching between views must always place the user at the latest transactions.
- **Nominal Privacy & Session Masking Invariant**:
  * All financial amounts across the entire application (Total Balance, Investment Balance, Net Worth, Income, Expense, Cashflow, Burn Rate, Chart Tooltips/Legends, 17 Account Cards, Card View, and Table Ledger) MUST default to masked (`Rp ••••••`).
  * Visibility toggle state is scoped to `sessionStorage` (`thelife-hide-nominals`). Revealed state (`false`) persists across tab transitions and page navigation during the session, but automatically reverts to masked on application cold start / tab kill.
  * Vector eye toggle buttons (`Eye` / `EyeOff` from `lucide-react`) must be provided in the sticky header and on `HeroVaultCard`.
- **Production Parity**: When building or refining mobile interactions, verification is incomplete until changes are committed, pushed, and deployed live to Vercel.