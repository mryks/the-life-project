"use client";

import { TrendUp, TrendDown, Scales, Flame } from "@phosphor-icons/react";

interface KpiGridProps {
  monthlyIncome: number;
  monthlyExpense: number;
  netCashflow: number;
  savingsRate: number;
  dailyAverageExpense: number;
  monthName: string;
  formatRupiah: (num: number) => string;
}

export default function KpiGrid({
  monthlyIncome,
  monthlyExpense,
  netCashflow,
  savingsRate,
  dailyAverageExpense,
  monthName,
  formatRupiah,
}: KpiGridProps) {
  const shortMonth = monthName.split(' ')[0];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* 1. Monthly Income */}
      <div className="bg-emerald-50/60 border border-emerald-200/90 border-b-[3px] border-b-emerald-300/90 rounded-2xl p-4 shadow-2xs hover:-translate-y-0.5 transition-all duration-150">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-emerald-900 uppercase tracking-wider">
            Income
          </span>
          <div className="w-7 h-7 rounded-xl bg-white border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-2xs">
            <TrendUp className="w-4 h-4" weight="bold" />
          </div>
        </div>
        <p className="text-lg sm:text-xl font-bold font-sora-numbers text-emerald-600 mt-2 truncate">
          +{formatRupiah(monthlyIncome)}
        </p>
        <p className="text-[11px] text-emerald-800/80 font-medium mt-0.5 truncate">
          {shortMonth} cash inflow
        </p>
      </div>

      {/* 2. Monthly Expenses */}
      <div className="bg-rose-50/60 border border-rose-200/90 border-b-[3px] border-b-rose-300/90 rounded-2xl p-4 shadow-2xs hover:-translate-y-0.5 transition-all duration-150">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-rose-900 uppercase tracking-wider">
            Expenses
          </span>
          <div className="w-7 h-7 rounded-xl bg-white border border-rose-200 text-rose-600 flex items-center justify-center shadow-2xs">
            <TrendDown className="w-4 h-4" weight="bold" />
          </div>
        </div>
        <p className="text-lg sm:text-xl font-bold font-sora-numbers text-rose-600 mt-2 truncate">
          -{formatRupiah(monthlyExpense)}
        </p>
        <p className="text-[11px] text-rose-800/80 font-medium mt-0.5 truncate">
          {shortMonth} spending outflow
        </p>
      </div>

      {/* 3. Net Cashflow (Stash) */}
      <div className="bg-amber-50/60 border border-amber-200/90 border-b-[3px] border-b-amber-300/90 rounded-2xl p-4 shadow-2xs hover:-translate-y-0.5 transition-all duration-150">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-amber-950 uppercase tracking-wider">
            {netCashflow >= 0 ? "Net Surplus" : "Net Deficit"}
          </span>
          <div className="w-7 h-7 rounded-xl bg-white border border-amber-200 text-amber-700 flex items-center justify-center shadow-2xs">
            <Scales className="w-4 h-4" weight="duotone" />
          </div>
        </div>
        <p className={`text-lg sm:text-xl font-bold font-sora-numbers mt-2 truncate ${
          netCashflow >= 0 ? 'text-stone-900' : 'text-rose-600'
        }`}>
          {netCashflow >= 0 ? '+' : ''}{formatRupiah(netCashflow)}
        </p>
        <p className="text-[11px] text-amber-900/80 font-medium mt-0.5 truncate">
          {savingsRate.toFixed(1)}% savings rate
        </p>
      </div>

      {/* 4. Daily Burn Rate (Pace) */}
      <div className="bg-violet-50/60 border border-violet-200/90 border-b-[3px] border-b-violet-300/90 rounded-2xl p-4 shadow-2xs hover:-translate-y-0.5 transition-all duration-150">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-violet-950 uppercase tracking-wider">
            Burn Speed
          </span>
          <div className="w-7 h-7 rounded-xl bg-white border border-violet-200 text-violet-600 flex items-center justify-center shadow-2xs">
            <Flame className="w-4 h-4" weight="duotone" />
          </div>
        </div>
        <p className="text-lg sm:text-xl font-bold font-sora-numbers text-stone-900 mt-2 truncate">
          {formatRupiah(dailyAverageExpense)}<span className="text-xs font-normal text-stone-400">/day</span>
        </p>
        <p className="text-[11px] text-violet-800/80 font-medium mt-0.5 truncate">
          Daily average runway
        </p>
      </div>
    </div>
  );
}
