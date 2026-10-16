# UI & Design System

> Hub: [[00 - Atlas (Index)]] | Related: [[Accounts & Portfolio]], [[Refunds & Relations]], [[Agreements & Historical Context]], [[Domain & Financial Model]], [[Security & Master PIN]]

---

## 🎨 Aesthetic Philosophy

- **Vibe**: "Simple, casual, engaging, not boring, friendly but mature" — playful Tactile Duolingo-inspired depth with clean minimalism.
- **Copy**: **100% English** across all labels, buttons, headers, error states, and tooltips.
- **Iconography**: **Strictly 0 raw keyboard emojis** (no 💰, 💳, 📈). All icons use `lucide-react` or curated SVG design elements.
- **Typography**: Clean modern sans (`Plus Jakarta Sans` / `Geist Sans` / `Inter`) with tabular monospaced numbers (`Geist Mono` / `JetBrains Mono`) for financial currency amounts.

---

## 🎨 Color Coding Matrix

Consistent visual language across creation forms, transaction cards, and activity filter pills:

| Event Type | Primary Color | Class Tokens | Tactile Button |
| :--- | :--- | :--- | :--- |
| **Expense** | Crimson / Red | `text-rose-600`, `bg-rose-50`, `border-rose-200` | `.btn-tactile-danger` |
| **Income** | Emerald / Green | `text-emerald-600`, `bg-emerald-50`, `border-emerald-200` | `.btn-tactile-primary` |
| **Transfer** | Vibrant Blue | `text-blue-600`, `bg-blue-50`, `border-blue-200` | `.btn-tactile-blue` |
| **Refund** | Purple / Violet | `text-violet-600`, `bg-violet-50`, `border-violet-200` | `.bg-violet-600` |

---

## 🕹️ Tactile Micro-Interactions

Custom CSS utilities in `app/globals.css`:
- `.btn-tactile-*`: Subtle 1px border with a soft bottom border drop (e.g. `border-b-[3px]`), depressing smoothly on `:active` (`translate-y-[2px]`).
- **Modal Background Scroll Locking**: Whenever any modal (Transaction Options, Record Form, Refund Modal, Pin Lock) opens, `document.body.style.overflow = 'hidden'` is applied to prevent background card scrolling.
- **Custom Dropdowns & Gooey Menus**: Native browser select elements replaced with custom tactile dropdown menus. Category filtering in Activity area utilizes EasyUI-inspired `GooeyMenu.tsx` featuring liquid SVG metaballs (`#_easyui_goo`), spring transitions, and crisp layered typography.
- **Fluid Spring Indicator Tabs**: Type Switcher (Expense, Income, Transfer) features an elastic sliding spring pill (`cubic-bezier(0.16, 1, 0.3, 1)`) with crisp layered vector icons and tactile bottom border drops matching the selected transaction type.
- **Mobile First Touch Targets & Keyboard Hygiene**:
  - Minimum 44px touch targets on mobile devices with `-webkit-tap-highlight-color: transparent`.
  - Automatic virtual keyboard dismissal (`blur()`) on scroll (`onScroll`, `onTouchMove`, and window scroll) or outside taps (`onPointerDown` on non-inputs) across amount, description, admin fee, cashback, and refund forms.
  - Lowercase mobile keyboard trigger (`autoCapitalize="none"`, `autoCorrect="off"`) for description input fields.
- **EasyUI Animated Number Morph (`components/ui/animated-number.tsx`)**:
  - Independent digit rolling counter powered by Framer Motion spring physics (`stiffness: 170`, `damping: 22`, `mass: 0.6`).
  - Strict Indonesian Rupiah dot grouping (e.g. `Rp 48.250.000`) with stable column keying from the right for organic numeric transitions.
  - Deployed on the Accounts page across Total Liquid, Total Investment, Total Net Worth, and all individual account cards.
  - Paired with an amber spring pulse ring (`ring-4 ring-amber-400`), card lift, `"UPDATED"` badge, and smooth viewport auto-scroll upon transaction completion.
- **Hardware-Accelerated Swipeable Tabs (`hooks/useSwipeableTabs.ts` & `lib/swipe-tabs.ts`)**:
  - GPU-accelerated gesture engine powered by Framer Motion (`<motion.div style={{ x }} drag="x" dragConstraints={dragConstraints} dragElastic={0.3} onDragEnd={handleDragEnd}>`).
  - **Single-Step Pagination Invariant (`calculateBoundedSwipeTarget`)**: A single touch swipe gesture is strictly constrained to advance by **at most $\pm 1$ tab**. It can NEVER skip or fly over multiple screens regardless of how fast or hard the user flicks.
  - **Touch Velocity Momentum Handoff (Zero-Jank / Stutter Elimination)**: On touch release (`onDragEnd`), real finger velocity (`info.velocity.x`) is directly injected into `animate(x, targetX, { velocity: releaseVelocity, stiffness: 280, damping: 32, mass: 0.8 })`, eliminating the zero-velocity jerk/hesitation of declarative springs.
  - **Zero Layout Thrashing with `settledTab`**: Overview and Accounts maintain natural heights without mid-gesture collapse. Activity (14,434px) is capped at 1600px when inactive and only uncaps after the gesture completely settles (`settledTab === 'ledger'`), preventing main-thread layout thrashing during the 60fps frame budget.
  - **Full-Bleed Viewport Hierarchy (Zero Tab Peeking / Bleed)**: The outer carousel clipping container (`containerRef`) MUST have full viewport width (`w-full overflow-hidden`) with zero horizontal padding (`px-0`). Tab panels span 100% of the viewport (`w-full min-w-full shrink-0`), and horizontal padding / max-width constraints (`max-w-5xl mx-auto px-4 sm:px-6`) are applied strictly *inside* each panel.
  - **Fluid Tab Pill Badge**: Active tab indicator synchronized with matching Apple-grade spring physics (`stiffness: 320, damping: 32`).
  - **Senior Front-End Playbook**: Codified in `.agents/skills/senior-frontend-engineer/SKILL.md` and enforced in `AGENTS.md`.



