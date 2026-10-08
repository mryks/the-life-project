"use client";

import { CaretLeft, CaretRight, CalendarBlank } from "@phosphor-icons/react";

interface MonthNavigatorProps {
  selectedMonth: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onCurrentMonth?: () => void;
  formatMonthName: (monthStr: string) => string;
  isCurrentMonth?: boolean;
}

export default function MonthNavigator({
  selectedMonth,
  onPrevMonth,
  onNextMonth,
  formatMonthName,
}: MonthNavigatorProps) {
  return (
    <div className="flex items-center justify-between bg-white px-3.5 py-2.5 sm:px-5 sm:py-3 rounded-2xl sm:rounded-full border border-stone-200/90 border-b-[3px] border-b-stone-300/80 shadow-xs">
      <button
        type="button"
        onClick={onPrevMonth}
        aria-label="Previous month"
        className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200/80 text-stone-700 flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-2xs"
      >
        <CaretLeft className="w-4 h-4" weight="bold" />
      </button>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 text-stone-800">
          <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center">
            <CalendarBlank className="w-4 h-4" weight="duotone" />
          </div>
          <span className="font-extrabold text-stone-900 text-sm sm:text-base capitalize tracking-tight font-sans">
            {formatMonthName(selectedMonth)}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onNextMonth}
        aria-label="Next month"
        className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200/80 text-stone-700 flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-2xs"
      >
        <CaretRight className="w-4 h-4" weight="bold" />
      </button>
    </div>
  );
}
