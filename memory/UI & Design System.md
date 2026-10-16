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
  - GPU-accelerated gesture engine powered by Framer Motion (`<motion.div drag="x" dragDirectionLock dragConstraints={dragConstraints} dragElastic={0.2} animate={{ x: -currentTabIndex * containerWidth }}>`).
  - **Single-Step Pagination Invariant (`calculateBoundedSwipeTarget`)**: A single touch swipe gesture is strictly constrained to advance by **at most $\pm 1$ tab**. It can NEVER skip or fly over multiple screens regardless of how fast or hard the user flicks.
  - **Dynamic Physical Drag Constraints**: `dragConstraints` dynamically bounds finger travel to $[\max(-(N-1)W, -(k+1)W), \min(0, -(k-1)W)]$. The finger cannot physically drag past adjacent tabs.
  - **Velocity Gating**: Distance $\ge 18\%$ of screen width OR quick flick velocity $> 0.22\,\text{px/ms}$ commits the transition to the adjacent tab; sub-threshold drags smoothly snap back to the origin tab with elastic spring.
  - **Fluid Tab Pill Badge**: Active tab indicator powered by Framer Motion `layoutId="activeTabBadge"` with spring physics (`stiffness: 450, damping: 35`), eliminating manual coordinate lag and resize thrashing.
  - **Vertical Scroll Protection**: Responsive height capping (`max-h-[85vh] overflow-hidden`) on inactive views prevents 14,000px empty vertical scroll blowout from background transaction lists, while keeping adjacent panels fully visible during swipes.
  - **Senior Front-End Playbook**: Codified in `.agents/skills/senior-frontend-engineer/SKILL.md` and enforced in `AGENTS.md`.



