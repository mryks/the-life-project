"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { AccountId, BackupParseResult, ExpenseCategory, FinancialEvent, IncomeCategory } from "@/lib/types";
import { GO_LIVE_DATE } from "@/lib/types";
import { getAccountById } from "@/lib/accounts";
import {
  FINANCE_STORAGE_VERSION,
  calculateFinanceStats,
  calculateNetExpenseForDate,

  compareEventsNewestFirst,
  createEventId,
  deleteFinancialEvent,
  deriveLedgerEntries,
  downloadBackupFile,
  expenseCategories,
  getAccountBalances,
  getBackupFilename,
  getOpeningBalances,
  hasNormalTransactionsForAccount,
  hasOpeningBalanceEvents,
  incomeCategories,
  isPositiveInteger,
  parseAndValidateBackup,
  readFinancialEvents,
  replaceFinancialEvent,
  restoreFinancialEvents,
  serializeBackup,
  setOpeningBalance,
  subscribeToFinancialEvents,
  todayDate,
  validateNormalTransactionDate,
  writeFinancialEvents,
} from "@/lib/finance";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  LineChart, Line, XAxis, YAxis, CartesianGrid 
} from "recharts";

// Konfigurasi
const accountOrder: AccountId[] = ['c', 'b', 'g', 's', 'jy', 'e', 'sea', 'q', 'j', 'k', 'h', 'sb', 'poe', 'kb', 'i', 'cla', 'p'];
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c'];
const emptyEvents: FinancialEvent[] = [];

