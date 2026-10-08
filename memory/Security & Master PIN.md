# Security & Master PIN

> Hub: [[00 - Atlas (Index)]] | Related: [[Cloud Sync & Supabase]], [[UI & Design System]]

---

## 🔒 Security Posture

The Life Project is a strictly single-user personal finance system. It safeguards financial privacy with an encrypted Master PIN mechanism operating both client-side and server-side.

---

## 🔑 Master PIN Specifications

- **Format**: Exactly 6 numeric digits (`/^\d{6}$/`).
- **Cryptographic Hashing**:
  - Algorithm: SHA-256 via native Web Crypto API (`crypto.subtle.digest`).
  - Salt: 16-byte cryptographically secure random hexadecimal salt (`crypto.getRandomValues`).
  - Formula: $\text{Hash} = \text{SHA-256}(\text{salt} + \text{":"} + \text{pin})$.
- **Verification Tiers**:
  1. **Server-Side API (`/api/auth/verify-pin`)**: Compares entered PIN with `process.env.MASTER_PIN` on the server.
  2. **Client-Side Fallback**: Offline verification using cached cryptographic salt and hash.

---

## 🛡️ Brute-Force & Session Protection

1. **IP Rate Limiting**:
   - Up to 5 failed attempts allowed before triggering a lockout.
   - Lockout duration: 30 seconds cooldown.
2. **15-Minute Idle Auto-Lock**:
   - Listens to mouse move, key down, touch start, and scroll events.
   - If inactivity exceeds 15 minutes (`IDLE_TIMEOUT_MS = 15 * 60 * 1000`), the session locks automatically.
3. **Privacy Shield**:
   - While locked, `MasterPinLockscreen` overlays the UI, blocking interaction until the correct PIN is provided.
