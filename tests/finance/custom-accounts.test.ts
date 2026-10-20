import { describe, it, expect, beforeEach } from 'vitest';
import type { FinancialEvent, IncomeEvent, ExpenseEvent, TransferEvent } from '@/lib/types';
import {
  accounts,
  getAllAccounts,
  getLiquidAccounts,
  getInvestmentAccounts,
  isDefaultAccount,
  isAccountId,
  isAccountInUse,
  addCustomAccount,
  deleteCustomAccount,
  readCustomAccounts,
  slugifyAccountId,
  isValidAccountIdFormat,
  fetchCloudCustomAccounts,
  pushCloudCustomAccounts,
  syncCustomAccountsWithCloud,
} from '@/lib/accounts';
import {
  getAccountBalances,
  getLiquidBalance,
  getInvestmentBalance,
  getNetWorth,
  createEventId,
  todayDate,
} from '@/lib/finance';

class LocalStorageMock {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const mockLocalStorage = new LocalStorageMock();

describe('Custom Accounts Feature', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: mockLocalStorage,
      dispatchEvent: () => true,
      CustomEvent: class CustomEvent {
        type: string;
        detail: unknown;
        constructor(type: string, init?: { detail?: unknown }) {
          this.type = type;
          this.detail = init?.detail;
        }
      },
    };
  });

  describe('Dynamic Account Registry & Retrieval', () => {
    it('returns all 17 default accounts when no custom accounts exist', () => {
      const all = getAllAccounts();
      expect(all.length).toBe(17);
      expect(all.map((a) => a.id)).toEqual(accounts.map((a) => a.id));
    });

    it('partitions default accounts into liquid and investment correctly', () => {
      const liquid = getLiquidAccounts();
      const investment = getInvestmentAccounts();
      expect(liquid.length).toBe(10);
      expect(investment.length).toBe(7);
      expect(liquid.every((a) => a.group === 'liquid')).toBe(true);
      expect(investment.every((a) => a.group === 'investment')).toBe(true);
    });

    it('slugifies account full names reliably', () => {
      expect(slugifyAccountId('Bank Jago')).toBe('bank-jago');
      expect(slugifyAccountId('  Pluang Crypto & Gold! ')).toBe('pluang-crypto-gold');
      expect(slugifyAccountId('Bank Syariah Indonesia')).toBe('bank-syariah-indonesia');
    });

    it('identifies default accounts strictly', () => {
      expect(isDefaultAccount('c')).toBe(true);
      expect(isDefaultAccount('b')).toBe(true);
      expect(isDefaultAccount('sea')).toBe(true);
      expect(isDefaultAccount('k')).toBe(true);
      expect(isDefaultAccount('custom-bank')).toBe(false);
    });

    it('recognizes valid account IDs and rejects unknown ones', () => {
      expect(isAccountId('c')).toBe(true);
      expect(isAccountId('b')).toBe(true);
      expect(isAccountId('non-existent-bank')).toBe(false);
    });
  });

  describe('Adding Custom Accounts', () => {
    it('successfully creates a custom liquid account and persists it', () => {
      const res = addCustomAccount({
        fullName: 'Bank Syariah Indonesia',
        name: 'BSI',
        group: 'liquid',
        colorClass: 'bg-teal-600',
        colorStyle: '#0d9488',
      });

      expect(res.success).toBe(true);
      expect(res.account).toBeDefined();
      expect(res.account?.id).toBe('bank-syariah-indonesia');
      expect(res.account?.fullName).toBe('Bank Syariah Indonesia');
      expect(res.account?.name).toBe('BSI');
      expect(res.account?.group).toBe('liquid');
      expect(res.account?.isCustom).toBe(true);
      expect(res.account?.colorStyle).toBe('#0d9488');

      // Check localStorage
      const stored = readCustomAccounts();
      expect(stored.length).toBe(1);
      expect(stored[0].id).toBe('bank-syariah-indonesia');

      // Check getAllAccounts includes it
      const all = getAllAccounts();
      expect(all.length).toBe(18);
      expect(getLiquidAccounts().length).toBe(11);
      expect(isAccountId('bank-syariah-indonesia')).toBe(true);
    });

    it('supports 2-color linear gradients for colorStyle', () => {
      const gradientStyle = 'linear-gradient(135deg, #0ea5e9, #2563eb)';
      const res = addCustomAccount({
        fullName: 'Revolut Global',
        name: 'REV',
        group: 'liquid',
        colorClass: 'bg-blue-600',
        colorStyle: gradientStyle,
      });

      expect(res.success).toBe(true);
      expect(res.account?.colorStyle).toBe(gradientStyle);
    });

    it('successfully creates a custom investment account', () => {
      const res = addCustomAccount({
        fullName: 'Interactive Brokers',
        name: 'IBKR',
        group: 'investment',
        colorClass: 'bg-rose-600',
      });

      expect(res.success).toBe(true);
      expect(res.account?.group).toBe('investment');
      expect(getInvestmentAccounts().length).toBe(8);
    });

    it('rejects empty or whitespace-only names', () => {
      const res = addCustomAccount({
        fullName: '   ',
        name: '',
        group: 'liquid',
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/cannot be empty/i);
    });

    it('rejects duplicate full names against default accounts', () => {
      const res = addCustomAccount({
        fullName: 'SeaBank',
        name: 'SEA2',
        group: 'liquid',
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/already exists/i);
    });

    it('rejects duplicate full names against existing custom accounts', () => {
      addCustomAccount({
        fullName: 'Super Bank',
        name: 'SBK',
        group: 'liquid',
      });

      const res = addCustomAccount({
        fullName: 'super bank',
        name: 'SB2',
        group: 'liquid',
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/already exists/i);
    });
  });

  describe('Account In Use & Deletion Guardrails', () => {
    it('prevents deletion of default accounts', () => {
      const res = deleteCustomAccount('b');
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/default system accounts cannot be deleted/i);
    });

    it('allows deleting an unused custom account', () => {
      addCustomAccount({
        fullName: 'Temp Wallet',
        name: 'TW',
        group: 'liquid',
      });

      expect(getAllAccounts().length).toBe(18);

      const delRes = deleteCustomAccount('temp-wallet');
      expect(delRes.success).toBe(true);
      expect(getAllAccounts().length).toBe(17);
    });

    it('blocks deleting a custom account used in an expense', () => {
      addCustomAccount({
        fullName: 'Aladin Bank',
        name: 'ALA',
        group: 'liquid',
      });

      const events: FinancialEvent[] = [
        {
          id: createEventId(),
          date: todayDate(),
          description: 'Coffee',
          amount: 25000,
          type: 'expense',
          category: 'Food & Drinks',
          accountId: 'aladin-bank',
        },
      ];

      expect(isAccountInUse('aladin-bank', events)).toBe(true);

      const delRes = deleteCustomAccount('aladin-bank', events);
      expect(delRes.success).toBe(false);
      expect(delRes.error).toMatch(/existing transactions/i);
    });

    it('blocks deleting a custom account used as transfer source or destination', () => {
      addCustomAccount({
        fullName: 'Wise Multi-Currency',
        name: 'WISE',
        group: 'liquid',
      });

      const events: FinancialEvent[] = [
        {
          id: createEventId(),
          date: todayDate(),
          description: 'Transfer to Wise',
          amount: 500000,
          type: 'transfer',
          sourceAccountId: 'b',
          destinationAccountId: 'wise-multi-currency',
        },
      ];

      expect(isAccountInUse('wise-multi-currency', events)).toBe(true);

      const delRes = deleteCustomAccount('wise-multi-currency', events);
      expect(delRes.success).toBe(false);
      expect(delRes.error).toMatch(/existing transactions/i);
    });
  });

  describe('Financial Calculations with Custom Accounts', () => {
    it('calculates opening balance and net liquid / investment balances dynamically', () => {
      const addRes = addCustomAccount({
        fullName: 'Bank Neo Commerce',
        name: 'BNC',
        group: 'liquid',
        colorClass: 'bg-yellow-500',
      });
      const bncId = addRes.account!.id;

      // Simulate opening balance transaction
      const openingIncome: IncomeEvent = {
        id: createEventId(),
        date: todayDate(),
        description: 'Initial balance - Bank Neo Commerce',
        amount: 1500000,
        type: 'income',
        accountId: bncId,
        category: 'Others',
      };

      const expense: ExpenseEvent = {
        id: createEventId(),
        date: todayDate(),
        description: 'Grocery shopping',
        amount: 300000,
        type: 'expense',
        accountId: bncId,
        category: 'Food & Drinks',
      };

      const events: FinancialEvent[] = [openingIncome, expense];
      const balances = getAccountBalances(events);

      expect(balances[bncId]).toBe(1200000);
      expect(getLiquidBalance(events)).toBe(1200000);
      expect(getInvestmentBalance(events)).toBe(0);
      expect(getNetWorth(events)).toBe(1200000);
    });

    it('handles custom investment accounts and transfer between liquid and investment', () => {
      addCustomAccount({
        fullName: 'Binance Global',
        name: 'BNB',
        group: 'investment',
        colorClass: 'bg-amber-500',
      });

      const initialCash: IncomeEvent = {
        id: createEventId(),
        date: todayDate(),
        description: 'Cash deposit',
        amount: 10000000,
        type: 'income',
        accountId: 'c',
        category: 'Salary',
      };

      const transferToCrypto: TransferEvent = {
        id: createEventId(),
        date: todayDate(),
        description: 'Buy USDT on Binance',
        amount: 4000000,
        type: 'transfer',
        sourceAccountId: 'c',
        destinationAccountId: 'binance-global',
      };

      const events: FinancialEvent[] = [initialCash, transferToCrypto];
      const balances = getAccountBalances(events);

      expect(balances['c']).toBe(6000000);
      expect(balances['binance-global']).toBe(4000000);
      expect(getLiquidBalance(events)).toBe(6000000);
      expect(getInvestmentBalance(events)).toBe(4000000);
      expect(getNetWorth(events)).toBe(10000000);
    });
  });
  describe('Account Slug Format & Cloud Synchronization', () => {
    it('validates account slug format correctly', () => {
      expect(isValidAccountIdFormat('ovo')).toBe(true);
      expect(isValidAccountIdFormat('bank-jago')).toBe(true);
      expect(isValidAccountIdFormat('gopay_plus')).toBe(true);
      expect(isValidAccountIdFormat('')).toBe(false);
      expect(isValidAccountIdFormat('a'.repeat(33))).toBe(false);
      expect(isValidAccountIdFormat('has space')).toBe(false);
      expect(isValidAccountIdFormat('special@account!')).toBe(false);
    });

    it('fetches and parses custom accounts from cloud vault', async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  pin_hash: JSON.stringify([
                    {
                      id: 'ovo',
                      name: 'OVO',
                      fullName: 'OVO',
                      group: 'liquid',
                      colorClass: 'bg-purple-600',
                      colorStyle: '#7c3aed',
                      isCustom: true,
                    },
                  ]),
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      // @ts-expect-error test mock
      const { accounts } = await fetchCloudCustomAccounts(mockSupabase);
      expect(accounts.length).toBe(1);
      expect(accounts[0].id).toBe('ovo');
      expect(accounts[0].fullName).toBe('OVO');
      expect(accounts[0].colorStyle).toBe('#7c3aed');
    });

    it('synchronizes cloud accounts to empty local storage on a fresh device', async () => {
      expect(readCustomAccounts().length).toBe(0);

      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  pin_hash: JSON.stringify([
                    {
                      id: 'ovo',
                      name: 'OVO',
                      fullName: 'OVO',
                      group: 'liquid',
                      colorClass: 'bg-purple-600',
                      colorStyle: '#7c3aed',
                      isCustom: true,
                    },
                  ]),
                },
                error: null,
              }),
            }),
          }),
          upsert: async () => ({ error: null }),
        }),
      };

      // @ts-expect-error test mock
      const synced = await syncCustomAccountsWithCloud(undefined, mockSupabase);
      expect(synced.length).toBe(1);
      expect(synced[0].id).toBe('ovo');

      // Verify it was written to localStorage
      const local = readCustomAccounts();
      expect(local.length).toBe(1);
      expect(local[0].id).toBe('ovo');
    });


    it('pushes custom accounts to cloud vault', async () => {
      let insertedRecord: unknown = null;
      const mockSupabase = {
        from: () => ({
          upsert: async (record: unknown) => {
            insertedRecord = record;
            return { error: null };
          },
        }),
      };

      const customAcc = [
        {
          id: 'ovo' as const,
          name: 'OVO',
          fullName: 'OVO',
          group: 'liquid' as const,
          colorClass: 'bg-purple-600',
          colorStyle: '#7c3aed',
          isCustom: true,
        },
      ];

      // @ts-expect-error test mock
      const ok = await pushCloudCustomAccounts(customAcc, mockSupabase);
      expect(ok).toBe(true);
      expect(insertedRecord).not.toBeNull();
      // @ts-expect-error test inspection
      expect(insertedRecord.id).toBe('vault-custom-accounts');
    });
    it('merges local and cloud accounts bidirectionally without duplicates', async () => {
      // Local has 'blu-bca'
      addCustomAccount({
        fullName: 'Blu BCA',
        name: 'BLU',
        group: 'liquid',
        colorClass: 'bg-blue-600',
      });

      let upsertPayload: unknown = null;
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  pin_hash: JSON.stringify([
                    {
                      id: 'ovo',
                      name: 'OVO',
                      fullName: 'OVO',
                      group: 'liquid',
                      colorClass: 'bg-purple-600',
                      colorStyle: '#7c3aed',
                      isCustom: true,
                    },
                  ]),
                },
                error: null,
              }),
            }),
          }),
          upsert: async (record: { pin_hash: string }) => {
            upsertPayload = JSON.parse(record.pin_hash);
            return { error: null };
          },
        }),
      };

      // @ts-expect-error test mock
      const merged = await syncCustomAccountsWithCloud(undefined, mockSupabase);
      expect(merged.length).toBe(2);
      expect(merged.map((a) => a.id).sort()).toEqual(['blu-bca', 'ovo']);

      // Cloud was pushed the merged result
      // @ts-expect-error test inspection
      expect(Array.isArray(upsertPayload.accounts)).toBe(true);
      // @ts-expect-error test inspection
      expect(upsertPayload.accounts.length).toBe(2);
    });
  });
});
