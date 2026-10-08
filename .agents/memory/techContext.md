# Technical Context

## Core Technologies
- **Framework:** Next.js 16.3.4 (App Router)
- **Runtime & Language:** React 19.2.8, TypeScript 5.x (Strict mode)
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`) + PostCSS
- **Visualizations:** Recharts 3.10.1 (`PieChart`, `LineChart`, `ResponsiveContainer`)
- **Testing Engine:** Vitest 5.0.2 (12 test suites, 171 tests)
- **Linting:** ESLint 9 (`eslint-config-next`)
- **OS Platform:** Windows (Shell: PowerShell)

## Data Storage Strategy
- **Current State:** Browser `window.localStorage` (keyed as `thelife-finance`, v2 JSON format).
- **Target State:** Supabase PostgreSQL (free tier).
  - Multi-device sync (Desktop PC & Mobile smartphone).
  - Single-user access secured with client-side or server-verified personal Master PIN.

## Developer Workflows & Commands
- `npm run dev`: Launch local development server (`http://localhost:3000`).
- `npm test`: Run full test suite with Vitest.
- `npm run test:watch`: Run tests in watch mode.
- `npm run lint`: Run ESLint analysis.
- `npm run build`: Production Next.js build.
- `npm run verify:opening-balance`: Tsx script to verify opening balance calculations.
