// src/lib/accounts.ts
import { Account, AccountId } from './types';

export const accounts: Account[] = [
  // 10 Liquid Accounts (Kas, Bank, E-Wallet, Personal)
  { id: 'c', name: 'C', fullName: 'Cash', colorClass: 'bg-amber-800', group: 'liquid' },
  { id: 'b', name: 'B', fullName: 'BNI', colorClass: 'bg-gradient-to-br from-blue-500 to-teal-400', group: 'liquid' },
  { id: 'g', name: 'G', fullName: 'GoPay', colorClass: 'bg-green-500', group: 'liquid' },
  { id: 's', name: 'S', fullName: 'ShopeePay', colorClass: 'bg-gradient-to-br from-orange-400 to-red-500', group: 'liquid' },
  { id: 'jy', name: 'JY', fullName: 'Jago Yoel', colorClass: 'bg-gradient-to-br from-purple-500 to-pink-400', group: 'liquid' },
  { id: 'e', name: 'E', fullName: 'e-money', colorClass: 'bg-gradient-to-br from-gray-200 to-gray-400', group: 'liquid' },
  { id: 'sea', name: 'SEA', fullName: 'SeaBank', colorClass: 'bg-gradient-to-br from-pink-100 to-orange-100', group: 'liquid' },
  { id: 'q', name: 'Q', fullName: 'Bank Saqu', colorClass: 'bg-gradient-to-br from-pink-400 to-orange-400', group: 'liquid' },
  { id: 'j', name: 'J', fullName: 'Jago', colorClass: 'bg-gradient-to-br from-orange-400 to-yellow-400', group: 'liquid' },
  { id: 'cla', name: 'CLA', fullName: 'Clara', colorClass: 'bg-lime-400', group: 'liquid' },

  // 7 Investment Accounts (Sekuritas, Saham, Kripto, Portofolio)
  { id: 'k', name: 'K', fullName: 'KOINS', colorClass: 'bg-gradient-to-br from-amber-700 to-gray-500', group: 'investment' },
  { id: 'h', name: 'H', fullName: 'HP', colorClass: 'bg-sky-300', group: 'investment' },
  { id: 'sb', name: 'SB', fullName: 'Stockbit', colorClass: 'bg-emerald-800', group: 'investment' },
  { id: 'poe', name: 'POE', fullName: 'POEMS', colorClass: 'bg-red-900', group: 'investment' },
  { id: 'kb', name: 'KB', fullName: 'KB', colorClass: 'bg-yellow-400', group: 'investment' },
  { id: 'i', name: 'I', fullName: 'IPOT', colorClass: 'bg-gradient-to-br from-red-800 to-amber-900', group: 'investment' },
  { id: 'p', name: 'P', fullName: 'Portfolio', colorClass: 'bg-purple-600', group: 'investment' },
];

export const liquidAccounts = accounts.filter((acc) => acc.group === 'liquid');
export const investmentAccounts = accounts.filter((acc) => acc.group === 'investment');

export const liquidAccountIds: AccountId[] = liquidAccounts.map((acc) => acc.id);
export const investmentAccountIds: AccountId[] = investmentAccounts.map((acc) => acc.id);

export const isLiquidAccount = (id: AccountId): boolean =>
  accounts.find((acc) => acc.id === id)?.group === 'liquid';

export const isInvestmentAccount = (id: AccountId): boolean =>
  accounts.find((acc) => acc.id === id)?.group === 'investment';

// Helper untuk mencari akun berdasarkan ID
export const getAccountById = (id: string): Account | undefined =>
  accounts.find((acc) => acc.id === id);

export const isAccountId = (value: unknown): value is AccountId =>
  typeof value === 'string' && accounts.some((acc) => acc.id === value);