// src/lib/accounts.ts
import { Account } from './types';

export const accounts: Account[] = [
  { id: 's', name: 'S', colorClass: 'bg-gradient-to-br from-orange-400 to-red-500' },
  { id: 'b', name: 'B', colorClass: 'bg-gradient-to-br from-blue-500 to-teal-400' },
  { id: 'g', name: 'G', colorClass: 'bg-green-500' },
  { id: 'k', name: 'K', colorClass: 'bg-gradient-to-br from-amber-700 to-gray-500' },
  { id: 'e', name: 'E', colorClass: 'bg-gradient-to-br from-gray-200 to-gray-400' },
  { id: 'c', name: 'C', colorClass: 'bg-amber-800' },
  { id: 'q', name: 'Q', colorClass: 'bg-gradient-to-br from-pink-400 to-orange-400' },
  { id: 'jy', name: 'JY', colorClass: 'bg-gradient-to-br from-purple-500 to-pink-400' },
  { id: 'h', name: 'H', colorClass: 'bg-sky-300' },
  { id: 'j', name: 'J', colorClass: 'bg-gradient-to-br from-orange-400 to-yellow-400' },
  { id: 'p', name: 'P', colorClass: 'bg-purple-600' },
  { id: 'sb', name: 'SB', colorClass: 'bg-emerald-800' },
  { id: 'sea', name: 'SEA', colorClass: 'bg-gradient-to-br from-pink-100 to-orange-100' },
  { id: 'poe', name: 'POE', colorClass: 'bg-red-900' },
  { id: 'cla', name: 'CLA', colorClass: 'bg-lime-400' },
  { id: 'kb', name: 'KB', colorClass: 'bg-yellow-400' },
  { id: 'i', name: 'I', colorClass: 'bg-gradient-to-br from-red-800 to-amber-900' },
];

// Helper untuk mencari akun berdasarkan ID
export const getAccountById = (id: string) => accounts.find(acc => acc.id === id);