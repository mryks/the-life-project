// src/lib/types.ts

export type AccountId = 's' | 'b' | 'g' | 'k' | 'e' | 'c' | 'q' | 'jy' | 'h' | 'j' | 'p' | 'sb' | 'sea' | 'poe' | 'cla' | 'kb' | 'i';

export type ExpenseCategory = 'Home & Family' | 'Food & Drinks' | 'Transportation' | 'Personal Care' | 'Leisure' | 'Medical' | '𝓡' | 'Other';

export const incomeCategories = ['Salary', 'Allowance', 'Cashback', 'Others'] as const;
export type IncomeCategory = typeof incomeCategories[number];

interface FinancialEventBase {
  id: string;
  date: string;
  description: string;
  amount: number;
}

export interface IncomeEvent extends FinancialEventBase {
  type: 'income';
  accountId: AccountId;
  category: IncomeCategory;
  relatedEventId?: string;
}

export interface ExpenseEvent extends FinancialEventBase {
  type: 'expense';
  accountId: AccountId;
  category: ExpenseCategory;
}

export interface TransferEvent extends FinancialEventBase {
  type: 'transfer';
  sourceAccountId: AccountId;
  destinationAccountId: AccountId;
  adminFee?: number;
}

export interface RefundEvent extends FinancialEventBase {
  type: 'refund';
  accountId: AccountId;
  relatedEventId: string;
}

export type FinancialEvent = IncomeEvent | ExpenseEvent | TransferEvent | RefundEvent;

export interface LedgerEntry {
  eventId: string;
  date: string;
  description: string;
  accountId: AccountId;
  amount: number;
  direction: 'in' | 'out';
  eventType: FinancialEvent['type'];
  category?: ExpenseCategory | IncomeCategory;
  counterpartyAccountId?: AccountId;
}

export type AccountGroup = 'liquid' | 'investment';

export interface Account {
  id: AccountId;
  name: string;
  fullName: string;
  colorClass: string;
  group: AccountGroup;
}

export interface FinancialBackupEnvelope {
  version: 2;
  exportedAt: string;
  events: FinancialEvent[];
}

export interface BackupSummary {
  totalEvents: number;
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
  refundCount: number;
  openingBalanceAccounts?: number;
}

export type BackupParseResult =
  | {
      success: true;
      version: number;
      exportedAt?: string;
      events: FinancialEvent[];
      summary: BackupSummary;
    }
  | {
      success: false;
      error: string;
    };

export interface ReorderUnit {
  id: string;
  type: 'income' | 'expense' | 'expense-with-cashback' | 'transfer' | 'refund';
  events: FinancialEvent[];
  primaryEvent: FinancialEvent;
}
