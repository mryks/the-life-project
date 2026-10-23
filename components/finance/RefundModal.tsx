"use client";

import { useState } from "react";
import type { ExpenseEvent, RefundEvent, AccountId } from "@/lib/types";
import { getAccountById, getAllAccounts } from "@/lib/accounts";
import { todayDate, isDateOnly, parseLocalDate, formatLocalDate } from "@/lib/finance";
import { DatePicker } from "@/components/ui/date-picker";
import { X, RotateCcw, AlertCircle, Check, Calendar as CalendarIcon } from "lucide-react";

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentExpense: ExpenseEvent | null;
  editingRefund?: RefundEvent | null;
  maxRefundableAmount: number;
  existingRefundedAmount: number;
  onSaveRefund: (data: { date: string; amount: number; description: string; accountId: AccountId }) => void;
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
  const [amount, setAmount] = useState(() => 
    editingRefund 
      ? editingRefund.amount.toLocaleString('id-ID') 
      : maxRefundableAmount > 0
        ? maxRefundableAmount.toLocaleString('id-ID')
        : ''
  );
  const [selectedAccount, setSelectedAccount] = useState<AccountId | null>(() => 
    editingRefund ? editingRefund.accountId : null
  );
  const [desc, setDesc] = useState(() => editingRefund ? editingRefund.description : `Refund: ${parentExpense.description}`);
  const [localError, setLocalError] = useState<string | null>(null);

  const parentAcc = getAccountById(parentExpense.accountId);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setAmount('');
      return;
    }
    setAmount(Number(raw).toLocaleString('id-ID'));
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr || !isDateOnly(dateStr)) return dateStr;
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const monthName = d.toLocaleDateString('en-US', { month: 'long' });
    return `${day} ${monthName} ${year}`;
  };

  const rawDigits = amount.replace(/\D/g, '');
  const parsedAmount = rawDigits ? Number(rawDigits) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setLocalError("Refund amount must be a positive number.");
      return;
    }
    if (!selectedAccount) {
      setLocalError("Please select a destination account for the refund.");
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
      accountId: selectedAccount,
    });
  };

  const dismissKeyboard = () => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
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
        className="bg-white border-2 border-stone-200 border-b-4 border-b-stone-300 w-full max-w-md rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onScroll={dismissKeyboard}
        onTouchMove={dismissKeyboard}
        onPointerDown={(e) => {
          const target = e.target as HTMLElement | null;
          if (target && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
            dismissKeyboard();
          }
        }}
      >
        <button
          onClick={onClose}
          type="button"
          aria-label="Close dialog"
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition rounded-full w-8 h-8 flex items-center justify-center cursor-pointer"
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
          <h3 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
            {editingRefund ? "Update Refund" : "Record Refund"}
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            {editingRefund ? "Modify existing refund credited to the original expense" : "Credit incoming funds back to the original expense"}
          </p>
        </div>

        {/* Parent Expense Summary Box */}
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 mb-4 text-xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-stone-500 font-medium">Original Expense:</span>
            <span className="font-semibold text-stone-900">{parentExpense.description}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-stone-500 font-medium">Paid From:</span>
            <span className="font-semibold text-stone-900 flex items-center gap-1.5">
              <span
                style={parentAcc?.colorStyle ? { background: parentAcc.colorStyle } : undefined}
                className={`w-2.5 h-2.5 rounded-full ${parentAcc?.colorClass || 'bg-stone-500'}`}
              />
              <span>{parentAcc?.fullName} ({parentAcc?.name})</span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-stone-500 font-medium">Original Amount:</span>
            <span className="font-semibold text-stone-900 font-mono-numbers">{formatRupiah(parentExpense.amount)}</span>
          </div>
          {existingRefundedAmount > 0 && (
            <div className="flex justify-between items-center text-amber-600">
              <span>Already Refunded:</span>
              <span className="font-semibold font-mono-numbers">{formatRupiah(existingRefundedAmount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-stone-200/80 font-bold text-stone-900">
            <span>Refundable Expense:</span>
            <span className="text-sm font-mono-numbers text-violet-700">{formatRupiah(maxRefundableAmount)}</span>
          </div>
          <p className="text-[10px] text-stone-400 mt-0.5">
            Refund can exceed this balance. Any excess will be recorded as profit under category &quot;Others&quot;.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount Input with Live Dot Delimiter */}
          <div>
            <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-1 block">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-base">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0"
                className="w-full bg-stone-50 border-2 border-stone-200 rounded-2xl pl-11 pr-4 py-2.5 outline-none focus:border-stone-400 focus:bg-white focus:ring-2 focus:ring-stone-900/5 text-xl font-black text-stone-900 font-mono-numbers transition"
              />
            </div>
            {parsedAmount > 0 && parsedAmount < maxRefundableAmount && (
              <p className="text-[11px] text-stone-500 mt-1">
                Partial refund: remaining net expense balance will be {formatRupiah(maxRefundableAmount - parsedAmount)}
              </p>
            )}
            {parsedAmount > 0 && parsedAmount === maxRefundableAmount && (
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                Full refund: net expense balance will be Rp 0
              </p>
            )}
            {parsedAmount > maxRefundableAmount && (
              <div className="mt-1.5 p-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px] text-emerald-800 space-y-0.5">
                <p className="font-bold">
                  Net expense balance: Rp 0
                </p>
                <p>
                  Excess profit: <span className="font-bold font-mono-numbers">+{formatRupiah(parsedAmount - maxRefundableAmount)}</span> (recorded in category <span className="font-bold">Others</span>)
                </p>
              </div>
            )}
          </div>

          {/* Destination Account Selection */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wider block">
                Destination Account
              </label>
              {!selectedAccount && (
                <span className="text-[10px] font-bold text-rose-500">Required</span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1.5 bg-stone-50 rounded-2xl border border-stone-200">
              {getAllAccounts().map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => {
                    setSelectedAccount(acc.id);
                    setLocalError(null);
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    selectedAccount === acc.id
                      ? 'bg-stone-900 text-white border-stone-950 shadow-xs'
                      : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <span
                    style={acc.colorStyle ? { background: acc.colorStyle } : undefined}
                    className={`w-5 h-5 rounded-full ${acc.colorClass || 'bg-stone-500'} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 shadow-xs`}
                  >
                    {acc.name}
                  </span>
                  <span className="truncate">{acc.fullName}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Account receiving the refunded funds (can be different from the original paid account).
            </p>
          </div>

          {/* Date Input (Formatted as d MMMM yyyy, e.g. 15 October 2026) */}
          <div>
            <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-1 block">
              Refund Date
            </label>
            <DatePicker
              value={parseLocalDate(date)}
              onChange={(newDate) => {
                if (newDate) {
                  setDate(formatLocalDate(newDate));
                }
              }}
              formatDate={(d) => formatDateDisplay(formatLocalDate(d))}
              className="w-full"
              triggerClassName="w-full bg-stone-50 border-2 border-stone-200 hover:border-stone-300 rounded-2xl px-3.5 py-2.5 text-sm text-stone-900 font-bold flex items-center justify-between transition cursor-pointer outline-none focus:border-stone-400"
              renderTrigger={({ text }) => (
                <>
                  <div className="flex items-center gap-2 text-stone-800">
                    <CalendarIcon className="w-4 h-4 text-stone-500" />
                    <span>{text}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-stone-400">Change</span>
                </>
              )}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-1 block">
              Description
            </label>
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="e.g. Returned item, order cancellation"
              className="w-full bg-stone-50 border-2 border-stone-200 rounded-2xl px-3.5 py-2.5 text-sm text-stone-900 outline-none focus:border-stone-400 focus:bg-white transition"
            />
          </div>

          {(localError || error) && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{localError || error}</span>
            </div>
          )}

          <div className="flex gap-2.5 mt-6 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-tactile-neutral flex-1 py-2.5 text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-tactile-dark flex-[2] py-2.5 text-sm cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{editingRefund ? "Save Changes" : "Save Refund"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
