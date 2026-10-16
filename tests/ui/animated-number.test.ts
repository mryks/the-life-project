import { describe, it, expect } from "vitest";
import {
  formatIDR,
  getDigitAtCol,
  buildReelDigits,
  calculateColumnTiming,
  calculateMaxChangedCol,
  calculateRevolutions,
} from "@/components/ui/animated-number";

describe("Animated Number: Mechanical Gear Ratio & Units-First Cascade", () => {
  // =========================================================================
  // 1. IDR Currency Formatting (formatIDR)
  // =========================================================================
  describe("formatIDR — Indonesian Rupiah Dot Formatting", () => {
    it("formats zero as '0'", () => {
      expect(formatIDR(0)).toBe("0");
      expect(formatIDR(-0)).toBe("0");
    });

    it("formats single and double digits without dots", () => {
      expect(formatIDR(5)).toBe("5");
      expect(formatIDR(9)).toBe("9");
      expect(formatIDR(42)).toBe("42");
      expect(formatIDR(99)).toBe("99");
    });

    it("formats hundreds without dots", () => {
      expect(formatIDR(100)).toBe("100");
      expect(formatIDR(500)).toBe("500");
      expect(formatIDR(999)).toBe("999");
    });

    it("formats thousands with single dot delimiter", () => {
      expect(formatIDR(1000)).toBe("1.000");
      expect(formatIDR(25000)).toBe("25.000");
      expect(formatIDR(100000)).toBe("100.000");
      expect(formatIDR(999999)).toBe("999.999");
    });

    it("formats millions and billions with multiple dot delimiters", () => {
      expect(formatIDR(1000000)).toBe("1.000.000");
      expect(formatIDR(48250000)).toBe("48.250.000");
      expect(formatIDR(1500000000)).toBe("1.500.000.000");
    });

    it("formats negative amounts with leading minus sign", () => {
      expect(formatIDR(-50000)).toBe("-50.000");
      expect(formatIDR(-1000)).toBe("-1.000");
      expect(formatIDR(-48250000)).toBe("-48.250.000");
      expect(formatIDR(-5)).toBe("-5");
    });

    it("handles floating point inputs by rounding to nearest integer", () => {
      expect(formatIDR(1000.4)).toBe("1.000");
      expect(formatIDR(1000.6)).toBe("1.001");
      expect(formatIDR(-50000.7)).toBe("-50.001");
    });

    it("handles non-finite and NaN values safely by returning '0'", () => {
      expect(formatIDR(NaN)).toBe("0");
      expect(formatIDR(Infinity)).toBe("0");
      expect(formatIDR(-Infinity)).toBe("0");
    });
  });

  // =========================================================================
  // 2. Place Value Single Digit Extraction (getDigitAtCol)
  // =========================================================================
  describe("getDigitAtCol — Place Value Extraction (10^col)", () => {
    const testNumber = 48250163; // 48.250.163

    it("extracts units (10^0 / satuan) at col 0", () => {
      expect(getDigitAtCol(testNumber, 0)).toBe(3);
    });

    it("extracts tens (10^1 / puluhan) at col 1", () => {
      expect(getDigitAtCol(testNumber, 1)).toBe(6);
    });

    it("extracts hundreds (10^2 / ratusan) at col 2", () => {
      expect(getDigitAtCol(testNumber, 2)).toBe(1);
    });

    it("extracts thousands (10^3 / ribuan) at col 3", () => {
      expect(getDigitAtCol(testNumber, 3)).toBe(0);
    });

    it("extracts ten-thousands (10^4 / puluhan ribu) at col 4", () => {
      expect(getDigitAtCol(testNumber, 4)).toBe(5);
    });

    it("extracts hundred-thousands (10^5 / ratusan ribu) at col 5", () => {
      expect(getDigitAtCol(testNumber, 5)).toBe(2);
    });

    it("extracts millions (10^6 / jutaan) at col 6", () => {
      expect(getDigitAtCol(testNumber, 6)).toBe(8);
    });

    it("extracts ten-millions (10^7 / puluhan juta) at col 7", () => {
      expect(getDigitAtCol(testNumber, 7)).toBe(4);
    });

    it("returns 0 for columns beyond the number's magnitude", () => {
      expect(getDigitAtCol(testNumber, 8)).toBe(0);
      expect(getDigitAtCol(testNumber, 12)).toBe(0);
    });

    it("handles negative numbers identically using absolute value", () => {
      expect(getDigitAtCol(-testNumber, 0)).toBe(3);
      expect(getDigitAtCol(-testNumber, 7)).toBe(4);
    });

    it("returns 0 for all columns when value is 0", () => {
      for (let c = 0; c <= 8; c++) {
        expect(getDigitAtCol(0, c)).toBe(0);
      }
    });
  });

  // =========================================================================
  // 3. Units-First Cascading Timing (calculateColumnTiming)
  // =========================================================================
  describe("calculateColumnTiming — Units-First Cascade & Time-Budget Invariant", () => {
    const baseDuration = 2.5; // 2500ms
    const baseDelay = 0.71;   // 710ms
    const staggerStep = 0.05; // 50ms

    it("column 0 (satuan) starts at the earliest delay (baseDelay)", () => {
      const timing0 = calculateColumnTiming(0, baseDuration, baseDelay, staggerStep);
      expect(timing0.columnDelay).toBe(baseDelay);
      expect(timing0.columnDuration).toBe(baseDuration);
    });

    it("delays strictly increase from right-to-left (units -> tens -> hundreds -> thousands)", () => {
      const t0 = calculateColumnTiming(0, baseDuration, baseDelay, staggerStep);
      const t1 = calculateColumnTiming(1, baseDuration, baseDelay, staggerStep);
      const t2 = calculateColumnTiming(2, baseDuration, baseDelay, staggerStep);
      const t3 = calculateColumnTiming(3, baseDuration, baseDelay, staggerStep);
      const t4 = calculateColumnTiming(4, baseDuration, baseDelay, staggerStep);

      expect(t0.columnDelay).toBeLessThan(t1.columnDelay);
      expect(t1.columnDelay).toBeLessThan(t2.columnDelay);
      expect(t2.columnDelay).toBeLessThan(t3.columnDelay);
      expect(t3.columnDelay).toBeLessThan(t4.columnDelay);

      // Verify exact 50ms increments
      expect(t0.columnDelay).toBeCloseTo(0.71, 5);
      expect(t1.columnDelay).toBeCloseTo(0.76, 5);
      expect(t2.columnDelay).toBeCloseTo(0.81, 5);
      expect(t3.columnDelay).toBeCloseTo(0.86, 5);
      expect(t4.columnDelay).toBeCloseTo(0.91, 5);
    });

    it("strictly preserves the total time-budget invariant (columnDelay + columnDuration <= baseDelay + baseDuration)", () => {
      const maxBudget = baseDelay + baseDuration; // 3.21s

      for (let col = 0; col <= 15; col++) {
        const { columnDelay, columnDuration } = calculateColumnTiming(
          col,
          baseDuration,
          baseDelay,
          staggerStep
        );

        // Invariant: no column may extend past baseDelay + baseDuration
        expect(columnDelay + columnDuration).toBeLessThanOrEqual(maxBudget + 1e-9);
      }
    });

    it("clamps column duration to minimum 0.8s for very high columns", () => {
      const highColTiming = calculateColumnTiming(50, baseDuration, baseDelay, staggerStep);
      expect(highColTiming.columnDuration).toBe(0.8);
    });

    it("supports custom duration, delay, and stagger parameters", () => {
      const custom = calculateColumnTiming(2, 3.0, 1.0, 0.1);
      // col 2: delay = 1.0 + 2 * 0.1 = 1.2
      // duration = max(0.8, 3.0 - 2 * 0.1) = 2.8
      expect(custom.columnDelay).toBeCloseTo(1.2, 5);
      expect(custom.columnDuration).toBeCloseTo(2.8, 5);
      expect(custom.columnDelay + custom.columnDuration).toBeCloseTo(4.0, 5);
    });
  });

  // =========================================================================
  // 4. Mechanical Gear Ratio Revolutions (calculateMaxChangedCol & calculateRevolutions)
  // =========================================================================
  describe("Mechanical Gear Ratio — Place-Value Revolutions & Change Detection", () => {
    describe("calculateMaxChangedCol", () => {
      it("returns -1 when there is no change between value and fromValue", () => {
        expect(calculateMaxChangedCol(48250000, 48250000)).toBe(-1);
        expect(calculateMaxChangedCol(0, 0)).toBe(-1);
        expect(calculateMaxChangedCol(1000, undefined)).toBe(-1);
      });

      it("detects thousands place as highest changed place for a delta of Rp 1.000", () => {
        // 48.250.000 -> 48.249.000 (delta = 1.000, changes 50.000 to 49.000)
        const maxCol = calculateMaxChangedCol(48249000, 48250000);
        expect(maxCol).toBe(4); // 5 in 10^4 changed to 4 in 10^4!
      });

      it("detects exact delta place value for simple step change (e.g. 5.000 -> 6.000)", () => {
        const maxCol = calculateMaxChangedCol(6000, 5000);
        expect(maxCol).toBe(3); // 10^3 (thousands)
      });

      it("detects millions place for a delta of Rp 5.000.000", () => {
        const maxCol = calculateMaxChangedCol(45000000, 40000000);
        expect(maxCol).toBe(6); // 10^6 (millions)
      });
    });

    describe("calculateRevolutions", () => {
      it("returns 0 revolutions for all columns when there is no change", () => {
        for (let col = 0; col <= 8; col++) {
          expect(calculateRevolutions(col, -1, false)).toBe(0);
        }
      });

      it("allocates 2 revolutions to units wheel (col 0) when change is active", () => {
        const maxChangedCol = 3;
        expect(calculateRevolutions(0, maxChangedCol, true)).toBe(2);
      });

      it("allocates 1 revolution to tens (col 1) and hundreds (col 2)", () => {
        const maxChangedCol = 3;
        expect(calculateRevolutions(1, maxChangedCol, true)).toBe(1);
        expect(calculateRevolutions(2, maxChangedCol, true)).toBe(1);
      });

      it("allocates 0 revolutions (direct step) to columns >= 3 at or below maxChangedCol", () => {
        const maxChangedCol = 5;
        expect(calculateRevolutions(3, maxChangedCol, true)).toBe(0);
        expect(calculateRevolutions(4, maxChangedCol, true)).toBe(0);
        expect(calculateRevolutions(5, maxChangedCol, true)).toBe(0);
      });

      it("allocates 0 revolutions to unchanged columns above maxChangedCol", () => {
        const maxChangedCol = 3; // e.g. Rp 1.000 delta
        expect(calculateRevolutions(4, maxChangedCol, true)).toBe(0);
        expect(calculateRevolutions(6, maxChangedCol, true)).toBe(0);
        expect(calculateRevolutions(7, maxChangedCol, true)).toBe(0);
      });
    });
  });

  // =========================================================================
  // 5. Mechanical Reel Generation & Landing Accuracy (buildReelDigits)
  // =========================================================================
  describe("buildReelDigits — Mechanical Reel Strip & Landing Accuracy Invariant", () => {
    it("generates 20 complete revolution steps for units wheel even when fromDigit === targetDigit (0 -> 0)", () => {
      // Units reel with 2 revolutions: 2 * 10 + 0 = 20 steps -> 21 digits in strip
      const reel = buildReelDigits(0, 0, 2, false);
      expect(reel.length).toBe(21);
      expect(reel[0]).toBe(0);
      expect(reel[reel.length - 1]).toBe(0);
    });

    it("generates 10 complete revolution steps for tens/hundreds with 1 revolution when fromDigit === targetDigit", () => {
      const reel = buildReelDigits(5, 5, 1, false);
      expect(reel.length).toBe(11); // 10 steps + initial
      expect(reel[0]).toBe(5);
      expect(reel[reel.length - 1]).toBe(5);
    });

    it("generates single static digit array [digit] when revolutions is 0 and fromDigit === targetDigit", () => {
      const reel = buildReelDigits(8, 8, 0, false);
      expect(reel).toEqual([8]);
      expect(reel.length).toBe(1);
    });

    it("correctly rolls upward when isIncreasing is true", () => {
      // 3 -> 7 with 0 revolutions: steps are 3 -> 4 -> 5 -> 6 -> 7
      const reel = buildReelDigits(3, 7, 0, true);
      expect(reel).toEqual([3, 4, 5, 6, 7]);
      expect(reel[0]).toBe(3);
      expect(reel[reel.length - 1]).toBe(7);
    });

    it("correctly rolls downward when isIncreasing is false", () => {
      // 7 -> 3 with 0 revolutions: steps are 7 -> 6 -> 5 -> 4 -> 3
      const reel = buildReelDigits(7, 3, 0, false);
      expect(reel).toEqual([7, 6, 5, 4, 3]);
      expect(reel[0]).toBe(7);
      expect(reel[reel.length - 1]).toBe(3);
    });

    it("handles modulo 10 wrap-around when rolling upward (e.g. 8 -> 2)", () => {
      // 8 -> 2 upward: 8 -> 9 -> 0 -> 1 -> 2 (4 delta steps)
      const reel = buildReelDigits(8, 2, 0, true);
      expect(reel).toEqual([8, 9, 0, 1, 2]);
      expect(reel[reel.length - 1]).toBe(2);
    });

    it("handles modulo 10 wrap-around when rolling downward (e.g. 2 -> 8)", () => {
      // 2 -> 8 downward: 2 -> 1 -> 0 -> 9 -> 8 (4 delta steps)
      const reel = buildReelDigits(2, 8, 0, false);
      expect(reel).toEqual([2, 1, 0, 9, 8]);
      expect(reel[reel.length - 1]).toBe(8);
    });

    it("combines full revolutions with delta steps (e.g. 2 -> 5 with 1 revolution)", () => {
      // upward: 1 rev (10 steps) + (5 - 2 = 3 steps) = 13 steps -> 14 digits
      const reel = buildReelDigits(2, 5, 1, true);
      expect(reel.length).toBe(14);
      expect(reel[0]).toBe(2);
      expect(reel[reel.length - 1]).toBe(5);
    });

    it("guarantees 100% landing accuracy: reelDigits[last] === targetDigit across all 100 digit pairs", () => {
      for (let from = 0; from <= 9; from++) {
        for (let target = 0; target <= 9; target++) {
          for (const rev of [0, 1, 2]) {
            for (const isInc of [true, false]) {
              const reel = buildReelDigits(from, target, rev, isInc);

              // 1. First digit must be fromDigit (unless static target)
              if (from === target && rev === 0) {
                expect(reel).toEqual([target]);
              } else {
                expect(reel[0]).toBe(from);
              }

              // 2. Last digit must STRICTLY equal targetDigit
              expect(reel[reel.length - 1]).toBe(target);

              // 3. Consecutive step monotonicity modulo 10
              for (let i = 1; i < reel.length; i++) {
                const prev = reel[i - 1];
                const curr = reel[i];
                if (isInc) {
                  expect(curr).toBe((prev + 1) % 10);
                } else {
                  expect(curr).toBe((prev - 1 + 10) % 10);
                }
              }
            }
          }
        }
      }
    });
  });

  // =========================================================================
  // 6. Real-World Financial Scenarios (End-to-End Mechanical Simulation)
  // =========================================================================
  describe("Real-World Financial Scenarios: Mechanical Rolling Simulation", () => {
    it("Scenario A: Daily Expense of Rp 1.000 (Rp 48.250.000 -> Rp 48.249.000)", () => {
      const fromVal = 48250000;
      const targetVal = 48249000;
      const isIncreasing = targetVal >= fromVal; // false (expense)

      expect(formatIDR(fromVal)).toBe("48.250.000");
      expect(formatIDR(targetVal)).toBe("48.249.000");
      expect(isIncreasing).toBe(false);

      const maxChangedCol = calculateMaxChangedCol(targetVal, fromVal);
      expect(maxChangedCol).toBe(4); // 50.000 -> 49.000 changes at ten-thousands

      // Column 0 (Units / Satuan: from 0 to 0)
      const uRev = calculateRevolutions(0, maxChangedCol, true);
      expect(uRev).toBe(2); // Units wheel spins 2 full revolutions!
      const uReel = buildReelDigits(0, 0, uRev, isIncreasing);
      expect(uReel.length).toBe(21);
      expect(uReel[0]).toBe(0);
      expect(uReel[uReel.length - 1]).toBe(0);

      // Column 1 (Tens / Puluhan: from 0 to 0)
      const tRev = calculateRevolutions(1, maxChangedCol, true);
      expect(tRev).toBe(1); // 1 revolution
      const tReel = buildReelDigits(0, 0, tRev, isIncreasing);
      expect(tReel.length).toBe(11);
      expect(tReel[0]).toBe(0);
      expect(tReel[tReel.length - 1]).toBe(0);

      // Column 2 (Hundreds / Ratusan: from 0 to 0)
      const hRev = calculateRevolutions(2, maxChangedCol, true);
      expect(hRev).toBe(1); // 1 revolution
      const hReel = buildReelDigits(0, 0, hRev, isIncreasing);
      expect(hReel.length).toBe(11);
      expect(hReel[0]).toBe(0);
      expect(hReel[hReel.length - 1]).toBe(0);

      // Column 3 (Thousands / Ribuan: from 0 to 9)
      const thRev = calculateRevolutions(3, maxChangedCol, true);
      expect(thRev).toBe(0); // direct step
      const thReel = buildReelDigits(0, 9, thRev, isIncreasing);
      expect(thReel).toEqual([0, 9]); // rolls 0 -> 9
      expect(thReel[thReel.length - 1]).toBe(9);

      // Column 4 (Ten-Thousands / Puluhan Ribu: from 5 to 4)
      const tthRev = calculateRevolutions(4, maxChangedCol, true);
      expect(tthRev).toBe(0); // direct step
      const tthReel = buildReelDigits(5, 4, tthRev, isIncreasing);
      expect(tthReel).toEqual([5, 4]); // rolls 5 -> 4
      expect(tthReel[tthReel.length - 1]).toBe(4);

      // Column 6 (Millions: unchanged digit 8 in Rp 48.xxx.xxx)
      const mRev = calculateRevolutions(6, maxChangedCol, true);
      expect(mRev).toBe(0);
      const mReel = buildReelDigits(8, 8, mRev, isIncreasing);
      expect(mReel).toEqual([8]); // Single static element, does NOT spin!

      // Column 7 (Ten-Millions: unchanged digit 4 in Rp 48.xxx.xxx)
      const tmRev = calculateRevolutions(7, maxChangedCol, true);
      expect(tmRev).toBe(0);
      const tmReel = buildReelDigits(4, 4, tmRev, isIncreasing);
      expect(tmReel).toEqual([4]); // Single static element, does NOT spin!
    });

    it("Scenario B: Salary Income of Rp 15.000.000 (Rp 10.000.000 -> Rp 25.000.000)", () => {
      const fromVal = 10000000;
      const targetVal = 25000000;
      const isIncreasing = targetVal >= fromVal; // true (income)

      expect(formatIDR(targetVal)).toBe("25.000.000");
      expect(isIncreasing).toBe(true);

      const maxChangedCol = calculateMaxChangedCol(targetVal, fromVal);
      expect(maxChangedCol).toBe(7); // Changes at ten-millions (10M -> 25M)

      // Units wheel spins 2 revolutions upward
      const uRev = calculateRevolutions(0, maxChangedCol, true);
      expect(uRev).toBe(2);
      const uReel = buildReelDigits(0, 0, uRev, isIncreasing);
      expect(uReel.length).toBe(21);
      expect(uReel[0]).toBe(0);
      expect(uReel[uReel.length - 1]).toBe(0);
      // Upward spin sequence check
      expect(uReel.slice(0, 4)).toEqual([0, 1, 2, 3]);

      // Column 7 (Ten-Millions: 1 -> 2)
      const tmRev = calculateRevolutions(7, maxChangedCol, true);
      expect(tmRev).toBe(0);
      const tmReel = buildReelDigits(1, 2, tmRev, isIncreasing);
      expect(tmReel).toEqual([1, 2]);
    });

    it("Scenario C: Negative Net Worth Transition (-Rp 50.000 -> -Rp 100.000)", () => {
      const fromVal = -50000;
      const targetVal = -100000;
      const isIncreasing = targetVal >= fromVal; // false

      expect(formatIDR(fromVal)).toBe("-50.000");
      expect(formatIDR(targetVal)).toBe("-100.000");
      expect(isIncreasing).toBe(false);

      const maxChangedCol = calculateMaxChangedCol(targetVal, fromVal);
      expect(maxChangedCol).toBeGreaterThanOrEqual(4);

      // Verify landing accuracy for negative balance change
      const targetUnits = getDigitAtCol(targetVal, 0);
      const fromUnits = getDigitAtCol(fromVal, 0);
      const uReel = buildReelDigits(fromUnits, targetUnits, 2, isIncreasing);
      expect(uReel[uReel.length - 1]).toBe(targetUnits);
    });
  });
});
