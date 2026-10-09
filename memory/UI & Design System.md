# UI & Design System

> Hub: [[00 - Atlas (Index)]] | Related: [[Domain & Financial Model]], [[Security & Master PIN]]

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
