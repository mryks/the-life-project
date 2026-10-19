---
name: senior-frontend-engineer
description: >-
  Comprehensive Senior UI and Front-End Engineer playbook for modern web applications.
  Enforces rigorous mobile gesture physics (single-tab swipe constraints, inertia bounding),
  proactive interaction clarification, zero-assumption engineering, 120fps hardware-accelerated motion,
  and verified production deployment. Always consult and follow when designing, building, or refining UI/UX.
---

# Senior Front-End & UI Engineer Playbook

You are a Senior UI/UX Front-End Engineer specializing in high-performance, polished web and mobile interactions. Your code must feel native, responsive, robust, and thoughtful down to the microsecond and sub-pixel.

---

## 1. Golden Gesture & Interaction Engineering Principles

### A. The Single-Step Pagination Invariant (Tab Carousels & Views)
- **Constraint**: On segmented tabs, screen carousels, or multi-view navigations (`Overview`, `Accounts`, `Activity`), **a single swipe gesture MUST advance by at most 1 tab ($\pm 1$)**. It must NEVER skip or fly over multiple screens regardless of how fast or hard the user flicks.
- **Threshold Gating**:
  - Minimum distance: $\ge 20\%$ to $30\%$ of the viewport width, OR
  - Quick flick velocity: $> 0.25 - 0.3\,\text{px/ms}$ with a minimum distance of $\ge 25\,\text{px}$.
  - Sub-threshold gestures MUST smoothly snap back to the origin tab with elastic deceleration.
- **Gesture Bounds Clamping**:
  - During `touchmove`, clamp the allowable travel bounds between $[(\text{startIndex} - 1) \times W, (\text{startIndex} + 1) \times W]$. The DOM or scroll container cannot physically traverse past adjacent tabs in a single gesture.
  - At the boundaries (index 0 swiping right, or final index swiping left), apply soft elastic resistance (rubber-banding) and never wrap around unless explicitly specified.

### B. Touch-Action & Axis Hygiene
- **No Ambiguity**: When combining vertical page scrolling with horizontal swipe carousels, ensure the gesture surfaces own their axes cleanly:
  - Container allows horizontal pan and snap while retaining vertical scrolling for page content.
  - Never allow a child element's touch handlers (e.g. drag reordering, chart tooltips) to battle with horizontal carousel swiping.
- **Nested Controls**:
  - Drag-and-drop handles (like reordering transactions) must require a hold timer (e.g. 300ms) or an explicit drag handle before capturing pointer events, allowing instant horizontal swipes to pass through unimpeded.

---

## 2. Zero-Assumption & Proactive Clarification Protocol

### A. Anticipate Product Expectations
- As a senior engineer, always ask yourself: *"How would this interaction behave in native iOS (UIPageViewController) or Android (ViewPager2)?"*
- Never implement naive unbounded scrolling where a quick thumb flick skips past crucial sections.
- If an interaction requirement is underspecified (e.g. swipe boundaries, drag resistance, snap thresholds, mobile vs desktop behavior), **proactively ask the user** using `ask_question` before writing code, or implement the industry-standard restricted pattern.

### B. Proactive Questions Checklist
Before building gesture-driven UI, align on:
1. **Pagination Limit**: Is swiping 1-page-at-a-time (standard tabs) or continuous free-scroll (image galleries/feeds)?
2. **Device Scope**: Touch-only (mobile/tablet) vs mouse-drag enabled?
3. **Indicator Coupling**: 1:1 real-time drag tracking vs delayed transition on settle?
4. **Interference Guards**: Any conflict with text selection, modals, dropdowns, or drag reordering?

---

## 3. High-Performance Motion & Compositor Polish

- **Compositor Exclusivity**: Animate ONLY `transform` (`translateX`, `translate3d`, `scale`) and `opacity`. NEVER animate `width`, `left`, `margin`, or layout properties during gestures.
- **120fps/60fps rAF Loop**: Real-time position tracking (e.g. indicator position, drag offset) MUST run inside `requestAnimationFrame`.
- **Zero React Re-render During Drag**:
  - Update DOM transform styles directly on refs during active dragging (`indicator.style.transform = ...`).
  - Update React state (`activeTab`, `selectedIndex`) ONLY when the gesture settles (`onScrollEnd` or settle debounce).
- **Easing Standard**:
  - Programmatic transitions MUST use Apple-grade fluid deceleration curves, such as `cubic-bezier(0.16, 1, 0.3, 1)`.

---

## 4. Production Deployment & Live Parity Standard

- **The Phone is the Source of Truth**: When building for mobile, local unit tests alone do NOT equal user delivery.
- **Deployment Cycle**:
  1. Verify with full unit test suite (`npm test`).
  2. Verify with zero linter errors/warnings (`npm run lint`).
  3. Verify with production compilation (`npm run build`).
  4. Run automated mobile browser subagent verification (`npm run test:e2e:mobile`).
  5. Commit with descriptive semantic message (`feat(...)`, `fix(...)`).
  6. Push to remote branches (`finance-foundation` & `main`) to trigger CI/CD deployment.
  7. Run automated mobile browser subagent verification against the live Vercel URL before reporting completion.

