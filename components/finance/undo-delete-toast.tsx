"use client";

import { motion } from "framer-motion";
import { Trash2, RotateCcw, X } from "lucide-react";
import type { FinancialEvent } from "@/lib/types";

export interface UndoDeleteToastProps {
  event: FinancialEvent;
  relatedCount?: number;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

const formatToastRupiah = (num: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);

export function UndoDeleteToast({
  event,
  relatedCount = 0,
  onUndo,
  onDismiss,
  durationMs = 4000,
}: UndoDeleteToastProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, x: "-50%", scale: 0.95 }}
      animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
      exit={{ opacity: 0, y: 20, x: "-50%", scale: 0.95 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 28,
      }}
      className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md pb-[env(safe-area-inset-bottom,0px)]"
      role="status"
      aria-live="polite"
    >
      <div className="border border-stone-800 shadow-2xl rounded-2xl bg-stone-900/95 backdrop-blur-md text-white overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-3.5 py-3">
          {/* Left: Icon & Transaction Details */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-stone-800/90 border border-stone-700/60 flex items-center justify-center shrink-0 text-rose-400">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-stone-200">
                  Transaction deleted
                </span>
                {relatedCount > 0 && (
                  <span className="text-[10px] text-stone-400 font-medium">
                    (+{relatedCount} linked)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-stone-400 truncate">
                <span className="truncate max-w-[120px] sm:max-w-[170px] font-medium text-stone-300">
                  {event.description || "Untitled"}
                </span>
                <span className="text-stone-600">•</span>
                <span className="tabular-nums font-mono text-stone-300 shrink-0">
                  {formatToastRupiah(event.amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Tactile Undo & Dismiss Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onUndo}
              className="bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-stone-900 font-bold px-3.5 py-2 min-h-[36px] rounded-xl text-xs active:translate-y-0.5 shadow-xs flex items-center gap-1.5 cursor-pointer transition-transform select-none"
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss toast and confirm deletion"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom: Linear Countdown Progress Bar */}
        <div className="h-1 bg-stone-800/80 w-full overflow-hidden">
          <motion.div
            className="h-1 bg-amber-400/90 w-full"
            style={{ transformOrigin: "left" }}
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{
              duration: durationMs / 1000,
              ease: "linear",
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default UndoDeleteToast;
