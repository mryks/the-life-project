// tests/finance/security.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateSalt,
  hashPin,
  isMasterPinSet,
  setupMasterPin,
  verifyMasterPin,
  isSessionUnlocked,
  isDeviceTrusted,
  unlockSession,
  lockSession,
  touchActivity,
  cleanupLegacyBiometrics,
  getSecurityDateString,
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

  describe('Legacy Biometric Removal & Pure Master PIN Invariants', () => {
    it('does not expose biometric keys in SECURITY_STORAGE_KEYS', () => {
      // Biometric storage keys must be completely removed from SECURITY_STORAGE_KEYS
      expect(SECURITY_STORAGE_KEYS).not.toHaveProperty('BIOMETRIC_ENABLED');
      expect(SECURITY_STORAGE_KEYS).not.toHaveProperty('WEBAUTHN_CREDENTIAL_ID');
      expect(Object.values(SECURITY_STORAGE_KEYS)).not.toContain('thelife-biometric-enabled');
      expect(Object.values(SECURITY_STORAGE_KEYS)).not.toContain('thelife-webauthn-id');
    });

    it('cleans up legacy biometric keys from localStorage via cleanupLegacyBiometrics', () => {
      mockLocalStorage.setItem('thelife-biometric-enabled', 'true');
      mockLocalStorage.setItem('thelife-webauthn-id', 'test-credential-id-12345');

      expect(mockLocalStorage.getItem('thelife-biometric-enabled')).toBe('true');
      expect(mockLocalStorage.getItem('thelife-webauthn-id')).toBe('test-credential-id-12345');

      cleanupLegacyBiometrics();

      expect(mockLocalStorage.getItem('thelife-biometric-enabled')).toBeNull();
      expect(mockLocalStorage.getItem('thelife-webauthn-id')).toBeNull();
    });

    it('ignores orphan legacy biometric keys in localStorage during session unlock checks', async () => {
      // Inject orphaned legacy biometric keys into localStorage
      mockLocalStorage.setItem('thelife-biometric-enabled', 'true');
      mockLocalStorage.setItem('thelife-webauthn-id', 'stale-webauthn-key');

      await setupMasterPin('654321');
      lockSession();

      // Ensure that having the legacy biometric keys present in localStorage NEVER unlocks the session
      expect(isSessionUnlocked()).toBe(false);
    });

    it('enforces Master PIN as the sole, deterministic source of access control regardless of biometric traces', async () => {
      // Set legacy biometric remnants
      mockLocalStorage.setItem('thelife-biometric-enabled', 'true');
      mockLocalStorage.setItem('thelife-webauthn-id', 'stale-cred');

      await setupMasterPin('987654');
      lockSession();

      // Attempting access without entering the Master PIN must strictly fail
      expect(isSessionUnlocked()).toBe(false);

      // Wrong PIN must fail despite legacy biometric data
      const wrongAttempt = await verifyMasterPin('111111');
      expect(wrongAttempt.success).toBe(false);
      expect(isSessionUnlocked()).toBe(false);

      // Correct Master PIN is the only way to deterministically unlock
      const correctAttempt = await verifyMasterPin('987654');
      expect(correctAttempt.success).toBe(true);
      expect(isSessionUnlocked()).toBe(true);
    });
  });

  describe('Trust this device (Stay unlocked) Architecture & Invariants', () => {
    it('formats date correctly as YYYY-MM-DD via getSecurityDateString', () => {
      const testDate = new Date(2026, 4, 9); // May 9, 2026
      expect(getSecurityDateString(testDate)).toBe('2026-05-09');
    });

    it('trustDevice = true: sets trusted device date in localStorage and isDeviceTrusted() returns true', async () => {
      await setupMasterPin('123456');
      lockSession();

      expect(isDeviceTrusted()).toBe(false);
      expect(isSessionUnlocked()).toBe(false);

      unlockSession(true);

      expect(isDeviceTrusted()).toBe(true);
      expect(mockLocalStorage.getItem(SECURITY_STORAGE_KEYS.DEVICE_TRUSTED)).toBe(getSecurityDateString());
      expect(isSessionUnlocked()).toBe(true);
    });

    it('trustDevice = true: remains unlocked even when sessionStorage is cleared during the same day', async () => {
      await setupMasterPin('123456');
      lockSession();

      const verification = await verifyMasterPin('123456', true);
      expect(verification.success).toBe(true);
      expect(isDeviceTrusted()).toBe(true);
      expect(isSessionUnlocked()).toBe(true);

      // Simulate app kill / tab close / fresh browser launch (clearing sessionStorage)
      mockSessionStorage.clear();
      expect(mockSessionStorage.getItem(SECURITY_STORAGE_KEYS.SESSION_UNLOCKED)).toBeNull();

      // Because device is trusted for today, isSessionUnlocked() STILL returns true!
      expect(isSessionUnlocked()).toBe(true);
      expect(isDeviceTrusted()).toBe(true);
    });

    it('ganti hari (day change boundary): isDeviceTrusted strictly returns false when date changes to tomorrow', () => {
      mockLocalStorage.setItem(SECURITY_STORAGE_KEYS.DEVICE_TRUSTED, '2026-10-18');

      // Matching today (2026-10-18) returns true
      expect(isDeviceTrusted('2026-10-18')).toBe(true);

      // Checked against tomorrow (2026-10-19) strictly returns false ("ganti hari")
      expect(isDeviceTrusted('2026-10-19')).toBe(false);

      // Checked against future or past mismatched dates strictly returns false
      expect(isDeviceTrusted('2026-10-20')).toBe(false);
      expect(isDeviceTrusted('2026-10-17')).toBe(false);
    });

    it('ganti hari: on cold start next day (sessionStorage empty), isSessionUnlocked returns false forcing PIN re-entry', async () => {
      await setupMasterPin('123456');

      // Simulate trusted date set yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getSecurityDateString(yesterday);
      mockLocalStorage.setItem(SECURITY_STORAGE_KEYS.DEVICE_TRUSTED, yesterdayStr);

      // Cold start: app killed from RAM overnight, fresh session
      mockSessionStorage.clear();

      // Expired date means device is untrusted and session is locked
      expect(isDeviceTrusted()).toBe(false);
      expect(isSessionUnlocked()).toBe(false);
    });

    it('ganti hari: stale trusted date from yesterday is automatically purged from localStorage on session check', async () => {
      await setupMasterPin('123456');
      // Simulate overnight app close / cold start
      mockSessionStorage.clear();

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getSecurityDateString(yesterday);
      mockLocalStorage.setItem(SECURITY_STORAGE_KEYS.DEVICE_TRUSTED, yesterdayStr);

      expect(mockLocalStorage.getItem(SECURITY_STORAGE_KEYS.DEVICE_TRUSTED)).toBe(yesterdayStr);

      // Checking session unlock on a new day detects stale date and cleans it up
      expect(isSessionUnlocked()).toBe(false);
      expect(mockLocalStorage.getItem(SECURITY_STORAGE_KEYS.DEVICE_TRUSTED)).toBeNull();
    });

    it('ganti hari: time-travel across midnight boundary purges trust and locks app on next morning cold start', async () => {
      vi.useFakeTimers();
      const day1 = new Date(2026, 9, 18, 22, 0, 0); // Oct 18, 2026 22:00
      vi.setSystemTime(day1);

      await setupMasterPin('123456');
      unlockSession(true);

      expect(mockLocalStorage.getItem(SECURITY_STORAGE_KEYS.DEVICE_TRUSTED)).toBe('2026-10-18');
      expect(isDeviceTrusted()).toBe(true);
      expect(isSessionUnlocked()).toBe(true);

      // Advance time across midnight to next morning Oct 19, 2026 07:00
      const day2 = new Date(2026, 9, 19, 7, 0, 0);
      vi.setSystemTime(day2);

      // Cold start next morning (sessionStorage wiped on app restart)
      mockSessionStorage.clear();

      expect(isDeviceTrusted()).toBe(false);
      expect(isSessionUnlocked()).toBe(false);
      expect(mockLocalStorage.getItem(SECURITY_STORAGE_KEYS.DEVICE_TRUSTED)).toBeNull();

      vi.useRealTimers();
    });

    it('trustDevice = true: is NOT auto-locked by 15-minute idle timeout within the same day', async () => {
      await setupMasterPin('123456');
      lockSession();

      unlockSession(true);
      expect(isSessionUnlocked()).toBe(true);
      expect(isDeviceTrusted()).toBe(true);

      // Advance time by 1 hour (within the same day)
      const expiredTime = Date.now() - (IDLE_TIMEOUT_MS * 4);
      mockLocalStorage.setItem(SECURITY_STORAGE_KEYS.LAST_ACTIVITY, expiredTime.toString());

      // Trusted device stays unlocked indefinitely during today without idle auto-lock
      expect(isSessionUnlocked()).toBe(true);
      expect(isDeviceTrusted()).toBe(true);
    });

    it('trustDevice = false (temporary session): isDeviceTrusted() returns false', async () => {
      await setupMasterPin('123456');
      lockSession();

      unlockSession(false);

      expect(isDeviceTrusted()).toBe(false);
      expect(mockLocalStorage.getItem(SECURITY_STORAGE_KEYS.DEVICE_TRUSTED)).toBeNull();
      expect(isSessionUnlocked()).toBe(true);
      expect(mockSessionStorage.getItem(SECURITY_STORAGE_KEYS.SESSION_UNLOCKED)).toBe('true');
    });

    it('trustDevice = false (temporary session): isSessionUnlocked() is true while sessionStorage has the session', async () => {
      await setupMasterPin('123456');
      lockSession();

      const res = await verifyMasterPin('123456', false);
      expect(res.success).toBe(true);
      expect(isDeviceTrusted()).toBe(false);
      expect(isSessionUnlocked()).toBe(true);
    });

    it('trustDevice = false (temporary session): auto-locks when sessionStorage is cleared (simulating tab/app close)', async () => {
      await setupMasterPin('123456');
      lockSession();

      const res = await verifyMasterPin('123456', false);
      expect(res.success).toBe(true);
      expect(isDeviceTrusted()).toBe(false);
      expect(isSessionUnlocked()).toBe(true);

      // Simulate tab/app close (clearing sessionStorage)
      mockSessionStorage.clear();

      // Temporary session without trusted device must be locked
      expect(isSessionUnlocked()).toBe(false);
    });

    it('trustDevice = false (temporary session): 15-minute idle timeout auto-locks temporary sessions', async () => {
      await setupMasterPin('123456');
      lockSession();

      unlockSession(false);
      expect(isSessionUnlocked()).toBe(true);

      // Advance time by 15 minutes and 1 second
      const expiredTime = Date.now() - (IDLE_TIMEOUT_MS + 1000);
      mockLocalStorage.setItem(SECURITY_STORAGE_KEYS.LAST_ACTIVITY, expiredTime.toString());

      // Temporary session must expire and auto-lock
      expect(isSessionUnlocked()).toBe(false);
    });

    it('manual lockSession(): clears both temporary session AND trusted device state', async () => {
      await setupMasterPin('123456');

      // First unlock with trustDevice = true
      unlockSession(true);
      expect(isDeviceTrusted()).toBe(true);
      expect(isSessionUnlocked()).toBe(true);

      // Explicitly lock
      lockSession();

      // Both trusted status and session unlock must be revoked
      expect(isDeviceTrusted()).toBe(false);
      expect(mockLocalStorage.getItem(SECURITY_STORAGE_KEYS.DEVICE_TRUSTED)).toBeNull();
      expect(isSessionUnlocked()).toBe(false);
      expect(mockSessionStorage.getItem(SECURITY_STORAGE_KEYS.SESSION_UNLOCKED)).toBeNull();
    });

    it('invalid PIN does not trust the device or unlock session', async () => {
      await setupMasterPin('123456');
      lockSession();

      // Attempt to verify with invalid PIN while requesting trustDevice = true
      const wrongResult = await verifyMasterPin('999999', true);
      expect(wrongResult.success).toBe(false);

      // Device must NOT be trusted, session must remain locked
      expect(isDeviceTrusted()).toBe(false);
      expect(mockLocalStorage.getItem(SECURITY_STORAGE_KEYS.DEVICE_TRUSTED)).toBeNull();
      expect(isSessionUnlocked()).toBe(false);
    });
  });
});

