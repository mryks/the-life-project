"use client";

import React, { useState, useEffect, useCallback } from "react";
import BrandLogo from "@/components/finance/BrandLogo";
import { 
  verifyMasterPin, 
  PIN_LENGTH 
} from "@/lib/security";
import { Delete, ShieldCheck, AlertCircle, Lock, Loader2, Check } from "lucide-react";

interface MasterPinLockscreenProps {
  onUnlocked: () => void;
}

export default function MasterPinLockscreen({ onUnlocked }: MasterPinLockscreenProps) {
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [lockoutSecs, setLockoutSecs] = useState<number>(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [trustDevice, setTrustDevice] = useState(true);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSecs <= 0) return;
    const interval = setInterval(() => {
      setLockoutSecs((prev) => {
        if (prev <= 1) {
          setErrorMsg(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSecs]);

  // Asynchronous non-blocking tactile haptic feedback
  const triggerHaptic = (durationMs = 10) => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      window.setTimeout(() => {
        try {
          navigator.vibrate(durationMs);
        } catch {
          // Safe fallback
        }
      }, 0);
    }
  };

  const triggerErrorShake = useCallback((msg: string) => {
    triggerHaptic(40);
    setErrorMsg(msg);
    setIsShaking(true);
    setPin("");
    setTimeout(() => setIsShaking(false), 500);
  }, []);

  // Fast zero-delay digit press handler
  const handleDigitPress = useCallback((digit: string) => {
    if (lockoutSecs > 0 || isVerifying) return;
    triggerHaptic(10);
    setErrorMsg(null);
    setPin((prev) => (prev.length < PIN_LENGTH ? prev + digit : prev));
  }, [lockoutSecs, isVerifying]);

  const handleBackspace = useCallback(() => {
    if (lockoutSecs > 0 || isVerifying) return;
    triggerHaptic(10);
    setPin((prev) => prev.slice(0, -1));
  }, [lockoutSecs, isVerifying]);

  // Handle physical keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lockoutSecs > 0 || isVerifying) return;
      if (/^[0-9]$/.test(e.key)) {
        handleDigitPress(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDigitPress, handleBackspace, lockoutSecs, isVerifying]);

  // Evaluate PIN when all 6 digits are typed
  useEffect(() => {
    if (pin.length !== PIN_LENGTH || isVerifying || lockoutSecs > 0) return;

    const evaluate = async () => {
      setIsVerifying(true);
      try {
        const result = await verifyMasterPin(pin, trustDevice);
        if (result.success) {
          triggerHaptic(20);
          onUnlocked();
        } else {
          if (result.lockoutSeconds) {
            setLockoutSecs(result.lockoutSeconds);
            triggerErrorShake(`Too many failed attempts. Locked out for ${result.lockoutSeconds}s.`);
          } else {
            triggerErrorShake(result.error || "Incorrect Master PIN");
          }
        }
      } finally {
        setIsVerifying(false);
      }
    };

    evaluate();
  }, [pin, trustDevice, isVerifying, lockoutSecs, onUnlocked, triggerErrorShake]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xl backdrop-saturate-150 animate-in fade-in duration-200">
      <div 
        className={`bg-white/95 backdrop-blur-md border-2 border-stone-200 border-b-4 border-b-stone-300 rounded-[32px] p-6 sm:p-8 max-w-sm w-full shadow-2xl text-center relative ${
          isShaking ? "animate-shake" : ""
        }`}
      >
        {/* Brand Header */}
        <div className="flex justify-center mb-4">
          <BrandLogo showSubtitle={false} />
        </div>

        {/* Title & Instructions */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-stone-100 border border-stone-200 text-stone-700 mb-2">
            <Lock className="w-3 h-3 text-stone-600" />
            <span>Encrypted Vault</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
            Enter Master PIN
          </h2>
          <p className="text-xs text-stone-500 font-medium mt-1">
            {lockoutSecs > 0
              ? `Security lockout active. Please wait ${lockoutSecs}s.`
              : "Enter your 6-digit code to access your records"}
          </p>
        </div>

        {/* 6 PIN Indicator Dots */}
        <div className="flex justify-center gap-3.5 mb-6">
          {Array.from({ length: PIN_LENGTH }).map((_, idx) => {
            const isFilled = idx < pin.length;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-150 ${
                  errorMsg
                    ? "border-2 border-rose-500 bg-rose-500 scale-105"
                    : isFilled
                    ? "border-2 border-stone-900 bg-stone-900 scale-110 shadow-xs"
                    : "border-2 border-stone-300 bg-stone-100"
                }`}
              />
            );
          })}
        </div>

        {/* Error Message or Verifying Spinner */}
        {isVerifying ? (
          <div className="flex items-center justify-center gap-1.5 mb-4 text-xs font-bold text-amber-700 animate-in fade-in">
            <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
            <span>Verifying credentials...</span>
          </div>
        ) : errorMsg ? (
          <div className="flex items-center justify-center gap-1.5 mb-4 text-xs font-bold text-rose-600 animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        ) : null}

        {/* Trust this device toggle button */}
        <div className="flex justify-center mb-5">
          <button
            type="button"
            onClick={() => setTrustDevice((prev) => !prev)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer select-none transition-all duration-150 border border-stone-200/90 bg-stone-50 hover:bg-stone-100 text-stone-700 active:scale-95 shadow-2xs"
            title="Keep this device unlocked even after closing the app"
          >
            <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors ${
              trustDevice 
                ? 'bg-stone-900 border-stone-900 text-white' 
                : 'bg-white border-stone-300 text-transparent'
            }`}>
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
            <span className="text-[11px] font-bold text-stone-700">Trust this device (stay unlocked)</span>
          </button>
        </div>

        {/* Tactile Keypad (3x4 Grid) with zero touch delay */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto select-none touch-manipulation">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigitPress(digit)}
              disabled={lockoutSecs > 0 || isVerifying}
              className="h-13 sm:h-14 rounded-2xl bg-white border border-stone-200 border-b-[3px] border-b-stone-300 hover:bg-stone-50 active:border-b-0 active:translate-y-1 active:scale-95 transition-transform duration-75 text-xl font-bold font-sora-numbers text-stone-900 flex items-center justify-center cursor-pointer shadow-2xs select-none touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {digit}
            </button>
          ))}

          {/* Bottom Row: Empty Placeholder | 0 | Backspace */}
          <div />

          <button
            type="button"
            onClick={() => handleDigitPress("0")}
            disabled={lockoutSecs > 0 || isVerifying}
            className="h-13 sm:h-14 rounded-2xl bg-white border border-stone-200 border-b-[3px] border-b-stone-300 hover:bg-stone-50 active:border-b-0 active:translate-y-1 active:scale-95 transition-transform duration-75 text-xl font-bold font-sora-numbers text-stone-900 flex items-center justify-center cursor-pointer shadow-2xs select-none touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            disabled={lockoutSecs > 0 || pin.length === 0 || isVerifying}
            aria-label="Delete last digit"
            className="h-13 sm:h-14 rounded-2xl bg-stone-100 border border-stone-200 border-b-[3px] border-b-stone-300 hover:bg-stone-200/80 active:border-b-0 active:translate-y-1 active:scale-95 transition-transform duration-75 flex items-center justify-center text-stone-700 cursor-pointer shadow-2xs select-none touch-manipulation disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Privacy Badge */}
        <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-stone-400">
          <ShieldCheck className="w-3.5 h-3.5 text-stone-400" />
          <span>Protected with Server-Side Master PIN</span>
        </div>
      </div>
    </div>
  );
}

