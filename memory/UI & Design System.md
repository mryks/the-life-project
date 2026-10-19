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
- **Sticky Search Bar Freeze, Natural Header Hide & Clean Date Headers (`app/finance/page.tsx`)**:
  - **Sticky Search Bar Freeze (`activityFreezeRef`)**: The search input, filter chips, category dropdown, and view switcher (and Table Ledger column headers) stick firmly at the top of the viewport (`sticky top-0 z-30 bg-[#FBF9F4]/95 backdrop-blur-xs -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-3 border-b border-stone-200/80 shadow-2xs`).
  - **Natural Header Hide ("Bisa Kehide")**: When scrolling down, the main app `<header>` (Logo, + Add button, tabs) scrolls off naturally into the upper page flow, giving maximum vertical reading space for transaction cards. Once `activityFreezeRef` reaches `top: 0`, it freezes and stays accessible at all times without having to scroll back to the top.
  - **Clean Static Date Headers (Card View)**: Date section headers rendered in clean normal document flow (`pt-2 pb-0.5 text-xs font-bold text-stone-500 tracking-wide`). Completely eliminated sticky translucent badges that caused overlapping text and visual clutter.
  - **Table Ledger Scroll Container (`max-h-[62vh] sm:max-h-[70vh] overflow-y-auto`)**: Table Ledger retains internal vertical and horizontal scrolling. Opening Table Ledger auto-scrolls `tableBodyScrollRef` to the bottom (`tableBottomAnchorRef`), immediately displaying the latest transactions while `window.scrollY` strictly stays at `0`.
  - **Centered Floating "Top" Pill Button**: When the user scrolls down (`window.scrollY > 350`), a sleek tactile floating pill (`↑ Top`) appears smoothly via Framer Motion at `fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-stone-900/95 text-white`. Tapping it smoothly scrolls `window.scrollTo({ top: 0, behavior: 'smooth' })`. Centered placement ensures zero collision with the green `+ Add` button (`bottom-6 right-6`) and provides equal ergonomics for left- and right-handed users.
- **Ghost-Touch-Free Gesture Handler (`hooks/useSwipeableTabs.ts`)**:
  - Replaced global `drag="x"` container with targeted touch handlers (`onTouchStart`, `onTouchEnd`).
  - **Angle & Axis Guard**: Requires `Math.abs(deltaX) > Math.abs(deltaY) * 1.5` so vertical scrolling is 100% ignored.
  - **Element Isolation Guard**: Touch gestures starting on `table`, `button`, `input`, `select`, or elements with `data-no-swipe="true"` will never trigger tab navigation.
  - **Static Width Stability**: Tabs do not dynamically toggle `display: none` during touches, eliminating the violent 780px layout shifts that caused ghost-swipe bouncing.
- **Mandatory Automated Mobile Subagent Testing**:
  - Integrated `scripts/test-mobile-e2e.mjs` (`npm run test:e2e:mobile`) using Puppeteer with real Chrome emulating iPhone 14 Pro touch events.
  - Automatically verifies sticky coordinates (`isFreezeStickyAtZero`), subheader pinning (`isPinnedToFreeze`), horizontal scroll sync, rapid tapping immunity, and tab swipe transitions before delivery.



- **Default Nominal Masking & Session-Persisted Eye Toggle (`lib/privacy.ts`)**:
  - **Cold Start Masking**: By default, all financial nominals across Overview, Accounts, Card View, and Table Ledger render masked as `Rp ••••••` (or with sign/suffix: `+Rp ••••••`, `-Rp ••••••`, `Rp ••••••/day`, `Net: Rp ••••••`).
  - **Eye Icon Toggle**: Tactile vector toggle buttons (`Eye` / `EyeOff` from `lucide-react`) in the top navigation header bar and beside `TOTAL BALANCE` on `HeroVaultCard`.
  - **Session Persistence**: Stored in `sessionStorage` (`thelife-hide-nominals`). Remains revealed across tab transitions and page navigation during the session; automatically re-masks when the application is killed or closed.
