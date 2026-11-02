import { describe, expect, it } from 'vitest';
import { evaluateNominalString, stepDateString, matchTypeaheadCandidate, isAltEShortcut } from '@/lib/finance';

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

  describe('matchTypeaheadCandidate', () => {
    const accountCandidates = [
      { id: 'c', label: 'Cash', aliases: ['C'] },
      { id: 'b', label: 'BNI', aliases: ['B'] },
      { id: 'q', label: 'Bank Saqu', aliases: ['Q'] },
      { id: 'g', label: 'GoPay', aliases: ['G'] },
      { id: 's', label: 'ShopeePay', aliases: ['S'] },
      { id: 'j', label: 'Jago', aliases: ['J'] },
      { id: 'jy', label: 'Jago Yoel', aliases: ['JY'] },
      { id: 'sea', label: 'SeaBank', aliases: ['SEA'] },
      { id: 'o', label: 'OVO', aliases: ['O'] },
    ];

    const categoryCandidates = [
      { id: 'Home & Family', label: 'Home & Family' },
      { id: 'Food & Drinks', label: 'Food & Drinks' },
      { id: 'Transportation', label: 'Transportation' },
      { id: 'Personal Care', label: 'Personal Care' },
      { id: 'Leisure', label: 'Leisure' },
      { id: 'Medical', label: 'Medical' },
      { id: 'Other', label: 'Other' },
      { id: '𝓡AI', label: '𝓡AI' },
    ];

    it('matches single letter prefixes and cycles on repeated keypresses', () => {
      // First 'b' matches BNI
      const firstB = matchTypeaheadCandidate(accountCandidates, 'b');
      expect(firstB?.label).toBe('BNI');

      // Repeated 'b' cycles to Bank Saqu
      const secondB = matchTypeaheadCandidate(accountCandidates, 'b', 'b');
      expect(secondB?.label).toBe('Bank Saqu');

      // Next 'b' cycles back to BNI
      const thirdB = matchTypeaheadCandidate(accountCandidates, 'b', 'q');
      expect(thirdB?.label).toBe('BNI');
    });

    it('matches multi-character prefixes accurately', () => {
      expect(matchTypeaheadCandidate(accountCandidates, 'ban')?.label).toBe('Bank Saqu');
      expect(matchTypeaheadCandidate(accountCandidates, 'gop')?.label).toBe('GoPay');
      expect(matchTypeaheadCandidate(accountCandidates, 'sea')?.label).toBe('SeaBank');
      expect(matchTypeaheadCandidate(accountCandidates, 'jago y')?.label).toBe('Jago Yoel');
      expect(matchTypeaheadCandidate(accountCandidates, 'ov')?.label).toBe('OVO');
    });

    it('matches word boundaries and partial words', () => {
      // 'saqu' matches Bank Saqu
      expect(matchTypeaheadCandidate(accountCandidates, 'saqu')?.label).toBe('Bank Saqu');

      // 'drinks' matches Food & Drinks
      expect(matchTypeaheadCandidate(categoryCandidates, 'drinks')?.label).toBe('Food & Drinks');

      // 'family' matches Home & Family
      expect(matchTypeaheadCandidate(categoryCandidates, 'family')?.label).toBe('Home & Family');

      // 'care' matches Personal Care
      expect(matchTypeaheadCandidate(categoryCandidates, 'care')?.label).toBe('Personal Care');
    });

    it('matches category single letter shortcuts', () => {
      expect(matchTypeaheadCandidate(categoryCandidates, 'f')?.id).toBe('Food & Drinks');
      expect(matchTypeaheadCandidate(categoryCandidates, 't')?.id).toBe('Transportation');
      expect(matchTypeaheadCandidate(categoryCandidates, 'h')?.id).toBe('Home & Family');
      expect(matchTypeaheadCandidate(categoryCandidates, 'p')?.id).toBe('Personal Care');
      expect(matchTypeaheadCandidate(categoryCandidates, 'l')?.id).toBe('Leisure');
      expect(matchTypeaheadCandidate(categoryCandidates, 'm')?.id).toBe('Medical');
      expect(matchTypeaheadCandidate(categoryCandidates, 'o')?.id).toBe('Other');
    });

    it('returns null when no candidate matches', () => {
      expect(matchTypeaheadCandidate(accountCandidates, 'xyz')).toBeNull();
      expect(matchTypeaheadCandidate([], 'a')).toBeNull();
      expect(matchTypeaheadCandidate(accountCandidates, '')).toBeNull();
    });
  });
  describe('isAltEShortcut (Show/Hide Nominals Keyboard Toggle)', () => {
    it('matches Alt+e and Alt+E on standard keyboards', () => {
      expect(isAltEShortcut({ altKey: true, key: 'e' })).toBe(true);
      expect(isAltEShortcut({ altKey: true, key: 'E' })).toBe(true);
    });

    it('matches Option+E on macOS when code is KeyE (even if dead key accent acute)', () => {
      expect(isAltEShortcut({ altKey: true, code: 'KeyE' })).toBe(true);
      expect(isAltEShortcut({ altKey: true, key: '´', code: 'KeyE' })).toBe(true);
    });

    it('rejects plain "e" without altKey', () => {
      expect(isAltEShortcut({ altKey: false, key: 'e' })).toBe(false);
      expect(isAltEShortcut({ altKey: false, key: 'E' })).toBe(false);
      expect(isAltEShortcut({ altKey: false, code: 'KeyE' })).toBe(false);
    });

    it('rejects AltGr (ctrlKey + altKey) to prevent breaking European international layouts', () => {
      expect(isAltEShortcut({ altKey: true, ctrlKey: true, key: 'e', code: 'KeyE' })).toBe(false);
      expect(isAltEShortcut({ altKey: true, ctrlKey: true, key: '€', code: 'KeyE' })).toBe(false);
    });

    it('rejects metaKey (Cmd+Option) combos', () => {
      expect(isAltEShortcut({ altKey: true, metaKey: true, key: 'e', code: 'KeyE' })).toBe(false);
    });

    it('rejects other keys pressed with Alt (e.g. Alt+N, Alt+D)', () => {
      expect(isAltEShortcut({ altKey: true, key: 'n', code: 'KeyN' })).toBe(false);
      expect(isAltEShortcut({ altKey: true, key: 'd', code: 'KeyD' })).toBe(false);
      expect(isAltEShortcut({ altKey: true, key: 'Enter', code: 'Enter' })).toBe(false);
    });
  });
});
