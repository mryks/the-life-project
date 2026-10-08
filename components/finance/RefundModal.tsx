"use client";

import { useState } from "react";
import type { ExpenseEvent, RefundEvent } from "@/lib/types";
import { getAccountById } from "@/lib/accounts";
import { todayDate } from "@/lib/finance";
import { X, RotateCcw, AlertCircle, Check } from "lucide-react";

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentExpense: ExpenseEvent | null;
  editingRefund?: RefundEvent | null;
  maxRefundableAmount: number;
  existingRefundedAmount: number;
  onSaveRefund: (data: { date: string; amount: number; description: string }) => void;
  error: string | null;
  formatRupiah: (amount: number) => string;
}

export default function RefundModal({
  isOpen,
  onClose,
  parentExpense,
  editingRefund,
  maxRefundableAmount,
  existingRefundedAmount,
  onSaveRefund,
  error,
  formatRupiah,
}: RefundModalProps) {
  if (!isOpen || !parentExpense) return null;

  return (
    <RefundModalInner
      key={`${parentExpense.id}-${editingRefund?.id ?? 'new'}`}
      onClose={onClose}
      parentExpense={parentExpense}
      editingRefund={editingRefund}
      maxRefundableAmount={maxRefundableAmount}
      existingRefundedAmount={existingRefundedAmount}
      onSaveRefund={onSaveRefund}
      error={error}
      formatRupiah={formatRupiah}
    />
  );
}

function RefundModalInner({
  onClose,
  parentExpense,
  editingRefund,
  maxRefundableAmount,
  existingRefundedAmount,
  onSaveRefund,
  error,
  formatRupiah,
}: Omit<RefundModalProps, "isOpen"> & { parentExpense: ExpenseEvent }) {
  const [date, setDate] = useState(() => editingRefund ? editingRefund.date : todayDate());
  const [amount, setAmount] = useState(() => editingRefund ? editingRefund.amount.toString() : maxRefundableAmount.toString());
  const [desc, setDesc] = useState(() => editingRefund ? editingRefund.description : `Refund: ${parentExpense.description}`);
  const [localError, setLocalError] = useState<string | null>(null);

  const parentAcc = getAccountById(parentExpense.accountId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setLocalError("Refund amount must be a positive number.");
      return;
    }
    if (parsedAmount > maxRefundableAmount) {
      setLocalError(`Refund amount exceeds the maximum refundable balance (${formatRupiah(maxRefundableAmount)}).`);
      return;
    }
    if (!date) {
      setLocalError("Refund date is required.");
      return;
    }
    onSaveRefund({
      date,
      amount: parsedAmount,
      description: desc.trim() || `Refund: ${parentExpense.description}`,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-zinc-200/80 w-full max-w-md rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          type="button"
          aria-label="Close dialog"
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition rounded-full w-8 h-8 flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200/60">
              <RotateCcw className="w-3 h-3" />
              {editingRefund ? "Edit Refund" : "Refund Flow"}
            </span>
          </div>
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">
            {editingRefund ? "Update Refund" : "Record Refund"}
          </h3>
          <p className="text-xs text-zinc-500">
            {editingRefund ? "Modify existing refund credited to the original expense" : "Credit incoming funds back to the original expense"}
          </p>
        </div>

        {/* Parent Expense Summary Box */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 mb-4 text-xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 font-medium">Original Expense:</span>
            <span className="font-semibold text-zinc-900">{parentExpense.description}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 font-medium">Account:</span>
            <span className="font-semibold text-zinc-900 flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${parentAcc?.colorClass}`} />
              <span>{parentAcc?.fullName} ({parentAcc?.name})</span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 font-medium">Original Amount:</span>
            <span className="font-semibold text-zinc-900 font-mono-numbers">{formatRupiah(parentExpense.amount)}</span>
          </div>
          {existingRefundedAmount > 0 && (
            <div className="flex justify-between items-center text-amber-600">
              <span>Already Refunded:</span>
              <span className="font-semibold font-mono-numbers">{formatRupiah(existingRefundedAmount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-zinc-200/80 font-bold text-zinc-900">
            <span>Max Refundable:</span>
            <span className="text-sm font-mono-numbers text-violet-700">{formatRupiah(maxRefundableAmount)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1 block">
              Refund Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-900/5 text-zinc-900 text-sm font-medium transition"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1 block">
              Refund Amount (IDR)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-medium text-sm">
                Rp
              </span>
              <input
                type="number"
                min="1"
                max={maxRefundableAmount}
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-900/5 text-base font-bold text-zinc-900 font-mono-numbers transition"
              />
            </div>
            {amount && Number(amount) < maxRefundableAmount && (
              <p className="text-[11px] text-zinc-500 mt-1">
                Partial refund: remaining net expense balance will be {formatRupiah(maxRefundableAmount - Number(amount))}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1 block">
              Description / Notes
            </label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="e.g. Returned item, order cancellation"
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-900/5 text-zinc-900 text-sm transition"
            />
          </div>

          {(localError || error) && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{localError || error}</span>
            </div>
          )}

          <div className="flex gap-2.5 mt-6 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] bg-zinc-900 hover:bg-zinc-800 text-white py-2.5 rounded-xl text-sm font-semibold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{editingRefund ? "Save Changes" : "Save Refund"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
