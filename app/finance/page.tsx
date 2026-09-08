"use client";

import { useState, useEffect, useMemo } from "react";
import BottomNav from "@/components/BottomNav";
import { Transaction, AccountId } from "@/lib/types";
import { accounts, getAccountById } from "@/lib/accounts";

export default function FinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'ledger'>('cards');
  const [showMenu, setShowMenu] = useState(false);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // State untuk Akun (Ini yang sebelumnya hilang/terlewat)
  const [selectedAccount, setSelectedAccount] = useState<AccountId>('g'); // Default akun asal
  const [destinationAccount, setDestinationAccount] = useState<AccountId>('s'); // Default akun tujuan

  // 1. Load Data
  useEffect(() => {
    const saved = localStorage.getItem("thelife-finance");
    if (saved) {
      setTransactions(JSON.parse(saved));
    } else {
      // Data Dummy Awal
      setTransactions([
        { id: '1', date: '2026-07-01', description: 'Saldo awal', accountId: 'g', type: 'income', amount: 18565800 },
      ]);
    }
  }, []);

  // 2. Save Data
  useEffect(() => {
    if (transactions.length > 0) localStorage.setItem("thelife-finance", JSON.stringify(transactions));
  }, [transactions]);

  // 3. Hitung Saldo Per Akun & Total
  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    accounts.forEach(acc => balances[acc.id] = 0);
    
    let totalBalance = 0;

    transactions.forEach(t => {
      if (t.type === 'income') {
        balances[t.accountId] = (balances[t.accountId] || 0) + t.amount;
        totalBalance += t.amount;
      } else if (t.type === 'expense') {
        balances[t.accountId] = (balances[t.accountId] || 0) - t.amount;
        totalBalance -= t.amount;
      }
      // Transfer tidak mengubah total balance global di versi sederhana ini
    });
    return { balances, totalBalance };
  }, [transactions]);

  // 4. Hitung Saldo Berjalan untuk Ledger (Running Balance)
  const ledgerData = useMemo(() => {
    // Sort by date
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let runningBalance = 0;
    
    return sorted.map(t => {
      if (t.type === 'income') runningBalance += t.amount;
      else if (t.type === 'expense') runningBalance -= t.amount;
      
      return { ...t, runningBalance };
    });
  }, [transactions]);

  const handleAdd = () => {
    if (!amount) return; // Transfer tidak wajib punya desc, tapi wajib amount
    
    const newTrans: Transaction = {
      id: Date.now().toString(),
      date,
      description: formType === 'transfer' ? `Transfer to ${destinationAccount.toUpperCase()}` : desc,
      accountId: selectedAccount, // Ini adalah akun Asal (untuk transfer)
      type: formType,
      amount: parseFloat(amount)
    };
    
    // Hack sederhana: Kita simpan ID tujuan di dalam object transaksi (walaupun tipe data kita belum definisikan, JS mengizinkan ini untuk MVP)
    if (formType === 'transfer') {
      (newTrans as any).destinationId = destinationAccount;
    }

    setTransactions([newTrans, ...transactions]);
    setShowForm(false);
    setAmount("");
    setDesc("");
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-24 relative">
      
      {/* Header: Total Balance */}
      <div className="bg-white p-6 pb-6 shadow-sm">
        <h1 className="text-xl font-medium text-gray-500">Total Balance</h1>
        <h2 className="text-4xl font-black text-gray-900 mt-1">
          {formatRupiah(accountBalances.totalBalance)}
        </h2>
      </div>

      {/* Account Balances (Horizontal Scroll) */}
      <div className="py-4 pl-6">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Saldo Akun</h3>
        <div className="flex gap-3 overflow-x-auto pb-4 pr-6 scrollbar-hide">
          <div className="flex gap-3 overflow-x-auto pb-4 pr-6 scrollbar-hide"></div>
          {accounts.map(acc => (
            <div key={acc.id} className={`flex-shrink-0 w-24 h-32 rounded-2xl ${acc.colorClass} p-3 flex flex-col justify-between shadow-md text-white`}>
              <span className="font-bold text-lg">{acc.name}</span>
              <span className="text-xs font-medium opacity-90 truncate">
                {formatRupiah(accountBalances.balances[acc.id] || 0)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* View Toggle */}
      <div className="px-6 mb-4">
        <div className="bg-gray-200 p-1 rounded-xl flex">
          <button 
            onClick={() => setViewMode('cards')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${viewMode === 'cards' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >
            Card View
          </button>
          <button 
            onClick={() => setViewMode('ledger')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${viewMode === 'ledger' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >
            Ledger
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="px-6">
        {viewMode === 'cards' ? (
          // CARD VIEW
          <div className="space-y-3">
            {transactions.map((t) => {
              const acc = getAccountById(t.accountId);
              return (
                <div key={t.id} className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${acc?.colorClass} flex items-center justify-center text-white font-bold text-xs`}>
                      {acc?.name}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{t.description}</p>
                      <p className="text-xs text-gray-400">{t.date} • {acc?.name}</p>
                    </div>
                  </div>
                  <p className={`font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatRupiah(t.amount)}
                  </p>
                </div>
              );
            })}
          </div>
                ) : (
          // LEDGER VIEW (Tabel)
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Keterangan</th>
                  <th className="px-4 py-3">Akun</th>
                  <th className="px-4 py-3 text-right">In</th>
                  <th className="px-4 py-3 text-right">Out</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ledgerData.map((t) => {
                  const acc = getAccountById(t.accountId);
                  const destAcc = getAccountById((t as any).destinationId);

                  // Logic Tampilan untuk Transfer
                  if (t.type === 'transfer') {
                    return (
                      <tr key={t.id} className="bg-gray-50/50">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{t.date}</td>
                        <td className="px-4 py-3 font-medium text-gray-500 italic">Transfer</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs text-white font-bold ${acc?.colorClass}`}>{acc?.name}</span>
                            <span className="text-gray-400 text-xs">➔</span>
                            <span className={`px-2 py-1 rounded text-xs text-white font-bold ${destAcc?.colorClass}`}>{destAcc?.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-300">-</td>
                        <td className="px-4 py-3 text-right text-gray-300">-</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-700">
                          {formatRupiah(t.runningBalance)}
                        </td>
                      </tr>
                    );
                  }

                  // Logic Tampilan Normal (Income/Expense)
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{t.date}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{t.description}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs text-white font-bold ${acc?.colorClass}`}>
                          {acc?.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">
                        {t.type === 'income' ? formatRupiah(t.amount) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-red-500 font-medium">
                        {t.type === 'expense' ? formatRupiah(t.amount) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {formatRupiah(t.runningBalance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Action Button (Glass) */}
      <div className="fixed bottom-24 right-6 z-40 flex flex-col items-end gap-3">
        {showMenu && !showForm && (
          <div className="flex flex-col gap-2 mb-2">
            <button onClick={() => { setFormType('income'); setShowForm(true); setShowMenu(false); }} className="bg-white/80 backdrop-blur-md border border-white/20 shadow-lg px-4 py-2 rounded-full text-green-600 font-bold text-sm">
              💰 Income
            </button>
            <button onClick={() => { setFormType('expense'); setShowForm(true); setShowMenu(false); }} className="bg-white/80 backdrop-blur-md border border-white/20 shadow-lg px-4 py-2 rounded-full text-red-600 font-bold text-sm">
              💸 Expense
            </button>
            <button onClick={() => { setFormType('transfer'); setShowForm(true); setShowMenu(false); }} className="bg-white/80 backdrop-blur-md border border-white/20 shadow-lg px-4 py-2 rounded-full text-blue-600 font-bold text-sm">
              🔄 Transfer
            </button>
          </div>
        )}
        
        <button 
          onClick={() => setShowMenu(!showMenu)}
          className="w-14 h-14 rounded-full bg-white/30 backdrop-blur-lg border border-white/40 shadow-xl flex items-center justify-center text-3xl text-gray-800 hover:scale-105 transition active:scale-95"
        >
          {showMenu || showForm ? '✕' : '+'}
        </button>
      </div>

      {/* Add Transaction Modal */}
      {showForm && (
        // 1. Backdrop: Klik di sini akan menutup modal
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4"
          onClick={() => setShowForm(false)} 
        >
                    {/* 2. Modal Content */}
          <div 
            className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()} 
          >
            {/* 3. Tombol Silang (X) */}
            <button 
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 transition bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="font-bold text-xl text-gray-800 mb-5 capitalize pr-8">Add {formType}</h3>
            
            <div className="space-y-4">
              {/* Tanggal */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Tanggal</label>
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-gray-900 font-medium transition"
                />
              </div>

              {/* Nominal dengan Prefix Rp */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nominal</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">Rp</span>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className={`w-full bg-white border border-gray-200 rounded-xl pl-12 pr-4 py-3 outline-none focus:border-blue-500 text-lg font-bold transition ${amount ? 'text-gray-900' : 'text-gray-400'}`}
                  />
                </div>
              </div>
              
              {/* Keterangan (Hanya muncul jika BUKAN transfer) */}
              {formType !== 'transfer' && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Keterangan</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Makan siang" 
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-gray-900 placeholder-gray-400 transition"
                  />
                </div>
              )}
              
              {/* Account Selector (Asal) */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase">
                  {formType === 'transfer' ? 'Dari Akun (Asal)' : 'Pilih Akun'}
                </p>
                {/* Tambahkan class 'scrollbar-hide' di sini */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {accounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => setSelectedAccount(acc.id)}
                      className={`flex-shrink-0 w-10 h-10 rounded-full ${acc.colorClass} flex items-center justify-center text-white font-bold text-xs border-2 transition ${selectedAccount === acc.id ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                    >
                      {acc.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Account Selector (Tujuan - Khusus Transfer) */}
              {formType === 'transfer' && (
                <div className="mt-2">
                  <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Ke Akun (Tujuan)</p>
                  {/* Tambahkan class 'scrollbar-hide' di sini */}
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {accounts.map(acc => (
                      <button
                        key={acc.id}
                        onClick={() => setDestinationAccount(acc.id)}
                        className={`flex-shrink-0 w-10 h-10 rounded-full ${acc.colorClass} flex items-center justify-center text-white font-bold text-xs border-2 transition ${destinationAccount === acc.id ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                      >
                        {acc.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tombol Aksi */}
              <div className="flex gap-3 mt-6 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition">Batal</button>
                <button onClick={handleAdd} className="flex-[2] bg-gray-900 text-white py-3.5 rounded-xl font-bold hover:bg-black transition shadow-lg">Simpan Transaksi</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}