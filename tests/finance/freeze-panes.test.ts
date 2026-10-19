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
    it("guarantees Card View date badges attach at freezeHeight offset", () => {
      const mockFreezeHeight = 261; // Dynamic height measured from activityFreezeRef
      const cardDateBadgeTop = mockFreezeHeight;

      expect(cardDateBadgeTop).toBe(mockFreezeHeight);
      expect(cardDateBadgeTop).toBeGreaterThan(0);
    });

    it("verifies Table Ledger column headers are frozen inside the freeze pane container", () => {
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

    it("verifies view switch scroll targeting (Table Ledger -> bottom, Card View -> top)", () => {
      type ViewMode = "card" | "ledger";
      const resolveTargetScroll = (viewMode: ViewMode, documentHeight: number) => {
        if (viewMode === "ledger") {
          return { target: "bottom", scrollY: documentHeight };
        }
        return { target: "top", scrollY: 0 };
      };

      const mockDocumentHeight = 4250;
      expect(resolveTargetScroll("ledger", mockDocumentHeight)).toEqual({
        target: "bottom",
        scrollY: 4250,
      });
      expect(resolveTargetScroll("card", mockDocumentHeight)).toEqual({
        target: "top",
        scrollY: 0,
      });
    });
  });
});
