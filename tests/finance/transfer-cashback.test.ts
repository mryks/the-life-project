import { describe, it, expect } from 'vitest';
import type { FinancialEvent, IncomeEvent, TransferEvent } from '@/lib/types';
import {
  validateFinancialEvents,
  deriveLedgerEntries,
  getAccountBalances,
  getAtomicReorderUnits,
  reorderFinancialEvents,
  deleteFinancialEvent,
  replaceFinancialEvent,
} from '@/lib/finance';

const createTransfer = (overrides?: Partial<TransferEvent>): TransferEvent => ({
  id: 'trf-1',
  date: '2026-10-20',
  description: 'Transfer to S',
  amount: 200_000,
  type: 'transfer',
  sourceAccountId: 'g',
  destinationAccountId: 's',
  ...overrides,
});

const createCashback = (overrides?: Partial<IncomeEvent>): IncomeEvent => ({
  id: 'cb-1',
  date: '2026-10-20',
  description: 'Cashback G',
  amount: 10_000,
  type: 'income',
  accountId: 'g',
  category: 'Cashback',
  relatedEventId: 'trf-1',
  ...overrides,
});

describe('Transfer with Cashback', () => {
  describe('Validation & Relationship Integrity', () => {
    it('accepts a transfer with cashback credited to the source account', () => {
      const transfer = createTransfer();
      const cashback = createCashback();
      expect(validateFinancialEvents([transfer, cashback])).toBe(true);
    });

    it('rejects cashback when credited to the destination account', () => {
      const transfer = createTransfer({ sourceAccountId: 'g', destinationAccountId: 's' });
      const cashback = createCashback({ accountId: 's' }); // 's' is destination
      expect(validateFinancialEvents([transfer, cashback])).toBe(false);
    });

    it('rejects cashback when credited to an unrelated third account', () => {
      const transfer = createTransfer({ sourceAccountId: 'g', destinationAccountId: 's' });
      const cashback = createCashback({ accountId: 'b' });
      expect(validateFinancialEvents([transfer, cashback])).toBe(false);
    });

    it('enforces maximum one cashback per transfer event', () => {
      const transfer = createTransfer();
      const cb1 = createCashback({ id: 'cb-1', amount: 5_000 });
      const cb2 = createCashback({ id: 'cb-2', amount: 5_000 });
      expect(validateFinancialEvents([transfer, cb1, cb2])).toBe(false);
    });

    it('rejects orphan cashback when parent transfer does not exist', () => {
      const cashback = createCashback({ relatedEventId: 'non-existent-trf' });
      expect(validateFinancialEvents([cashback])).toBe(false);
    });
  });

  describe('Ledger Entries & Balance Derivation', () => {
    it('derives correct ledger entries and balances for transfer + admin fee + cashback', () => {
      const transfer = createTransfer({
        amount: 200_000,
        adminFee: 2_500,
        sourceAccountId: 'g',
        destinationAccountId: 's',
      });
      const cashback = createCashback({
        amount: 10_000,
        accountId: 'g',
      });

      const entries = deriveLedgerEntries([transfer, cashback]);
      expect(entries).toHaveLength(4);

      // 1. Transfer Out from source
      expect(entries[0]).toMatchObject({
        eventId: 'trf-1',
        accountId: 'g',
        amount: 200_000,
        direction: 'out',
        eventType: 'transfer',
        counterpartyAccountId: 's',
      });

      // 2. Transfer In to destination
      expect(entries[1]).toMatchObject({
        eventId: 'trf-1',
        accountId: 's',
        amount: 200_000,
        direction: 'in',
        eventType: 'transfer',
        counterpartyAccountId: 'g',
      });

      // 3. Admin Fee from source
      expect(entries[2]).toMatchObject({
        eventId: 'trf-1',
        accountId: 'g',
        amount: 2_500,
        direction: 'out',
        eventType: 'expense',
        category: 'Other',
      });

      // 4. Cashback to source
      expect(entries[3]).toMatchObject({
        eventId: 'cb-1',
        accountId: 'g',
        amount: 10_000,
        direction: 'in',
        eventType: 'income',
        category: 'Cashback',
      });

      // Balances
      const balances = getAccountBalances([transfer, cashback]);
      // Source 'g': -200_000 (transfer out) - 2_500 (admin fee) + 10_000 (cashback) = -192_500
      expect(balances.g).toBe(-192_500);
      // Destination 's': +200_000
      expect(balances.s).toBe(200_000);
    });
  });

  describe('Atomic Reordering', () => {
    it('groups transfer and linked cashback into a single atomic reorder unit', () => {
      const transfer = createTransfer();
      const cashback = createCashback();
      const units = getAtomicReorderUnits([transfer, cashback]);

      expect(units).toHaveLength(1);
      expect(units[0]).toMatchObject({
        id: 'trf-1',
        type: 'transfer-with-cashback',
        primaryEvent: transfer,
        events: [transfer, cashback],
      });
    });

    it('reorders transfer-with-cashback atomically when moved before another event', () => {
      const otherExpense: FinancialEvent = {
        id: 'exp-1',
        date: '2026-10-20',
        description: 'Groceries',
        amount: 50_000,
        type: 'expense',
        accountId: 'g',
        category: 'Food & Drinks',
      };
      const transfer = createTransfer();
      const cashback = createCashback();

      // Initial: [otherExpense, transfer, cashback]
      const events: FinancialEvent[] = [otherExpense, transfer, cashback];

      // Move transfer before otherExpense
      const reordered = reorderFinancialEvents(events, transfer.id, otherExpense.id, 'before');

      // Both transfer AND cashback must move before otherExpense
      expect(reordered.map((e) => e.id)).toEqual(['trf-1', 'cb-1', 'exp-1']);
      expect(validateFinancialEvents(reordered)).toBe(true);
    });

    it('reorders another event around transfer-with-cashback without splitting the unit', () => {
      const transfer = createTransfer();
      const cashback = createCashback();
      const otherIncome: FinancialEvent = {
        id: 'inc-1',
        date: '2026-10-20',
        description: 'Bonus',
        amount: 100_000,
        type: 'income',
        accountId: 'g',
        category: 'Salary',
      };

      // Initial: [transfer, cashback, otherIncome]
      const events: FinancialEvent[] = [transfer, cashback, otherIncome];

      // Move otherIncome before transfer
      const reordered = reorderFinancialEvents(events, otherIncome.id, transfer.id, 'before');

      // otherIncome comes first, then transfer and cashback stay together
      expect(reordered.map((e) => e.id)).toEqual(['inc-1', 'trf-1', 'cb-1']);
      expect(validateFinancialEvents(reordered)).toBe(true);
    });
  });

  describe('Replace & Edit Behavior', () => {
    it('updates linked cashback date and source account when transfer is edited', () => {
      const transfer = createTransfer({ sourceAccountId: 'g', date: '2026-10-20' });
      const cashback = createCashback({ accountId: 'g', date: '2026-10-20' });
      const events = [transfer, cashback];

      const updatedTransfer: TransferEvent = {
        ...transfer,
        date: '2026-10-21',
        sourceAccountId: 'b',
      };

      const result = replaceFinancialEvent(events, updatedTransfer);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);

      const updatedCb = result!.find((e) => e.id === 'cb-1') as IncomeEvent;
      expect(updatedCb.date).toBe('2026-10-21');
      expect(updatedCb.accountId).toBe('b');
      expect(updatedCb.description).toBe('Cashback B');
      expect(validateFinancialEvents(result!)).toBe(true);
    });
  });

  describe('Cascading Deletion', () => {
    it('deletes linked cashback when parent transfer is deleted', () => {
      const transfer = createTransfer();
      const cashback = createCashback();
      const otherIncome: FinancialEvent = {
        id: 'inc-1',
        date: '2026-10-20',
        description: 'Salary',
        amount: 1_000_000,
        type: 'income',
        accountId: 'g',
        category: 'Salary',
      };

      const events = [transfer, cashback, otherIncome];
      const remaining = deleteFinancialEvent(events, transfer.id);

      expect(remaining.map((e) => e.id)).toEqual(['inc-1']);
      expect(validateFinancialEvents(remaining)).toBe(true);
    });
  });
});
