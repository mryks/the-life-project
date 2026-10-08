// tests/finance/security.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateSalt,
  hashPin,
  isMasterPinSet,
  setupMasterPin,
  verifyMasterPin,
  isSessionUnlocked,
  unlockSession,
  lockSession,
  touchActivity,
  IDLE_TIMEOUT_MS,
  MAX_FAILED_ATTEMPTS,
  SECURITY_STORAGE_KEYS,
} from '@/lib/security';

class StorageMock {
  private store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, value); }
  removeItem(key: string) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

const mockLocalStorage = new StorageMock();
const mockSessionStorage = new StorageMock();

Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: mockLocalStorage,
    sessionStorage: mockSessionStorage,
    dispatchEvent: () => true,
    crypto: globalThis.crypto,
  },
  writable: true,
});
Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
});

describe('Security & Master PIN Architecture', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockSessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Salt and Hashing', () => {
    it('generates a 32-character hexadecimal salt (16 bytes)', () => {
      const salt = generateSalt(16);
      expect(salt).toHaveLength(32);
      expect(/^[0-9a-f]{32}$/.test(salt)).toBe(true);
    });

    it('generates unique salts on consecutive calls', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).not.toBe(salt2);
    });

    it('produces a deterministic 64-character SHA-256 hash for identical PIN and salt', async () => {
      const salt = 'abcdef1234567890abcdef1234567890';
      const hash1 = await hashPin('123456', salt);
      const hash2 = await hashPin('123456', salt);

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different PINs with the same salt', async () => {
      const salt = 'abcdef1234567890abcdef1234567890';
      const hashA = await hashPin('123456', salt);
      const hashB = await hashPin('654321', salt);

      expect(hashA).not.toBe(hashB);
    });
  });

  describe('Master PIN Setup & Verification', () => {
    it('returns false for isMasterPinSet when no PIN exists', () => {
      expect(isMasterPinSet()).toBe(false);
    });

    it('rejects invalid PIN formats during setup', async () => {
      await expect(setupMasterPin('123')).rejects.toThrow('exactly 6 numeric digits');
      await expect(setupMasterPin('1234567')).rejects.toThrow('exactly 6 numeric digits');
      await expect(setupMasterPin('abcdef')).rejects.toThrow('exactly 6 numeric digits');
    });

    it('successfully configures a 6-digit Master PIN and unlocks the session', async () => {
      const result = await setupMasterPin('789012');
      expect(result).toBe(true);
      expect(isMasterPinSet()).toBe(true);
      expect(isSessionUnlocked()).toBe(true);
    });

    it('verifies correctly with the valid Master PIN', async () => {
      await setupMasterPin('556677');
      lockSession();
      expect(isSessionUnlocked()).toBe(false);

      const verification = await verifyMasterPin('556677');
      expect(verification.success).toBe(true);
      expect(isSessionUnlocked()).toBe(true);
    });

    it('fails verification with an incorrect PIN and tracks remaining attempts', async () => {
      await setupMasterPin('112233');
      lockSession();

      const verification = await verifyMasterPin('999999');
      expect(verification.success).toBe(false);
      expect(verification.remainingAttempts).toBe(MAX_FAILED_ATTEMPTS - 1);
      expect(isSessionUnlocked()).toBe(false);
    });

    it('triggers a 30-second lockout after 5 consecutive failed attempts', async () => {
      await setupMasterPin('445566');
      lockSession();

      for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) {
        const res = await verifyMasterPin('000000');
        expect(res.success).toBe(false);
        expect(res.remainingAttempts).toBe(MAX_FAILED_ATTEMPTS - i);
      }

      // 5th failed attempt triggers lockout
      const fifthRes = await verifyMasterPin('000000');
      expect(fifthRes.success).toBe(false);
      expect(fifthRes.lockoutSeconds).toBe(30);

      // Attempting again while locked out should immediately be rejected
      const immediateRetry = await verifyMasterPin('445566');
      expect(immediateRetry.success).toBe(false);
      expect(immediateRetry.error).toContain('Locked out');
    });
  });

  describe('Session Lock & 15-Minute Idle Timeout Policy', () => {
    it('locks and unlocks session explicitly', async () => {
      await setupMasterPin('123456');
      expect(isSessionUnlocked()).toBe(true);

      lockSession();
      expect(isSessionUnlocked()).toBe(false);

      unlockSession();
      expect(isSessionUnlocked()).toBe(true);
    });

    it('auto-locks session if last activity exceeded 15 minutes', async () => {
      await setupMasterPin('123456');
      expect(isSessionUnlocked()).toBe(true);

      // Advance time by 15 minutes and 1 second
      const expiredTime = Date.now() - (IDLE_TIMEOUT_MS + 1000);
      localStorage.setItem(SECURITY_STORAGE_KEYS.LAST_ACTIVITY, expiredTime.toString());

      expect(isSessionUnlocked()).toBe(false);
    });

    it('touchActivity keeps session fresh when called within the 15-minute window', async () => {
      await setupMasterPin('123456');
      const initialActivity = Date.now();
      localStorage.setItem(SECURITY_STORAGE_KEYS.LAST_ACTIVITY, initialActivity.toString());

      // Advance by 10 minutes
      const tenMinsLater = initialActivity + 10 * 60 * 1000;
      vi.spyOn(Date, 'now').mockReturnValue(tenMinsLater);

      touchActivity();
      expect(isSessionUnlocked()).toBe(true);
    });
  });
});
