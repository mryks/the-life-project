import { describe, it, expect } from "vitest";
import {
  calculateIndicatorPosition,
  calculateSnappedTabIndex,
  calculateBoundedSwipeTarget,
  type TabButtonRect,
} from "@/lib/swipe-tabs";

describe("Swipeable Tabs Pure Calculations", () => {
  const buttons: TabButtonRect[] = [
    { offsetLeft: 4, offsetWidth: 100 },   // Tab 0: Overview
    { offsetLeft: 108, offsetWidth: 105 }, // Tab 1: Accounts
    { offsetLeft: 217, offsetWidth: 140 }, // Tab 2: Activity
  ];
  const clientWidth = 400;

  describe("calculateIndicatorPosition", () => {
    it("returns exact button rect at scroll position 0 (first tab)", () => {
      const pos = calculateIndicatorPosition(buttons, 0, clientWidth);
      expect(pos.left).toBe(4);
      expect(pos.width).toBe(100);
    });

    it("interpolates continuously halfway between tab 0 and tab 1", () => {
      // scrollLeft = 200 (halfway between 0 and 400)
      const pos = calculateIndicatorPosition(buttons, 200, clientWidth);
      // left: 4 + (108 - 4) * 0.5 = 4 + 52 = 56
      // width: 100 + (105 - 100) * 0.5 = 100 + 2.5 = 102.5
      expect(pos.left).toBe(56);
      expect(pos.width).toBe(102.5);
    });

    it("returns exact button rect at scroll position 400 (tab 1 / Accounts)", () => {
      const pos = calculateIndicatorPosition(buttons, 400, clientWidth);
      expect(pos.left).toBe(108);
      expect(pos.width).toBe(105);
    });

    it("interpolates continuously halfway between tab 1 and tab 2", () => {
      // scrollLeft = 600 (ratio = 1.5)
      const pos = calculateIndicatorPosition(buttons, 600, clientWidth);
      // left: 108 + (217 - 108) * 0.5 = 108 + 54.5 = 162.5
      // width: 105 + (140 - 105) * 0.5 = 105 + 17.5 = 122.5
      expect(pos.left).toBe(162.5);
      expect(pos.width).toBe(122.5);
    });

    it("returns exact button rect at scroll position 800 (tab 2 / Activity)", () => {
      const pos = calculateIndicatorPosition(buttons, 800, clientWidth);
      expect(pos.left).toBe(217);
      expect(pos.width).toBe(140);
    });

    it("clamps safely when overscrolled to the left (< 0)", () => {
      const pos = calculateIndicatorPosition(buttons, -100, clientWidth);
      expect(pos.left).toBe(4);
      expect(pos.width).toBe(100);
    });

    it("clamps safely when overscrolled past max scroll (> 800)", () => {
      const pos = calculateIndicatorPosition(buttons, 1200, clientWidth);
      expect(pos.left).toBe(217);
      expect(pos.width).toBe(140);
    });

    it("handles empty buttons or zero client width gracefully", () => {
      expect(calculateIndicatorPosition([], 200, clientWidth)).toEqual({ left: 0, width: 0 });
      expect(calculateIndicatorPosition(buttons, 200, 0)).toEqual({ left: 0, width: 0 });
    });
  });

  describe("calculateSnappedTabIndex", () => {
    it("snaps to tab 0 when near start", () => {
      expect(calculateSnappedTabIndex(0, clientWidth, 3)).toBe(0);
      expect(calculateSnappedTabIndex(120, clientWidth, 3)).toBe(0);
      expect(calculateSnappedTabIndex(190, clientWidth, 3)).toBe(0);
    });

    it("snaps to tab 1 when crossing midpoint", () => {
      expect(calculateSnappedTabIndex(201, clientWidth, 3)).toBe(1);
      expect(calculateSnappedTabIndex(400, clientWidth, 3)).toBe(1);
      expect(calculateSnappedTabIndex(590, clientWidth, 3)).toBe(1);
    });

    it("snaps to tab 2 when near end", () => {
      expect(calculateSnappedTabIndex(601, clientWidth, 3)).toBe(2);
      expect(calculateSnappedTabIndex(800, clientWidth, 3)).toBe(2);
    });

    it("clamps index boundaries properly", () => {
      expect(calculateSnappedTabIndex(-200, clientWidth, 3)).toBe(0);
      expect(calculateSnappedTabIndex(2000, clientWidth, 3)).toBe(2);
    });

    it("handles zero dimensions safely", () => {
      expect(calculateSnappedTabIndex(100, 0, 3)).toBe(0);
      expect(calculateSnappedTabIndex(100, clientWidth, 0)).toBe(0);
    });
  });

  describe("calculateBoundedSwipeTarget (Single-Step Pagination Invariant)", () => {
    it("advances by exactly +1 tab on intentional left swipe", () => {
      const target = calculateBoundedSwipeTarget({
        startIndex: 0,
        deltaX: -100,
        velocity: 0.1,
        clientWidth,
        totalTabs: 3,
      });
      expect(target).toBe(1);
    });

    it("STRICT INVARIANT: huge flick from tab 0 never skips tab 1 to reach tab 2", () => {
      const target = calculateBoundedSwipeTarget({
        startIndex: 0,
        deltaX: -800,
        velocity: 4.5, // Extremely high velocity flick
        clientWidth,
        totalTabs: 3,
      });
      expect(target).toBe(1); // STRICTLY 1, NEVER 2!
    });

    it("advances by exactly +1 tab on quick flick left", () => {
      const target = calculateBoundedSwipeTarget({
        startIndex: 0,
        deltaX: -30,
        velocity: 0.4,
        clientWidth,
        totalTabs: 3,
      });
      expect(target).toBe(1);
    });

    it("snaps back to start tab on weak/incomplete drag", () => {
      const target = calculateBoundedSwipeTarget({
        startIndex: 0,
        deltaX: -15,
        velocity: 0.05,
        clientWidth,
        totalTabs: 3,
      });
      expect(target).toBe(0);
    });

    it("moves by exactly -1 tab on intentional right swipe from tab 1", () => {
      const target = calculateBoundedSwipeTarget({
        startIndex: 1,
        deltaX: 100,
        velocity: 0.1,
        clientWidth,
        totalTabs: 3,
      });
      expect(target).toBe(0);
    });

    it("STRICT INVARIANT: huge flick right from tab 2 never skips tab 1 to reach tab 0", () => {
      const target = calculateBoundedSwipeTarget({
        startIndex: 2,
        deltaX: 900,
        velocity: 5.0, // Massive flick
        clientWidth,
        totalTabs: 3,
      });
      expect(target).toBe(1); // STRICTLY 1, NEVER 0!
    });

    it("clamps boundaries safely when swiping right at index 0", () => {
      const target = calculateBoundedSwipeTarget({
        startIndex: 0,
        deltaX: 200,
        velocity: 0.5,
        clientWidth,
        totalTabs: 3,
      });
      expect(target).toBe(0);
    });

    it("clamps boundaries safely when swiping left at last index (2)", () => {
      const target = calculateBoundedSwipeTarget({
        startIndex: 2,
        deltaX: -200,
        velocity: 0.5,
        clientWidth,
        totalTabs: 3,
      });
      expect(target).toBe(2);
    });
  });
});

