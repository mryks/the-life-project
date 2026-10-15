/**
 * Pure calculation utilities for Swipeable Tabs
 * Inspired by React Aria swipeable-tabs architecture
 */

export interface TabButtonRect {
  offsetLeft: number;
  offsetWidth: number;
}

/**
 * Calculates continuous 1:1 indicator position and width based on horizontal scroll progress.
 */
export function calculateIndicatorPosition(
  buttons: TabButtonRect[],
  scrollLeft: number,
  clientWidth: number
): { left: number; width: number } {
  if (buttons.length === 0 || clientWidth <= 0) {
    return { left: 0, width: 0 };
  }

  const maxScroll = Math.max(0, (buttons.length - 1) * clientWidth);
  const clampedScroll = Math.max(0, Math.min(scrollLeft, maxScroll));
  const ratio = clampedScroll / clientWidth;

  const baseIndex = Math.min(Math.floor(ratio), buttons.length - 1);
  const nextIndex = Math.min(baseIndex + 1, buttons.length - 1);
  const fraction = ratio - baseIndex;

  const currentBtn = buttons[baseIndex];
  const nextBtn = buttons[nextIndex];

  if (!currentBtn) return { left: 0, width: 0 };

  let targetLeft = currentBtn.offsetLeft;
  let targetWidth = currentBtn.offsetWidth;

  if (nextBtn && baseIndex !== nextIndex) {
    targetLeft = currentBtn.offsetLeft + (nextBtn.offsetLeft - currentBtn.offsetLeft) * fraction;
    targetWidth = currentBtn.offsetWidth + (nextBtn.offsetWidth - currentBtn.offsetWidth) * fraction;
  }

  return { left: targetLeft, width: targetWidth };
}

/**
 * Calculates settled snapped tab index based on scroll offset and viewport width.
 */
export function calculateSnappedTabIndex(
  scrollLeft: number,
  clientWidth: number,
  totalTabs: number
): number {
  if (clientWidth <= 0 || totalTabs <= 0) return 0;
  const rawIndex = Math.round(scrollLeft / clientWidth);
  return Math.max(0, Math.min(rawIndex, totalTabs - 1));
}

export interface SwipeGestureInfo {
  startIndex: number;
  deltaX: number;
  velocity: number;
  clientWidth: number;
  totalTabs: number;
}

/**
 * Calculates the target tab index for a single swipe gesture.
 * STRICT INVARIANT: A single swipe can advance by AT MOST ±1 tab.
 * It will NEVER skip multiple tabs regardless of swipe distance or velocity.
 */
export function calculateBoundedSwipeTarget({
  startIndex,
  deltaX,
  velocity,
  clientWidth,
  totalTabs,
}: SwipeGestureInfo): number {
  if (totalTabs <= 0) return 0;
  if (clientWidth <= 0) return Math.max(0, Math.min(startIndex, totalTabs - 1));

  // Minimum travel distance: 18% of viewport width
  const distanceThreshold = clientWidth * 0.18;
  // Quick flick detection: displacement > 20px and velocity > 0.22 px/ms
  const isQuickFlick = Math.abs(deltaX) > 20 && velocity > 0.22;

  if (deltaX < -distanceThreshold || (deltaX < -20 && isQuickFlick)) {
    // Swipe left -> advance by AT MOST +1 tab
    return Math.min(startIndex + 1, totalTabs - 1);
  }

  if (deltaX > distanceThreshold || (deltaX > 20 && isQuickFlick)) {
    // Swipe right -> advance by AT MOST -1 tab
    return Math.max(startIndex - 1, 0);
  }

  // Sub-threshold gesture -> snap back to starting tab
  return Math.max(0, Math.min(startIndex, totalTabs - 1));
}

