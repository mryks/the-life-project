---
name: casual-modern-ui
description: >-
  Use this skill when designing or implementing clean, casual, engaging, and friendly modern web UIs.
  Enforces 100% English copy, clean vector icons (Lucide React / 3D icons), no default keyboard emojis,
  mature typography, and modern interactive component patterns inspired by shadcn/ui, Aceternity UI,
  Magic UI, and motion-primitives.
---

# Casual Modern UI & Design System Guide

This skill governs the aesthetic direction of The Life Project: **"Simple & casual, yet engaging and not boring. Friendly, but mature."**

---

## 1. Golden Aesthetic Rules

1. **100% English UI Copy:**
   - All headers, badges, form labels, actions, and error messages MUST be in English.
   - Examples: "Total Balance", "Net Cashflow", "Income", "Expenses", "Transfer", "Recent Activity", "Add Transaction", "All Accounts".
2. **Strictly NO Default Keyboard/Phone Emojis:**
   - NEVER use raw Unicode emojis like 💰, 💳, 📈, 🍔, 🚗.
   - Use `lucide-react` vector icons (e.g., `<Wallet />`, `<TrendingUp />`, `<ArrowRightLeft />`, `<CreditCard />`, `<Coffee />`).
   - For playful accents, use curated 3D vector icons (3dicons.co) or custom SVG design badges.
3. **Typography (Mature & Casual, NOT Childish):**
   - Headings & Body: `Plus Jakarta Sans`, `Geist Sans`, or `Inter` (clean, casual, modern geometric/humanist).
   - Numerical Currency: `JetBrains Mono` or `Geist Mono` with `font-variant-numeric: tabular-nums` for precise IDR alignment.
   - AVOID childlike handwriting fonts (Caveat, Patrick Hand).
4. **Clean Account Selectors (No Clutter):**
   - Do NOT display loud "Liquid" vs "Non-Liquid" badges on transaction cards or transfer forms.
   - Display account names cleanly (e.g. "BCA", "GoPay", "Bibit", "Cash") with an account icon or logo badge.
5. **Theme & Canvas:**
   - Warm, crisp light mode (soft light canvas `#FAFAFA` or `#FBFBFA`, soft white cards `#FFFFFF`, hairline borders `#E4E4E7` or `border-black/5`).
   - Subtle soft shadows (`shadow-sm`, `shadow-[0_2px_8px_rgba(0,0,0,0.04)]`).

---

## 2. Curated Reference Libraries & Inspiration Sources

When exploring or building UI components, draw directly from these design engineering libraries:

- **Component Primitives & Motion:**
  * **shadcn/ui** (`ui.shadcn.com`): Clean, accessible Radix + Tailwind primitives.
  * **Aceternity UI** (`ui.aceternity.com`): Bento grids, subtle spotlights, clean card borders, smooth tabs.
  * **Magic UI** (`magicui.design`): Number tickers, blur fades, animated docks, sleek badges.
  * **Motion Primitives** (`motion-primitives.com` / `openmotion.design`): Micro-interactions, spring accordions, smooth dialog reveals.
  * **21st.dev** (`21st.dev`): Modern production-ready components registry.
  * **React Bits** (`reactbits.dev`): Creative animated interactions.
  * **Uiverse** (`uiverse.io`): Micro-buttons, loaders, and toggle switches.

- **Design Inspiration & Galleries:**
  * **Styles Refero** (`styles.refero.design`) & **Minimal Gallery** (`minimal.gallery`): Real-world fintech and personal dashboards.
  * **Component Gallery** (`component.gallery`) & **Appshot** (`appshot.gallery`): Mobile screen ergonomics.
  * **3D Icons** (`3dicons.co`): Beautiful open-source 3D illustrations for finance & categories.

---

## 3. Google Stitch Integration

Google Stitch (`stitch.withgoogle.com`) is an AI-native UI design canvas by Google Labs powered by Gemini models.
- **Workflow:** You can sketch or describe visual concepts in Stitch, export the generated React + Tailwind JSX, and drop the components into `components/` in this project.
- Antigravity IDE connects seamlessly: take the JSX output from Stitch and wire it to the deterministic `lib/finance.ts` state.
