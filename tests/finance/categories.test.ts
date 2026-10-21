import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  readCustomCategories,
  validateCategoryName,
  addCustomCategory,
  deleteCustomCategory,
  isDefaultCategory,
  isCategoryInUse,
  getAllExpenseCategories,
  getAllIncomeCategories,
} from '@/lib/categories';
import {
  calculateFinanceStats,
  createBackupEnvelope,
  parseAndValidateBackup,
  isExpenseCategory,
  isIncomeCategory,
} from '@/lib/finance';
import { eventToDbRow, dbRowToEvent } from '@/lib/sync';
import type { ExpenseEvent, FinancialEvent, IncomeEvent } from '@/lib/types';
import {
  createExpense,
  createIncome,
  createRefund,
} from './helpers/fixtures';

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

describe('Custom Categories: Creation, Validation, Deletion & Accounting Integrity', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: mockLocalStorage,
      dispatchEvent: () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  // =========================================================================
  // 1. Category Name Validation & Addition
  // =========================================================================
  describe('1. Category Name Validation & Addition', () => {
    it('accepts and trims valid names (e.g. "  Streaming  " -> "Streaming")', () => {
      const result = validateCategoryName('  Streaming  ', 'expense', [
        ...DEFAULT_EXPENSE_CATEGORIES,
      ]);
      expect(result.valid).toBe(true);
      expect(result.cleanName).toBe('Streaming');

      const addResult = addCustomCategory('expense', '  Streaming  ');
      expect(addResult.success).toBe(true);
      expect(addResult.category).toBe('Streaming');
      expect(readCustomCategories().expense).toContain('Streaming');
    });

    it('rejects empty or whitespace-only names', () => {
      const empty = validateCategoryName('', 'expense', [...DEFAULT_EXPENSE_CATEGORIES]);
      expect(empty.valid).toBe(false);
      expect(empty.error).toMatch(/cannot be empty/i);

      const spaces = validateCategoryName('    ', 'expense', [...DEFAULT_EXPENSE_CATEGORIES]);
      expect(spaces.valid).toBe(false);
      expect(spaces.error).toMatch(/cannot be empty/i);

      const tabs = validateCategoryName('\t\n  ', 'income', [...DEFAULT_INCOME_CATEGORIES]);
      expect(tabs.valid).toBe(false);
      expect(tabs.error).toMatch(/cannot be empty/i);

      const addEmpty = addCustomCategory('expense', '   ');
      expect(addEmpty.success).toBe(false);
      expect(readCustomCategories().expense).toHaveLength(0);
    });

    it('rejects names exceeding 30 characters', () => {
      const thirtyOne = 'A'.repeat(31);
      const result = validateCategoryName(thirtyOne, 'expense', [
        ...DEFAULT_EXPENSE_CATEGORIES,
      ]);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/cannot exceed 30 characters/i);

      const exactlyThirty = 'B'.repeat(30);
      const validResult = validateCategoryName(exactlyThirty, 'expense', [
        ...DEFAULT_EXPENSE_CATEGORIES,
      ]);
      expect(validResult.valid).toBe(true);
      expect(validResult.cleanName).toBe(exactlyThirty);
    });

    it('rejects case-insensitive duplicates in the same type', () => {
      const lower = validateCategoryName('medical', 'expense', [
        ...DEFAULT_EXPENSE_CATEGORIES,
      ]);
      expect(lower.valid).toBe(false);
      expect(lower.error).toMatch(/already exists/i);

      const upper = validateCategoryName('FOOD & DRINKS', 'expense', [
        ...DEFAULT_EXPENSE_CATEGORIES,
      ]);
      expect(upper.valid).toBe(false);
      expect(upper.error).toMatch(/already exists/i);

      const incomeSalary = validateCategoryName('salary', 'income', [
        ...DEFAULT_INCOME_CATEGORIES,
      ]);
      expect(incomeSalary.valid).toBe(false);
      expect(incomeSalary.error).toMatch(/already exists/i);

      // Duplicate against already added custom category
      addCustomCategory('expense', 'Gym');
      const dupCustom = addCustomCategory('expense', '  gym  ');
      expect(dupCustom.success).toBe(false);
      expect(dupCustom.error).toMatch(/already exists/i);
    });

    it('rejects expense named "Cashback"', () => {
      const exact = validateCategoryName('Cashback', 'expense', [
        ...DEFAULT_EXPENSE_CATEGORIES,
      ]);
      expect(exact.valid).toBe(false);
      expect(exact.error).toMatch(/reserved for income/i);

      const lower = validateCategoryName('cashback', 'expense', [
        ...DEFAULT_EXPENSE_CATEGORIES,
      ]);
      expect(lower.valid).toBe(false);
      expect(lower.error).toMatch(/reserved for income/i);

      const addResult = addCustomCategory('expense', 'Cashback');
      expect(addResult.success).toBe(false);
    });

    it('rejects income named legacy "Other" or "Investment"', () => {
      const other = validateCategoryName('Other', 'income', [
        ...DEFAULT_INCOME_CATEGORIES,
      ]);
      expect(other.valid).toBe(false);
      expect(other.error).toMatch(/not allowed as an income category/i);

      const lowerOther = validateCategoryName('other', 'income', [
        ...DEFAULT_INCOME_CATEGORIES,
      ]);
      expect(lowerOther.valid).toBe(false);

      const inv = validateCategoryName('Investment', 'income', [
        ...DEFAULT_INCOME_CATEGORIES,
      ]);
      expect(inv.valid).toBe(false);
      expect(inv.error).toMatch(/not allowed as an income category/i);

      const lowerInv = validateCategoryName('investment', 'income', [
        ...DEFAULT_INCOME_CATEGORIES,
      ]);
      expect(lowerInv.valid).toBe(false);
    });

    it('accepts and adds valid custom income categories (e.g. "Freelance", "Side Project")', () => {
      const res = addCustomCategory('income', 'Freelance');
      expect(res.success).toBe(true);
      expect(res.category).toBe('Freelance');
      expect(readCustomCategories().income).toContain('Freelance');

      const res2 = addCustomCategory('income', 'Side Project');
      expect(res2.success).toBe(true);
      expect(readCustomCategories().income).toEqual(['Freelance', 'Side Project']);
    });
  });

  // =========================================================================
  // 2. Deletion of Custom Categories (Option A Invariant)
  // =========================================================================
  describe('2. Deletion of Custom Categories (Option A Invariant)', () => {
    it('system default categories can NEVER be deleted', () => {
      const delFood = deleteCustomCategory('expense', 'Food & Drinks', []);
      expect(delFood.success).toBe(false);
      expect(delFood.error).toMatch(/default categories cannot be deleted/i);

      const delOther = deleteCustomCategory('expense', 'Other', []);
      expect(delOther.success).toBe(false);
      expect(delOther.error).toMatch(/default categories cannot be deleted/i);

      const delSalary = deleteCustomCategory('income', 'Salary', []);
      expect(delSalary.success).toBe(false);
      expect(delSalary.error).toMatch(/default categories cannot be deleted/i);

      const delCashback = deleteCustomCategory('income', 'Cashback', []);
      expect(delCashback.success).toBe(false);
      expect(delCashback.error).toMatch(/default categories cannot be deleted/i);

      const delOthers = deleteCustomCategory('income', 'Others', []);
      expect(delOthers.success).toBe(false);
      expect(delOthers.error).toMatch(/default categories cannot be deleted/i);
    });

    it('custom category that has 0 transactions can be deleted successfully', () => {
      addCustomCategory('expense', 'Books');
      expect(readCustomCategories().expense).toContain('Books');

      const delResult = deleteCustomCategory('expense', 'Books', []);
      expect(delResult.success).toBe(true);
      expect(readCustomCategories().expense).not.toContain('Books');
    });

    it('custom category that is currently used by 1 or more transactions CANNOT be deleted', () => {
      addCustomCategory('expense', 'Gym');
      const gymExpense = createExpense({
        id: 'exp-gym-1',
        category: 'Gym',
        amount: 500_000,
      });

      const delResult = deleteCustomCategory('expense', 'Gym', [gymExpense]);
      expect(delResult.success).toBe(false);
      expect(delResult.error).toMatch(/used/i);
      expect(readCustomCategories().expense).toContain('Gym');
    });

    it('custom income category that is currently used by transactions CANNOT be deleted', () => {
      addCustomCategory('income', 'Consulting');
      const consultingIncome = createIncome({
        id: 'inc-consult-1',
        category: 'Consulting',
        amount: 3_000_000,
      });

      const delResult = deleteCustomCategory('income', 'Consulting', [consultingIncome]);
      expect(delResult.success).toBe(false);
      expect(delResult.error).toMatch(/used/i);
      expect(readCustomCategories().income).toContain('Consulting');
    });

    it('custom category can be deleted after its using transaction is removed', () => {
      addCustomCategory('expense', 'Gadgets');
      const gadgetExpense = createExpense({
        id: 'exp-gadget-1',
        category: 'Gadgets',
        amount: 1_200_000,
      });

      // Blocked while used
      expect(deleteCustomCategory('expense', 'Gadgets', [gadgetExpense]).success).toBe(false);

      // Allowed after transaction list no longer contains it
      const delSuccess = deleteCustomCategory('expense', 'Gadgets', []);
      expect(delSuccess.success).toBe(true);
      expect(readCustomCategories().expense).not.toContain('Gadgets');
    });
  });

  // =========================================================================
  // 3. Financial Calculations with Custom Categories
  // =========================================================================
  describe('3. Financial Calculations with Custom Categories', () => {
    it('adding expense with custom category "Gym" calculates categoryTotals["Gym"] deterministically', () => {
      addCustomCategory('expense', 'Gym');
      const events: FinancialEvent[] = [
        createExpense({
          id: 'exp-1',
          date: '2026-10-02',
          amount: 200_000,
          category: 'Food & Drinks',
        }),
        createExpense({
          id: 'exp-2',
          date: '2026-10-05',
          amount: 450_000,
          category: 'Gym',
        }),
        createIncome({
          id: 'inc-1',
          date: '2026-10-01',
          amount: 5_000_000,
          category: 'Salary',
        }),
      ];

      const stats = calculateFinanceStats(events, '2026-10-15');
      expect(stats.categoryTotals['Gym']).toBe(450_000);
      expect(stats.categoryTotals['Food & Drinks']).toBe(200_000);
      expect(stats.monthlyExpense).toBe(650_000);
      expect(stats.netCashflow).toBe(5_000_000 - 650_000);
    });

    it('pieData includes "Gym" with its exact IDR total and no NaN values', () => {
      addCustomCategory('expense', 'Gym');
      const events: FinancialEvent[] = [
        createExpense({
          id: 'exp-gym-1',
          date: '2026-10-03',
          amount: 600_000,
          category: 'Gym',
        }),
        createExpense({
          id: 'exp-food-1',
          date: '2026-10-04',
          amount: 300_000,
          category: 'Food & Drinks',
        }),
      ];

      const stats = calculateFinanceStats(events, '2026-10-10');
      const gymPie = stats.pieData.find((p) => p.name === 'Gym');
      expect(gymPie).toBeDefined();
      expect(gymPie?.value).toBe(600_000);

      // Verify zero NaN across all pie slices and categoryTotals
      for (const slice of stats.pieData) {
        expect(Number.isNaN(slice.value)).toBe(false);
        expect(slice.value).toBeGreaterThan(0);
      }
      for (const total of Object.values(stats.categoryTotals)) {
        expect(Number.isNaN(total)).toBe(false);
      }
    });

    it('refunds on custom category expenses decrease categoryTotals["Gym"] deterministically', () => {
      addCustomCategory('expense', 'Gym');
      const gymExpense = createExpense({
        id: 'exp-gym-parent',
        date: '2026-10-02',
        amount: 800_000,
        category: 'Gym',
      });
      const gymRefund = createRefund({
        id: 'ref-gym-1',
        date: '2026-10-05',
        amount: 250_000,
        relatedEventId: 'exp-gym-parent',
      });

      const stats = calculateFinanceStats([gymExpense, gymRefund], '2026-10-10');
      expect(stats.categoryTotals['Gym']).toBe(800_000 - 250_000);
      expect(stats.monthlyExpense).toBe(550_000);

      const gymPie = stats.pieData.find((p) => p.name === 'Gym');
      expect(gymPie?.value).toBe(550_000);
    });

    it('full refund on custom category drops category total to 0 and removes from pieData', () => {
      addCustomCategory('expense', 'Concert');
      const concertExpense = createExpense({
        id: 'exp-concert',
        date: '2026-10-02',
        amount: 1_000_000,
        category: 'Concert',
      });
      const concertRefund = createRefund({
        id: 'ref-concert',
        date: '2026-10-04',
        amount: 1_000_000,
        relatedEventId: 'exp-concert',
      });

      const stats = calculateFinanceStats([concertExpense, concertRefund], '2026-10-10');
      expect(stats.categoryTotals['Concert']).toBe(0);
      expect(stats.monthlyExpense).toBe(0);
      expect(stats.pieData.some((p) => p.name === 'Concert')).toBe(false);
    });
  });

  // =========================================================================
  // 4. Sync & Persistence with Custom Categories
  // =========================================================================
  describe('4. Sync & Persistence with Custom Categories', () => {
    it('events with custom categories are serialized to Supabase DB rows and deserialized back identically', () => {
      addCustomCategory('expense', 'Subscriptions');
      addCustomCategory('income', 'Dividend');

      const expense: ExpenseEvent = {
        id: 'exp-sub-1',
        date: '2026-10-03',
        description: 'Netflix 4K',
        amount: 186_000,
        type: 'expense',
        accountId: 'b',
        category: 'Subscriptions',
      };

      const income: IncomeEvent = {
        id: 'inc-div-1',
        date: '2026-10-04',
        description: 'Stock Dividend',
        amount: 2_500_000,
        type: 'income',
        accountId: 'sb',
        category: 'Dividend',
      };

      // 1. Serialize to Supabase DB row
      const expRow = eventToDbRow(expense, 0);
      expect(expRow.id).toBe('exp-sub-1');
      expect(expRow.category).toBe('Subscriptions');
      expect(expRow.account_id).toBe('b');

      const incRow = eventToDbRow(income, 1);
      expect(incRow.id).toBe('inc-div-1');
      expect(incRow.category).toBe('Dividend');
      expect(incRow.account_id).toBe('sb');

      // 2. Deserialize from DB row back to domain FinancialEvent
      const restoredExpense = dbRowToEvent(expRow);
      expect(restoredExpense).toEqual(expense);

      const restoredIncome = dbRowToEvent(incRow);
      expect(restoredIncome).toEqual(income);
    });

    it('backup JSON containing custom categories parses and validates successfully', () => {
      addCustomCategory('expense', 'Gaming');
      addCustomCategory('income', 'Consulting');

      const backupEnvelope = {
        version: 2,
        exportedAt: '2026-10-17T08:00:00.000Z',
        events: [
          createExpense({
            id: 'exp-game-1',
            date: '2026-10-03',
            description: 'Steam Game',
            amount: 450_000,
            category: 'Gaming',
          }),
          createIncome({
            id: 'inc-consult-1',
            date: '2026-10-04',
            description: 'Design Consultation',
            amount: 7_500_000,
            category: 'Consulting',
          }),
        ],
      };

      const rawJson = JSON.stringify(backupEnvelope);
      const parseResult = parseAndValidateBackup(rawJson);
      expect(parseResult.success).toBe(true);
      if (!parseResult.success) return;

      const [ev0, ev1] = parseResult.events;
      expect(ev0.type === 'expense' && ev0.category).toBe('Gaming');
      expect(ev1.type === 'income' && ev1.category).toBe('Consulting');
      expect(parseResult.summary.expenseCount).toBe(1);
      expect(parseResult.summary.incomeCount).toBe(1);
    });

    it('backup restore round-trip preserves custom category events and calculations', () => {
      addCustomCategory('expense', 'Hardware');
      const hardwareExpense = createExpense({
        id: 'exp-hw-1',
        date: '2026-10-02',
        description: 'Mechanical Keyboard',
        amount: 1_250_000,
        category: 'Hardware',
      });
      const salaryIncome = createIncome({
        id: 'inc-sal-1',
        date: '2026-10-01',
        amount: 10_000_000,
      });

      const envelope = createBackupEnvelope([hardwareExpense, salaryIncome]);
      const json = JSON.stringify(envelope);

      const parsed = parseAndValidateBackup(json);
      expect(parsed.success).toBe(true);
      if (!parsed.success) return;

      const stats = calculateFinanceStats(parsed.events, '2026-10-10');
      expect(stats.categoryTotals['Hardware']).toBe(1_250_000);
      expect(stats.monthlyExpense).toBe(1_250_000);
      expect(stats.netCashflow).toBe(10_000_000 - 1_250_000);
    });
  });

  // =========================================================================
  // 5. Category Helpers & Type Invariants
  // =========================================================================
  describe('5. Category Helpers & Type Invariants', () => {
    it('isDefaultCategory accurately distinguishes system defaults from custom categories', () => {
      expect(isDefaultCategory('Food & Drinks', 'expense')).toBe(true);
      expect(isDefaultCategory('Transportation', 'expense')).toBe(true);
      expect(isDefaultCategory('Other', 'expense')).toBe(true);
      expect(isDefaultCategory('Gym', 'expense')).toBe(false);

      expect(isDefaultCategory('Salary', 'income')).toBe(true);
      expect(isDefaultCategory('Allowance', 'income')).toBe(true);
      expect(isDefaultCategory('Cashback', 'income')).toBe(true);
      expect(isDefaultCategory('Others', 'income')).toBe(true);
      expect(isDefaultCategory('Consulting', 'income')).toBe(false);
    });

    it('getAllExpenseCategories returns default + custom + event categories deduplicated', () => {
      const custom = ['Gym', 'Books', 'Food & Drinks']; // contains duplicate default
      const events = [
        createExpense({ category: 'Gym' }),
        createExpense({ category: 'Course' }),
      ];

      const all = getAllExpenseCategories(custom, events);
      expect(all).toContain('Food & Drinks');
      expect(all).toContain('Gym');
      expect(all).toContain('Books');
      expect(all).toContain('Course');

      // Deduplication check
      const gymOccurrences = all.filter((c) => c === 'Gym');
      expect(gymOccurrences).toHaveLength(1);
      const foodOccurrences = all.filter((c) => c === 'Food & Drinks');
      expect(foodOccurrences).toHaveLength(1);
    });

    it('getAllIncomeCategories returns default + custom + event categories deduplicated', () => {
      const custom = ['Freelance', 'Salary'];
      const events = [
        createIncome({ category: 'Freelance' }),
        createIncome({ category: 'Grants' }),
      ];

      const all = getAllIncomeCategories(custom, events);
      expect(all).toContain('Salary');
      expect(all).toContain('Freelance');
      expect(all).toContain('Grants');

      const freelanceOccurrences = all.filter((c) => c === 'Freelance');
      expect(freelanceOccurrences).toHaveLength(1);
    });

    it('isCategoryInUse accurately detects active transactions', () => {
      const events: FinancialEvent[] = [
        createExpense({ category: 'Gym' }),
        createIncome({ category: 'Freelance' }),
      ];

      expect(isCategoryInUse('Gym', 'expense', events)).toBe(true);
      expect(isCategoryInUse('Books', 'expense', events)).toBe(false);
      expect(isCategoryInUse('Freelance', 'income', events)).toBe(true);
      expect(isCategoryInUse('Consulting', 'income', events)).toBe(false);
    });

    it('isExpenseCategory and isIncomeCategory validate registered custom categories properly', () => {
      expect(isExpenseCategory('Gym')).toBe(false);
      addCustomCategory('expense', 'Gym');
      expect(isExpenseCategory('Gym')).toBe(true);

      expect(isIncomeCategory('Freelance')).toBe(false);
      addCustomCategory('income', 'Freelance');
      expect(isIncomeCategory('Freelance')).toBe(true);
    });
  });

  // =========================================================================
  // 6. Category Ordering Invariants & Delete Icon Guardrail
  // =========================================================================
  describe('6. Category Ordering Invariants & Delete Icon Guardrail', () => {
    it('custom expense categories are positioned chronologically AFTER defaults and strictly BEFORE "Other"', () => {
      // Add multiple custom expense categories
      addCustomCategory('expense', 'Subscriptions');
      addCustomCategory('expense', 'Gym');
      addCustomCategory('expense', 'Books');

      const customState = readCustomCategories();
      const allExpense = getAllExpenseCategories(customState.expense, []);

      // 1. "Other" must be strictly the LAST element
      expect(allExpense[allExpense.length - 1]).toBe('Other');

      // 2. Custom categories must precede "Other"
      const otherIndex = allExpense.indexOf('Other');
      const subIndex = allExpense.indexOf('Subscriptions');
      const gymIndex = allExpense.indexOf('Gym');
      const booksIndex = allExpense.indexOf('Books');

      expect(subIndex).toBeLessThan(otherIndex);
      expect(gymIndex).toBeLessThan(otherIndex);
      expect(booksIndex).toBeLessThan(otherIndex);

      // 3. Chronological addition order is preserved: Subscriptions -> Gym -> Books
      expect(subIndex).toBeLessThan(gymIndex);
      expect(gymIndex).toBeLessThan(booksIndex);

      // 4. Standard default categories precede all custom categories
      const foodIndex = allExpense.indexOf('Food & Drinks');
      const medicalIndex = allExpense.indexOf('Medical');
      expect(foodIndex).toBeLessThan(subIndex);
      expect(medicalIndex).toBeLessThan(subIndex);
    });

    it('custom income categories are positioned chronologically AFTER defaults and strictly BEFORE "Others"', () => {
      // Add multiple custom income categories
      addCustomCategory('income', 'Freelance');
      addCustomCategory('income', 'Investments Dividend');
      addCustomCategory('income', 'Side Project');

      const customState = readCustomCategories();
      const allIncome = getAllIncomeCategories(customState.income, []);

      // 1. "Others" must be strictly the LAST element
      expect(allIncome[allIncome.length - 1]).toBe('Others');

      // 2. Custom categories must precede "Others"
      const othersIndex = allIncome.indexOf('Others');
      const freelanceIndex = allIncome.indexOf('Freelance');
      const divIndex = allIncome.indexOf('Investments Dividend');
      const sideIndex = allIncome.indexOf('Side Project');

      expect(freelanceIndex).toBeLessThan(othersIndex);
      expect(divIndex).toBeLessThan(othersIndex);
      expect(sideIndex).toBeLessThan(othersIndex);

      // 3. Chronological addition order is preserved: Freelance -> Investments Dividend -> Side Project
      expect(freelanceIndex).toBeLessThan(divIndex);
      expect(divIndex).toBeLessThan(sideIndex);

      // 4. Standard default categories precede all custom categories
      const salaryIndex = allIncome.indexOf('Salary');
      const cashbackIndex = allIncome.indexOf('Cashback');
      expect(salaryIndex).toBeLessThan(freelanceIndex);
      expect(cashbackIndex).toBeLessThan(freelanceIndex);
    });

    it('event-discovered custom categories from cloud sync also position before "Other"/"Others"', () => {
      const customExpense = ['Streaming'];
      const events: FinancialEvent[] = [
        createExpense({ category: 'Course' }),
        createIncome({ category: 'Bonus' }),
      ];

      const allExpense = getAllExpenseCategories(customExpense, events);
      expect(allExpense[allExpense.length - 1]).toBe('Other');
      expect(allExpense.indexOf('Course')).toBeLessThan(allExpense.indexOf('Other'));

      const allIncome = getAllIncomeCategories([], events);
      expect(allIncome[allIncome.length - 1]).toBe('Others');
      expect(allIncome.indexOf('Bonus')).toBeLessThan(allIncome.indexOf('Others'));
    });

    it('delete icon eligibility (canDelete = !isDefault && !inUse)', () => {
      addCustomCategory('expense', 'UnusedCategory');
      addCustomCategory('expense', 'UsedCategory');

      const events: FinancialEvent[] = [
        createExpense({ category: 'UsedCategory' }),
      ];

      // Defaults can never be deleted
      expect(!isDefaultCategory('Food & Drinks', 'expense') && !isCategoryInUse('Food & Drinks', 'expense', events)).toBe(false);
      expect(!isDefaultCategory('Other', 'expense') && !isCategoryInUse('Other', 'expense', events)).toBe(false);

      // Used custom category has delete button SUPPRESSED
      const usedCanDelete = !isDefaultCategory('UsedCategory', 'expense') && !isCategoryInUse('UsedCategory', 'expense', events);
      expect(usedCanDelete).toBe(false);

      // Unused custom category HAS delete button ENABLED
      const unusedCanDelete = !isDefaultCategory('UnusedCategory', 'expense') && !isCategoryInUse('UnusedCategory', 'expense', events);
      expect(unusedCanDelete).toBe(true);
    });
  });
});
