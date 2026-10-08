"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { AccountId, BackupParseResult, ExpenseCategory, ExpenseEvent, FinancialEvent, IncomeCategory, RefundEvent } from "@/lib/types";
import { 
  accounts, 
  getAccountById, 
  liquidAccounts, 
  investmentAccounts, 
} from "@/lib/accounts";
import {
  calculateFinanceStats,
  calculateNetExpenseForDate,
  createEventId,
  deleteFinancialEvent,
  deriveLedgerEntries,
  downloadBackupFile,
  expenseCategories,
  getAccountBalances,
  getBackupFilename,
  incomeCategories,
  isDateOnly,
  isPositiveInteger,
  parseAndValidateBackup,
  readFinancialEvents,
  reorderFinancialEvents,
  replaceFinancialEvent,
  restoreFinancialEvents,
  serializeBackup,
  subscribeToFinancialEvents,
  todayDate,
  validateFinancialEvents,
  validateNormalTransactionDate,
  writeFinancialEvents,
} from "@/lib/finance";
import { useTransactionReorder } from "@/hooks/useTransactionReorder";
import MonthNavigator from "@/components/finance/MonthNavigator";
import RefundModal from "@/components/finance/RefundModal";
import TransactionFilters from "@/components/finance/TransactionFilters";
import HeroVaultCard from "@/components/finance/HeroVaultCard";
import KpiGrid from "@/components/finance/KpiGrid";
import EmptyState from "@/components/finance/EmptyState";
import BrandLogo from "@/components/finance/BrandLogo";
import MasterPinLockscreen from "@/components/finance/MasterPinLockscreen";
import {
  isSessionUnlocked,
  lockSession,
  touchActivity,
  SECURITY_CHANGE_EVENT,
} from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  syncWithCloud,
  forceUploadAllToCloud,
  getSyncState,
  deleteFinancialEventWithSync,
  queuePendingUpserts,
  queuePendingDeletion,
  SYNC_STATUS_EVENT,
  type SyncState,
} from "@/lib/sync";
import { SquaresFour, Wallet as PhWallet, Receipt as PhReceipt } from "@phosphor-icons/react";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  LineChart, Line, XAxis, YAxis, CartesianGrid 
} from "recharts";
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowRightLeft, 
  RotateCcw, 
  Trash2, 
  Edit3, 
  Download, 
  Upload, 
  FileText, 
  CreditCard, 
  AlertCircle, 
  Check, 
  ChevronRight, 
  ChevronDown,
  Calendar as CalendarIcon,
  X, 
  HardDrive,
  Lock,
  Cloud,
  RefreshCw,
  Database
} from "lucide-react";

// Curated playful & vibrant fintech palette for charts
const CHART_COLORS = [
  '#F59E0B', // Sunny Amber
  '#10B981', // Emerald Mint
  '#F43F5E', // Rose Coral
  '#8B5CF6', // Royal Violet
  '#06B6D4', // Electric Cyan
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#F97316', // Orange
];

const emptyEvents: FinancialEvent[] = [];

