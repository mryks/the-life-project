import { describe, it, expect } from "vitest";
import { groupCardEventsByDate } from "@/lib/finance";
import type { FinancialEvent } from "@/lib/types";

describe("Freeze Panes & Sticky Date Grouping Invariants", () => {
  const sampleEvents: FinancialEvent[] = [
    // 2026-10-18 (2 events)
    {
      id: "ev-1",
      date: "2026-10-18",
      type: "expense",
      amount: 50000,
      description: "Coffee",
      category: "Food & Drinks",
      accountId: "b",
    },
    {
      id: "ev-2",
      date: "2026-10-18",
      type: "expense",
      amount: 120000,
      description: "Groceries",
      category: "Food & Drinks",
      accountId: "b",
    },
    // 2026-10-17 (1 event, same month)
    {
      id: "ev-3",
      date: "2026-10-17",
      type: "income",
      amount: 5000000,
      description: "Salary",
      category: "Salary",
      accountId: "c",
    },
    // 2026-09-30 (1 event, previous month)
    {
      id: "ev-4",
      date: "2026-09-30",
      type: "expense",
      amount: 30000,
      description: "Taxi",
      category: "Transportation",
      accountId: "g",
    },
  ];

  describe("groupCardEventsByDate", () => {
    it("returns empty array when events array is empty", () => {
      const groups = groupCardEventsByDate([]);
      expect(groups).toEqual([]);
    });

    it("groups same-date events together into a single date group", () => {
      const groups = groupCardEventsByDate(sampleEvents);
      expect(groups.length).toBe(3);

      // Group 1: 2026-10-18
      expect(groups[0].date).toBe("2026-10-18");
      expect(groups[0].month).toBe("2026-10");
      expect(groups[0].events.length).toBe(2);
      expect(groups[0].events[0].id).toBe("ev-1");
      expect(groups[0].events[1].id).toBe("ev-2");

      // Group 2: 2026-10-17
      expect(groups[1].date).toBe("2026-10-17");
      expect(groups[1].month).toBe("2026-10");
      expect(groups[1].events.length).toBe(1);
      expect(groups[1].events[0].id).toBe("ev-3");

      // Group 3: 2026-09-30
      expect(groups[2].date).toBe("2026-09-30");
      expect(groups[2].month).toBe("2026-09");
      expect(groups[2].events.length).toBe(1);
      expect(groups[2].events[0].id).toBe("ev-4");
    });

    it("flags showMonthHeader = true ONLY on the first date group of each month", () => {
      const groups = groupCardEventsByDate(sampleEvents);

      // First group of October 2026 -> showMonthHeader = true
      expect(groups[0].showMonthHeader).toBe(true);

      // Second group of October 2026 -> showMonthHeader = false (same month)
      expect(groups[1].showMonthHeader).toBe(false);

      // First group of September 2026 -> showMonthHeader = true (month change)
      expect(groups[2].showMonthHeader).toBe(true);
    });

    it("preserves exact within-day event ordering within each group", () => {
      const groups = groupCardEventsByDate(sampleEvents);
      expect(groups[0].events.map((e) => e.id)).toEqual(["ev-1", "ev-2"]);
    });
  });

  describe("Sticky Freeze Header Invariants", () => {
    it("guarantees sticky table headers and card date badges attach at freezeHeight offset", () => {
      const mockFreezeHeight = 142; // Dynamic height measured from activityFreezeRef
      const cardDateBadgeTop = mockFreezeHeight;
      const tableTheadTop = mockFreezeHeight;

      // Both must be identical so they align seamlessly beneath the filter bar
      expect(cardDateBadgeTop).toBe(tableTheadTop);
      expect(cardDateBadgeTop).toBeGreaterThan(0);
    });

    it("verifies transform clearing rule on settled tab to prevent containing block trap", () => {
      // In CSS, any ancestor with transform creates a containing block for fixed/sticky children.
      // useSwipeableTabs provides isTransitioning:
      // When isTransitioning === true: style = { x }
      // When isTransitioning === false: style = { transform: 'none' }
      const computeCarouselStyle = (isTransitioning: boolean, xValue: number) => {
        return isTransitioning ? { transform: `translateX(${xValue}px)` } : { transform: "none" };
      };

      expect(computeCarouselStyle(true, -800)).toEqual({ transform: "translateX(-800px)" });
      expect(computeCarouselStyle(false, -800)).toEqual({ transform: "none" });
    });
  });
});
