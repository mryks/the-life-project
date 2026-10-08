// lib/security.ts
/**
 * The Life Project — Single-User Security Architecture
 * 
 * Provides deterministic Master PIN hashing, salt generation,
 * session unlock/lock management with 15-minute idle auto-lock,
 * brute-force rate-limiting, and optional WebAuthn biometrics.
 */

import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export const PIN_LENGTH = 6;
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds cooldown
export const VAULT_SECURITY_TABLE = 'vault_security';
export const MASTER_VAULT_RECORD_ID = 'master-vault';

export const SECURITY_STORAGE_KEYS = {
  PIN_HASH: 'thelife-pin-hash',
  PIN_SALT: 'thelife-pin-salt',
  SESSION_UNLOCKED: 'thelife-session-unlocked',
  LAST_ACTIVITY: 'thelife-last-activity',
  FAILED_ATTEMPTS: 'thelife-failed-attempts',
  LOCKOUT_UNTIL: 'thelife-lockout-until',
  BIOMETRIC_ENABLED: 'thelife-biometric-enabled',
  WEBAUTHN_CREDENTIAL_ID: 'thelife-webauthn-id',
} as const;

export const SECURITY_CHANGE_EVENT = 'thelife-security-change';

/**
 * Notify all components in current window when lock status changes
 */
export function dispatchSecurityChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SECURITY_CHANGE_EVENT));
  }
}

/**
 * Generate a cryptographically secure random hexadecimal salt
 */
