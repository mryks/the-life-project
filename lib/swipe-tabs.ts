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
