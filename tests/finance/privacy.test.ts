import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readHideNominals,
  writeHideNominals,
  formatMaskedNominal,
  PRIVACY_STORAGE_KEY,
  PRIVACY_CHANGE_EVENT,
  MASKED_NOMINAL,
} from '@/lib/privacy';

class StorageMock {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const mockSessionStorage = new StorageMock();
let dispatchedEvents: CustomEvent[] = [];

Object.defineProperty(globalThis, 'window', {
  value: {
    sessionStorage: mockSessionStorage,
    dispatchEvent: (event: CustomEvent) => {
      dispatchedEvents.push(event);
      return true;
    },
  },
  writable: true,
});

describe('Privacy Module (Nominal Masking & Session Persistence)', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    dispatchedEvents = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Default Privacy Behavior', () => {
    it('defaults to hidden (true) on cold start when sessionStorage is empty', () => {
      expect(readHideNominals()).toBe(true);
    });

    it('returns true when sessionStorage throws or is unavailable', () => {
      const originalGetItem = mockSessionStorage.getItem;
      mockSessionStorage.getItem = () => {
        throw new Error('SecurityError: Access Denied');
      };
      expect(readHideNominals()).toBe(true);
      mockSessionStorage.getItem = originalGetItem;
    });
  });

  describe('Session Persistence (Stay revealed during session, reset on app kill)', () => {
    it('reveals nominals when explicitly set to false and persists during the session', () => {
      writeHideNominals(false);
      expect(mockSessionStorage.getItem(PRIVACY_STORAGE_KEY)).toBe('false');
      expect(readHideNominals()).toBe(false);
    });

    it('can be toggled back to hidden (true)', () => {
      writeHideNominals(false);
      expect(readHideNominals()).toBe(false);

      writeHideNominals(true);
      expect(mockSessionStorage.getItem(PRIVACY_STORAGE_KEY)).toBe('true');
      expect(readHideNominals()).toBe(true);
    });

    it('reverts to default hidden state when sessionStorage is cleared (app killed / tab closed)', () => {
      // User revealed nominals during active session
      writeHideNominals(false);
      expect(readHideNominals()).toBe(false);

      // Browser/OS closes tab or terminates process, clearing sessionStorage
      mockSessionStorage.clear();

      // Cold start in fresh session: nominals must be hidden by default
      expect(readHideNominals()).toBe(true);
    });

    it('dispatches PRIVACY_CHANGE_EVENT when visibility is toggled', () => {
      writeHideNominals(false);
      expect(dispatchedEvents.length).toBe(1);
      expect(dispatchedEvents[0].type).toBe(PRIVACY_CHANGE_EVENT);
      expect(dispatchedEvents[0].detail).toEqual({ hide: false });

      writeHideNominals(true);
      expect(dispatchedEvents.length).toBe(2);
      expect(dispatchedEvents[1].detail).toEqual({ hide: true });
    });
  });

  describe('formatMaskedNominal Formatter Helper', () => {
    const dummyFormatter = (num: number) => `Rp ${num.toLocaleString('id-ID')}`;

    it('returns MASKED_NOMINAL when hideNominals is true', () => {
      const result = formatMaskedNominal(500000, true, dummyFormatter);
      expect(result).toBe(MASKED_NOMINAL);
      expect(result).toBe('Rp ••••••');
    });

    it('masks positive amounts with + prefix when showPlusSign is true', () => {
      const result = formatMaskedNominal(15000000, true, dummyFormatter, { showPlusSign: true });
      expect(result).toBe('+Rp ••••••');
    });

    it('masks expense amounts with - prefix when isExpense is true', () => {
      const result = formatMaskedNominal(75000, true, dummyFormatter, { isExpense: true });
      expect(result).toBe('-Rp ••••••');
    });

    it('preserves custom suffix like /day when masked', () => {
      const result = formatMaskedNominal(120000, true, dummyFormatter, { suffix: '/day' });
      expect(result).toBe('Rp ••••••/day');
    });

    it('preserves custom text prefix when masked', () => {
      const result = formatMaskedNominal(120000, true, dummyFormatter, { prefix: 'Net:' });
      expect(result).toBe('Net: Rp ••••••');
    });

    it('unmasks and formats real values when hideNominals is false', () => {
      const revealedIncome = formatMaskedNominal(5000000, false, dummyFormatter, { showPlusSign: true });
      expect(revealedIncome).toBe('+Rp 5.000.000');

      const revealedExpense = formatMaskedNominal(25000, false, dummyFormatter, { isExpense: true });
      expect(revealedExpense).toBe('-Rp 25.000');

      const revealedBurnRate = formatMaskedNominal(45000, false, dummyFormatter, { suffix: '/day' });
      expect(revealedBurnRate).toBe('Rp 45.000/day');
    });
  });
});