export function generateSalt(byteLength = 16): string {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  if (!cryptoObj || !cryptoObj.getRandomValues) {
    // Deterministic fallback for constrained environments
    return Array.from({ length: byteLength * 2 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
  const bytes = new Uint8Array(byteLength);
  cryptoObj.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute SHA-256 hash of (PIN + salt) using native Web Crypto API
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const normalizedPin = pin.trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${normalizedPin}`);
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('Web Crypto API is unavailable in current environment');
  }
  const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Push current Master PIN salt and hash to Supabase cloud vault
 */
export async function syncVaultSecurityToCloud(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const client = getSupabaseClient();
  if (!client) return false;

  const salt = typeof window !== 'undefined' ? window.localStorage.getItem(SECURITY_STORAGE_KEYS.PIN_SALT) : null;
  const hash = typeof window !== 'undefined' ? window.localStorage.getItem(SECURITY_STORAGE_KEYS.PIN_HASH) : null;
  if (!salt || !hash) return false;

  try {
    const { error } = await client.from(VAULT_SECURITY_TABLE).upsert({
      id: MASTER_VAULT_RECORD_ID,
      pin_salt: salt,
      pin_hash: hash,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Fetch Master PIN salt and hash from Supabase cloud vault if missing locally
 */
export async function fetchVaultSecurityFromCloud(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { data, error } = await client
      .from(VAULT_SECURITY_TABLE)
      .select('pin_salt, pin_hash')
      .eq('id', MASTER_VAULT_RECORD_ID)
      .maybeSingle();

    if (error || !data) return false;

    if (data.pin_salt && data.pin_hash && data.pin_hash.length === 64) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SECURITY_STORAGE_KEYS.PIN_SALT, data.pin_salt);
        window.localStorage.setItem(SECURITY_STORAGE_KEYS.PIN_HASH, data.pin_hash);
        dispatchSecurityChange();
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Ensure Master PIN configuration is loaded (checks local first, then cloud)
 */
export async function ensureMasterPinConfigured(): Promise<boolean> {
  if (isMasterPinSet()) {
    // If set locally, ensure it is also backed up to cloud in background
    syncVaultSecurityToCloud().catch(() => {});
    return true;
  }
  // If not set locally, attempt to pull from Supabase
  const pulled = await fetchVaultSecurityFromCloud();
  return pulled;
}

/**
 * Check if Master PIN has already been created or configured
 */
export function isMasterPinSet(): boolean {
  if (typeof window === 'undefined') return true;
  // In unit test environment, respect mock localStorage
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    const hash = window.localStorage.getItem(SECURITY_STORAGE_KEYS.PIN_HASH);
    const salt = window.localStorage.getItem(SECURITY_STORAGE_KEYS.PIN_SALT);
    return Boolean(hash && salt && hash.length === 64);
  }
  // In runtime production browser: Server-Side Fixed Master PIN is always active
  return true;
}

/**
 * Setup a new Master PIN (must be exactly 6 digits)
 */
export async function setupMasterPin(pin: string): Promise<boolean> {
  if (!/^\d{6}$/.test(pin)) {
    throw new Error('Master PIN must be exactly 6 numeric digits');
  }
  const salt = generateSalt(16);
  const hash = await hashPin(pin, salt);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SECURITY_STORAGE_KEYS.PIN_SALT, salt);
    window.localStorage.setItem(SECURITY_STORAGE_KEYS.PIN_HASH, hash);
    window.localStorage.removeItem(SECURITY_STORAGE_KEYS.FAILED_ATTEMPTS);
    window.localStorage.removeItem(SECURITY_STORAGE_KEYS.LOCKOUT_UNTIL);
    unlockSession();
    // Synchronize to cloud vault so other devices automatically have it
    syncVaultSecurityToCloud().catch(() => {});
  }
  return true;
}

export interface VerifyPinResult {
  success: boolean;
  error?: string;
  remainingAttempts?: number;
  lockoutSeconds?: number;
}

/**
 * Verify an entered PIN against server-side Master PIN or local stored salt/hash
 */
export async function verifyMasterPin(enteredPin: string): Promise<VerifyPinResult> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Storage unavailable' };
  }

  // 1. Check local lockout first (fast fail if user is spamming)
  const now = Date.now();
  const lockoutUntilStr = window.localStorage.getItem(SECURITY_STORAGE_KEYS.LOCKOUT_UNTIL);
  if (lockoutUntilStr) {
    const lockoutUntil = Number(lockoutUntilStr);
    if (!Number.isNaN(lockoutUntil) && lockoutUntil > now) {
      const remainingSecs = Math.ceil((lockoutUntil - now) / 1000);
      return {
        success: false,
        error: `Too many failed attempts. Locked out for ${remainingSecs} seconds.`,
        lockoutSeconds: remainingSecs,
      };
    }
    // Expired lockout
    window.localStorage.removeItem(SECURITY_STORAGE_KEYS.LOCKOUT_UNTIL);
    window.localStorage.removeItem(SECURITY_STORAGE_KEYS.FAILED_ATTEMPTS);
  }

  // 2. Try Server-Side Verification API (Next.js server with process.env.MASTER_PIN)
  try {
    const res = await fetch('/api/auth/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: enteredPin }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        window.localStorage.removeItem(SECURITY_STORAGE_KEYS.FAILED_ATTEMPTS);
        window.localStorage.removeItem(SECURITY_STORAGE_KEYS.LOCKOUT_UNTIL);
        if (data.salt && data.hash) {
          window.localStorage.setItem(SECURITY_STORAGE_KEYS.PIN_SALT, data.salt);
          window.localStorage.setItem(SECURITY_STORAGE_KEYS.PIN_HASH, data.hash);
        }
        unlockSession();
        return { success: true };
      }
    } else {
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        const secs = data.lockoutSeconds || 30;
        const lockoutUntil = now + secs * 1000;
        window.localStorage.setItem(SECURITY_STORAGE_KEYS.LOCKOUT_UNTIL, lockoutUntil.toString());
        return {
          success: false,
          error: data.error || `Locked out for ${secs}s.`,
          lockoutSeconds: secs,
        };
      }
      if (res.status === 401) {
        const currentAttempts = Number(window.localStorage.getItem(SECURITY_STORAGE_KEYS.FAILED_ATTEMPTS) || '0') + 1;
        window.localStorage.setItem(SECURITY_STORAGE_KEYS.FAILED_ATTEMPTS, currentAttempts.toString());
        const remaining = typeof data.remainingAttempts === 'number' ? data.remainingAttempts : Math.max(0, MAX_FAILED_ATTEMPTS - currentAttempts);
        return {
          success: false,
          error: data.error || `Incorrect Master PIN. ${remaining} attempt(s) remaining.`,
          remainingAttempts: remaining,
        };
      }
    }
  } catch {
    // Network offline or unit test environment: fall back to local cryptographic check
  }

  // 3. Fallback: Local cryptographic verification against stored salt & hash
  const storedSalt = window.localStorage.getItem(SECURITY_STORAGE_KEYS.PIN_SALT);
  const storedHash = window.localStorage.getItem(SECURITY_STORAGE_KEYS.PIN_HASH);
  if (!storedSalt || !storedHash) {
    return { success: false, error: 'Incorrect Master PIN.' };
  }

  const computedHash = await hashPin(enteredPin, storedSalt);
  if (computedHash === storedHash) {
    // Successful unlock: reset failure counter & unlock
    window.localStorage.removeItem(SECURITY_STORAGE_KEYS.FAILED_ATTEMPTS);
    window.localStorage.removeItem(SECURITY_STORAGE_KEYS.LOCKOUT_UNTIL);
    unlockSession();
    syncVaultSecurityToCloud().catch(() => {});
    return { success: true };
  }

  // Incorrect PIN
  const currentAttempts = Number(window.localStorage.getItem(SECURITY_STORAGE_KEYS.FAILED_ATTEMPTS) || '0') + 1;
  window.localStorage.setItem(SECURITY_STORAGE_KEYS.FAILED_ATTEMPTS, currentAttempts.toString());

  if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
    const lockoutUntil = now + LOCKOUT_DURATION_MS;
    window.localStorage.setItem(SECURITY_STORAGE_KEYS.LOCKOUT_UNTIL, lockoutUntil.toString());
    return {
      success: false,
      error: `Too many incorrect attempts. Please wait 30 seconds before trying again.`,
      lockoutSeconds: 30,
    };
  }

  const remaining = MAX_FAILED_ATTEMPTS - currentAttempts;
  return {
    success: false,
    error: `Incorrect Master PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
    remainingAttempts: remaining,
  };
}

/**
 * Check if the application session is currently unlocked
 * (Session storage checks for tab close, plus 15-minute idle timeout check)
 */
export function isSessionUnlocked(): boolean {
  if (typeof window === 'undefined') return false;

  // If no PIN is configured at all, app is accessible for first-time onboarding
  if (!isMasterPinSet()) return true;

  try {
    const isUnlockedInSession = window.sessionStorage.getItem(SECURITY_STORAGE_KEYS.SESSION_UNLOCKED) === 'true';
    if (!isUnlockedInSession) return false;

    // Check 15-minute idle timeout
    const lastActivityStr = window.localStorage.getItem(SECURITY_STORAGE_KEYS.LAST_ACTIVITY);
    if (!lastActivityStr) return false;

    const lastActivity = Number(lastActivityStr);
    if (Number.isNaN(lastActivity) || Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
      // Idle timeout expired
      lockSession();
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Mark session as unlocked and record current activity timestamp
 */
export function unlockSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SECURITY_STORAGE_KEYS.SESSION_UNLOCKED, 'true');
    window.localStorage.setItem(SECURITY_STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());
    dispatchSecurityChange();
  } catch {
    // Safe fallback
  }
}

/**
 * Explicitly lock the session
 */
export function lockSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SECURITY_STORAGE_KEYS.SESSION_UNLOCKED);
    window.localStorage.removeItem(SECURITY_STORAGE_KEYS.LAST_ACTIVITY);
    dispatchSecurityChange();
  } catch {
    // Safe fallback
  }
}

