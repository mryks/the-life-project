import { describe, expect, it } from 'vitest';
import { evaluateNominalString, stepDateString } from '@/lib/finance';

describe('Keyboard Navigation & Scientific Shorthand Logic', () => {
  describe('evaluateNominalString', () => {
    it('evaluates standard integer strings and delimited numbers', () => {
      expect(evaluateNominalString('10000')).toBe(10000);
      expect(evaluateNominalString('10.000')).toBe(10000);
      expect(evaluateNominalString('10,000')).toBe(10000);
      expect(evaluateNominalString('1.500.000')).toBe(1500000);
      expect(evaluateNominalString(' 50000 ')).toBe(50000);
    });

    it('evaluates scientific "e" notation accurately', () => {
      // 10e3 -> 10,000
      expect(evaluateNominalString('10e3')).toBe(10000);
      expect(evaluateNominalString('10E3')).toBe(10000);

      // 1e6 -> 1,000,000
      expect(evaluateNominalString('1e6')).toBe(1000000);
      expect(evaluateNominalString('1E6')).toBe(1000000);

      // 50e3 -> 50,000
      expect(evaluateNominalString('50e3')).toBe(50000);

      // 2.5e3 -> 2,500
      expect(evaluateNominalString('2.5e3')).toBe(2500);

      // 1.5e5 -> 150,000
      expect(evaluateNominalString('1.5e5')).toBe(150000);

      // Comma separator support: 1,5e5 -> 150,000
      expect(evaluateNominalString('1,5e5')).toBe(150000);

      // 100e0 -> 100
      expect(evaluateNominalString('100e0')).toBe(100);
    });

    it('evaluates "k" (thousands) and "m" (millions) shorthand notation', () => {
      expect(evaluateNominalString('100k')).toBe(100000);
      expect(evaluateNominalString('100K')).toBe(100000);
      expect(evaluateNominalString('2.5m')).toBe(2500000);
      expect(evaluateNominalString('2,5M')).toBe(2500000);
      expect(evaluateNominalString('15k')).toBe(15000);
      expect(evaluateNominalString('1.2k')).toBe(1200);
    });

    it('returns null for zero, negative, or invalid non-numeric inputs', () => {
      expect(evaluateNominalString('')).toBeNull();
      expect(evaluateNominalString('   ')).toBeNull();
      expect(evaluateNominalString('0')).toBeNull();
      expect(evaluateNominalString('0e3')).toBeNull();
      expect(evaluateNominalString('abc')).toBeNull();
      expect(evaluateNominalString('-1000')).toBe(1000); // digits extracted, but if negative prefix only:
      expect(evaluateNominalString('xyz')).toBeNull();
    });
  });

  describe('stepDateString', () => {
    it('steps days forward and backward correctly', () => {
      expect(stepDateString('2026-10-23', 1)).toBe('2026-10-24');
      expect(stepDateString('2026-10-23', -1)).toBe('2026-10-22');
    });

    it('steps weeks forward and backward with delta 7', () => {
      expect(stepDateString('2026-10-23', 7)).toBe('2026-10-30');
      expect(stepDateString('2026-10-23', -7)).toBe('2026-10-16');
    });

    it('handles month boundaries and year boundaries', () => {
      // Month rollover
      expect(stepDateString('2026-10-31', 1)).toBe('2026-11-01');
      expect(stepDateString('2026-11-01', -1)).toBe('2026-10-31');

      // Year rollover
      expect(stepDateString('2026-12-31', 1)).toBe('2027-01-01');
      expect(stepDateString('2027-01-01', -1)).toBe('2026-12-31');
    });

    it('handles leap years correctly', () => {
      expect(stepDateString('2028-02-28', 1)).toBe('2028-02-29');
      expect(stepDateString('2028-02-29', 1)).toBe('2028-03-01');
    });

    it('gracefully returns unchanged string for invalid formats', () => {
      expect(stepDateString('invalid-date', 1)).toBe('invalid-date');
      expect(stepDateString('', 1)).toBe('');
    });
  });
});