export default function FinancePage() {
  // Navigation State
  const [view, setView] = useState<'dashboard' | 'accounts' | 'categories'>('dashboard');
  const [accountViewMode, setAccountViewMode] = useState<'card' | 'ledger'>('card');
  const [filterAccountId, setFilterAccountId] = useState<AccountId | null>(null);

  // Data State
  const events = useSyncExternalStore(subscribeToFinancialEvents, readFinancialEvents, () => emptyEvents);
  const [showMenu, setShowMenu] = useState(false);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(todayDate());
  const [selectedAccount, setSelectedAccount] = useState<AccountId>('g');
  const [destinationAccount, setDestinationAccount] = useState<AccountId>('s');
  const [hasCashback, setHasCashback] = useState(false);
  const [cashbackAmount, setCashbackAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | IncomeCategory>('Food & Drinks');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Action Menu State
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [activeTransactionId, setActiveTransactionId] = useState<string | null>(null);
  const [pendingDeleteEventId, setPendingDeleteEventId] = useState<string | null>(null);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [editingOpeningAccount, setEditingOpeningAccount] = useState<AccountId | null>(null);
  const [openingAmount, setOpeningAmount] = useState("");
  const [openingError, setOpeningError] = useState<string | null>(null);
  const [confirmingOpeningEdit, setConfirmingOpeningEdit] = useState(false);

  // Backup & Restore State
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupStatusMessage, setBackupStatusMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<Extract<BackupParseResult, { success: true }> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = () => {
    try {
      const jsonString = serializeBackup(events);
      const filename = getBackupFilename();
      downloadBackupFile(jsonString, filename);
      setBackupStatusMessage('Backup downloaded successfully.');
      setBackupError(null);
    } catch (err: unknown) {
      setBackupError(err instanceof Error ? err.message : 'Failed to export backup.');
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

  const handleConfirmRestore = () => {
    if (!pendingRestore) return;
    try {
      restoreFinancialEvents(pendingRestore.events);
      setBackupStatusMessage(`Successfully restored ${pendingRestore.events.length} financial event(s).`);
      setPendingRestore(null);
      setBackupError(null);
    } catch (err: unknown) {
      setBackupError(err instanceof Error ? err.message : 'Unable to restore financial events.');
    }
  };

  const handleDownloadCurrentBeforeRestore = () => {
    handleExportBackup();
  };

  const handleCancelRestore = () => {
    setPendingRestore(null);
    setBackupError(null);
  };

  // All reports and account balances are deterministic derivations of persisted events.
  const stats = useMemo(() => calculateFinanceStats(events, todayDate()), [events]);
  const accountBalances = useMemo(() => getAccountBalances(events), [events]);
  const openingBalances = useMemo(() => getOpeningBalances(events), [events]);
  const hasOpening = useMemo(() => hasOpeningBalanceEvents(events), [events]);

  // 5. Line Chart Data
  const lineChartData = useMemo(() => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayExpense = calculateNetExpenseForDate(events, dateStr);
      last7Days.push({ name: d.toLocaleDateString('en-US', { weekday: 'short' }), expense: dayExpense });
    }
    return last7Days;
  }, [events]);

  // 6. Grouped Transactions (For Card View)
  const groupedTransactions = useMemo(() => {
    let filtered = events.filter((event) => event.type !== 'opening-balance');
    if (filterAccountId) filtered = filtered.filter((event) =>
      event.type === 'transfer'
        ? event.sourceAccountId === filterAccountId || event.destinationAccountId === filterAccountId
        : event.accountId === filterAccountId
    );
    
    const sorted = [...filtered].sort(compareEventsNewestFirst);
    const groups: Record<string, FinancialEvent[]> = {};
    sorted.forEach((event) => {
      if (!groups[event.date]) groups[event.date] = [];
      groups[event.date].push(event);
    });
    return groups;
  }, [events, filterAccountId]);

  const ledgerEntries = useMemo(() => {
    const entries = deriveLedgerEntries(events);
    return filterAccountId ? entries.filter((entry) => entry.accountId === filterAccountId) : entries;
  }, [events, filterAccountId]);
  const activeEvent = events.find((event) => event.id === activeTransactionId) ?? null;
  const pendingDeleteEvent = events.find((event) => event.id === pendingDeleteEventId) ?? null;
  const pendingDeleteRelatedCount = pendingDeleteEvent?.type === 'expense'
    ? events.filter((event) => 'relatedEventId' in event && event.relatedEventId === pendingDeleteEvent.id).length
    : 0;

  const resetForm = () => {
    setEditingEventId(null);
    setAmount("");
    setDesc("");
    setDate(hasOpening && todayDate() < GO_LIVE_DATE ? GO_LIVE_DATE : todayDate());
    setHasCashback(false);
    setCashbackAmount("");
    setFormError(null);
  };

  const handleSave = () => {
    const parsedAmount = Number(amount);
    const trimmedDescription = (formType === 'transfer' ? `transfer to ${destinationAccount.toUpperCase()}` : desc).trim();
    if (!isPositiveInteger(parsedAmount)) return setFormError('Amount must be a positive whole number.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !trimmedDescription) return setFormError('Date and description are required.');
    if (hasOpening && !validateNormalTransactionDate(date, true)) {
      return setFormError('Transaction date cannot be before 2026-10-01 when Opening Balance is active.');
    }
    if (formType === 'transfer' && selectedAccount === destinationAccount) return setFormError('Transfer accounts must be different.');

    const eventId = editingEventId ?? createEventId();
    const event: FinancialEvent = formType === 'transfer'
      ? { id: eventId, date, description: trimmedDescription, amount: parsedAmount, type: 'transfer', sourceAccountId: selectedAccount, destinationAccountId: destinationAccount }
      : formType === 'expense'
        ? { id: eventId, date, description: trimmedDescription, amount: parsedAmount, type: 'expense', accountId: selectedAccount, category: selectedCategory as ExpenseCategory }
        : { id: eventId, date, description: trimmedDescription, amount: parsedAmount, type: 'income', accountId: selectedAccount, category: selectedCategory as IncomeCategory };

    let nextEvents: FinancialEvent[] | null = editingEventId
      ? replaceFinancialEvent(events, event)
      : [...events, event];
    if (!nextEvents) return setFormError('This change would violate a related financial event rule.');

    if (formType === 'expense') {
      const existingCashback = events.find((candidate) => candidate.type === 'income' && candidate.category === 'Cashback' && candidate.relatedEventId === eventId);
      if (hasCashback) {
        const parsedCashback = Number(cashbackAmount);
        if (!isPositiveInteger(parsedCashback)) return setFormError('Cashback must be a positive whole number.');
        const cashback: FinancialEvent = {
          id: existingCashback?.id ?? createEventId(),
          date,
          description: `cashback ${selectedAccount}`,
          amount: parsedCashback,
          type: 'income',
          accountId: selectedAccount,
          category: 'Cashback',
          relatedEventId: eventId,
        };
        nextEvents = existingCashback
          ? nextEvents.map((candidate) => candidate.id === existingCashback.id ? cashback : candidate)
          : [...nextEvents, cashback];
      } else if (existingCashback) {
        nextEvents = deleteFinancialEvent(nextEvents, existingCashback.id);
      }
    }

    try {
      writeFinancialEvents(nextEvents);
    } catch {
      setFormError('Unable to save a valid financial event.');
      return;
    }
    setShowForm(false);
    resetForm();
  };

  const handleActionOpen = (id: string) => { setActiveTransactionId(id); setActionMenuOpen(true); };
  
  const handleDelete = () => {
    if (!activeTransactionId) return;
    setPendingDeleteEventId(activeTransactionId);
    setActionMenuOpen(false); setActiveTransactionId(null);
  };

  const confirmDelete = () => {
    if (!pendingDeleteEventId) return;
    writeFinancialEvents(deleteFinancialEvent(events, pendingDeleteEventId));
    setPendingDeleteEventId(null);
  };

  const handleEdit = () => {
    const event = events.find((candidate) => candidate.id === activeTransactionId);
    if (!event || event.type === 'refund' || event.type === 'opening-balance' || (event.type === 'income' && event.category === 'Cashback')) return;
    setFormType(event.type);
    setDesc(event.description);
    setAmount(event.amount.toString());
    setDate(event.date);
    setSelectedAccount(event.type === 'transfer' ? event.sourceAccountId : event.accountId);
    if (event.type === 'transfer') setDestinationAccount(event.destinationAccountId);
    if (event.type !== 'transfer') setSelectedCategory(event.category);
    if (event.type === 'expense') {
      const cashback = events.find((candidate) => candidate.type === 'income' && candidate.category === 'Cashback' && candidate.relatedEventId === event.id);
      setHasCashback(Boolean(cashback));
      setCashbackAmount(cashback?.amount.toString() ?? '');
    } else {
      setHasCashback(false);
      setCashbackAmount('');
    }
    setEditingEventId(event.id);
    setFormError(null);
    setShowForm(true); setActionMenuOpen(false); setActiveTransactionId(null);
  };

  // Helpers
  const formatRupiah = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  const formatDateCard = (dateStr: string) => new Date(`${dateStr}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const formatDateLedger = (dateStr: string) => new Date(`${dateStr}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace('.', '');

  return (
    <main className="min-h-screen bg-gray-50 pb-24 relative">
      
      {/* ================= DASHBOARD VIEW ================= */}
      {view === 'dashboard' && (
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div onClick={() => setView('accounts')} className="bg-white p-5 rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition">
              <p className="text-sm text-gray-500 lowercase">total balance</p>
              <h2 className="text-3xl font-black text-gray-900 mt-1">{formatRupiah(stats.totalBalance)}</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                <p className="text-xs text-green-600 font-bold uppercase">income (this month)</p>
                <p className="text-lg font-bold text-green-700 mt-1">{formatRupiah(stats.monthlyIncome)}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                <p className="text-xs text-red-600 font-bold uppercase">expense (this month)</p>
                <p className="text-lg font-bold text-red-700 mt-1">{formatRupiah(stats.monthlyExpense)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 lowercase">expense by category</h3>
              <button onClick={() => setView('categories')} className="text-xs text-blue-600 font-bold">view all</button>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {stats.pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(value) => formatRupiah(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 lowercase">net expense trend (last 7 days)</h3>
            <div className="h-64 overflow-x-auto">
              <ResponsiveContainer width="100%" height="100%" minWidth={300}>
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{fontSize: 12}} />
                  <YAxis tick={{fontSize: 12}} domain={['auto', 'auto']} />
                  <Tooltip formatter={(value) => formatRupiah(Number(value))} />
                  <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} dot={{r: 4}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ================= ACCOUNTS VIEW ================= */}
      {view === 'accounts' && (
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button onClick={() => { setView('dashboard'); setFilterAccountId(null); }} className="text-sm text-blue-600 font-bold">← back</button>
              <h2 className="text-2xl font-bold text-gray-800 lowercase">accounts</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setBackupStatusMessage(null);
                  setBackupError(null);
                  setPendingRestore(null);
                  setShowBackupModal(true);
                }}
                className="text-xs font-bold text-gray-700 bg-white border border-gray-200 px-3 py-1.5 rounded-xl shadow-sm hover:bg-gray-50 transition lowercase"
              >
                backup & restore
              </button>
              <button
                onClick={() => {
                  setEditingOpeningAccount(null);
                  setOpeningError(null);
                  setConfirmingOpeningEdit(false);
                  setShowOpeningModal(true);
                }}
                className="text-xs font-bold text-gray-700 bg-white border border-gray-200 px-3 py-1.5 rounded-xl shadow-sm hover:bg-gray-50 transition lowercase"
              >
                manage opening balances
              </button>
            </div>
          </div>

          {/* Account List */}
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide mb-6">
            <div onClick={() => setFilterAccountId(null)} className={`flex-shrink-0 w-24 h-32 rounded-2xl p-3 flex flex-col justify-between shadow-md text-white cursor-pointer border-2 ${filterAccountId === null ? 'border-gray-900 scale-105' : 'border-transparent'} bg-gradient-to-br from-gray-700 to-gray-900`}>
              <span className="font-bold text-lg">All</span>
              <span className="text-xs font-medium opacity-90 truncate">{formatRupiah(stats.totalBalance)}</span>
            </div>
            {accountOrder.map(accId => {
               const acc = getAccountById(accId);
               if (!acc) return null;
               return (
                  <div key={acc.id} onClick={() => setFilterAccountId(accId)} className={`flex-shrink-0 w-24 h-32 rounded-2xl ${acc.colorClass} p-3 flex flex-col justify-between shadow-md text-white cursor-pointer border-2 transition ${filterAccountId === accId ? 'border-gray-900 scale-105' : 'border-transparent'}`}>
                    <span className="font-bold text-lg">{acc.name}</span>
                    <span className="text-xs font-medium opacity-90 truncate">{formatRupiah(accountBalances[acc.id] || 0)}</span>
                  </div>
               );
            })}
          </div>

          {/* Toggle View */}
          <div className="bg-gray-200 p-1 rounded-xl flex mb-6">
            <button onClick={() => setAccountViewMode('card')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${accountViewMode === 'card' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>card view</button>
            <button onClick={() => setAccountViewMode('ledger')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${accountViewMode === 'ledger' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>ledger</button>
          </div>

          {/* Content: Card or Ledger */}
          {accountViewMode === 'card' ? (
            <div className="space-y-6">
              {Object.keys(groupedTransactions).length === 0 && <p className="text-center text-gray-400 mt-10">no transactions yet</p>}
              {Object.keys(groupedTransactions).map(date => (
                <div key={date}>
                  <h3 className="text-sm font-bold text-gray-400 mb-3 sticky top-0 bg-gray-50 py-2 z-10 lowercase">{formatDateCard(date)}</h3>
                  <div className="space-y-3">
                    {groupedTransactions[date].map((event) => {
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
                      return (
                        <div key={event.id} onContextMenu={(e) => { e.preventDefault(); handleActionOpen(event.id); }} className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center active:bg-gray-50 transition cursor-pointer">
                          <div className={`w-10 h-10 rounded-full ${acc?.colorClass} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>{acc?.name}</div>
                          <div className="flex-1 mx-4 min-w-0"><p className="font-bold text-gray-800 text-sm lowercase truncate">{cardDescription}</p></div>
                          <p className={`font-bold text-sm ${transferDirection === 'out' ? 'text-red-500' : transferDirection === 'in' ? 'text-green-600' : 'text-blue-600'}`}>{transferDirection === 'neutral' ? '' : transferDirection === 'out' ? '-' : '+'}{formatRupiah(event.amount)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">date</th>
                    <th className="px-4 py-3">desc</th>
                    <th className="px-4 py-3">acc</th>
                    <th className="px-4 py-3 text-right">in</th>
                    <th className="px-4 py-3 text-right">out</th>
                    <th className="px-4 py-3 text-right">cat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ledgerEntries.map((entry) => {
                    const acc = getAccountById(entry.accountId);
                    const isOpening = entry.eventType === 'opening-balance';
                    const openingEv = isOpening ? openingBalances[entry.accountId] : undefined;
                    const rawOpeningAmount = openingEv ? openingEv.amount : (entry.direction === 'in' ? entry.amount : -entry.amount);
                    return (
                      <tr
                        key={`${entry.eventId}-${entry.accountId}-${entry.direction}`}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (isOpening) {
                            setEditingOpeningAccount(entry.accountId);
                            setOpeningAmount(String(rawOpeningAmount));
                            setOpeningError(null);
                            setConfirmingOpeningEdit(false);
                            setShowOpeningModal(true);
                          } else {
                            handleActionOpen(entry.eventId);
                          }
                        }}
                        onClick={() => {
                          if (isOpening) {
                            setEditingOpeningAccount(entry.accountId);
                            setOpeningAmount(String(rawOpeningAmount));
                            setOpeningError(null);
                            setConfirmingOpeningEdit(false);
                            setShowOpeningModal(true);
                          }
                        }}
                        className={`hover:bg-gray-50 cursor-pointer ${isOpening ? 'bg-blue-50/30' : ''}`}
                      >
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{formatDateLedger(entry.date)}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 lowercase max-w-[150px] truncate">
                          {isOpening ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold tracking-tight">starting balance</span>
                              <span className="truncate">{entry.description}</span>
                            </span>
                          ) : (
                            entry.description
                          )}
                        </td>
                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs text-white font-bold ${acc?.colorClass}`}>{acc?.name}</span></td>
                        <td className="px-4 py-3 text-right font-medium">
                          {isOpening ? <span className="text-gray-400">-</span> : (entry.direction === 'in' ? <span className="text-green-600">{formatRupiah(entry.amount)}</span> : '-')}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {isOpening ? <span className="text-gray-400">-</span> : (entry.direction === 'out' ? <span className="text-red-500">{formatRupiah(entry.amount)}</span> : '-')}
                        </td>
                        <td className="px-4 py-3 text-right text-xs lowercase">
                          {isOpening ? (
                            <span className="font-bold text-gray-900">{formatRupiah(rawOpeningAmount)}</span>
                          ) : (
                            <span className="text-gray-500">{entry.category || '-'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= CATEGORIES VIEW ================= */}
      {view === 'categories' && (
        <div className="p-6">
          <button onClick={() => setView('dashboard')} className="mb-4 text-sm text-blue-600 font-bold">← back to dashboard</button>
          <h2 className="text-2xl font-bold text-gray-800 mb-4 lowercase">expense categories</h2>
          <div className="grid grid-cols-2 gap-3">
            {expenseCategories.map(cat => (
              <div key={cat} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p className="font-bold text-gray-800 lowercase">{cat}</p>
                <p className="text-xs text-gray-500 mt-1">{formatRupiah(stats.pieData.find(p => p.name === cat)?.value || 0)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= FLOATING ACTION BUTTON ================= */}
      <div className="fixed bottom-24 right-6 z-40 flex flex-col items-end gap-3">
        {showMenu && !showForm && (
          <div className="flex flex-col gap-2 mb-2">
            <button onClick={() => { resetForm(); setFormType('income'); setSelectedCategory('Others'); setShowForm(true); setShowMenu(false); }} className="bg-white/80 backdrop-blur-md border border-white/20 shadow-lg px-4 py-2 rounded-full text-green-600 font-bold text-sm lowercase">income</button>
            <button onClick={() => { resetForm(); setFormType('expense'); setSelectedCategory('Food & Drinks'); setShowForm(true); setShowMenu(false); }} className="bg-white/80 backdrop-blur-md border border-white/20 shadow-lg px-4 py-2 rounded-full text-red-600 font-bold text-sm lowercase">expense</button>
            <button onClick={() => { resetForm(); setFormType('transfer'); setShowForm(true); setShowMenu(false); }} className="bg-white/80 backdrop-blur-md border border-white/20 shadow-lg px-4 py-2 rounded-full text-blue-600 font-bold text-sm lowercase">transfer</button>
          </div>
        )}
        <button onClick={() => setShowMenu(!showMenu)} className="w-14 h-14 rounded-full bg-white/30 backdrop-blur-lg border border-white/40 shadow-xl flex items-center justify-center text-3xl text-gray-800 hover:scale-105 transition active:scale-95">
          {showMenu || showForm ? '✕' : '+'}
        </button>
      </div>

      {/* ================= MODAL FORM ================= */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 transition bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 z-10">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="font-bold text-xl text-gray-800 mb-5 lowercase pr-8">{editingEventId ? 'edit' : 'add'} {formType}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block lowercase">date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-gray-900 font-medium transition" />
              </div>
              {formType !== 'transfer' && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block lowercase">description</label>
                  <input type="text" placeholder="e.g. lunch" value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-gray-900 placeholder-gray-400 transition" />
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block lowercase">amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">Rp</span>
                  <input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={`w-full bg-white border border-gray-200 rounded-xl pl-12 pr-4 py-3 outline-none focus:border-blue-500 text-lg font-bold transition ${amount ? 'text-gray-900' : 'text-gray-400'}`} />
                </div>
              </div>
              {formType !== 'transfer' && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block lowercase">category</label>
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value as ExpenseCategory | IncomeCategory)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-gray-900 font-medium transition">
                    {(formType === 'income' ? incomeCategories : expenseCategories).map(c => <option key={c} value={c} className="text-gray-900">{c}</option>)}
                  </select>
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase lowercase">{formType === 'transfer' ? 'from account (source)' : 'select account'}</p>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {accountOrder.map(accId => {
                    const acc = getAccountById(accId);
                    if(!acc) return null;
                    return (<button key={acc.id} onClick={() => setSelectedAccount(acc.id)} className={`flex-shrink-0 w-10 h-10 rounded-full ${acc.colorClass} flex items-center justify-center text-white font-bold text-xs border-2 transition ${selectedAccount === acc.id ? 'border-gray-900 scale-110' : 'border-transparent'}`}>{acc.name}</button>)
                  })}
                </div>
              </div>
              {formType === 'transfer' && (
                <div className="mt-2">
                  <p className="text-xs font-bold text-gray-500 mb-2 uppercase lowercase">to account (destination)</p>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {accountOrder.map(accId => {
                      const acc = getAccountById(accId);
                      if(!acc) return null;
                      return (<button key={acc.id} onClick={() => setDestinationAccount(acc.id)} className={`flex-shrink-0 w-10 h-10 rounded-full ${acc.colorClass} flex items-center justify-center text-white font-bold text-xs border-2 transition ${destinationAccount === acc.id ? 'border-gray-900 scale-110' : 'border-transparent'}`}>{acc.name}</button>)
                    })}
                  </div>
                </div>
              )}
              {formType === 'expense' && (
                <div className="pt-2 border-t border-gray-100">
                  {!hasCashback ? (
                    <button onClick={() => setHasCashback(true)} className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 font-bold text-sm hover:border-gray-400 hover:text-gray-700 transition lowercase">+ add cashback</button>
                  ) : (
                    <div className="bg-gray-50 p-3 rounded-xl">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-gray-500 uppercase lowercase">cashback amount</label>
                        <button onClick={() => { setHasCashback(false); setCashbackAmount(""); }} className="text-xs text-red-500 font-bold lowercase">remove</button>
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rp</span>
                        <input type="number" min="1" step="1" value={cashbackAmount} onChange={(e) => setCashbackAmount(e.target.value)} placeholder="0" className={`w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 outline-none focus:border-blue-500 font-bold transition ${cashbackAmount ? 'text-gray-900' : 'text-gray-400'}`} />
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-3 mt-6 pt-2">
                <button onClick={() => { setShowForm(false); resetForm(); }} className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition lowercase">cancel</button>
                <button onClick={handleSave} className="flex-[2] bg-gray-900 text-white py-3.5 rounded-xl font-bold hover:bg-black transition shadow-lg lowercase">save transaction</button>
              </div>
              {formError && <p className="text-sm font-medium text-red-600">{formError}</p>}
            </div>
          </div>
        </div>
      )}

      {pendingDeleteEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="alertdialog" aria-modal="true" aria-labelledby="delete-confirmation-title">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">
            <h3 id="delete-confirmation-title" className="font-bold text-xl text-gray-800 lowercase">delete this {pendingDeleteEvent.type}?</h3>
            <p className="mt-3 text-sm text-gray-600">
              {pendingDeleteEvent.type === 'expense' && pendingDeleteRelatedCount > 0
                ? `This will also delete ${pendingDeleteRelatedCount} related cashback or refund event${pendingDeleteRelatedCount === 1 ? '' : 's'}.`
                : 'This action cannot be undone.'}
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setPendingDeleteEventId(null)} className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition lowercase">cancel</button>
              <button onClick={confirmDelete} className="flex-[2] bg-red-600 text-white py-3.5 rounded-xl font-bold hover:bg-red-700 transition shadow-lg lowercase">delete event</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ACTION MENU (BOTTOM SHEET) ================= */}
      {actionMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm" onClick={() => setActionMenuOpen(false)}>
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6"></div>
            <h3 className="font-bold text-lg text-gray-800 mb-4 lowercase">pilih aksi</h3>
            <div className="space-y-3">
              <button onClick={handleEdit} disabled={activeEvent?.type === 'refund' || activeEvent?.type === 'opening-balance' || (activeEvent?.type === 'income' && activeEvent.category === 'Cashback')} className="w-full py-3.5 rounded-xl bg-gray-100 text-gray-800 font-bold hover:bg-gray-200 transition lowercase disabled:cursor-not-allowed disabled:opacity-50">edit transaksi</button>
              <button onClick={handleDelete} disabled={activeEvent?.type === 'opening-balance'} className="w-full py-3.5 rounded-xl bg-red-50 text-red-600 font-bold hover:bg-red-100 transition lowercase disabled:cursor-not-allowed disabled:opacity-50">hapus transaksi</button>
              <button onClick={() => setActionMenuOpen(false)} className="w-full py-3.5 rounded-xl text-gray-500 font-bold hover:bg-gray-50 transition lowercase">batal</button>
            </div>
          </div>
        </div>
      )}

    
      {/* ================= OPENING BALANCES MODAL ================= */}
      {showOpeningModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4" onClick={() => setShowOpeningModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowOpeningModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 transition bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 z-10">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <div className="mb-5 pr-8">
              <h3 className="font-bold text-xl text-gray-800 lowercase">manage opening balances</h3>
              <p className="text-xs text-gray-500 mt-1">fixed position as of <span className="font-semibold text-gray-700">30 Sep 2026</span> (go-live: 1 Oct 2026)</p>
            </div>

            {editingOpeningAccount ? (
              <div className="space-y-4">
                {(() => {
                  const acc = getAccountById(editingOpeningAccount);
                  const currentBal = accountBalances[editingOpeningAccount] || 0;
                  const hasTx = hasNormalTransactionsForAccount(events, editingOpeningAccount);

                  const handleSaveOpening = () => {
                    const parsed = Number(openingAmount);
                    if (!Number.isSafeInteger(parsed)) {
                      return setOpeningError('Please enter a valid integer amount.');
                    }
                    if (hasTx && !confirmingOpeningEdit) {
                      setConfirmingOpeningEdit(true);
                      return;
                    }
                    try {
                      const nextEvents = setOpeningBalance(events, editingOpeningAccount, parsed);
                      writeFinancialEvents(nextEvents);
                      setEditingOpeningAccount(null);
                      setConfirmingOpeningEdit(false);
                      setOpeningError(null);
                    } catch (err: unknown) {
                      setOpeningError(err instanceof Error ? err.message : 'Unable to save opening balance.');
                    }
                  };

                  const handleResetZero = () => {
                    setOpeningAmount("0");
                  };

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                        <div className={`w-10 h-10 rounded-full ${acc?.colorClass} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>{acc?.name}</div>
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{acc?.name} Account</p>
                          <p className="text-xs text-gray-500">Current balance: <span className="font-medium text-gray-700">{formatRupiah(currentBal)}</span></p>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block lowercase">opening balance amount (IDR)</label>
                        <p className="text-[11px] text-gray-400 mb-2">Can be positive, zero, or negative (e.g. for credit card / overdraft).</p>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">Rp</span>
                          <input
                            type="number"
                            step="1"
                            value={openingAmount}
                            onChange={(e) => {
                              setOpeningAmount(e.target.value);
                              setOpeningError(null);
                            }}
                            placeholder="0"
                            className="w-full bg-white border border-gray-200 rounded-xl pl-12 pr-4 py-3 outline-none focus:border-blue-500 text-lg font-bold text-gray-900 transition"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleResetZero}
                          className="text-xs font-bold text-gray-600 hover:text-gray-900 underline lowercase"
                        >
                          set to Rp0
                        </button>
                      </div>

                      {hasTx && (
                        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs space-y-1">
                          <p className="font-bold lowercase">⚠️ transactions already exist for this account</p>
                          <p>Editing this opening balance will immediately adjust the calculated account balance and total balance.</p>
                        </div>
                      )}

                      {confirmingOpeningEdit && (
                        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs">
                          <p className="font-bold lowercase">confirm balance adjustment</p>
                          <p className="mt-1">Are you sure you want to change the opening balance for {acc?.name} to {formatRupiah(Number(openingAmount) || 0)}?</p>
                        </div>
                      )}

                      {openingError && <p className="text-xs font-bold text-red-600">{openingError}</p>}

                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOpeningAccount(null);
                            setConfirmingOpeningEdit(false);
                            setOpeningError(null);
                          }}
                          className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition lowercase"
                        >
                          cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveOpening}
                          className="flex-[2] bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition shadow-lg lowercase"
                        >
                          {confirmingOpeningEdit ? 'confirm & save' : 'save opening balance'}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto pr-1">
                  {accountOrder.map((accId) => {
                    const acc = getAccountById(accId);
                    if (!acc) return null;
                    const op = openingBalances[acc.id];
                    const curBal = accountBalances[acc.id] || 0;
                    return (
                      <div key={acc.id} className="py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full ${acc.colorClass} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>{acc.name}</div>
                          <div>
                            <p className="font-bold text-gray-800 text-sm">{acc.name}</p>
                            <p className="text-xs text-gray-400">Current: {formatRupiah(curBal)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-xs font-bold text-gray-800">{op !== undefined ? formatRupiah(op.amount) : 'Rp0'}</p>
                            <p className="text-[10px] text-gray-400">{op !== undefined ? 'configured' : 'not set'}</p>
                          </div>
                          <button
                            onClick={() => {
                              setEditingOpeningAccount(acc.id);
                              setOpeningAmount(op ? String(op.amount) : "0");
                              setOpeningError(null);
                              setConfirmingOpeningEdit(false);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition lowercase"
                          >
                            edit
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= BACKUP & RESTORE MODAL ================= */}
      {showBackupModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4" onClick={() => setShowBackupModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowBackupModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 transition bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 z-10">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <div className="mb-5 pr-8">
              <h3 className="font-bold text-xl text-gray-800 lowercase">backup & restore</h3>
              <p className="text-xs text-gray-500 mt-1">export or restore your personal finance dataset (JSON format)</p>
            </div>

            {pendingRestore ? (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs space-y-2">
                  <p className="font-bold text-sm lowercase flex items-center gap-1.5">
                    <span>⚠️</span> replace current financial data?
                  </p>
                  <p>
                    This will replace all current financial data on this device with the imported backup.
                    Existing transactions will be overwritten.
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl space-y-2 text-xs text-gray-700">
                  <p className="font-bold text-gray-900 lowercase text-sm mb-2">backup preview</p>
                  <div className="flex justify-between py-1 border-b border-gray-200/60">
                    <span className="text-gray-500 lowercase">schema version:</span>
                    <span className="font-semibold">{pendingRestore.version === 2 ? 'version 2' : `version ${pendingRestore.version} (migrated)`}</span>
                  </div>
                  {pendingRestore.exportedAt && (
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span className="text-gray-500 lowercase">export timestamp:</span>
                      <span className="font-semibold">{new Date(pendingRestore.exportedAt).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-gray-200/60">
                    <span className="text-gray-500 lowercase">total events:</span>
                    <span className="font-bold text-gray-900">{pendingRestore.summary.totalEvents}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200/60">
                    <span className="text-gray-500 lowercase">opening balances configured:</span>
                    <span className="font-semibold">{pendingRestore.summary.openingBalanceAccounts} account(s)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500 lowercase">breakdown:</span>
                    <span className="text-gray-600">
                      {pendingRestore.summary.incomeCount} inc / {pendingRestore.summary.expenseCount} exp / {pendingRestore.summary.transferCount} trf / {pendingRestore.summary.refundCount} ref
                    </span>
                  </div>
                </div>

                {backupStatusMessage && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs font-semibold">
                    {backupStatusMessage}
                  </div>
                )}

                {backupError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-semibold">
                    {backupError}
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadCurrentBeforeRestore}
                    className="w-full py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-50 transition lowercase"
                  >
                    download current backup first
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleCancelRestore}
                      className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition text-xs lowercase"
                    >
                      cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmRestore}
                      className="flex-[2] bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition shadow-lg text-xs lowercase"
                    >
                      continue & restore
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900 text-sm lowercase">current dataset</p>
                    <p className="text-xs text-gray-500 mt-0.5">{events.length} event(s) recorded</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700">
                    v{FINANCE_STORAGE_VERSION} storage
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="p-4 bg-white border border-gray-200 rounded-2xl space-y-2">
                    <h4 className="font-bold text-gray-800 text-sm lowercase">export backup</h4>
                    <p className="text-xs text-gray-500">
                      Download all your financial events into a JSON file for safekeeping or transfer to another device.
                    </p>
                    <button
                      type="button"
                      onClick={handleExportBackup}
                      className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-black transition shadow-sm lowercase"
                    >
                      download backup JSON
                    </button>
                  </div>

                  <div className="p-4 bg-white border border-gray-200 rounded-2xl space-y-2">
                    <h4 className="font-bold text-gray-800 text-sm lowercase">import backup</h4>
                    <p className="text-xs text-gray-500">
                      Restore a previously exported JSON backup file. This will validate the data and ask for confirmation before replacing current data.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileSelected}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2.5 rounded-xl border border-gray-300 text-gray-800 text-xs font-bold hover:bg-gray-50 transition shadow-sm lowercase"
                    >
                      select backup file to restore
                    </button>
                  </div>
                </div>

                {backupStatusMessage && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs font-semibold">
                    {backupStatusMessage}
                  </div>
                )}

                {backupError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-semibold">
                    {backupError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </main>
  );
}
