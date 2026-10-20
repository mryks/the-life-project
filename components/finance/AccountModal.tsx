"use client";

import { useState } from "react";
import type { AccountGroup } from "@/lib/types";
import { X, Check, Wallet, TrendingUp, Sparkles, AlertCircle } from "lucide-react";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAccount: (data: {
    fullName: string;
    name: string;
    group: AccountGroup;
    colorStyle: string;
    colorClass: string;
    openingBalance?: number;
  }) => void;
  existingAccountNames?: string[];
}

const SOLID_PRESETS = [
  { name: "Blue", color: "#2563eb", class: "bg-blue-600" },
  { name: "Emerald", color: "#059669", class: "bg-emerald-600" },
  { name: "Indigo", color: "#4f46e5", class: "bg-indigo-600" },
  { name: "Violet", color: "#7c3aed", class: "bg-purple-600" },
  { name: "Rose", color: "#e11d48", class: "bg-rose-600" },
  { name: "Amber", color: "#d97706", class: "bg-amber-600" },
  { name: "Teal", color: "#0d9488", class: "bg-teal-600" },
  { name: "Slate", color: "#475569", class: "bg-slate-600" },
];

const GRADIENT_PRESETS = [
  { name: "Ocean", color1: "#0ea5e9", color2: "#2563eb", style: "linear-gradient(135deg, #0ea5e9, #2563eb)" },
  { name: "Emerald", color1: "#10b981", color2: "#059669", style: "linear-gradient(135deg, #10b981, #059669)" },
  { name: "Royal", color1: "#6366f1", color2: "#8b5cf6", style: "linear-gradient(135deg, #6366f1, #8b5cf6)" },
  { name: "Sunset", color1: "#f59e0b", color2: "#ef4444", style: "linear-gradient(135deg, #f59e0b, #ef4444)" },
  { name: "Berry", color1: "#8b5cf6", color2: "#ec4899", style: "linear-gradient(135deg, #8b5cf6, #ec4899)" },
  { name: "Teal Cyan", color1: "#06b6d4", color2: "#0d9488", style: "linear-gradient(135deg, #06b6d4, #0d9488)" },
  { name: "Peach Rose", color1: "#fb923c", color2: "#f43f5e", style: "linear-gradient(135deg, #fb923c, #f43f5e)" },
  { name: "Midnight", color1: "#475569", color2: "#0f172a", style: "linear-gradient(135deg, #475569, #0f172a)" },
];

