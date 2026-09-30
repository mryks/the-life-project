// src/lib/types.ts

export type AccountId = 's' | 'b' | 'g' | 'k' | 'e' | 'c' | 'q' | 'jy' | 'h' | 'j' | 'p' | 'sb' | 'sea' | 'poe' | 'cla' | 'kb' | 'i';

export type ExpenseCategory = 'Home & Family' | 'Food & Drinks' | 'Transportation' | 'Shopping' | 'Utilities' | 'Medical' | 'Investments' | '𝓡' | 'Other';

export const incomeCategories = ['Salary', 'Investment', 'Allowance', 'Cashback', 'Others'] as const;
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
}

export interface RefundEvent extends FinancialEventBase {
  type: 'refund';
  accountId: AccountId;
  relatedEventId: string;
}

export const OPENING_BALANCE_DATE = '2026-09-30';
export const GO_LIVE_DATE = '2026-10-01';

export interface OpeningBalanceEvent extends FinancialEventBase {
  type: 'opening-balance';
  accountId: AccountId;
  date: typeof OPENING_BALANCE_DATE;
}

export type FinancialEvent = IncomeEvent | ExpenseEvent | TransferEvent | RefundEvent | OpeningBalanceEvent;

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

export interface Account {
  id: AccountId;
  name: string;
  colorClass: string;
}

export interface FinancialBackupEnvelope {
  version: 2;
  exportedAt: string;
  events: FinancialEvent[];
}

export interface BackupSummary {
  totalEvents: number;
  openingBalanceAccounts: number;
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
  refundCount: number;
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
