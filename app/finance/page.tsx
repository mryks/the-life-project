"use client";

import { useState, useEffect, useMemo } from "react";
import BottomNav from "@/components/BottomNav";
import { Transaction, AccountId, ExpenseCategory } from "@/lib/types";
import { accounts, getAccountById } from "@/lib/accounts";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  LineChart, Line, XAxis, YAxis, CartesianGrid 
} from "recharts";

// Konfigurasi
const accountOrder: AccountId[] = ['c', 'b', 'g', 's', 'jy', 'e', 'sea', 'q', 'j', 'k', 'h', 'sb', 'poe', 'kb', 'i', 'cla', 'p'];
const expenseCategories: ExpenseCategory[] = ['Home & Family', 'Food & Drinks', 'Transportation', 'Shopping', 'Utilities', 'Medical', 'Investments', '𝓡', 'Other'];
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c'];

export default function FinancePage() {
  // Navigation State
  const [view, setView] = useState<'dashboard' | 'accounts' | 'categories'>('dashboard');
  const [accountViewMode, setAccountViewMode] = useState<'card' | 'ledger'>('card');
  const [filterAccountId, setFilterAccountId] = useState<AccountId | null>(null);

  // Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAccount, setSelectedAccount] = useState<AccountId>('g');
  const [destinationAccount, setDestinationAccount] = useState<AccountId>('s');
  const [hasCashback, setHasCashback] = useState(false);
  const [cashbackAmount, setCashbackAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory>('Food & Drinks');
  
  // Action Menu State
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [activeTransactionId, setActiveTransactionId] = useState<string | null>(null);

  // 1. Load Data
  useEffect(() => {
    const saved = localStorage.getItem("thelife-finance");
    if (saved) setTransactions(JSON.parse(saved));
    else setTransactions([
      { id: '1', date: new Date().toISOString().split('T')[0], description: 'initial balance', accountId: 'g', type: 'income', amount: 18565800, category: 'Other' },
    ]);
  }, []);

  // 2. Save Data
  useEffect(() => {
    if (transactions.length > 0) localStorage.setItem("thelife-finance", JSON.stringify(transactions));
  }, [transactions]);

  // 3. Calculations for Dashboard
  const stats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let totalBalance = 0;
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    const categoryTotals: Record<string, number> = {};

    transactions.forEach(t => {
      const tDate = new Date(t.date);
      const isCurrentMonth = tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;

      if (t.type === 'income') {
        totalBalance += t.amount;
        if (isCurrentMonth) monthlyIncome += t.amount;
      } else if (t.type === 'expense') {
        totalBalance -= t.amount;
        if (isCurrentMonth) {
          monthlyExpense += t.amount;
          const cat = t.category || 'Other';
          categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
        }
      } else if (t.type === 'transfer') {
        // Transfer doesn't change total balance in this simple logic
      }
    });

    const pieData = Object.keys(categoryTotals).map(key => ({ name: key, value: categoryTotals[key] }));
    return { totalBalance, monthlyIncome, monthlyExpense, pieData };
  }, [transactions]);

  // 4. Calculations for Account Balances
  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    accounts.forEach(acc => balances[acc.id] = 0);
    transactions.forEach(t => {
      if (t.type === 'income') balances[t.accountId] = (balances[t.accountId] || 0) + t.amount;
      else if (t.type === 'expense') balances[t.accountId] = (balances[t.accountId] || 0) - t.amount;
      else if (t.type === 'transfer') {
        balances[t.accountId] = (balances[t.accountId] || 0) - t.amount;
        const destId = (t as any).destinationId;
        if (destId) balances[destId] = (balances[destId] || 0) + t.amount;
      }
    });
    return balances;
  }, [transactions]);

  // 5. Line Chart Data
  const lineChartData = useMemo(() => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayExpense = transactions.filter(t => t.date === dateStr && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      last7Days.push({ name: d.toLocaleDateString('en-US', { weekday: 'short' }), expense: dayExpense });
    }
    return last7Days;
  }, [transactions]);

  // 6. Grouped Transactions (For Card View)
  const groupedTransactions = useMemo(() => {
    let filtered = transactions;
    if (filterAccountId) filtered = transactions.filter(t => t.accountId === filterAccountId || (t.type === 'transfer' && (t as any).destinationId === filterAccountId));
    
    const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const groups: Record<string, Transaction[]> = {};
    sorted.forEach(t => {
      if (!groups[t.date]) groups[t.date] = [];
      groups[t.date].push(t);
    });
    return groups;
  }, [transactions, filterAccountId]);

  // Handlers
  const handleAdd = () => {
    if (!amount) return;
    const newTrans: Transaction = {
      id: Date.now().toString(),
      date,
      description: formType === 'transfer' ? `transfer to ${destinationAccount.toUpperCase()}` : desc,
      accountId: selectedAccount,
      type: formType,
      amount: parseFloat(amount),
      category: formType === 'expense' ? selectedCategory : undefined
    };
    if (formType === 'transfer') (newTrans as any).destinationId = destinationAccount;

    const newTransactions = [newTrans, ...transactions];

    if (formType === 'expense' && hasCashback && cashbackAmount) {
      const cashbackTrans: Transaction = {
        id: (Date.now() + 1).toString(),
        date,
        description: `cashback ${selectedAccount}`,
        accountId: selectedAccount,
        type: 'income',
        amount: parseFloat(cashbackAmount)
      };
      // Insert right after the main expense
      newTransactions.splice(1, 0, cashbackTrans);
    }

    setTransactions(newTransactions);
    setShowForm(false);
    setAmount(""); setDesc(""); setHasCashback(false); setCashbackAmount("");
  };

  const handleActionOpen = (id: string) => { setActiveTransactionId(id); setActionMenuOpen(true); };
  
  const handleDelete = () => {
    if (!activeTransactionId) return;
    setTransactions(transactions.filter(t => t.id !== activeTransactionId));
    setActionMenuOpen(false); setActiveTransactionId(null);
  };

  const handleEdit = () => {
    const t = transactions.find(x => x.id === activeTransactionId);
    if (!t) return;
    setFormType(t.type); setDesc(t.description); setAmount(t.amount.toString());
    setDate(t.date); setSelectedAccount(t.accountId);
    if (t.category) setSelectedCategory(t.category);
    setShowForm(true); setActionMenuOpen(false); setActiveTransactionId(null);
  };

  // Helpers
  const formatRupiah = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  const formatDateCard = (dateStr: string) => new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const formatDateLedger = (dateStr: string) => new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace('.', '');

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
                  <Tooltip formatter={(value: any) => formatRupiah(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 lowercase">expense trend (last 7 days)</h3>
            <div className="h-64 overflow-x-auto">
              <ResponsiveContainer width="100%" height="100%" minWidth={300}>
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{fontSize: 12}} />
                  <YAxis tick={{fontSize: 12}} domain={[0, 'auto']} />
                  <Tooltip formatter={(value: any) => formatRupiah(Number(value))} />
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
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => { setView('dashboard'); setFilterAccountId(null); }} className="text-sm text-blue-600 font-bold">← back</button>
            <h2 className="text-2xl font-bold text-gray-800 lowercase">accounts</h2>
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
                    {groupedTransactions[date].map((t) => {
                      const acc = getAccountById(t.accountId);
                      return (
                        <div key={t.id} onContextMenu={(e) => { e.preventDefault(); handleActionOpen(t.id); }} className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center active:bg-gray-50 transition cursor-pointer">
                          <div className={`w-10 h-10 rounded-full ${acc?.colorClass} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>{acc?.name}</div>
                          <div className="flex-1 mx-4 min-w-0"><p className="font-bold text-gray-800 text-sm lowercase truncate">{t.description}</p></div>
                          <p className={`font-bold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>{t.type === 'income' ? '+' : '-'}{formatRupiah(t.amount)}</p>
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
                  {Object.values(groupedTransactions).flat().sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((t) => {
                    const acc = getAccountById(t.accountId);
                    return (
                      <tr key={t.id} onContextMenu={(e) => { e.preventDefault(); handleActionOpen(t.id); }} className="hover:bg-gray-50 cursor-pointer">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{formatDateLedger(t.date)}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 lowercase max-w-[150px] truncate">{t.description}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs text-white font-bold ${acc?.colorClass}`}>{acc?.name}</span></td>
                        <td className="px-4 py-3 text-right text-green-600 font-medium">{t.type === 'income' ? formatRupiah(t.amount) : '-'}</td>
                        <td className="px-4 py-3 text-right text-red-500 font-medium">{t.type === 'expense' ? formatRupiah(t.amount) : '-'}</td>
                        <td className="px-4 py-3 text-right text-gray-500 text-xs lowercase">{t.category || '-'}</td>
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
            <button onClick={() => { setFormType('income'); setShowForm(true); setShowMenu(false); }} className="bg-white/80 backdrop-blur-md border border-white/20 shadow-lg px-4 py-2 rounded-full text-green-600 font-bold text-sm lowercase">income</button>
            <button onClick={() => { setFormType('expense'); setShowForm(true); setShowMenu(false); }} className="bg-white/80 backdrop-blur-md border border-white/20 shadow-lg px-4 py-2 rounded-full text-red-600 font-bold text-sm lowercase">expense</button>
            <button onClick={() => { setFormType('transfer'); setShowForm(true); setShowMenu(false); }} className="bg-white/80 backdrop-blur-md border border-white/20 shadow-lg px-4 py-2 rounded-full text-blue-600 font-bold text-sm lowercase">transfer</button>
          </div>
        )}
        <button onClick={() => setShowMenu(!showMenu)} className="w-14 h-14 rounded-full bg-white/30 backdrop-blur-lg border border-white/40 shadow-xl flex items-center justify-center text-3xl text-gray-800 hover:scale-105 transition active:scale-95">
          {showMenu || showForm ? '✕' : '+'}
        </button>
      </div>

      {/* ================= MODAL FORM ================= */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 transition bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 z-10">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="font-bold text-xl text-gray-800 mb-5 lowercase pr-8">add {formType}</h3>
            
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
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={`w-full bg-white border border-gray-200 rounded-xl pl-12 pr-4 py-3 outline-none focus:border-blue-500 text-lg font-bold transition ${amount ? 'text-gray-900' : 'text-gray-400'}`} />
                </div>
              </div>
              {formType === 'expense' && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block lowercase">category</label>
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value as ExpenseCategory)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-gray-900 font-medium transition">
                    {expenseCategories.map(c => <option key={c} value={c} className="text-gray-900">{c}</option>)}
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
                        <input type="number" value={cashbackAmount} onChange={(e) => setCashbackAmount(e.target.value)} placeholder="0" className={`w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 outline-none focus:border-blue-500 font-bold transition ${cashbackAmount ? 'text-gray-900' : 'text-gray-400'}`} />
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-3 mt-6 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition lowercase">cancel</button>
                <button onClick={handleAdd} className="flex-[2] bg-gray-900 text-white py-3.5 rounded-xl font-bold hover:bg-black transition shadow-lg lowercase">save transaction</button>
              </div>
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
              <button onClick={handleEdit} className="w-full py-3.5 rounded-xl bg-gray-100 text-gray-800 font-bold hover:bg-gray-200 transition lowercase">edit transaksi</button>
              <button onClick={handleDelete} className="w-full py-3.5 rounded-xl bg-red-50 text-red-600 font-bold hover:bg-red-100 transition lowercase">hapus transaksi</button>
              <button onClick={() => setActionMenuOpen(false)} className="w-full py-3.5 rounded-xl text-gray-500 font-bold hover:bg-gray-50 transition lowercase">batal</button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}