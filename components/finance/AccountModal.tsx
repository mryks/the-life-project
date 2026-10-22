"use client";

import { useState, useRef } from "react";
import type { AccountGroup } from "@/lib/types";
import { X, Check, Wallet, TrendingUp, Sparkles, Pipette, AlertCircle } from "lucide-react";
import {
  ColorSelector,
  ColorSelectorList,
  ColorSelectorItem,
} from "@/components/motion/color-selector";
import {
  ColorPicker,
  ColorPickerArea,
  ColorPickerHue,
  ColorPickerSwatch,
  ColorPickerHexInput,
  ColorPickerEyeDropper,
} from "@/components/motion/color-picker";

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
  const [colorMode, setColorMode] = useState<"solid" | "gradient">("solid");
  const [solidColor, setSolidColor] = useState("#2563eb");
  const [gradColor1, setGradColor1] = useState("#0ea5e9");
  const [gradColor2, setGradColor2] = useState("#2563eb");
  const [activeGradStop, setActiveGradStop] = useState<1 | 2>(1);

  // Opening Balance
  const [openingBalanceStr, setOpeningBalanceStr] = useState("");
  const [error, setError] = useState<string | null>(null);

  const modalScrollRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const activeColorStyle =
    colorMode === "solid"
      ? solidColor
      : `linear-gradient(135deg, ${gradColor1}, ${gradColor2})`;

  const activeGradientPresetStyle =
    GRADIENT_PRESETS.find(
      (p) =>
        p.color1.toLowerCase() === gradColor1.toLowerCase() &&
        p.color2.toLowerCase() === gradColor2.toLowerCase()
    )?.style ?? "";

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
      modalScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      nameInputRef.current?.focus();
      return;
    }

    if (cleanName.length > 30) {
      setError("Account name cannot exceed 30 characters.");
      modalScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      nameInputRef.current?.focus();
      return;
    }

    if (!cleanCode) {
      setError("Short code is required.");
      modalScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (cleanCode.length > 4) {
      setError("Short code cannot exceed 4 characters.");
      modalScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const isDuplicate = existingAccountNames.some(
      (n) => n.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (isDuplicate) {
      setError(`An account named "${cleanName}" already exists.`);
      modalScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      nameInputRef.current?.focus();
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
        ref={modalScrollRef}
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
                ref={nameInputRef}
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
              <div className="space-y-4 bg-stone-50/80 p-3.5 rounded-2xl border border-stone-200/80">
                {/* Default Colors via @beui/color-selector */}
                <div>
                  <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Default Colors</span>
                  </div>
                  <ColorSelector
                    value={solidColor.toLowerCase()}
                    onValueChange={(val) => setSolidColor(val)}
                  >
                    <ColorSelectorList className="gap-2.5 p-0.5 justify-start">
                      {SOLID_PRESETS.map((p) => (
                        <ColorSelectorItem
                          key={p.color}
                          value={p.color.toLowerCase()}
                          color={p.color}
                          label={p.name}
                        />
                      ))}
                    </ColorSelectorList>
                  </ColorSelector>
                </div>

                {/* Custom Color via @beui/color-picker */}
                <div className="pt-3 border-t border-stone-200/60">
                  <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Pipette className="w-3.5 h-3.5 text-stone-600" />
                      <span>Custom Color Picker</span>
                    </div>
                    <span className="font-mono-numbers text-[11px] font-bold text-stone-600 uppercase">
                      {solidColor}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs">
                    <ColorPicker
                      value={solidColor}
                      onValueChange={(val) => setSolidColor(val)}
                      alpha={false}
                      className="w-full max-w-none gap-3"
                    >
                      <ColorPickerArea className="h-32 rounded-xl" />
                      <ColorPickerHue />
                      <div className="flex items-center gap-2 pt-1">
                        <ColorPickerSwatch className="size-9 rounded-xl" />
                        <ColorPickerHexInput className="flex-1" />
                        <ColorPickerEyeDropper />
                      </div>
                    </ColorPicker>
                  </div>
                </div>
              </div>
            )}

            {/* Gradient Mode Controls */}
            {colorMode === "gradient" && (
              <div className="space-y-4 bg-stone-50/80 p-3.5 rounded-2xl border border-stone-200/80">
                {/* Default Gradient Presets via @beui/color-selector */}
                <div>
                  <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Default Gradient Presets</span>
                  </div>
                  <ColorSelector
                    value={activeGradientPresetStyle}
                    onValueChange={(styleVal) => {
                      const preset = GRADIENT_PRESETS.find((p) => p.style === styleVal);
                      if (preset) {
                        setGradColor1(preset.color1);
                        setGradColor2(preset.color2);
                      }
                    }}
                  >
                    <ColorSelectorList className="gap-2.5 p-0.5 justify-start">
                      {GRADIENT_PRESETS.map((p) => (
                        <ColorSelectorItem
                          key={p.name}
                          value={p.style}
                          color={p.style}
                          label={p.name}
                        />
                      ))}
                    </ColorSelectorList>
                  </ColorSelector>
                </div>

                {/* Custom Gradient Dual-Stop Controls */}
                <div className="pt-3 border-t border-stone-200/60">
                  <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Pipette className="w-3.5 h-3.5 text-stone-600" />
                      <span>Customize Gradient Stops</span>
                    </div>
                  </div>

                  {/* Stop Switcher */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setActiveGradStop(1)}
                      className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center justify-between ${
                        activeGradStop === 1
                          ? "bg-white border-stone-900 shadow-xs"
                          : "bg-stone-100/80 border-stone-200 hover:bg-white text-stone-600"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-4 h-4 rounded-full border border-black/15 shadow-2xs flex-shrink-0"
                          style={{ backgroundColor: gradColor1 }}
                        />
                        <span className="text-xs font-bold text-stone-900">From</span>
                      </div>
                      <span className="font-mono-numbers text-[11px] font-bold text-stone-600 uppercase flex-shrink-0">
                        {gradColor1}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveGradStop(2)}
                      className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center justify-between ${
                        activeGradStop === 2
                          ? "bg-white border-stone-900 shadow-xs"
                          : "bg-stone-100/80 border-stone-200 hover:bg-white text-stone-600"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-4 h-4 rounded-full border border-black/15 shadow-2xs flex-shrink-0"
                          style={{ backgroundColor: gradColor2 }}
                        />
                        <span className="text-xs font-bold text-stone-900">To</span>
                      </div>
                      <span className="font-mono-numbers text-[11px] font-bold text-stone-600 uppercase flex-shrink-0">
                        {gradColor2}
                      </span>
                    </button>
                  </div>

                  {/* Default color presets for the active stop */}
                  <div className="mb-3">
                    <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span>Quick Colors for {activeGradStop === 1 ? "Color 1 (From)" : "Color 2 (To)"}</span>
                    </div>
                    <ColorSelector
                      value={(activeGradStop === 1 ? gradColor1 : gradColor2).toLowerCase()}
                      onValueChange={(val) => {
                        if (activeGradStop === 1) setGradColor1(val);
                        else setGradColor2(val);
                      }}
                    >
                      <ColorSelectorList className="gap-2.5 p-0.5 justify-start">
                        {SOLID_PRESETS.map((p) => (
                          <ColorSelectorItem
                            key={p.color}
                            value={p.color.toLowerCase()}
                            color={p.color}
                            label={p.name}
                          />
                        ))}
                      </ColorSelectorList>
                    </ColorSelector>
                  </div>

                  {/* Custom ColorPicker for the active stop */}
                  <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs">
                    <ColorPicker
                      key={`grad-picker-${activeGradStop}`}
                      value={activeGradStop === 1 ? gradColor1 : gradColor2}
                      onValueChange={(val) => {
                        if (activeGradStop === 1) setGradColor1(val);
                        else setGradColor2(val);
                      }}
                      alpha={false}
                      className="w-full max-w-none gap-3"
                    >
                      <ColorPickerArea className="h-32 rounded-xl" />
                      <ColorPickerHue />
                      <div className="flex items-center gap-2 pt-1">
                        <ColorPickerSwatch className="size-9 rounded-xl" />
                        <ColorPickerHexInput className="flex-1" />
                        <ColorPickerEyeDropper />
                      </div>
                    </ColorPicker>
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

          {/* Bottom Error Alert (ensures user always sees validation error without scrolling) */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions (Natural document flow - NOT sticky/frozen) */}
          <div className="flex gap-2.5 pt-4 mt-2 border-t border-stone-200/80">
            <button
              type="button"
              onClick={onClose}
              className="btn-tactile-neutral flex-1 py-3 text-sm cursor-pointer select-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-tactile-dark flex-[2] py-3 text-sm cursor-pointer select-none flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Create Account</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
