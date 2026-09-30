import type {
  ExpenseEvent,
  IncomeEvent,
  OpeningBalanceEvent,
  RefundEvent,
  TransferEvent,
} from '@/lib/types';
import { OPENING_BALANCE_DATE } from '@/lib/types';

export const createIncome = (overrides?: Partial<IncomeEvent>): IncomeEvent => ({
  id: 'inc-test-1',
  date: '2026-10-02',
  description: 'Salary',
  amount: 5_000_000,
  type: 'income',
  accountId: 'g',
  category: 'Salary',
  ...overrides,
});

export const createExpense = (overrides?: Partial<ExpenseEvent>): ExpenseEvent => ({
  id: 'exp-test-1',
  date: '2026-10-02',
  description: 'Groceries',
  amount: 250_000,
  type: 'expense',
  accountId: 'g',
  category: 'Food & Drinks',
  ...overrides,
});

export const createTransfer = (overrides?: Partial<TransferEvent>): TransferEvent => ({
  id: 'trf-test-1',
  date: '2026-10-02',
  description: 'Transfer G to S',
  amount: 100_000,
  type: 'transfer',
  sourceAccountId: 'g',
  destinationAccountId: 's',
  ...overrides,
});

export const createRefund = (overrides?: Partial<RefundEvent>): RefundEvent => ({
  id: 'ref-test-1',
  date: '2026-10-02',
  description: 'Refund',
  amount: 50_000,
  type: 'refund',
  accountId: 'g',
  relatedEventId: 'exp-test-1',
  ...overrides,
});

export const createCashback = (overrides?: Partial<IncomeEvent>): IncomeEvent => ({
  id: 'cb-test-1',
  date: '2026-10-02',
  description: 'Cashback G',
  amount: 25_000,
  type: 'income',
  accountId: 'g',
  category: 'Cashback',
  relatedEventId: 'exp-test-1',
  ...overrides,
});

export const createOpeningBalance = (overrides?: Partial<OpeningBalanceEvent>): OpeningBalanceEvent => ({
  id: 'op-test-1',
  date: OPENING_BALANCE_DATE,
  description: 'Opening balance',
  amount: 1_000_000,
  type: 'opening-balance',
  accountId: 'g',
  ...overrides,
});
