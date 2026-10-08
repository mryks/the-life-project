"use client";

import { Vault, ArrowRight, ShieldCheck } from "@phosphor-icons/react";

interface HeroVaultCardProps {
  totalBalance: number;
  investmentBalance: number;
  netWorth: number;
  savingsRate: number;
  formatRupiah: (num: number) => string;
  onViewAccounts: () => void;
}

export default function HeroVaultCard({
  totalBalance,
  investmentBalance,
  netWorth,
  savingsRate,
  formatRupiah,
  onViewAccounts,
}: HeroVaultCardProps) {
  // Compute visual health progress (0 to 100%)
  const clampedProgress = Math.min(100, Math.max(8, savingsRate > 0 ? savingsRate : 12));

  return (
    <div 
      onClick={onViewAccounts}
      className="bg-gradient-to-br from-amber-500/[0.08] via-amber-100/20 to-orange-500/[0.04] bg-white border-2 border-amber-300/80 border-b-4 border-b-amber-400/90 rounded-3xl p-5 sm:p-7 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group relative overflow-hidden"
    >
      {/* Top Header Pill Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100/90 text-amber-950 border border-amber-300/80 shadow-2xs tracking-wide">
          <Vault className="w-3.5 h-3.5 text-amber-700" weight="duotone" />
          <span>TOTAL BALANCE</span>
        </span>

        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-900/80 group-hover:text-amber-950 transition-colors shrink-0">
          <span>View Accounts</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" weight="bold" />
        </span>
      </div>

      {/* Main Big Balance Amount */}
      <div className="mt-3">
        <h2 className="text-3xl sm:text-5xl font-extrabold text-stone-900 font-sora-numbers tracking-tight">
          {formatRupiah(totalBalance)}
        </h2>
        <p className="text-xs font-medium text-stone-500 mt-1">
          Available funds across everyday checking accounts and e-wallets
        </p>
      </div>

      {/* Duolingo-style Savings Streak & Health Progress Bar */}
      <div className="mt-5 pt-4 border-t border-amber-200/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs font-bold mb-2">
          <div className="flex items-center gap-1.5 text-stone-700 min-w-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" weight="duotone" />
            <span className="truncate">
              {savingsRate >= 50
                ? "Savings Health: Exceptional Streak!"
                : savingsRate >= 20
                ? "Savings Health: Strong & Steady"
                : savingsRate > 0
                ? "Savings Health: Positive Flow"
                : "Cashflow Alert: Outflows higher than inflows"}
            </span>
          </div>
          <span className="self-start sm:self-auto font-sora-numbers text-stone-900 bg-amber-100/90 border border-amber-300/80 px-2.5 py-0.5 rounded-full text-[11px] whitespace-nowrap shrink-0 shadow-2xs font-bold">
            {savingsRate.toFixed(1)}% savings rate
          </span>
        </div>

        {/* Juicy Pill Progress Bar */}
        <div className="w-full h-3 rounded-full bg-stone-100 border border-stone-200/80 overflow-hidden p-0.5">
          <div 
            className={`h-full rounded-full transition-all duration-700 ${
              savingsRate >= 20 
                ? 'bg-gradient-to-r from-amber-400 via-emerald-400 to-emerald-500' 
                : savingsRate > 0
                ? 'bg-gradient-to-r from-amber-400 to-emerald-400'
                : 'bg-rose-400'
            }`}
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
      </div>

      {/* Footer Companion Chips */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs pt-1">
        <div className="flex items-center gap-2 text-stone-600">
          <span>Investment Assets:</span>
          <strong className="font-sora-numbers text-stone-900 font-bold bg-white/90 border border-stone-200 px-2 py-0.5 rounded-lg shadow-2xs">
            {formatRupiah(investmentBalance)}
          </strong>
        </div>

        <div className="inline-flex items-center self-start sm:self-auto gap-1.5 bg-stone-900 text-white px-3 py-1 rounded-xl font-bold shadow-xs">
          <span className="text-stone-300 font-normal">Total Net Worth:</span>
          <span className="font-sora-numbers text-white font-bold">{formatRupiah(netWorth)}</span>
        </div>
      </div>
    </div>
  );
}
