// src/lib/types.ts

export type AccountId = 's' | 'b' | 'g' | 'k' | 'e' | 'c' | 'q' | 'jy' | 'h' | 'j' | 'p' | 'sb' | 'sea' | 'poe' | 'cla' | 'kb' | 'i';

export type TransactionType = 'income' | 'expense' | 'transfer';

// Daftar Kategori Expense
export type ExpenseCategory = 'Home & Family' | 'Food & Drinks' | 'Transportation' | 'Shopping' | 'Utilities' | 'Medical' | 'Investments' | '𝓡' | 'Other';

export interface Transaction {
  id: string;
  date: string; // Format: YYYY-MM-DD
  description: string;
  accountId: AccountId;
  type: TransactionType;
  amount: number;
  category?: ExpenseCategory; // Tambahan baru untuk kategori
}

export interface Account {
  id: AccountId;
  name: string;
  colorClass: string;
}