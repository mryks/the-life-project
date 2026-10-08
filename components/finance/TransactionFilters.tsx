"use client";

import { useState, useRef, useEffect } from "react";
import { 
  MagnifyingGlass, 
  X, 
  Stack, 
  TrendDown, 
  TrendUp, 
  ArrowsLeftRight, 
  ArrowCounterClockwise,
  Faders,
  CaretDown,
  Check
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
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isCategoryOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsCategoryOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCategoryOpen]);

  const types = [
    { id: 'all' as const, label: 'All', icon: Stack, activeColor: 'bg-stone-900 text-white border-b-2 border-stone-950' },
    { id: 'expense' as const, label: 'Expenses', icon: TrendDown, activeColor: 'bg-rose-500 text-white border-b-2 border-rose-700' },
    { id: 'income' as const, label: 'Income', icon: TrendUp, activeColor: 'bg-emerald-500 text-white border-b-2 border-emerald-700' },
    { id: 'transfer' as const, label: 'Transfers', icon: ArrowsLeftRight, activeColor: 'bg-blue-600 text-white border-b-2 border-blue-800' },
    { id: 'refund' as const, label: 'Refunds', icon: ArrowCounterClockwise, activeColor: 'bg-violet-600 text-white border-b-2 border-violet-800' },
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

        {/* Custom Category Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsCategoryOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={isCategoryOpen}
            aria-label="Filter by category"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs active:scale-95 select-none ${
              categoryFilter !== 'all'
                ? 'bg-amber-100/90 border-amber-300 text-amber-950 shadow-xs'
                : 'bg-stone-50 hover:bg-stone-100/90 border-stone-200 text-stone-700 hover:text-stone-900'
            }`}
          >
            <Faders className={`w-3.5 h-3.5 ${categoryFilter !== 'all' ? 'text-amber-700' : 'text-stone-400'}`} weight="bold" />
            <span className="max-w-[120px] sm:max-w-[160px] truncate">
              {categoryFilter === 'all' ? 'All Categories' : categoryFilter}
            </span>
            <CaretDown
              className={`w-3 h-3 text-stone-400 transition-transform duration-200 ${
                isCategoryOpen ? 'rotate-180 text-stone-700' : ''
              }`}
              weight="bold"
            />
          </button>

          {isCategoryOpen && (
            <div
              role="listbox"
              className="absolute right-0 top-full mt-1.5 z-40 min-w-[190px] max-w-[260px] w-max bg-white border-2 border-stone-200 border-b-4 border-b-stone-300 rounded-2xl p-1.5 shadow-xl max-h-60 overflow-y-auto overscroll-contain space-y-0.5 animate-in fade-in duration-100"
            >
              <button
                type="button"
                role="option"
                aria-selected={categoryFilter === 'all'}
                onClick={() => {
                  onCategoryFilterChange('all');
                  setIsCategoryOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                  categoryFilter === 'all'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-700 hover:bg-stone-100 active:bg-stone-200'
                }`}
              >
                <span>All Categories</span>
                {categoryFilter === 'all' && <Check className="w-3.5 h-3.5 text-white shrink-0" weight="bold" />}
              </button>

              {availableCategories.length > 0 && <div className="h-px bg-stone-100 my-1 mx-1" />}

              {availableCategories.map((c) => {
                const isSelected = categoryFilter === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onCategoryFilterChange(c);
                      setIsCategoryOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer gap-2 ${
                      isSelected
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'text-stone-700 hover:bg-stone-100 active:bg-stone-200'
                    }`}
                  >
                    <span className="truncate">{c}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" weight="bold" />}
                  </button>
                );
              })}
            </div>
          )}
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
