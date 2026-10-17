import type { FinancialEvent } from './types';

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Home & Family',
  'Food & Drinks',
  'Transportation',
  'Personal Care',
  'Leisure',
  'Medical',
  '𝓡',
  'Other',
] as const;

export const DEFAULT_INCOME_CATEGORIES = [
  'Salary',
  'Allowance',
  'Cashback',
  'Others',
] as const;

export const CUSTOM_CATEGORIES_STORAGE_KEY = 'thelife-custom-categories';
export const CUSTOM_CATEGORIES_CHANGE_EVENT = 'thelife-custom-categories-change';

export interface CustomCategoriesState {
  expense: string[];
  income: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const readCustomCategories = (): CustomCategoriesState => {
  if (typeof window === 'undefined') {
    return { expense: [], income: [] };
  }

  try {
    const raw = window.localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
    if (!raw) {
      return { expense: [], income: [] };
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return { expense: [], income: [] };
    }

    const expense = Array.isArray(parsed.expense)
      ? parsed.expense.filter((cat): cat is string => typeof cat === 'string' && cat.trim().length > 0)
      : [];

    const income = Array.isArray(parsed.income)
      ? parsed.income.filter((cat): cat is string => typeof cat === 'string' && cat.trim().length > 0)
      : [];

    return {
      expense: Array.from(new Set(expense)),
      income: Array.from(new Set(income)),
    };
  } catch {
    return { expense: [], income: [] };
  }
};

export const writeCustomCategories = (state: CustomCategoriesState): void => {
  if (typeof window === 'undefined') return;

  try {
    const sanitized: CustomCategoriesState = {
      expense: Array.from(new Set(state.expense.map((c) => c.trim()).filter((c) => c.length > 0))),
      income: Array.from(new Set(state.income.map((c) => c.trim()).filter((c) => c.length > 0))),
    };
    window.localStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(sanitized));
    window.dispatchEvent(new Event(CUSTOM_CATEGORIES_CHANGE_EVENT));
  } catch {
    // Graceful fallback for storage quota or privacy mode
  }
};

export const isDefaultCategory = (name: string, type: 'income' | 'expense'): boolean => {
  if (type === 'expense') {
    return (DEFAULT_EXPENSE_CATEGORIES as readonly string[]).includes(name);
  }
  return (DEFAULT_INCOME_CATEGORIES as readonly string[]).includes(name);
};

export const isCategoryInUse = (
  name: string,
  type: 'income' | 'expense',
  events: FinancialEvent[] = []
): boolean => {
  if (type === 'expense') {
    return events.some((event) => event.type === 'expense' && event.category === name);
  }
  return events.some((event) => event.type === 'income' && event.category === name);
};

export const validateCategoryName = (
  name: string,
  type: 'income' | 'expense',
  existingCategories: string[]
): { valid: boolean; error?: string; cleanName: string } => {
  const cleanName = name.trim();

  if (cleanName.length === 0) {
    return { valid: false, error: 'Category name cannot be empty', cleanName };
  }

  if (cleanName.length > 30) {
    return { valid: false, error: 'Category name cannot exceed 30 characters', cleanName };
  }

  if (type === 'expense' && cleanName.toLowerCase() === 'cashback') {
    return { valid: false, error: '"Cashback" is reserved for income', cleanName };
  }

  if (
    type === 'income' &&
    (cleanName.toLowerCase() === 'other' || cleanName.toLowerCase() === 'investment')
  ) {
    return {
      valid: false,
      error: `"${cleanName}" is not allowed as an income category`,
      cleanName,
    };
  }

  const isDuplicate = existingCategories.some(
    (existing) => existing.trim().toLowerCase() === cleanName.toLowerCase()
  );

  if (isDuplicate) {
    return {
      valid: false,
      error: `Category "${cleanName}" already exists`,
      cleanName,
    };
  }

  return { valid: true, cleanName };
};

export const getAllExpenseCategories = (
  customExpense: string[] = [],
  events: FinancialEvent[] = []
): string[] => {
  const combined = [
    ...DEFAULT_EXPENSE_CATEGORIES,
    ...customExpense,
    ...events
      .filter((e): e is Extract<FinancialEvent, { type: 'expense' }> => e.type === 'expense')
      .map((e) => e.category),
  ];

  return Array.from(new Set(combined.map((c) => c.trim()).filter((c) => c.length > 0)));
};

export const getAllIncomeCategories = (
  customIncome: string[] = [],
  events: FinancialEvent[] = []
): string[] => {
  const combined = [
    ...DEFAULT_INCOME_CATEGORIES,
    ...customIncome,
    ...events
      .filter((e): e is Extract<FinancialEvent, { type: 'income' }> => e.type === 'income')
      .map((e) => e.category),
  ];

  return Array.from(new Set(combined.map((c) => c.trim()).filter((c) => c.length > 0)));
};

export const addCustomCategory = (
  type: 'income' | 'expense',
  name: string,
  events: FinancialEvent[] = []
): { success: boolean; error?: string; category?: string } => {
  const currentState = readCustomCategories();
  const existingCategories =
    type === 'expense'
      ? getAllExpenseCategories(currentState.expense, events)
      : getAllIncomeCategories(currentState.income, events);

  const validation = validateCategoryName(name, type, existingCategories);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const nextState: CustomCategoriesState = {
    ...currentState,
    [type]: [...currentState[type], validation.cleanName],
  };

  writeCustomCategories(nextState);
  return { success: true, category: validation.cleanName };
};

export const deleteCustomCategory = (
  type: 'income' | 'expense',
  name: string,
  events: FinancialEvent[] = []
): { success: boolean; error?: string } => {
  if (isDefaultCategory(name, type)) {
    return { success: false, error: 'Default categories cannot be deleted' };
  }

  if (isCategoryInUse(name, type, events)) {
    return {
      success: false,
      error: 'Cannot delete category: it is used in existing transactions',
    };
  }

  const currentState = readCustomCategories();
  const nextList = currentState[type].filter((cat) => cat !== name);

  writeCustomCategories({
    ...currentState,
    [type]: nextList,
  });

  return { success: true };
};
