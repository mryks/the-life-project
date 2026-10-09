"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { CaretDown, Check, Faders } from "@phosphor-icons/react";

export interface GooeyMenuProps {
  options: string[];
  value: string;
  onSelect: (option: string) => void;
  placeholder?: string;
  className?: string;
  width?: number | string;
}

export default function GooeyMenu({
  options,
  value,
  onSelect,
  placeholder = "All Categories",
  className = "",
  width = 200,
}: GooeyMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const filterId = useId().replace(/:/g, "_") + "_easyui_goo";

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const displayLabel = value === "all" ? placeholder : value;
  const isCustomActive = value !== "all";

  // Calculate dynamic dropdown height based on item count (capped with scroll)
  const itemHeight = 36;
  const maxVisibleItems = 6;
  const visibleItems = Math.min(options.length + 1, maxVisibleItems);
  const dropdownHeight = visibleItems * itemHeight + 16;

  return (
    <div
      ref={containerRef}
      className={`relative inline-block select-none text-left font-sans ${className}`}
      style={{ width }}
    >
      {/* SVG Liquid Metaball Filter Definition */}
      <svg
        width="0"
        height="0"
        className="absolute pointer-events-none"
        aria-hidden="true"
        style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      >
        <defs>
          <filter
            id={filterId}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="6.5" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -12"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* Gooey Liquid Background Layer (Rendered with the SVG goo filter) */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          filter: `url(#${filterId})`,
          transform: "translateZ(0)",
          isolation: "isolate",
        }}
      >
        {/* Top Trigger Pill Blob */}
        <div
          className={`absolute left-0 top-0 transition-colors duration-200 ${
            isCustomActive
              ? "bg-amber-600 dark:bg-amber-600"
              : "bg-stone-900 dark:bg-stone-900"
          }`}
          style={{
            width: "100%",
            height: 38,
            borderRadius: 19,
          }}
        />

        {/* Liquid Extrusion Dropdown Blob */}
        <div
          className={`absolute left-0 top-0 transition-all duration-300 ${
            isCustomActive
              ? "bg-amber-600 dark:bg-amber-600"
              : "bg-stone-900 dark:bg-stone-900"
          }`}
          style={{
            width: "100%",
            height: dropdownHeight,
            borderRadius: 20,
            transformOrigin: "50% 0%",
            transform: isOpen
              ? "translateY(44px) scaleY(1)"
              : "translateY(0px) scaleY(0.2)",
            opacity: isOpen ? 1 : 0,
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>

      {/* Interactive Trigger Button (Crisp Foreground Layer, outside filter) */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select Category"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative z-20 w-full h-[38px] px-3.5 flex items-center justify-between text-white font-bold text-xs rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-98 transition-transform"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Faders
            className={`w-3.5 h-3.5 shrink-0 ${
              isCustomActive ? "text-amber-200" : "text-stone-300"
            }`}
            weight="bold"
          />
          <span className="truncate text-xs tracking-tight">{displayLabel}</span>
        </div>
        <CaretDown
          className={`w-3.5 h-3.5 text-stone-300 shrink-0 transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
          weight="bold"
        />
      </button>

      {/* Crisp Options Dropdown Menu (Outside SVG filter to keep text 100% crisp) */}
      <div
        role="listbox"
        className={`absolute left-0 top-[44px] z-30 w-full p-2 text-white overflow-hidden transition-all duration-300 ${
          isOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
        style={{
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div
          className="space-y-1 overflow-y-auto pr-1 overscroll-contain"
          style={{ maxHeight: dropdownHeight - 16 }}
        >
          {/* "All Categories" option */}
          <button
            type="button"
            role="option"
            aria-selected={value === "all"}
            onClick={() => {
              onSelect("all");
              setIsOpen(false);
            }}
            className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between text-left transition-colors cursor-pointer select-none ${
              value === "all"
                ? "bg-white/20 text-white font-bold shadow-2xs"
                : "text-stone-200 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span>All Categories</span>
            {value === "all" && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" weight="bold" />}
          </button>

          {/* Dynamic Available Categories */}
          {options.map((opt) => {
            const isSelected = value === opt;
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onSelect(opt);
                  setIsOpen(false);
                }}
                className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between text-left transition-colors cursor-pointer select-none ${
                  isSelected
                    ? "bg-white/20 text-white font-bold shadow-2xs"
                    : "text-stone-200 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="truncate">{opt}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" weight="bold" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
