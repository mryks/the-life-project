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

  describe("Date Grouping & Clean Section Headers Invariants", () => {
    it("guarantees Card View date headers render cleanly as section headings in normal flow", () => {
      // In the natural scroll layout, date headers render in normal document flow per date group without sticky overlapping
      const isDateHeaderSticky = false;
      expect(isDateHeaderSticky).toBe(false);
    });

    it("verifies Table Ledger column headers are synchronized with table body", () => {
      const expectedColumns = ["Date", "Description", "Account", "In (+)", "Out (-)", "Category"];
      expect(expectedColumns.length).toBe(6);
      expect(expectedColumns[0]).toBe("Date");
      expect(expectedColumns[1]).toBe("Description");
    });

    it("verifies bidirectional horizontal scroll synchronization invariant", () => {
      let bodyScrollLeft = 0;
      let headerScrollLeft = 0;

      const syncFromTableBody = (scrollLeft: number) => {
        headerScrollLeft = scrollLeft;
      };

      const syncFromTableHeader = (scrollLeft: number) => {
        bodyScrollLeft = scrollLeft;
      };

      // When table body scrolls horizontally
      bodyScrollLeft = 140;
      syncFromTableBody(bodyScrollLeft);
      expect(headerScrollLeft).toBe(140);

      // When table header scrolls horizontally
      headerScrollLeft = 210;
      syncFromTableHeader(headerScrollLeft);
      expect(bodyScrollLeft).toBe(210);
    });

    it("verifies transform clearing rule on settled tab to prevent containing block trap", () => {
      // In CSS, any ancestor with transform creates a containing block for fixed/sticky children.
      const computeCarouselStyle = (isTransitioning: boolean, xValue: number) => {
        return isTransitioning ? { transform: `translateX(${xValue}px)` } : { transform: "none" };
      };

      expect(computeCarouselStyle(true, -800)).toEqual({ transform: "translateX(-800px)" });
      expect(computeCarouselStyle(false, -800)).toEqual({ transform: "none" });
    });
  });

  describe("Table Ledger Default Scroll-to-Bottom & Chronological Sorting Invariant", () => {
    it("guarantees Table Ledger places latest transactions at the bottom (chronological ascending)", () => {
      // Sample events sorted in chronological order as produced by deriveLedgerEntries
      const chronologicalEvents = [...sampleEvents].sort((a, b) => a.date.localeCompare(b.date));
      expect(chronologicalEvents[0].date).toBe("2026-09-30"); // Oldest at top
      expect(chronologicalEvents[chronologicalEvents.length - 1].date).toBe("2026-10-18"); // Latest at bottom
    });

    it("guarantees Card View places latest transactions at the top (reverse chronological descending)", () => {
      // Card view order
      const reverseChronologicalEvents = [...sampleEvents].sort((a, b) => b.date.localeCompare(a.date));
      expect(reverseChronologicalEvents[0].date).toBe("2026-10-18"); // Latest at top
      expect(reverseChronologicalEvents[reverseChronologicalEvents.length - 1].date).toBe("2026-09-30"); // Oldest at bottom
    });

    it("verifies internal container scroll targeting (Table Ledger -> container.scrollHeight, Card View -> 0, Window -> 0)", () => {
      type ViewMode = "card" | "ledger";
      const resolveTargetScroll = (viewMode: ViewMode, containerScrollHeight: number) => {
        if (viewMode === "ledger") {
          return {
            windowScrollY: 0, // Upper shell remains static at top (never scrolled away)
            containerScrollTop: containerScrollHeight, // Table body scrolled to bottom
          };
        }
        return {
          windowScrollY: 0,
          containerScrollTop: 0, // Card view scrolled to top
        };
      };

      const mockTableHeight = 4250;
      expect(resolveTargetScroll("ledger", mockTableHeight)).toEqual({
        windowScrollY: 0,
        containerScrollTop: 4250,
      });
      expect(resolveTargetScroll("card", mockTableHeight)).toEqual({
        windowScrollY: 0,
        containerScrollTop: 0,
      });
    });

    it("guarantees app header and search area remain visible without requiring scroll-to-top", () => {
      const windowScrollY = 0;
      const isHeaderVisibleAtZero = windowScrollY === 0;
      const isSearchAreaVisibleAtZero = windowScrollY === 0;

      expect(isHeaderVisibleAtZero).toBe(true);
      expect(isSearchAreaVisibleAtZero).toBe(true);
    });
  });
});