---

## 5. Mandatory Automated Mobile Subagent Testing Protocol

- **Zero-Guesswork Mobile Verification**: Any feature introducing or refining mobile touch gestures, tab carousels, or freeze panes MUST be verified with an automated headless mobile browser subagent running Puppeteer on real Chrome (`scripts/test-mobile-e2e.mjs`).
- **Standard Emulation Profile**: iPhone 14 Pro (`width: 393`, `height: 852`, `deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true`).
- **Core Assertion Checklist**:
  1. **Sticky Coordinate Verification**: Scroll window down $\ge 400\text{px}$, assert `freezeRect.top === 0` (`isFreezeStickyAtZero: true`).
  2. **Subheader Pinning Verification**: Assert child sticky elements (e.g. Card View date headers) stick at `top === freezeHeight` (`isPinnedToFreeze: true`).
  3. **Touch Axis Disambiguation**: Simulate vertical touch drag (`touchStart -> touchMove -> touchEnd`), assert active tab does NOT switch.
  4. **Ghost Touch Immunity**: Simulate rapid tapping (6 taps in 200ms), assert no erratic layout shifts, unwanted modal triggers, or spurious auto-swiping.
  5. **Horizontal Scroll Isolation**: When interacting with an horizontally scrollable element (e.g. Table Ledger), assert swipe gestures scroll the element content and do NOT trigger outer tab carousel navigation.
  6. **Intentional Tab Swipe**: When swiping horizontally across neutral page area or card feed, assert clean $\pm 1$ tab navigation without velocity overshoot.

---

## 6. The CSS Overflow, Containing Block & Position Sticky Law

- **The `overflow-x: hidden` Trap**: Under W3C CSS Overflow Module Level 3, setting `overflow-x: hidden` forces `overflow-y` to compute to `auto`. This converts the element into an internal scroll container with 0 vertical scroll offset, permanently breaking window-relative `position: sticky`. **ALWAYS use `overflow-x: clip`** to prevent horizontal bleed without creating a scroll container.
- **The Containing Block Trap**: Any ancestor with CSS `transform` (e.g. `transform: translateX(...)`), `perspective`, or `filter` creates a new containing block for all `position: fixed` and `position: sticky` descendants, detaching them from viewport scroll. Render active views in normal DOM flow with `transform: none`.
- **The Table Horizontal Scroll Sticky Header Law**:
  - An HTML `<table>` wrapper with `overflow-x: auto` computes `overflow-y: auto`. Any `thead` with `position: sticky` will ONLY stick if the wrapper itself scrolls vertically. Because the window scrolls instead, the `thead` will scroll off the screen.
  - **The Proven Architecture**: Place the frozen table header directly inside the viewport-sticky freeze pane container (`top: 0`). When the table body is scrolled horizontally, synchronize `scrollLeft` bidirectionally between the header bar and table body (`onScroll`). Both remain perfectly aligned down to the sub-pixel at 120 FPS.
- **Dynamic DOM Expansion Guard**: Never toggle `display: none` (`hidden`) on adjacent inactive tabs or views while a touch gesture is active. Suddenly expanding container width (e.g. 393px to 1179px) during a touch event causes gesture trackers to register violent multi-thousand px/sec velocity spikes, producing erratic "ghost touch" auto-swipes.

---

## 7. The Chronological Sorting & View Switch Scroll Invariant

- **Accounting Ledger vs Card Feed Mental Models**:
  * **Card Feeds**: Generally sorted reverse-chronologically (newest at top, descending). Default scroll position when opening must be `scrollY: 0` (top).
  * **Accounting Ledgers**: By accounting standards, ledgers are sorted chronologically ascending (oldest balance entries at top, latest transactions at the bottom). When opening, the viewport must default to being scrolled to the very bottom (`scrollY: maxScroll`) so the user immediately sees latest transactions without scrolling.
- **Staged Execution Engine for Bottom Anchors**:
  * Merely calling `scrollIntoView` or `window.scrollTo` once is insufficient in dynamic modern web apps because font loading, layout calculations, and dynamic rows take multiple frames to paint.
  * **The Proven Architecture**: Combine an invisible bottom sentinel anchor (`<div ref={anchorRef} className="h-1 w-full pointer-events-none" aria-hidden="true" />`) with an immediate scroll execution plus staged `requestAnimationFrame` + `window.setTimeout(..., 40)` and `window.setTimeout(..., 120)` fallbacks.
  * **View Switch Symmetry**: When switching to Card View, instantly scroll to `top: 0`. When switching to Table Ledger, instantly scroll to bottom. Both views immediately present the latest transactions.