function TransferAccountDropdown({
  label,
  value,
  onChange,
  excludeAccountId,
}: {
  label: string;
  value: AccountId | null;
  onChange: (id: AccountId) => void;
  excludeAccountId?: AccountId | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedAcc = value ? getAccountById(value) : null;
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-1 block">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border-2 border-stone-200 hover:border-stone-300 text-stone-800 rounded-xl px-3 py-2 flex items-center justify-between transition cursor-pointer shadow-2xs"
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedAcc ? (
            <>
              <span className={`w-5 h-5 rounded-full ${selectedAcc?.colorClass || 'bg-stone-500'} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 shadow-2xs`}>
                {selectedAcc?.name}
              </span>
              <span className="text-xs font-bold truncate text-stone-900">
                {selectedAcc?.fullName}
              </span>
            </>
          ) : (
            <span className="text-xs font-medium text-stone-400">
              Select {label.toLowerCase()}...
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border-2 border-stone-200 rounded-2xl shadow-xl p-1.5 max-h-56 overflow-y-auto space-y-1">
          {accounts.map((acc) => {
            const isSelected = acc.id === value;
            const isExcluded = Boolean(excludeAccountId && acc.id === excludeAccountId);
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => {
                  onChange(acc.id);
                  setIsOpen(false);
                }}
                disabled={isExcluded}
                className={`w-full p-2 rounded-xl text-left flex items-center justify-between text-xs font-bold transition cursor-pointer ${
                  isSelected
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : isExcluded
                    ? 'opacity-40 cursor-not-allowed bg-stone-50 text-stone-400'
                    : 'hover:bg-stone-100 text-stone-700'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-5 h-5 rounded-full ${acc.colorClass} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 shadow-xs`}>
                    {acc.name}
                  </span>
                  <span className="truncate">{acc.fullName}</span>
                </div>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 ml-1" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FinancePage() {
  // Security & Master PIN Lock State
  const [isLocked, setIsLocked] = useState(() => !isSessionUnlocked());

  useEffect(() => {
    const checkLock = () => {
      setIsLocked(!isSessionUnlocked());
    };

    checkLock();

    const handleSecurityChange = () => {
      checkLock();
    };

    window.addEventListener(SECURITY_CHANGE_EVENT, handleSecurityChange);
    window.addEventListener('storage', handleSecurityChange);

    // 15-minute idle activity tracking
    const handleActivity = () => {
      touchActivity();
    };

    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });
    window.addEventListener('scroll', handleActivity, { passive: true });

    // Periodic check every 10 seconds for 15-minute idle timeout expiry
    const timer = setInterval(() => {
      checkLock();
    }, 10000);

    return () => {
      window.removeEventListener(SECURITY_CHANGE_EVENT, handleSecurityChange);
      window.removeEventListener('storage', handleSecurityChange);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      clearInterval(timer);
    };
  }, []);

  // Cloud Sync State
  const [syncState, setSyncState] = useState<SyncState>(() => getSyncState());
  const [showSyncModal, setShowSyncModal] = useState(false);

  useEffect(() => {
    const handleSyncStatus = (e: Event) => {
      const custom = e as CustomEvent<SyncState>;
      if (custom.detail) {
        setSyncState(custom.detail);
      } else {
        setSyncState(getSyncState());
      }
    };
    window.addEventListener(SYNC_STATUS_EVENT, handleSyncStatus);
    return () => window.removeEventListener(SYNC_STATUS_EVENT, handleSyncStatus);
  }, []);

  // Proactive multi-device cloud synchronization (mount, visibility change, and focus)
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    // Immediate sync on mount (pulls cloud events even before unlocking so data is instantly ready)
    syncWithCloud().catch(() => {});

    // Sync when user switches back to this tab/window (e.g. mobile app switch or returning from desktop browser)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncWithCloud().catch(() => {});
      }
    };
    const handleFocus = () => {
      syncWithCloud().catch(() => {});
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Sync again whenever vault transitions to unlocked state
  useEffect(() => {
    if (!isLocked && isSupabaseConfigured()) {
      syncWithCloud().catch(() => {});
    }
  }, [isLocked]);

  // Navigation State
  const [view, setView] = useState<'dashboard' | 'accounts' | 'ledger'>('dashboard');
  const [accountViewMode, setAccountViewMode] = useState<'card' | 'ledger'>('card');
  const [filterAccountId, setFilterAccountId] = useState<AccountId | null>(null);

  // Month Navigation State (for Dashboard)
  const [selectedMonth, setSelectedMonth] = useState(() => todayDate().slice(0, 7));
  const [trendRange, setTrendRange] = useState<'7days' | 'week' | 'month'>('7days');

  // Search & Filter State (for Accounts/History)
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income' | 'transfer' | 'refund'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Data State
  const events = useSyncExternalStore(subscribeToFinancialEvents, readFinancialEvents, () => emptyEvents);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [amount, setAmount] = useState("");
  const [adminFee, setAdminFee] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(todayDate());
  const [selectedAccount, setSelectedAccount] = useState<AccountId | null>(null);
  const [destinationAccount, setDestinationAccount] = useState<AccountId | null>(null);
  const [hasCashback, setHasCashback] = useState(false);
  const [cashbackAmount, setCashbackAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | IncomeCategory | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showCashbackAccountWarning, setShowCashbackAccountWarning] = useState(false);
  
  // Action Menu State
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [activeTransactionId, setActiveTransactionId] = useState<string | null>(null);
  const [pendingDeleteEventId, setPendingDeleteEventId] = useState<string | null>(null);

  // Refund Flow State
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundParentExpense, setRefundParentExpense] = useState<ExpenseEvent | null>(null);
  const [editingRefundEvent, setEditingRefundEvent] = useState<RefundEvent | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);

  // Backup & Restore State
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupStatusMessage, setBackupStatusMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<Extract<BackupParseResult, { success: true }> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Undo & Reorder State
  const undoTimerRef = useRef<number | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<FinancialEvent[] | null>(null);
  const [undoToast, setUndoToast] = useState<string | null>(null);

  // Modal Scroll Lock State
  const isAnyModalOpen = Boolean(
    actionMenuOpen ||
    showForm ||
    showSyncModal ||
    showRefundModal ||
    showBackupModal ||
    pendingDeleteEventId ||
    showCashbackAccountWarning
  );

  // Lock background scrolling when any modal is open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [isAnyModalOpen]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    setSelectedMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(year, month, 1);
    setSelectedMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(todayDate().slice(0, 7));
  };

  const formatMonthName = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const allCategories = useMemo(
    () => Array.from(new Set([...expenseCategories, ...incomeCategories])),
    []
  );

  const isFiltered = Boolean(
    filterAccountId || searchQuery.trim() || typeFilter !== 'all' || categoryFilter !== 'all'
  );

  const handleReorder = (activeEventId: string, targetEventId: string, placement: "before" | "after") => {
    const nextEvents = reorderFinancialEvents(events, activeEventId, targetEventId, placement);
    if (nextEvents === events) return;
    setUndoSnapshot(events);
    setUndoToast("Transaction reordered");
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => {
      setUndoToast(null);
      setUndoSnapshot(null);
    }, 8000);

    // Queue affected same-date events so new within_day_order is synced to Supabase
    const activeEv = events.find((e) => e.id === activeEventId);
    if (activeEv) {
      const sameDateIds = nextEvents.filter((e) => e.date === activeEv.date).map((e) => e.id);
      queuePendingUpserts(sameDateIds);
    }

    writeFinancialEvents(nextEvents);
    if (isSupabaseConfigured()) {
      syncWithCloud(nextEvents).catch(() => {});
    }
  };

  const handleUndoReorder = () => {
    if (!undoSnapshot) return;
    const restored = undoSnapshot;
    const firstEv = restored[0];
    if (firstEv) {
      const allIds = restored.map((e) => e.id);
      queuePendingUpserts(allIds);
    }
    writeFinancialEvents(restored);
    setUndoSnapshot(null);
    setUndoToast(null);
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    if (isSupabaseConfigured()) {
      syncWithCloud(restored).catch(() => {});
    }
  };

  const {
    isDragging,
    isEventActive,
    shouldShowDropIndicator,
    getItemProps,
  } = useTransactionReorder({
    events,
    viewMode: accountViewMode,
    disabled: isFiltered,
    onReorder: handleReorder,
  });

  const handleExportBackup = () => {
    try {
      const jsonString = serializeBackup(events);
      const filename = getBackupFilename();
      downloadBackupFile(jsonString, filename);
      setBackupStatusMessage('Backup file downloaded successfully.');
      setBackupError(null);
    } catch (err: unknown) {
      setBackupError(err instanceof Error ? err.message : 'Failed to export backup file.');
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setBackupStatusMessage(null);
    setBackupError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== 'string') {
        setBackupError('Failed to read file content.');
        return;
      }
      const result = parseAndValidateBackup(text);
      if (!result.success) {
        setPendingRestore(null);
        setBackupError(result.error);
      } else {
        setPendingRestore(result);
        setBackupError(null);
      }
    };
    reader.onerror = () => {
      setBackupError('Error reading backup file.');
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return;
    try {
      const restoredEvents = pendingRestore.events;
      restoreFinancialEvents(restoredEvents);
      setBackupStatusMessage(`Successfully restored ${restoredEvents.length} transactions.`);
      setPendingRestore(null);
      setBackupError(null);
      setUndoSnapshot(null);
      setUndoToast(null);
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);

      if (isSupabaseConfigured()) {
        await forceUploadAllToCloud(restoredEvents);
      }
    } catch (err: unknown) {
      setBackupError(err instanceof Error ? err.message : 'Unable to restore financial records.');
    }
  };

  const handleDownloadCurrentBeforeRestore = () => {
    handleExportBackup();
  };

  const handleCancelRestore = () => {
    setPendingRestore(null);
    setBackupError(null);
  };

  // Deterministic derivations of persisted events
  const stats = useMemo(() => calculateFinanceStats(events, `${selectedMonth}-01`), [events, selectedMonth]);
  const accountBalances = useMemo(() => getAccountBalances(events), [events]);

  // Line Chart Data
  const lineChartData = useMemo(() => {
    const isCurrentMonth = selectedMonth === todayDate().slice(0, 7);
    const [year, month] = selectedMonth.split('-').map(Number);
    const lastDayOfMonth = new Date(year, month, 0).getDate();

    if (trendRange === '7days') {
      const days = [];
      const baseDate = isCurrentMonth
        ? new Date()
        : new Date(year, month - 1, Math.min(new Date().getDate(), lastDayOfMonth));
      for (let i = 6; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayExpense = calculateNetExpenseForDate(events, dateStr);
        days.push({
          name: `${d.getDate()}/${d.getMonth() + 1}`,
          expense: dayExpense,
        });
      }
      return days;
    }

    if (trendRange === 'week') {
      const baseDate = isCurrentMonth ? new Date() : new Date(year, month - 1, 15);
      const dayOfWeek = (baseDate.getDay() + 6) % 7; // Monday = 0, Sunday = 6
      const monday = new Date(baseDate);
      monday.setDate(baseDate.getDate() - dayOfWeek);
      const days = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayExpense = calculateNetExpenseForDate(events, dateStr);
        days.push({
          name: `${d.getDate()}/${d.getMonth() + 1}`,
          expense: dayExpense,
        });
      }
      return days;
    }

    // trendRange === 'month': all days of the selected month
    const days = [];
    for (let dayNum = 1; dayNum <= lastDayOfMonth; dayNum++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayExpense = calculateNetExpenseForDate(events, dateStr);
      days.push({
        name: `${dayNum}/${month}`,
        expense: dayExpense,
      });
    }
    return days;
  }, [events, selectedMonth, trendRange]);

  // Card View Transactions
  const cardEvents = useMemo(() => {
    let filtered = events;
    if (filterAccountId) {
      filtered = filtered.filter((event) =>
        event.type === 'transfer'
          ? event.sourceAccountId === filterAccountId || event.destinationAccountId === filterAccountId
          : event.accountId === filterAccountId
      );
    }
    if (typeFilter !== 'all') {
      filtered = filtered.filter((event) => event.type === typeFilter);
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((event) => 'category' in event && event.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((event) => {
        const descMatch = event.description.toLowerCase().includes(q);
        const accMatch = event.type === 'transfer'
          ? ((getAccountById(event.sourceAccountId)?.fullName.toLowerCase().includes(q) ?? false) ||
             (getAccountById(event.destinationAccountId)?.fullName.toLowerCase().includes(q) ?? false))
          : (getAccountById(event.accountId)?.fullName.toLowerCase().includes(q) ?? false);
        const amountMatch = event.amount.toString().includes(q);
        return descMatch || accMatch || amountMatch;
      });
    }

    const indexed = filtered.map((event) => ({
      event,
      originalIndex: events.indexOf(event),
    }));
    indexed.sort((a, b) => {
      const dateCmp = b.event.date.localeCompare(a.event.date);
      if (dateCmp !== 0) return dateCmp;
      return b.originalIndex - a.originalIndex;
    });
    return indexed.map((item) => item.event);
  }, [events, filterAccountId, typeFilter, categoryFilter, searchQuery]);

  // Ledger Entries
  const ledgerEntries = useMemo(() => {
    let entries = deriveLedgerEntries(events);
    if (filterAccountId) {
      entries = entries.filter((entry) => entry.accountId === filterAccountId);
    }
    if (typeFilter !== 'all') {
      entries = entries.filter((entry) => {
        const ev = events.find((e) => e.id === entry.eventId);
        return ev?.type === typeFilter;
      });
    }
    if (categoryFilter !== 'all') {
      entries = entries.filter((entry) => entry.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      entries = entries.filter((entry) => {
        const descMatch = entry.description.toLowerCase().includes(q);
        const acc = getAccountById(entry.accountId);
        const accMatch = (acc?.fullName.toLowerCase().includes(q) ?? false) || (acc?.name.toLowerCase().includes(q) ?? false);
        const amountMatch = entry.amount.toString().includes(q);
        return descMatch || accMatch || amountMatch;
      });
    }
    return entries;
  }, [events, filterAccountId, typeFilter, categoryFilter, searchQuery]);

  // Refund Calculation
  const refundCalculation = useMemo(() => {
    if (!refundParentExpense) return { maxRefundable: 0, totalRefunded: 0 };
    const otherRefunds = events.filter(
      (e) => e.type === 'refund' && e.relatedEventId === refundParentExpense.id && (!editingRefundEvent || e.id !== editingRefundEvent.id)
    );
    const totalRefunded = otherRefunds.reduce((sum, r) => sum + r.amount, 0);
    const maxRefundable = Math.max(0, refundParentExpense.amount - totalRefunded);
    return { maxRefundable, totalRefunded };
  }, [events, refundParentExpense, editingRefundEvent]);

  // Precomputed refunds map for fast lookup on expense cards
  const refundsByExpenseId = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      if (e.type === 'refund') {
        map.set(e.relatedEventId, (map.get(e.relatedEventId) ?? 0) + e.amount);
      }
    }
    return map;
  }, [events]);

  const handleOpenRefund = () => {
    if (!activeEvent || activeEvent.type !== 'expense') return;
    const existingRefunds = events.filter(
      (e) => e.type === 'refund' && e.relatedEventId === activeEvent.id
    );
    const totalRefunded = existingRefunds.reduce((sum, r) => sum + r.amount, 0);
    const remaining = Math.max(0, activeEvent.amount - totalRefunded);
    if (remaining <= 0) {
      alert("This expense has already been fully refunded.");
      return;
    }
    setEditingRefundEvent(null);
    setRefundParentExpense(activeEvent);
    setRefundError(null);
    setShowRefundModal(true);
    setActionMenuOpen(false);
    setActiveTransactionId(null);
  };

  const handleSaveRefund = ({ date: refDate, amount: refAmount, description: refDesc }: { date: string; amount: number; description: string }) => {
    if (!refundParentExpense) return;

    if (editingRefundEvent) {
      const updatedRefund: RefundEvent = {
        ...editingRefundEvent,
        date: refDate,
        description: refDesc,
        amount: refAmount,
      };
      const nextEvents = replaceFinancialEvent(events, updatedRefund);
      if (!nextEvents) {
        setRefundError("Refund validation failed. Amount cannot exceed remaining original expense.");
        return;
      }
      try {
        queuePendingUpserts([updatedRefund.id]);
        writeFinancialEvents(nextEvents);
        if (isSupabaseConfigured()) {
          syncWithCloud(nextEvents).catch(() => {});
        }
        setShowRefundModal(false);
        setRefundParentExpense(null);
        setEditingRefundEvent(null);
        setRefundError(null);
        setUndoSnapshot(null);
        setUndoToast(null);
        if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
      } catch {
        setRefundError("Failed to update refund.");
      }
      return;
    }

    const refundEvent: FinancialEvent = {
      id: createEventId(),
      date: refDate,
      description: refDesc,
      amount: refAmount,
      type: 'refund',
      accountId: refundParentExpense.accountId,
      relatedEventId: refundParentExpense.id,
    };
    const nextEvents = [...events, refundEvent];
    if (!validateFinancialEvents(nextEvents)) {
      setRefundError("Refund validation failed. Amount cannot exceed remaining expense.");
      return;
    }
    try {
      queuePendingUpserts([refundEvent.id]);
      writeFinancialEvents(nextEvents);
      if (isSupabaseConfigured()) {
        syncWithCloud(nextEvents).catch(() => {});
      }
      setShowRefundModal(false);
      setRefundParentExpense(null);
      setEditingRefundEvent(null);
      setRefundError(null);
      setUndoSnapshot(null);
      setUndoToast(null);
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    } catch {
      setRefundError("Failed to save refund.");
    }
  };

  const activeEvent = events.find((event) => event.id === activeTransactionId) ?? null;
  const pendingDeleteEvent = events.find((event) => event.id === pendingDeleteEventId) ?? null;
  const pendingDeleteRelatedCount = pendingDeleteEvent?.type === 'expense'
    ? events.filter((event) => 'relatedEventId' in event && event.relatedEventId === pendingDeleteEvent.id).length
    : 0;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setAmount('');
      return;
    }
    setAmount(Number(raw).toLocaleString('id-ID'));
  };

  const handleAdminFeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setAdminFee('');
      return;
    }
    setAdminFee(Number(raw).toLocaleString('id-ID'));
  };

  const handleCashbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setCashbackAmount('');
      return;
    }
    setCashbackAmount(Number(raw).toLocaleString('id-ID'));
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr || !isDateOnly(dateStr)) return dateStr;
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const monthName = d.toLocaleDateString('en-US', { month: 'long' });
    return `${day} ${monthName} ${year}`;
  };

  const resetForm = () => {
    setEditingEventId(null);
    setAmount("");
    setAdminFee("");
    setDesc("");
    setDate(todayDate());
    setSelectedAccount(null);
    setDestinationAccount(null);
    setHasCashback(false);
    setCashbackAmount("");
    setSelectedCategory(null);
    setFormError(null);
    setShowCashbackAccountWarning(false);
  };

  const handleSave = () => {
    const rawDigits = amount.replace(/\D/g, '');
    const parsedAmount = rawDigits ? Number(rawDigits) : 0;
    if (!isPositiveInteger(parsedAmount)) return setFormError('Amount must be a positive whole number.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setFormError('Transaction date is required.');
    if (!validateNormalTransactionDate(date)) {
      return setFormError('Transaction date is invalid.');
    }

    if (formType === 'transfer') {
      if (!selectedAccount) return setFormError('Please select a source account.');
      if (!destinationAccount) return setFormError('Please select a destination account.');
      if (selectedAccount === destinationAccount) {
        return setFormError('Source and destination accounts must be different.');
      }
      if (adminFee.trim()) {
        const rawAdminDigits = adminFee.replace(/\D/g, '');
        const parsedAdminFee = rawAdminDigits ? Number(rawAdminDigits) : undefined;
        if (parsedAdminFee !== undefined && !isPositiveInteger(parsedAdminFee)) {
          return setFormError('Admin fee must be a positive whole number.');
        }
      }
    } else {
      const trimmedDescription = desc.trim();
      if (!trimmedDescription) return setFormError('Description is required.');
      if (!selectedAccount) return setFormError('Please select an account.');
      if (!selectedCategory) return setFormError('Please select a category.');

      if (formType === 'expense' && hasCashback) {
        const rawCashbackDigits = cashbackAmount.replace(/\D/g, '');
        const parsedCashback = rawCashbackDigits ? Number(rawCashbackDigits) : 0;
        if (!isPositiveInteger(parsedCashback)) return setFormError('Cashback must be a positive whole number.');
      }

      // Check if editing an expense with cashback and the account was changed
      if (editingEventId && formType === 'expense') {
        const originalExpense = events.find((e) => e.id === editingEventId);
        const existingCashback = events.find(
          (candidate) => candidate.type === 'income' && candidate.category === 'Cashback' && candidate.relatedEventId === editingEventId
        );
        if (
          originalExpense &&
          originalExpense.type === 'expense' &&
          originalExpense.accountId !== selectedAccount &&
          (hasCashback || Boolean(existingCashback))
        ) {
          setShowCashbackAccountWarning(true);
          return;
        }
      }
    }

    executeSave();
  };

  const executeSave = () => {
    setFormError(null);
    const rawDigits = amount.replace(/\D/g, '');
    const parsedAmount = rawDigits ? Number(rawDigits) : 0;
    const trimmedDescription = formType === 'transfer'
      ? `Transfer to ${destinationAccount!.toUpperCase()}`
      : desc.trim();

    let parsedAdminFee: number | undefined = undefined;
    if (formType === 'transfer' && adminFee.trim()) {
      const rawAdminDigits = adminFee.replace(/\D/g, '');
      parsedAdminFee = rawAdminDigits ? Number(rawAdminDigits) : undefined;
    }

    const eventId = editingEventId ?? createEventId();
    const event: FinancialEvent = formType === 'transfer'
      ? { 
          id: eventId, 
          date, 
          description: trimmedDescription, 
          amount: parsedAmount, 
          type: 'transfer', 
          sourceAccountId: selectedAccount!, 
          destinationAccountId: destinationAccount!,
          ...(parsedAdminFee !== undefined ? { adminFee: parsedAdminFee } : {})
        }
      : formType === 'expense'
        ? { id: eventId, date, description: trimmedDescription, amount: parsedAmount, type: 'expense', accountId: selectedAccount!, category: selectedCategory as ExpenseCategory }
        : { id: eventId, date, description: trimmedDescription, amount: parsedAmount, type: 'income', accountId: selectedAccount!, category: selectedCategory as IncomeCategory };

    let nextEvents: FinancialEvent[] | null = editingEventId
      ? replaceFinancialEvent(events, event)
      : [...events, event];
    if (!nextEvents) return setFormError('This action would violate financial relation rules.');

    if (formType === 'expense') {
      const existingCashback = events.find((candidate) => candidate.type === 'income' && candidate.category === 'Cashback' && candidate.relatedEventId === eventId);
      if (hasCashback) {
        const rawCashbackDigits = cashbackAmount.replace(/\D/g, '');
        const parsedCashback = rawCashbackDigits ? Number(rawCashbackDigits) : 0;
        if (!isPositiveInteger(parsedCashback)) return setFormError('Cashback must be a positive whole number.');
        const cashback: FinancialEvent = {
          id: existingCashback?.id ?? createEventId(),
          date,
          description: `Cashback ${selectedAccount!.toUpperCase()}`,
          amount: parsedCashback,
          type: 'income',
          accountId: selectedAccount!,
          category: 'Cashback',
          relatedEventId: eventId,
        };
        if (existingCashback) {
          nextEvents = nextEvents.map((candidate) => candidate.id === existingCashback.id ? cashback : candidate);
        } else {
          const expenseIndex = nextEvents.findIndex((candidate) => candidate.id === eventId);
          if (expenseIndex !== -1) {
            nextEvents = [
              ...nextEvents.slice(0, expenseIndex + 1),
              cashback,
              ...nextEvents.slice(expenseIndex + 1),
            ];
          } else {
            nextEvents = [...nextEvents, cashback];
          }
        }
      } else if (existingCashback) {
        nextEvents = deleteFinancialEvent(nextEvents, existingCashback.id);
        queuePendingDeletion(existingCashback.id);
      }
    }

    try {
      const idsToUpsert = [eventId];
      if (formType === 'expense' && hasCashback) {
        const cb = nextEvents.find((e) => e.type === 'income' && e.category === 'Cashback' && e.relatedEventId === eventId);
        if (cb) idsToUpsert.push(cb.id);
      }
      queuePendingUpserts(idsToUpsert);

      writeFinancialEvents(nextEvents);
      if (isSupabaseConfigured()) {
        syncWithCloud(nextEvents).catch(() => {});
      }
      setUndoSnapshot(null);
      setUndoToast(null);
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
      setShowForm(false);
      resetForm();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('thelife-logo-bounce'));
      }
    } catch {
      setFormError('Unable to persist financial event.');
      return;
    }
  };

  const handleActionOpen = (id: string) => { 
    setActiveTransactionId(id); 
    setActionMenuOpen(true); 
  };
  
  const handleDelete = () => {
    if (!activeTransactionId) return;
    setPendingDeleteEventId(activeTransactionId);
    setActionMenuOpen(false); 
    setActiveTransactionId(null);
  };

  const confirmDelete = () => {
    if (!pendingDeleteEventId) return;
    deleteFinancialEventWithSync(pendingDeleteEventId, events);
    setPendingDeleteEventId(null);
    setUndoSnapshot(null);
    setUndoToast(null);
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
  };

  const handleEdit = () => {
    const rawEvent = events.find((candidate) => candidate.id === activeTransactionId);
    if (!rawEvent) return;

    if (rawEvent.type === 'refund') {
      const parent = events.find((candidate): candidate is ExpenseEvent => candidate.id === rawEvent.relatedEventId && candidate.type === 'expense');
      if (!parent) {
        alert("Parent expense transaction not found.");
        return;
      }
      setEditingRefundEvent(rawEvent);
      setRefundParentExpense(parent);
      setRefundError(null);
      setShowRefundModal(true);
      setActionMenuOpen(false);
      setActiveTransactionId(null);
      return;
    }

    let event = rawEvent;
    if (event.type === 'income' && event.category === 'Cashback' && event.relatedEventId) {
      const parentId = event.relatedEventId;
      const parentExpense = events.find((candidate) => candidate.id === parentId);
      if (parentExpense && parentExpense.type === 'expense') {
        event = parentExpense;
      }
    }
    setFormType(event.type);
    setDesc(event.description);
    setAmount(event.amount.toLocaleString('id-ID'));
    setDate(event.date);
    setSelectedAccount(event.type === 'transfer' ? event.sourceAccountId : event.accountId);
    if (event.type === 'transfer') {
      setDestinationAccount(event.destinationAccountId);
      setAdminFee(event.adminFee ? event.adminFee.toLocaleString('id-ID') : '');
    } else {
      setDestinationAccount(null);
      setAdminFee('');
    }
    if (event.type !== 'transfer') setSelectedCategory(event.category);
    else setSelectedCategory(null);
    if (event.type === 'expense') {
      const cashback = events.find((candidate) => candidate.type === 'income' && candidate.category === 'Cashback' && candidate.relatedEventId === event.id);
      setHasCashback(Boolean(cashback));
      setCashbackAmount(cashback?.amount ? cashback.amount.toLocaleString('id-ID') : '');
    } else {
      setHasCashback(false);
      setCashbackAmount('');
    }
    setEditingEventId(event.id);
    setFormError(null);
    setShowForm(true); 
    setActionMenuOpen(false); 
    setActiveTransactionId(null);
  };

  // Helpers
  const formatRupiah = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  const formatDateCard = (dateStr: string) => {
    if (!dateStr || !isDateOnly(dateStr)) return dateStr;
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };
  const MONTH_SHORT_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ] as const;

  const formatDateLedger = (dateStr: string) => {
    if (!dateStr || !isDateOnly(dateStr)) return dateStr;
    const [year, month, day] = dateStr.split('-').map(Number);
    const shortMonth = MONTH_SHORT_NAMES[month - 1] ?? '';
    return `${day} ${shortMonth} ${year}`;
  };

  return (
    <main className="min-h-screen bg-[#FBF9F4] text-stone-900 pb-28 relative">
      
      {/* ================= HEADER BAR (ARC + DUOLINGO FUSION) ================= */}
      <header className="bg-white/95 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <BrandLogo />

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="btn-tactile-primary px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm flex items-center gap-1 sm:gap-1.5 cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span className="hidden sm:inline">New Transaction</span>
              <span className="sm:hidden font-bold">Add</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBackupStatusMessage(null);
                setBackupError(null);
                setPendingRestore(null);
                setShowBackupModal(true);
              }}
              className="btn-tactile-neutral px-2.5 sm:px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
              title="Backup & Restore"
            >
              <HardDrive className="w-3.5 h-3.5 text-stone-600" />
              <span className="hidden sm:inline">Backup</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isSupabaseConfigured()) {
                  syncWithCloud();
                } else {
                  setShowSyncModal(true);
                }
              }}
              className={`btn-tactile-neutral px-2.5 sm:px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0 ${
                syncState.status === 'syncing' ? 'text-amber-700 bg-amber-50/70 border-amber-300' :
                syncState.status === 'synced' ? 'text-emerald-700 bg-emerald-50/60 border-emerald-300' :
                syncState.status === 'error' ? 'text-rose-600 bg-rose-50/60 border-rose-300' : 'text-stone-700'
              }`}
              title={
                syncState.status === 'synced'
                  ? `Cloud Synced (${syncState.lastSyncedAt ? new Date(syncState.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'})`
                  : syncState.status === 'syncing'
                  ? 'Syncing with Supabase...'
                  : syncState.status === 'error'
                  ? `Sync error: ${syncState.errorMessage || 'Click to retry'}`
                  : syncState.status === 'offline'
                  ? 'Offline mode'
                  : 'Connect to Supabase Cloud'
              }
            >
              {syncState.status === 'syncing' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
              ) : syncState.status === 'synced' ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-stone-600" />
              )}
              <span className="hidden sm:inline font-bold">
                {syncState.status === 'synced' ? 'Synced' :
                 syncState.status === 'syncing' ? 'Syncing...' :
                 syncState.status === 'error' ? 'Sync Error' :
                 syncState.status === 'offline' ? 'Offline' : 'Cloud'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                lockSession();
                setIsLocked(true);
              }}
              className="btn-tactile-neutral px-2.5 sm:px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0 text-stone-700 hover:text-stone-900"
              title="Lock Vault Now"
            >
              <Lock className="w-3.5 h-3.5 text-stone-600" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
        </div>

        {/* Floating Arc-Style Segmented Navigation Pill */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-2 overflow-x-auto scrollbar-hide pt-1 pb-2.5">
          <div className="bg-stone-100/90 p-1 rounded-2xl border border-stone-200/70 flex gap-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setView('dashboard')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 ${
                view === 'dashboard'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
              }`}
            >
              <SquaresFour className="w-4 h-4" weight={view === 'dashboard' ? "fill" : "duotone"} />
              <span>Overview</span>
            </button>
            <button
              type="button"
              onClick={() => setView('accounts')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 ${
                view === 'accounts'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
              }`}
            >
              <PhWallet className="w-4 h-4" weight={view === 'accounts' ? "fill" : "duotone"} />
              <span>Accounts</span>
            </button>
            <button
              type="button"
              onClick={() => setView('ledger')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 ${
                view === 'ledger'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
              }`}
            >
              <PhReceipt className="w-4 h-4" weight={view === 'ledger' ? "fill" : "duotone"} />
              <span>Activity<span className="hidden sm:inline"> & Ledger</span></span>
            </button>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT CONTAINER ================= */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">

        {/* ================= 1. OVERVIEW VIEW ================= */}
        {view === 'dashboard' && (
          <div className="space-y-6">
            <MonthNavigator
              selectedMonth={selectedMonth}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onCurrentMonth={handleCurrentMonth}
              formatMonthName={formatMonthName}
              isCurrentMonth={selectedMonth === todayDate().slice(0, 7)}
            />

            {/* HERO VAULT CARD */}
            <HeroVaultCard
              totalBalance={stats.totalBalance}
              investmentBalance={stats.investmentBalance}
              netWorth={stats.netWorth}
              savingsRate={stats.savingsRate}
              formatRupiah={formatRupiah}
              onViewAccounts={() => setView('accounts')}
            />

            {/* 4 TACTILE PLAYFUL KPI CARDS */}
            <KpiGrid
              monthlyIncome={stats.monthlyIncome}
              monthlyExpense={stats.monthlyExpense}
              netCashflow={stats.netCashflow}
              savingsRate={stats.savingsRate}
              dailyAverageExpense={stats.dailyAverageExpense}
              monthName={formatMonthName(selectedMonth)}
              formatRupiah={formatRupiah}
            />

            {/* CHARTS ROW (EXPENSES BY CATEGORY + DAILY TREND) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Breakdown Donut */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/90 border-b-[3px] border-b-stone-300/80 shadow-xs">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-bold text-base text-stone-900">
                      Expenses by Category
                    </h3>
                    <p className="text-xs text-stone-500 font-medium">Spending breakdown for {formatMonthName(selectedMonth)}</p>
                  </div>
                </div>

                {stats.pieData.length === 0 ? (
                  <EmptyState 
                    title="No category expenses logged"
                    description="Record your coffee, lunch, or groceries to visualize your monthly category distribution."
                    actionLabel="Add Expense"
                    onAction={() => {
                      resetForm();
                      setFormType('expense');
                      setShowForm(true);
                    }}
                  />
                ) : (
                  <div>
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={stats.pieData} 
                            cx="50%" 
                            cy="50%" 
                            innerRadius={55} 
                            outerRadius={80} 
                            paddingAngle={4} 
                            dataKey="value"
                          >
                            {stats.pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value) => [formatRupiah(Number(value)), 'Amount']}
                            contentStyle={{
                              backgroundColor: '#FFFFFF',
                              borderColor: '#E7E4DC',
                              borderRadius: '16px',
                              boxShadow: '0 8px 24px -4px rgba(0,0,0,0.08)',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#1C1917'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Colorful Category Legend Pills */}
                    <div className="flex flex-wrap gap-1.5 pt-2 max-h-24 overflow-y-auto">
                      {stats.pieData.map((cat, idx) => (
                        <span 
                          key={cat.name}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-stone-50 border border-stone-200 text-stone-700"
                        >
                          <span 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} 
                          />
                          <span>{cat.name}:</span>
                          <strong className="font-mono-numbers text-stone-900">{formatRupiah(cat.value)}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Trend Chart (Line Chart) */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/90 border-b-[3px] border-b-stone-300/80 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-bold text-base text-stone-900 mb-0.5">
                      Daily Spending Trend
                    </h3>
                    <p className="text-xs text-stone-500 font-medium">
                      {trendRange === '7days' && 'Pace over the past 7 days'}
                      {trendRange === 'week' && 'Pace this week (Mon – Sun)'}
                      {trendRange === 'month' && `Daily spending in ${formatMonthName(selectedMonth)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl self-start sm:self-auto border border-stone-200/80">
                    <button
                      type="button"
                      onClick={() => setTrendRange('7days')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        trendRange === '7days'
                          ? 'bg-stone-900 text-white shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Past 7 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrendRange('week')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        trendRange === 'week'
                          ? 'bg-stone-900 text-white shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      This Week
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrendRange('month')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        trendRange === 'month'
                          ? 'bg-stone-900 text-white shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      This Month
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                  <div style={{ minWidth: trendRange === 'month' ? `${Math.max(680, lineChartData.length * 28)}px` : '100%', height: '260px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lineChartData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E4DC" />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 11, fill: '#78716C', fontWeight: 600 }} 
                          interval={0}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fontFamily: 'var(--font-sora), sans-serif', fill: '#78716C' }} 
                          tickFormatter={(val) => Number(val).toLocaleString('id-ID')}
                          domain={['auto', 'auto']} 
                        />
                        <Tooltip 
                          formatter={(value) => [formatRupiah(Number(value)), 'Expense']}
                          contentStyle={{
                            backgroundColor: '#FFFFFF',
                            borderColor: '#E7E4DC',
                            borderRadius: '16px',
                            boxShadow: '0 8px 24px -4px rgba(0,0,0,0.08)',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#1C1917'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="expense" 
                          stroke="#10B981" 
                          strokeWidth={3} 
                          dot={{ r: 3.5, fill: '#10B981', strokeWidth: 2, stroke: '#FFFFFF' }} 
                          activeDot={{ r: 6, fill: '#047857' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Link to Ledger */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setView('ledger')}
                className="btn-tactile-neutral px-5 py-2.5 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>View Full Activity & Ledger</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ================= 2. ACCOUNTS VIEW (CLEAN, NO NOISY BADGES) ================= */}
        {view === 'accounts' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-stone-900">
                  Financial Accounts
                </h2>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  10 Liquid cash accounts and 7 investment holdings
                </p>
              </div>
              <button
                type="button"
                onClick={() => setView('dashboard')}
                className="btn-tactile-neutral px-3.5 py-1.5 text-xs font-bold cursor-pointer"
              >
                ← Back to Overview
              </button>
            </div>

            {/* SECTION 1: 10 LIQUID ACCOUNTS (CLEAN LABELS, NO NOISY BADGES) */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/90 border-b-[3px] border-b-stone-300/80 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300/80 mb-1">
                    Ready Checking & Cash
                  </span>
                  <h3 className="font-bold text-base text-stone-900">
                    10 Liquid Accounts
                  </h3>
                  <p className="text-xs text-stone-500 font-medium">
                    Physical cash, daily bank accounts, and e-wallets
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-stone-400 font-medium block">Total Liquid:</span>
                  <span className="text-xl font-bold font-mono-numbers text-stone-900">
                    {formatRupiah(stats.liquidBalance)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {liquidAccounts.map((acc) => {
                  const bal = accountBalances[acc.id] || 0;
                  const isFilteredAcc = filterAccountId === acc.id;
                  return (
                    <div
                      key={acc.id}
                      onClick={() => {
                        setFilterAccountId(isFilteredAcc ? null : acc.id);
                        setView('ledger');
                      }}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between hover:-translate-y-1 active:scale-95 shadow-2xs ${
                        isFilteredAcc
                          ? 'bg-stone-900 text-white border-stone-950 border-b-4 border-b-black shadow-sm'
                          : 'bg-stone-50/70 border-stone-200/90 border-b-[3px] border-b-stone-300/80 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className={`w-8 h-8 rounded-full ${acc.colorClass} text-white text-xs font-bold flex items-center justify-center shadow-xs`}>
                          {acc.name}
                        </span>
                      </div>
                      <div>
                        <span className={`text-xs font-semibold block truncate leading-tight ${isFilteredAcc ? 'text-stone-300' : 'text-stone-600'}`}>
                          {acc.fullName}
                        </span>
                        <span className={`text-sm font-bold font-mono-numbers block mt-1 truncate ${isFilteredAcc ? 'text-white' : 'text-stone-900'}`}>
                          {formatRupiah(bal)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION 2: 7 INVESTMENT ACCOUNTS (CLEAN LABELS, NO NOISY BADGES) */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/90 border-b-[3px] border-b-stone-300/80 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-900 border border-violet-300/80 mb-1">
                    Portfolios & Holdings
                  </span>
                  <h3 className="font-bold text-base text-stone-900">
                    7 Investment Accounts
                  </h3>
                  <p className="text-xs text-stone-500 font-medium">
                    Securities, equities, mutual funds, crypto, and portfolio assets
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-stone-400 font-medium block">Total Investment:</span>
                  <span className="text-xl font-bold font-mono-numbers text-violet-700">
                    {formatRupiah(stats.investmentBalance)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {investmentAccounts.map((acc) => {
                  const bal = accountBalances[acc.id] || 0;
                  const isFilteredAcc = filterAccountId === acc.id;
                  return (
                    <div
                      key={acc.id}
                      onClick={() => {
                        setFilterAccountId(isFilteredAcc ? null : acc.id);
                        setView('ledger');
                      }}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between hover:-translate-y-1 active:scale-95 shadow-2xs ${
                        isFilteredAcc
                          ? 'bg-stone-900 text-white border-stone-950 border-b-4 border-b-black shadow-sm'
                          : 'bg-stone-50/70 border-stone-200/90 border-b-[3px] border-b-stone-300/80 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className={`w-8 h-8 rounded-full ${acc.colorClass} text-white text-xs font-bold flex items-center justify-center shadow-xs`}>
                          {acc.name}
                        </span>
                      </div>
                      <div>
                        <span className={`text-xs font-semibold block truncate leading-tight ${isFilteredAcc ? 'text-stone-300' : 'text-stone-600'}`}>
                          {acc.fullName}
                        </span>
                        <span className={`text-sm font-bold font-mono-numbers block mt-1 truncate ${isFilteredAcc ? 'text-white' : 'text-stone-900'}`}>
                          {formatRupiah(bal)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TOTAL NET WORTH AGGREGATE BANNER */}
            <div className="bg-stone-900 text-white p-6 rounded-3xl border-b-4 border-b-black shadow-md flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Total Net Worth Aggregate</span>
                <p className="text-3xl sm:text-4xl font-black font-mono-numbers mt-1">
                  {formatRupiah(stats.netWorth)}
                </p>
              </div>
              <p className="text-xs text-stone-300 max-w-sm leading-relaxed">
                Combined balance across all 10 liquid cash accounts and 7 investment holdings.
              </p>
            </div>
          </div>
        )}

        {/* ================= 3. ACTIVITY & LEDGER VIEW ================= */}
        {view === 'ledger' && (
          <div className="space-y-4">
            
            {/* Active Account Filter Banner */}
            {filterAccountId && (() => {
              const filteredAcc = getAccountById(filterAccountId);
              return (
                <div className="flex items-center justify-between bg-stone-900 text-white rounded-2xl px-4 py-3 text-xs shadow-xs border-b-2 border-black">
                  <div className="flex items-center gap-2">
                    <span className="text-stone-400">Filtered by account:</span>
                    <span className="font-bold text-sm text-white">{filteredAcc?.fullName}</span>
                    <span className="px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 font-bold text-[10px]">
                      {filteredAcc?.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilterAccountId(null)}
                    className="text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer"
                  >
                    Clear Filter ✕
                  </button>
                </div>
              );
            })()}

            {/* Search Bar & Filter Chips */}
            <TransactionFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              availableCategories={allCategories}
              filteredCount={accountViewMode === 'card' ? cardEvents.length : ledgerEntries.length}
              totalCount={events.length}
              onResetAll={() => {
                setFilterAccountId(null);
                setSearchQuery("");
                setTypeFilter('all');
                setCategoryFilter('all');
              }}
              isFiltered={isFiltered}
            />

            {/* Toggle View Mode (Card vs Table Ledger) */}
            <div className="bg-white p-1 rounded-2xl border border-stone-200/90 border-b-[3px] border-b-stone-300/80 flex shadow-xs">
              <button
                type="button"
                onClick={() => setAccountViewMode('card')}
                className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  accountViewMode === 'card'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Card View</span>
              </button>
              <button
                type="button"
                onClick={() => setAccountViewMode('ledger')}
                className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  accountViewMode === 'ledger'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Table Ledger</span>
              </button>
            </div>

            {/* Content: Card View */}
            {accountViewMode === 'card' ? (
              <div className="space-y-3">
                {cardEvents.length === 0 && (
                  <EmptyState 
                    title="No transactions match your search"
                    description="Try resetting your filters or search keywords to view all transaction records."
                    actionLabel="Reset All Filters"
                    onAction={() => {
                      setFilterAccountId(null);
                      setSearchQuery("");
                      setTypeFilter('all');
                      setCategoryFilter('all');
                    }}
                  />
                )}
                {cardEvents.map((event, index) => {
                  const currentEventMonth = event.date.slice(0, 7);
                  const prevEventMonth = index > 0 ? cardEvents[index - 1].date.slice(0, 7) : null;
                  const showMonthHeader = index === 0 || currentEventMonth !== prevEventMonth;
                  const showDateHeader = index === 0 || event.date !== cardEvents[index - 1].date;
                  
                  const displayAccountId = event.type === 'transfer'
                    ? (filterAccountId === event.destinationAccountId ? event.destinationAccountId : event.sourceAccountId)
                    : event.accountId;
                  const acc = getAccountById(displayAccountId);
                  const sourceAccount = event.type === 'transfer' ? getAccountById(event.sourceAccountId) : null;
                  const destinationAccount = event.type === 'transfer' ? getAccountById(event.destinationAccountId) : null;
                  
                  const transferDirection = event.type === 'transfer'
                    ? filterAccountId === event.destinationAccountId ? 'in' : filterAccountId === event.sourceAccountId ? 'out' : 'neutral'
                    : event.type === 'expense' ? 'out' : 'in';
                  
                  const cardDescription = event.type === 'transfer' && !filterAccountId
                    ? `${sourceAccount?.name ?? event.sourceAccountId} → ${destinationAccount?.name ?? event.destinationAccountId}`
                    : event.description;

                  const totalRefundedForEvent = event.type === 'expense' ? (refundsByExpenseId.get(event.id) ?? 0) : 0;
                  const netExpenseForEvent = event.type === 'expense' ? event.amount - totalRefundedForEvent : event.amount;

                  const isActive = isEventActive(event.id);
                  const showDropAbove = shouldShowDropIndicator(event.id, 'above');
                  const showDropBelow = shouldShowDropIndicator(event.id, 'below');
                  const itemProps = isFiltered ? {} : getItemProps(event.id);

                  return (
                    <div key={event.id}>
                      {showMonthHeader && (
                        <div className={`flex items-center gap-3 py-2 ${index > 0 ? 'mt-6 mb-2' : 'mb-2'}`}>
                          <div className="h-px bg-stone-200 flex-1" />
                          <span className="px-3.5 py-1 bg-amber-100 text-amber-900 font-bold text-xs rounded-full border border-amber-300/80 shadow-2xs">
                            {formatMonthName(currentEventMonth)}
                          </span>
                          <div className="h-px bg-stone-200 flex-1" />
                        </div>
                      )}
                      {showDateHeader && (
                        <h3 className={`text-xs font-bold text-stone-500 sticky top-[108px] bg-[#FBF9F4]/90 backdrop-blur-xs py-1.5 z-10 ${index > 0 && !showMonthHeader ? 'mt-4' : ''}`}>
                          {formatDateCard(event.date)}
                        </h3>
                      )}
                      {showDropAbove && (
                        <div className="h-1.5 bg-emerald-500 rounded-full mx-2 my-1 shadow-xs transition-all animate-pulse pointer-events-none" />
                      )}
                      <div
                        {...itemProps}
                        onContextMenu={(e) => { 
                          e.preventDefault(); 
                          if (isDragging) return;
                          handleActionOpen(event.id); 
                        }}
                        onClick={() => {
                          if (isDragging) return;
                          handleActionOpen(event.id);
                        }}
                        className={`bg-white p-4 rounded-2xl border border-stone-200/90 border-b-[3px] border-b-stone-300/80 shadow-xs flex justify-between items-center transition select-none hover:-translate-y-0.5 hover:shadow-sm ${
                          isActive 
                            ? 'scale-[1.02] shadow-lg ring-2 ring-emerald-500 bg-white z-20 transition-transform duration-150 relative' 
                            : 'active:bg-stone-50'
                        } ${isFiltered ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            title={`${acc?.fullName} (${acc?.name})`}
                            className={`w-9 h-9 rounded-full ${acc?.colorClass} flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-xs`}
                          >
                            {acc?.name}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-stone-900 text-sm truncate">{cardDescription}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {'category' in event && (
                                <span className="text-[10px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full font-bold border border-stone-200/60">
                                  {event.category}
                                </span>
                              )}
                              {event.type === 'expense' && totalRefundedForEvent > 0 && (
                                <span className="text-[10px] bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full font-bold border border-violet-200/70">
                                  Refunded: {formatRupiah(totalRefundedForEvent)}
                                </span>
                              )}
                              {event.type === 'transfer' && event.adminFee && (
                                <span className="text-[10px] bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full font-bold border border-violet-200">
                                  Fee: {formatRupiah(event.adminFee)}
                                </span>
                              )}
                              {event.type === 'refund' && (
                                <span className="text-[10px] bg-violet-100 text-violet-800 border border-violet-200 px-2 py-0.5 rounded-full font-bold">
                                  Refund
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0 ml-3">
                          <p className={`font-black font-mono-numbers text-sm sm:text-base ${
                            event.type === 'refund'
                              ? 'text-violet-600'
                              : transferDirection === 'out' 
                                ? 'text-rose-600' 
                                : transferDirection === 'in' 
                                  ? 'text-emerald-600' 
                                  : 'text-stone-900'
                          }`}>
                            {event.type === 'refund'
                              ? `+${formatRupiah(event.amount)}`
                              : `${transferDirection === 'neutral' ? '' : transferDirection === 'out' ? '-' : '+'}${formatRupiah(event.amount)}`}
                          </p>
                          {event.type === 'expense' && totalRefundedForEvent > 0 && (
                            <p className="text-[11px] font-bold text-stone-400 font-mono-numbers mt-0.5">
                              Net: -{formatRupiah(netExpenseForEvent)}
                            </p>
                          )}
                        </div>
                      </div>
                      {showDropBelow && (
                        <div className="h-1.5 bg-emerald-500 rounded-full mx-2 my-1 shadow-xs transition-all animate-pulse pointer-events-none" />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Content: Table Ledger View */
              <div className="bg-white rounded-3xl border border-stone-200/90 border-b-[3px] border-b-stone-300/80 shadow-xs overflow-hidden overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-stone-100 text-stone-700 text-xs uppercase border-b border-stone-200">
                    <tr>
                      <th className="px-4 py-3 font-bold">Date</th>
                      <th className="px-4 py-3 font-bold">Description</th>
                      <th className="px-4 py-3 font-bold">Account</th>
                      <th className="px-4 py-3 text-right font-bold">In (+)</th>
                      <th className="px-4 py-3 text-right font-bold">Out (-)</th>
                      <th className="px-4 py-3 text-right font-bold">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {ledgerEntries.map((entry, index) => {
                      const currentEntryMonth = entry.date.slice(0, 7);
                      const prevEntryMonth = index > 0 ? ledgerEntries[index - 1].date.slice(0, 7) : null;
                      const showMonthHeader = index === 0 || currentEntryMonth !== prevEntryMonth;
                      const acc = getAccountById(entry.accountId);
                      const isActive = isEventActive(entry.eventId);
                      const showDropAbove = shouldShowDropIndicator(entry.eventId, 'above', entry.direction);
                      const showDropBelow = shouldShowDropIndicator(entry.eventId, 'below', entry.direction);
                      const itemProps = isFiltered ? {} : getItemProps(entry.eventId);

                      return (
                        <Fragment key={`${entry.eventId}-${entry.accountId}-${entry.direction}`}>
                          {showMonthHeader && (
                            <tr className="bg-amber-50/70 font-bold text-amber-950 text-xs">
                              <td colSpan={6} className="px-4 py-2 uppercase tracking-wider">
                                {formatMonthName(currentEntryMonth)}
                              </td>
                            </tr>
                          )}
                          {showDropAbove && (
                            <tr className="pointer-events-none">
                              <td colSpan={6} className="p-0 border-none">
                                <div className="h-1.5 bg-emerald-500 rounded-full mx-2 my-0.5 animate-pulse" />
                              </td>
                            </tr>
                          )}
                          <tr
                            {...itemProps}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              if (isDragging) return;
                              handleActionOpen(entry.eventId);
                            }}
                            onClick={() => {
                              if (isDragging) return;
                              handleActionOpen(entry.eventId);
                            }}
                            className={`hover:bg-stone-50 transition select-none cursor-pointer ${
                              isActive ? 'bg-emerald-50/80 ring-2 ring-emerald-500 font-semibold shadow-xs' : ''
                            }`}
                          >
                            <td className="px-4 py-3 text-stone-500 whitespace-nowrap text-xs font-mono-numbers">
                              {formatDateLedger(entry.date)}
                            </td>
                            <td className="px-4 py-3 font-bold text-stone-900 max-w-[180px] truncate">
                              {entry.description}
                            </td>
                            <td className="px-4 py-3">
                              <span title={`${acc?.fullName} (${acc?.name})`} className={`px-2 py-0.5 rounded-full text-xs text-white font-bold ${acc?.colorClass}`}>
                                {acc?.name}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold font-mono-numbers">
                              {entry.direction === 'in' ? (
                                <span className={entry.eventType === 'refund' ? "text-violet-600" : "text-emerald-600"}>
                                  +{formatRupiah(entry.amount)}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold font-mono-numbers">
                              {entry.direction === 'out' ? <span className="text-rose-600">-{formatRupiah(entry.amount)}</span> : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-xs">
                              <span className="bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-full text-stone-700 font-medium">
                                {entry.category || '-'}
                              </span>
                            </td>
                          </tr>
                          {showDropBelow && (
                            <tr className="pointer-events-none">
                              <td colSpan={6} className="p-0 border-none">
                                <div className="h-1.5 bg-emerald-500 rounded-full mx-2 my-0.5 animate-pulse" />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= FLOATING ACTION BUTTON (MOBILE) ================= */}
      <button
        type="button"
        onClick={() => {
          resetForm();
          setShowForm(true);
        }}
        className="fixed bottom-6 right-6 sm:hidden w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xl font-bold shadow-lg border-b-4 border-b-emerald-700 active:border-b-0 active:translate-y-1 transition cursor-pointer z-40"
        aria-label="Add Transaction"
      >
        <Plus className="w-6 h-6 stroke-[3]" />
      </button>

      {/* ================= FORM MODAL (TACTILE 3D BUTTONS) ================= */}
      {showForm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4"
          onClick={() => setShowForm(false)}
        >
          <div 
            className="bg-white border-2 border-stone-200 border-b-4 border-b-stone-300 w-full max-w-lg rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowForm(false)}
              type="button"
              aria-label="Close dialog"
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition rounded-full w-8 h-8 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-4">
              <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300/80 mb-1">
                {editingEventId ? 'Edit Entry' : 'Financial Record'}
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                {editingEventId ? 'Update Transaction' : 'Record New Transaction'}
              </h3>
            </div>

            {/* Type Switcher Tactile Tabs */}
            <div className="flex bg-stone-100 p-1.5 rounded-2xl gap-1.5 mb-4 border border-stone-200/80">
              <button
                type="button"
                onClick={() => {
                  setFormType('expense');
                  if (!editingEventId) setSelectedCategory(null);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  formType === 'expense'
                    ? 'btn-tactile-rose shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>Expense</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormType('income');
                  if (!editingEventId) setSelectedCategory(null);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  formType === 'income'
                    ? 'btn-tactile-primary shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Income</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormType('transfer');
                  if (!editingEventId) setSelectedCategory(null);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  formType === 'transfer'
                    ? 'btn-tactile-blue shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Transfer</span>
              </button>
            </div>

            <div className="space-y-4">
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
              </div>

              {/* Date Input (Formatted as d MMMM yyyy, e.g. 4 October 2026) */}
              <div>
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-1 block">
                  Transaction Date
                </label>
                <div className="relative">
                  <div className="w-full bg-stone-50 border-2 border-stone-200 hover:border-stone-300 rounded-2xl px-3.5 py-2.5 text-sm text-stone-900 font-bold flex items-center justify-between transition cursor-pointer">
                    <div className="flex items-center gap-2 text-stone-800">
                      <CalendarIcon className="w-4 h-4 text-stone-500" />
                      <span>{formatDateDisplay(date)}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-stone-400">Change</span>
                  </div>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                </div>
              </div>

              {/* Description (Non-transfer) */}
              {formType !== 'transfer' && (
                <div>
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-1 block">
                    Description
                  </label>
                  <input
                    type="text"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="e.g. Morning Coffee, Team Lunch, Client Invoice"
                    className="w-full bg-stone-50 border-2 border-stone-200 rounded-2xl px-3.5 py-2.5 text-sm text-stone-900 outline-none focus:border-stone-400 focus:bg-white transition"
                  />
                </div>
              )}

              {/* Account Selection (Clean Grid, NO noisy badges) */}
              {formType !== 'transfer' && (
                <div>
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-1 block">
                    Account
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-1.5 bg-stone-50 rounded-2xl border border-stone-200">
                    {accounts.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setSelectedAccount(acc.id)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                          selectedAccount === acc.id
                            ? 'bg-stone-900 text-white border-stone-950 shadow-xs'
                            : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full ${acc.colorClass} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 shadow-xs`}>
                          {acc.name}
                        </span>
                        <span className="truncate">{acc.fullName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Pills (Non-transfer) */}
              {formType !== 'transfer' && (
                <div>
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-1 block">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-stone-50 rounded-2xl border border-stone-200">
                    {(formType === 'expense' ? expenseCategories : incomeCategories).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                          selectedCategory === cat
                            ? 'bg-stone-900 text-white shadow-2xs'
                            : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Transfer Form (Custom Badge Account Selectors + Admin Fee) */}
              {formType === 'transfer' && (
                <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border-2 border-stone-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <TransferAccountDropdown
                      label="Source Account"
                      value={selectedAccount}
                      onChange={setSelectedAccount}
                      excludeAccountId={destinationAccount}
                    />

                    <TransferAccountDropdown
                      label="Destination Account"
                      value={destinationAccount}
                      onChange={setDestinationAccount}
                      excludeAccountId={selectedAccount}
                    />
                  </div>

                  {/* Transfer Admin Fee Input with Live Dot Delimiter */}
                  <div>
                    <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-1 block">
                      Admin Fee (Optional)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs">
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={adminFee}
                        onChange={handleAdminFeeChange}
                        placeholder="0 (e.g. 2.500 or 6.500)"
                        className="w-full bg-white border-2 border-stone-200 rounded-xl pl-10 pr-3 py-2 text-xs font-bold font-mono-numbers outline-none focus:border-stone-400"
                      />
                    </div>
                    <p className="text-[11px] text-stone-400 mt-1">
                      Admin fee will be deducted from source account and recorded under Expenses (Other).
                    </p>
                  </div>
                </div>
              )}

              {/* Cashback Option for Expenses */}
              {formType === 'expense' && (
                <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasCashback}
                      onChange={(e) => setHasCashback(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold text-stone-800">
                      Received cashback or promotional credit?
                    </span>
                  </label>
                  {hasCashback && (
                    <div className="mt-2.5 pl-6">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cashbackAmount}
                        onChange={handleCashbackChange}
                        placeholder="Cashback amount (e.g. 5.000)"
                        className="w-full bg-white border-2 border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-900 font-bold font-mono-numbers outline-none focus:border-stone-400"
                      />
                    </div>
                  )}
                </div>
              )}

              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-tactile-neutral flex-1 py-2.5 text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn-tactile-primary flex-[2] py-2.5 text-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Save Transaction</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= ACTION CONTEXT MENU MODAL ================= */}
      {actionMenuOpen && activeEvent && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 touch-none overscroll-contain select-none"
          onClick={() => { setActionMenuOpen(false); setActiveTransactionId(null); }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
            }
          }}
        >
          <div 
            className="bg-white border-2 border-stone-200 border-b-4 border-b-stone-300 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3 touch-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-stone-100 pb-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block mb-0.5">
                Transaction Options
              </span>
              <h4 className="font-bold text-base text-stone-900 truncate">
                {activeEvent.description}
              </h4>
              <p className="text-xs font-mono-numbers text-stone-500 mt-0.5">
                {formatRupiah(activeEvent.amount)} • {formatDateDisplay(activeEvent.date)}
              </p>
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={handleEdit}
                className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-bold text-stone-800 hover:bg-stone-100 transition cursor-pointer flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4 text-stone-500" />
                <span>{activeEvent.type === 'refund' ? 'Edit Refund' : 'Edit Transaction'}</span>
              </button>

              {activeEvent.type === 'expense' && (
                <button
                  type="button"
                  onClick={handleOpenRefund}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-bold text-violet-700 hover:bg-violet-50 transition cursor-pointer flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4 text-violet-500" />
                  <span>Record Refund</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDelete}
                className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 transition cursor-pointer flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>Delete Transaction</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => { setActionMenuOpen(false); setActiveTransactionId(null); }}
              className="btn-tactile-neutral w-full py-2 text-xs cursor-pointer mt-1"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ================= DELETE CONFIRMATION DIALOG ================= */}
      {pendingDeleteEvent && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setPendingDeleteEventId(null)}
        >
          <div 
            className="bg-white border-2 border-rose-300 border-b-4 border-b-rose-400 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-black text-stone-900">Delete Transaction?</h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              Are you sure you want to permanently delete <strong>{pendingDeleteEvent.description}</strong> ({formatRupiah(pendingDeleteEvent.amount)})?
            </p>
            {pendingDeleteRelatedCount > 0 && (
              <p className="text-[11px] text-rose-800 bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-left font-semibold">
                Warning: {pendingDeleteRelatedCount} linked event(s) (cashback/refund) will also be deleted.
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingDeleteEventId(null)}
                className="btn-tactile-neutral flex-1 py-2.5 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="btn-tactile-rose flex-1 py-2.5 text-xs cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CASHBACK ACCOUNT CHANGE CONFIRMATION ================= */}
      {showCashbackAccountWarning && editingEventId && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setShowCashbackAccountWarning(false)}
        >
          <div 
            className="bg-white border-2 border-amber-300 border-b-4 border-b-amber-400 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center shadow-xs">
              <AlertCircle className="w-6 h-6 stroke-[2.5]" />
            </div>
            <h4 className="text-xl font-black text-stone-900">Update Cashback Account?</h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              This expense has a linked cashback transaction. Changing the expense account from{' '}
              <strong className="text-stone-900">{getAccountById((events.find((e): e is ExpenseEvent => e.id === editingEventId && e.type === 'expense'))?.accountId as AccountId)?.fullName || 'Original Account'}</strong> to{' '}
              <strong className="text-stone-900">{selectedAccount ? (getAccountById(selectedAccount)?.fullName || selectedAccount) : ''}</strong> will also automatically update the cashback account to{' '}
              <strong className="text-stone-900">{selectedAccount ? (getAccountById(selectedAccount)?.fullName || selectedAccount) : ''}</strong>.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCashbackAccountWarning(false)}
                className="btn-tactile-neutral flex-1 py-2.5 text-xs cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCashbackAccountWarning(false);
                  executeSave();
                }}
                className="btn-tactile-primary flex-1 py-2.5 text-xs cursor-pointer"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= BACKUP & RESTORE MODAL ================= */}
      {showBackupModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4"
          onClick={() => setShowBackupModal(false)}
        >
          <div 
            className="bg-white border-2 border-stone-200 border-b-4 border-b-stone-300 w-full max-w-md rounded-3xl p-6 shadow-2xl relative space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowBackupModal(false)}
              type="button"
              aria-label="Close dialog"
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition rounded-full w-8 h-8 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300/80 mb-1">
                Data Vault
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                Backup & Restore
              </h3>
              <p className="text-xs text-stone-500 font-medium">
                Safeguard your financial records as a JSON file or restore a previous snapshot.
              </p>
            </div>

            <div className="space-y-3">
              {/* Download Backup */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-stone-900 block">Export JSON Backup</span>
                  <span className="text-[11px] text-stone-500">{events.length} transactions recorded</span>
                </div>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="btn-tactile-dark px-3.5 py-1.5 text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>

              {/* Restore Backup */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-stone-900 block">Restore from File</span>
                  <span className="text-[11px] text-stone-500">Upload JSON backup file</span>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-tactile-neutral px-3.5 py-1.5 text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-stone-600" />
                  <span>Choose File</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelected}
                  className="hidden"
                />
              </div>

              {backupStatusMessage && (
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>{backupStatusMessage}</span>
                </div>
              )}

              {backupError && (
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{backupError}</span>
                </div>
              )}

              {pendingRestore && (
                <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-300 space-y-2">
                  <span className="text-xs font-bold text-amber-900 block">Confirm Restore:</span>
                  <p className="text-xs text-stone-700 font-medium">
                    Found <strong>{pendingRestore.events.length}</strong> valid transactions in the backup file. Overwrite your current records?
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCancelRestore}
                      className="btn-tactile-neutral flex-1 py-2 text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCurrentBeforeRestore}
                      className="btn-tactile-neutral flex-1 py-2 text-xs cursor-pointer"
                    >
                      Backup First
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmRestore}
                      className="btn-tactile-primary flex-1 py-2 text-xs cursor-pointer"
                    >
                      Restore Now
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= CLOUD SYNC MODAL ================= */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border-2 border-stone-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-5 animate-scale-up">
            <button
              type="button"
              onClick={() => setShowSyncModal(false)}
              className="absolute right-5 top-5 p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-amber-700 shadow-2xs">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-stone-900 leading-tight">
                  Cloud Synchronization
                </h3>
                <p className="text-xs text-stone-700 font-semibold">
                  Multi-device PostgreSQL sync via Supabase
                </p>
              </div>
            </div>

            {isSupabaseConfigured() ? (
              <div className="space-y-4">
                <div className="bg-emerald-50/80 border-2 border-emerald-200 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      Supabase Connected
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                      {syncState.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-stone-700 font-medium">
                    Last Synced: {syncState.lastSyncedAt ? new Date(syncState.lastSyncedAt).toLocaleString() : 'Never'}
                  </p>
                  {syncState.errorMessage && (
                    <p className="text-xs text-rose-600 font-semibold">
                      {syncState.errorMessage}
                    </p>
                  )}
                </div>

                <p className="text-xs text-stone-700 leading-relaxed font-medium">
                  Your transactions are stored in your device&apos;s local database and automatically synced to your private Supabase PostgreSQL table in the background.
                </p>

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      syncWithCloud();
                    }}
                    disabled={syncState.status === 'syncing'}
                    className="btn-tactile-primary w-full py-2.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
                    <span>{syncState.status === 'syncing' ? 'Syncing Now...' : 'Sync with Cloud'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await forceUploadAllToCloud(events);
                    }}
                    disabled={syncState.status === 'syncing'}
                    className="btn-tactile-neutral w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-2xs text-stone-700 hover:text-stone-900"
                    title="Upload all active local records directly to Supabase"
                  >
                    <Upload className="w-4 h-4 text-stone-600" />
                    <span>Force Push All ({events.length}) Records to Cloud</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-stone-50 border-2 border-stone-200 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-stone-400" />
                      Local Storage Mode
                    </span>
                    <span className="text-[11px] font-bold text-stone-700 bg-stone-200 px-2 py-0.5 rounded-full">
                      STANDALONE
                    </span>
                  </div>
                  <p className="text-xs text-stone-700 leading-relaxed font-medium">
                    The app is currently running 100% locally on this device. To enable sync across your PC and smartphone:
                  </p>
                </div>

                <div className="space-y-2 text-xs text-stone-700 font-medium bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200">
                  <p className="font-bold text-stone-900">Quick 3-step setup:</p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Create a free project at <span className="font-bold text-amber-800">supabase.com</span></li>
                    <li>Execute <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300">supabase/schema.sql</span> in SQL Editor</li>
                    <li>Add Supabase URL and Anon Key to <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300">.env.local</span></li>
                  </ol>
                </div>

                <p className="text-[11px] text-stone-600 italic">
                  See <strong>supabase/README.md</strong> for detailed step-by-step instructions.
                </p>

                <button
                  type="button"
                  onClick={() => setShowSyncModal(false)}
                  className="btn-tactile-neutral w-full py-2.5 text-xs font-bold cursor-pointer"
                >
                  Got it, close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= UNDO TOAST ================= */}
      {undoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 font-bold text-xs sm:text-sm animate-bounce border-2 border-stone-800">
          <span>{undoToast}</span>
          <button
            type="button"
            onClick={handleUndoReorder}
            className="bg-stone-800 hover:bg-stone-700 text-amber-400 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Undo</span>
          </button>
        </div>
      )}

      {/* ================= REFUND MODAL ================= */}
      <RefundModal
        isOpen={showRefundModal}
        onClose={() => {
          setShowRefundModal(false);
          setRefundParentExpense(null);
          setEditingRefundEvent(null);
          setRefundError(null);
        }}
        parentExpense={refundParentExpense}
        editingRefund={editingRefundEvent}
        maxRefundableAmount={refundCalculation.maxRefundable}
        existingRefundedAmount={refundCalculation.totalRefunded}
        onSaveRefund={handleSaveRefund}
        error={refundError}
        formatRupiah={formatRupiah}
      />

      {/* ================= MASTER PIN PRIVACY SHIELD LOCKSCREEN ================= */}
      {isLocked && (
        <MasterPinLockscreen onUnlocked={() => setIsLocked(false)} />
      )}
    </main>
  );
}
