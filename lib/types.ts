// src/lib/types.ts

// Daftar ID Akun yang valid
export type AccountId = 's' | 'b' | 'g' | 'k' | 'e' | 'c' | 'q' | 'jy' | 'h' | 'j' | 'p' | 'sb' | 'sea' | 'poe' | 'cla' | 'kb' | 'i';

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
  id: string;
  date: string; // Format: YYYY-MM-DD untuk sorting
  description: string;
  accountId: AccountId;
  type: TransactionType;
  amount: number;
}

export interface Account {
  id: AccountId;
  name: string;
  colorClass: string; // Class Tailwind untuk warna/gradasi
}