const deriveShortCode = (fullName: string): string => {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) {
    return words[0].slice(0, 4).toUpperCase();
  }
  // If multiple words (e.g. Bank Central Asia -> BCA)
  return words
    .map((w) => w[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
};

export default function AccountModal({
  isOpen,
  onClose,
  onSaveAccount,
  existingAccountNames = [],
}: AccountModalProps) {
  if (!isOpen) return null;

  return (
    <AccountModalInner
      onClose={onClose}
      onSaveAccount={onSaveAccount}
      existingAccountNames={existingAccountNames}
    />
  );
}

function AccountModalInner({
  onClose,
  onSaveAccount,
  existingAccountNames,
}: {
  onClose: () => void;
  onSaveAccount: AccountModalProps["onSaveAccount"];
  existingAccountNames: string[];
}) {
  const [group, setGroup] = useState<AccountGroup>("liquid");
  const [fullName, setFullName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [hasManuallyEditedShortCode, setHasManuallyEditedShortCode] = useState(false);

  // Color Mode: 'solid' | 'gradient'
  const [colorMode, setColorMode] = useState<"solid" | "gradient">("gradient");
  const [solidColor, setSolidColor] = useState("#2563eb");
  const [gradColor1, setGradColor1] = useState("#0ea5e9");
  const [gradColor2, setGradColor2] = useState("#2563eb");

  // Opening Balance
  const [openingBalanceStr, setOpeningBalanceStr] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeColorStyle =
    colorMode === "solid"
      ? solidColor
      : `linear-gradient(135deg, ${gradColor1}, ${gradColor2})`;

  const handleFullNameChange = (val: string) => {
    setFullName(val);
    setError(null);
    if (!hasManuallyEditedShortCode) {
      setShortCode(deriveShortCode(val));
    }
  };

  const handleShortCodeChange = (val: string) => {
    setHasManuallyEditedShortCode(true);
    setShortCode(val.trim().toUpperCase().slice(0, 4));
    setError(null);
  };

  const handleOpeningBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      setOpeningBalanceStr("");
      return;
    }
    setOpeningBalanceStr(Number(raw).toLocaleString("id-ID"));
  };

  const parsedOpeningBalance = openingBalanceStr
    ? Number(openingBalanceStr.replace(/\D/g, ""))
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    const cleanCode = shortCode.trim().toUpperCase();

    if (!cleanName) {
      setError("Account name is required.");
      return;
    }

    if (cleanName.length > 30) {
      setError("Account name cannot exceed 30 characters.");
      return;
    }

    if (!cleanCode) {
      setError("Short code is required.");
      return;
    }

    if (cleanCode.length > 4) {
      setError("Short code cannot exceed 4 characters.");
      return;
    }

    const isDuplicate = existingAccountNames.some(
      (n) => n.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (isDuplicate) {
      setError(`An account named "${cleanName}" already exists.`);
      return;
    }

    onSaveAccount({
      fullName: cleanName,
      name: cleanCode,
      group,
      colorStyle: activeColorStyle,
      colorClass: "bg-stone-600",
      openingBalance: parsedOpeningBalance > 0 ? parsedOpeningBalance : undefined,
    });
  };

  const dismissKeyboard = () => {
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
        document.activeElement.blur();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4"
      onClick={onClose}
      onTouchStart={dismissKeyboard}
    >
      <div
        className="relative w-full max-w-lg bg-[#FBF9F4] rounded-3xl p-6 shadow-2xl border-2 border-stone-200 border-b-4 border-b-stone-300 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-200">
          <div>
            <h2 className="text-xl font-black text-stone-900 tracking-tight">
              Add New Account
            </h2>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Create a custom liquid or investment account
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center cursor-pointer transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Group Classification: Liquid vs Investment */}
          <div>
            <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2">
              ACCOUNT CLASSIFICATION
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGroup("liquid")}
                className={`p-3.5 rounded-2xl border-2 text-left cursor-pointer transition-all duration-150 flex flex-col gap-1.5 ${
                  group === "liquid"
                    ? "bg-white border-blue-600 border-b-4 shadow-xs"
                    : "bg-stone-50/80 border-stone-200 hover:bg-white text-stone-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet
                      className={`w-4 h-4 ${
                        group === "liquid" ? "text-blue-600" : "text-stone-500"
                      }`}
                    />
                    <span
                      className={`text-xs font-black tracking-tight ${
                        group === "liquid" ? "text-stone-900" : "text-stone-700"
                      }`}
                    >
                      Liquid Account
                    </span>
                  </div>
                  {group === "liquid" && (
                    <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-stone-500 leading-snug">
                  Cash, checking bank accounts, and daily e-wallets. Included in Total Balance.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setGroup("investment")}
                className={`p-3.5 rounded-2xl border-2 text-left cursor-pointer transition-all duration-150 flex flex-col gap-1.5 ${
                  group === "investment"
                    ? "bg-white border-purple-600 border-b-4 shadow-xs"
                    : "bg-stone-50/80 border-stone-200 hover:bg-white text-stone-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp
                      className={`w-4 h-4 ${
                        group === "investment" ? "text-purple-600" : "text-stone-500"
                      }`}
                    />
                    <span
                      className={`text-xs font-black tracking-tight ${
                        group === "investment" ? "text-stone-900" : "text-stone-700"
                      }`}
                    >
                      Investment
                    </span>
                  </div>
                  {group === "investment" && (
                    <div className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-stone-500 leading-snug">
                  Brokerages, stocks, crypto, and mutual funds. Contributes to Net Worth.
                </p>
              </button>
            </div>
          </div>

          {/* Full Name & Short Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                ACCOUNT NAME
              </label>
              <input
                type="text"
                autoFocus
                autoCapitalize="words"
                autoCorrect="off"
                value={fullName}
                onChange={(e) => handleFullNameChange(e.target.value)}
                placeholder="e.g. Bank Central Asia"
                className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-stone-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                SHORT CODE
              </label>
              <input
                type="text"
                value={shortCode}
                onChange={(e) => handleShortCodeChange(e.target.value)}
                placeholder="BCA"
                maxLength={4}
                className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-stone-900 font-black text-sm uppercase tracking-wider text-center focus:outline-none focus:ring-2 focus:ring-stone-900 shadow-2xs"
              />
            </div>
          </div>

          {/* Visual Appearance & Dual Color Picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                APPEARANCE & COLOR
              </label>

              {/* Mode Toggle: Solid vs Gradient */}
              <div className="inline-flex rounded-lg bg-stone-200/80 p-0.5 border border-stone-300/80">
                <button
                  type="button"
                  onClick={() => setColorMode("solid")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    colorMode === "solid"
                      ? "bg-white text-stone-900 shadow-2xs"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  Solid
                </button>
                <button
                  type="button"
                  onClick={() => setColorMode("gradient")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    colorMode === "gradient"
                      ? "bg-white text-stone-900 shadow-2xs"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  Gradient
                </button>
              </div>
            </div>

            {/* Live Badge Preview Card */}
            <div className="p-3.5 rounded-2xl bg-white border border-stone-200 shadow-xs flex items-center gap-4 mb-3">
              <div
                style={{ background: activeColorStyle }}
                className="w-12 h-12 rounded-full text-white font-black text-sm flex items-center justify-center shadow-sm flex-shrink-0"
              >
                {shortCode || "ACC"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black text-stone-900 truncate">
                  {fullName || "Account Name Preview"}
                </div>
                <div className="text-[11px] text-stone-500 font-medium flex items-center gap-1.5 mt-0.5">
                  <span className="capitalize font-bold text-stone-700">{group}</span>
                  <span>•</span>
                  <span className="font-mono-numbers">{shortCode || "ACC"}</span>
                  <span>•</span>
                  <span className="truncate">{activeColorStyle}</span>
                </div>
              </div>
            </div>

            {/* Solid Mode Controls */}
            {colorMode === "solid" && (
              <div className="space-y-3 bg-stone-50/80 p-3 rounded-2xl border border-stone-200/80">
                <div className="flex items-center gap-3">
                  <div className="relative w-9 h-9 rounded-xl border border-stone-300 overflow-hidden shadow-2xs flex-shrink-0 cursor-pointer">
                    <input
                      type="color"
                      value={solidColor}
                      onChange={(e) => setSolidColor(e.target.value)}
                      className="absolute -inset-2 w-14 h-14 cursor-pointer"
                    />
                  </div>
                  <input
                    type="text"
                    value={solidColor}
                    onChange={(e) => setSolidColor(e.target.value)}
                    placeholder="#2563EB"
                    className="flex-1 px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-stone-800 font-mono-numbers font-bold text-xs uppercase focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>

                {/* Presets */}
                <div>
                  <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Quick Color Presets</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SOLID_PRESETS.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => setSolidColor(p.color)}
                        className={`w-7 h-7 rounded-lg border-2 transition-transform cursor-pointer ${
                          solidColor.toLowerCase() === p.color.toLowerCase()
                            ? "border-stone-900 scale-110 shadow-xs"
                            : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: p.color }}
                        title={p.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Gradient Mode Controls */}
            {colorMode === "gradient" && (
              <div className="space-y-3 bg-stone-50/80 p-3 rounded-2xl border border-stone-200/80">
                <div className="grid grid-cols-2 gap-3">
                  {/* From Color */}
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                      COLOR 1 (FROM)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative w-8 h-8 rounded-lg border border-stone-300 overflow-hidden shadow-2xs flex-shrink-0 cursor-pointer">
                        <input
                          type="color"
                          value={gradColor1}
                          onChange={(e) => setGradColor1(e.target.value)}
                          className="absolute -inset-2 w-12 h-12 cursor-pointer"
                        />
                      </div>
                      <input
                        type="text"
                        value={gradColor1}
                        onChange={(e) => setGradColor1(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-stone-300 rounded-lg text-stone-800 font-mono-numbers font-bold text-[11px] uppercase focus:outline-none focus:ring-1 focus:ring-stone-900"
                      />
                    </div>
                  </div>

                  {/* To Color */}
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                      COLOR 2 (TO)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative w-8 h-8 rounded-lg border border-stone-300 overflow-hidden shadow-2xs flex-shrink-0 cursor-pointer">
                        <input
                          type="color"
                          value={gradColor2}
                          onChange={(e) => setGradColor2(e.target.value)}
                          className="absolute -inset-2 w-12 h-12 cursor-pointer"
                        />
                      </div>
                      <input
                        type="text"
                        value={gradColor2}
                        onChange={(e) => setGradColor2(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-stone-300 rounded-lg text-stone-800 font-mono-numbers font-bold text-[11px] uppercase focus:outline-none focus:ring-1 focus:ring-stone-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Presets */}
                <div>
                  <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Quick Gradient Presets</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {GRADIENT_PRESETS.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => {
                          setGradColor1(p.color1);
                          setGradColor2(p.color2);
                        }}
                        className="w-7 h-7 rounded-lg border border-stone-300/80 transition-transform cursor-pointer hover:scale-105 shadow-2xs"
                        style={{ background: p.style }}
                        title={p.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Opening Balance (Optional) */}
          <div>
            <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">
              OPENING BALANCE (OPTIONAL)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={openingBalanceStr}
                onChange={handleOpeningBalanceChange}
                placeholder="0"
                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-stone-900 font-mono-numbers font-black text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 shadow-2xs"
              />
            </div>
            <p className="text-[11px] text-stone-500 mt-1.5 leading-relaxed">
              If entered, an initial balance income entry will automatically be deposited for today in category &apos;Others&apos;.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 bg-[#FBF9F4]/95 backdrop-blur-xs pt-3 pb-1 border-t border-stone-200 flex items-center justify-end gap-3 z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-xs cursor-pointer select-none transition-all duration-150 border-2 border-stone-200 border-b-4 border-b-stone-300 bg-white text-stone-700 hover:bg-stone-50 active:translate-y-0.5 active:border-b-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl font-black text-xs cursor-pointer select-none transition-all duration-150 border-2 border-stone-800 border-b-4 border-b-stone-950 bg-stone-900 text-white hover:bg-stone-800 active:translate-y-0.5 active:border-b-2 shadow-sm"
            >
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
