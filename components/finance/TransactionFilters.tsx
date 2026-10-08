"use client";

import { 
  MagnifyingGlass, 
  X, 
  Stack, 
  TrendDown, 
  TrendUp, 
  ArrowsLeftRight, 
  ArrowCounterClockwise,
  Faders 
} from "@phosphor-icons/react";

interface TransactionFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  typeFilter: 'all' | 'expense' | 'income' | 'transfer' | 'refund';
  onTypeFilterChange: (type: 'all' | 'expense' | 'income' | 'transfer' | 'refund') => void;
  categoryFilter: string;
  onCategoryFilterChange: (cat: string) => void;
  availableCategories: string[];
  filteredCount: number;
  totalCount: number;
  onResetAll: () => void;
  isFiltered: boolean;
}

export default function TransactionFilters({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  availableCategories,
  filteredCount,
  totalCount,
  onResetAll,
  isFiltered,
}: TransactionFiltersProps) {
  const types = [
    { id: 'all' as const, label: 'All', icon: Stack, activeColor: 'bg-stone-900 text-white border-b-2 border-stone-950' },
    { id: 'expense' as const, label: 'Expenses', icon: TrendDown, activeColor: 'bg-rose-500 text-white border-b-2 border-rose-700' },
    { id: 'income' as const, label: 'Income', icon: TrendUp, activeColor: 'bg-emerald-500 text-white border-b-2 border-emerald-700' },
    { id: 'transfer' as const, label: 'Transfers', icon: ArrowsLeftRight, activeColor: 'bg-violet-600 text-white border-b-2 border-violet-800' },
    { id: 'refund' as const, label: 'Refunds', icon: ArrowCounterClockwise, activeColor: 'bg-amber-500 text-white border-b-2 border-amber-700' },
  ];

  return (
    <div className="bg-white p-4 sm:p-5 rounded-3xl border border-stone-200/90 border-b-[3px] border-b-stone-300/80 shadow-xs mb-6 space-y-3.5">
      {/* Search Bar */}
      <div className="relative">
        <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" weight="bold" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by description, account, or amount..."
          className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:border-stone-400 focus:bg-white focus:ring-2 focus:ring-stone-900/5 transition font-medium"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 bg-stone-200/80 hover:bg-stone-300 rounded-full w-5 h-5 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-3 h-3" weight="bold" />
          </button>
        )}
      </div>

      {/* Filter Row: Type Segmented Pills & Category Dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
        {/* Type Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {types.map((t) => {
            const Icon = t.icon;
            const isActive = typeFilter === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTypeFilterChange(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer active:scale-95 shadow-2xs ${
                  isActive
                    ? t.activeColor
                    : 'bg-stone-100 hover:bg-stone-200/80 text-stone-600 border border-stone-200/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-stone-500'}`} weight={isActive ? "bold" : "regular"} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Category Dropdown */}
        <div className="flex items-center gap-1.5">
          <Faders className="w-3.5 h-3.5 text-stone-400" weight="bold" />
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="bg-stone-50 border border-stone-200 text-stone-800 text-xs font-semibold rounded-xl px-3 py-1.5 outline-none focus:border-stone-400 cursor-pointer shadow-2xs"
          >
            <option value="all">All Categories</option>
            {availableCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter Summary & Reset Bar */}
      {isFiltered && (
        <div className="flex items-center justify-between pt-2.5 border-t border-stone-100 text-xs text-stone-500 font-medium">
          <span>
            Showing <strong className="text-stone-900 font-bold">{filteredCount}</strong> of {totalCount} transactions
          </span>
          <button
            type="button"
            onClick={onResetAll}
            className="text-amber-800 hover:text-amber-950 font-bold hover:underline cursor-pointer transition flex items-center gap-1 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-lg"
          >
            <ArrowCounterClockwise className="w-3 h-3 text-amber-700" weight="bold" />
            <span>Reset Filters</span>
          </button>
        </div>
      )}
    </div>
  );
}