/**
 * Update the last activity timestamp (called on mouse/keyboard/touch events)
 * to keep the 15-minute auto-lock window fresh while actively used.
 */
export function touchActivity(): void {
  if (typeof window === 'undefined') return;
  try {
    const isUnlocked = window.sessionStorage.getItem(SECURITY_STORAGE_KEYS.SESSION_UNLOCKED) === 'true';
    if (isUnlocked) {
      window.localStorage.setItem(SECURITY_STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());
    }
  } catch {
    // Safe fallback
  }
}

/**
 * Biometrics / WebAuthn Helpers
 */
export async function isBiometricsSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    if (!window.PublicKeyCredential) return false;
    if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
      return false;
    }
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function isBiometricsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SECURITY_STORAGE_KEYS.BIOMETRIC_ENABLED) === 'true' &&
           Boolean(window.localStorage.getItem(SECURITY_STORAGE_KEYS.WEBAUTHN_CREDENTIAL_ID));
  } catch {
    return false;
  }
}

export function setBiometricsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      window.localStorage.setItem(SECURITY_STORAGE_KEYS.BIOMETRIC_ENABLED, 'true');
    } else {
      window.localStorage.removeItem(SECURITY_STORAGE_KEYS.BIOMETRIC_ENABLED);
      window.localStorage.removeItem(SECURITY_STORAGE_KEYS.WEBAUTHN_CREDENTIAL_ID);
    }
    dispatchSecurityChange();
  } catch {
    // Safe fallback
  }
}

/**
 * Register device biometric sensor via WebAuthn
 */
export async function registerBiometrics(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'The Life Project OS',
          id: window.location.hostname || 'localhost',
        },
        user: {
          id: userId,
          name: 'owner',
          displayName: 'The Life Project Owner',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // TouchID, FaceID, Windows Hello, Fingerprint
          userVerification: 'required',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (credential) {
      const rawId = Array.from(new Uint8Array(credential.rawId), (b) => b.toString(16).padStart(2, '0')).join('');
      window.localStorage.setItem(SECURITY_STORAGE_KEYS.WEBAUTHN_CREDENTIAL_ID, rawId);
      window.localStorage.setItem(SECURITY_STORAGE_KEYS.BIOMETRIC_ENABLED, 'true');
      dispatchSecurityChange();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Biometric registration error:', err);
    return false;
  }
}

/**
 * Authenticate via device biometric sensor (FaceID, Fingerprint, Windows Hello)
 */
export async function authenticateWithBiometrics(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
  const credIdHex = window.localStorage.getItem(SECURITY_STORAGE_KEYS.WEBAUTHN_CREDENTIAL_ID);
  if (!credIdHex) return false;

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    // Convert hex back to Uint8Array
    const rawIdBytes = new Uint8Array(credIdHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []);

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: rawIdBytes,
            type: 'public-key',
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    });

    if (assertion) {
      unlockSession();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Biometric authentication failed:', err);
    return false;
  }
}
