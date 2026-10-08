"use client";

import { Receipt, Plus } from "@phosphor-icons/react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title = "Ready to start your financial streak?",
  description = "Log your first morning coffee, paycheck, or account transfer to kick off your live charts and cashflow insights.",
  actionLabel = "Record First Transaction",
  onAction,
}: EmptyStateProps) {
  return (
    <div className="text-center py-10 px-4 bg-white/80 rounded-3xl border-2 border-dashed border-stone-200/90 max-w-lg mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-amber-100/90 text-amber-800 flex items-center justify-center mx-auto mb-3 shadow-2xs border border-amber-200">
        <Receipt className="w-7 h-7 text-amber-700" weight="duotone" />
      </div>
      <h4 className="text-base sm:text-lg font-extrabold text-stone-900 tracking-tight">
        {title}
      </h4>
      <p className="text-xs sm:text-sm text-stone-500 mt-1 max-w-sm mx-auto leading-relaxed">
        {description}
      </p>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="btn-tactile-primary px-5 py-2.5 text-xs sm:text-sm inline-flex items-center gap-1.5 mt-4 cursor-pointer"
        >
          <Plus className="w-4 h-4" weight="bold" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}
