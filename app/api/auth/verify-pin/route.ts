import { NextRequest, NextResponse } from "next/server";

// Server-side in-memory rate limiting for brute-force protection
interface RateLimitRecord {
  attempts: number;
  lockoutUntil: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 1000; // 30 seconds

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown-ip";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const enteredPin = typeof body?.pin === "string" ? body.pin.trim() : "";

    if (!/^\d{6}$/.test(enteredPin)) {
      return NextResponse.json(
        { success: false, error: "Master PIN must be exactly 6 numeric digits." },
        { status: 400 }
      );
    }

    const clientIp = getClientIp(request);
    const now = Date.now();
    const clientRecord = rateLimitMap.get(clientIp);

    // Check if client IP is currently locked out
    if (clientRecord && clientRecord.lockoutUntil > now) {
      const remainingSecs = Math.ceil((clientRecord.lockoutUntil - now) / 1000);
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed attempts. Locked out for ${remainingSecs}s.`,
          lockoutSeconds: remainingSecs,
        },
        { status: 429 }
      );
    }

    // Configured Server-Side Master PIN (defaults to 123456 if not yet set in environment)
    const serverMasterPin = (process.env.MASTER_PIN || "123456").trim();

    if (enteredPin === serverMasterPin) {
      // Clear rate limit record on successful unlock
      rateLimitMap.delete(clientIp);

      // Generate a crypto salt and SHA-256 hash for client offline caching & biometric validation
      const salt = crypto.randomUUID().replace(/-/g, "");
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(`${salt}:${enteredPin}`)
      );
      const hash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      return NextResponse.json({
        success: true,
        salt,
        hash,
        message: "PIN verified successfully.",
      });
    }

    // Handle failed attempt
    const attempts = (clientRecord?.attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      rateLimitMap.set(clientIp, {
        attempts: 0,
        lockoutUntil: now + LOCKOUT_MS,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Too many incorrect attempts. Please wait 30 seconds before trying again.",
          lockoutSeconds: 30,
        },
        { status: 429 }
      );
    }

    rateLimitMap.set(clientIp, {
      attempts,
      lockoutUntil: 0,
    });

    const remaining = MAX_ATTEMPTS - attempts;
    return NextResponse.json(
      {
        success: false,
        error: `Incorrect Master PIN. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
        remainingAttempts: remaining,
      },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Server authentication error." },
      { status: 500 }
    );
  }
}
