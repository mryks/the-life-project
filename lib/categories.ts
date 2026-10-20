import type { FinancialEvent } from './types';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
type SupabaseClient = ReturnType<typeof getSupabaseClient>;

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
export const VAULT_CUSTOM_CATEGORIES_RECORD_ID = 'vault-custom-categories';
export const VAULT_CATEGORIES_SALT = 'categories_metadata_v1';

export interface CustomCategoriesState {
  expense: string[];
  income: string[];
}

const getStorage = (): Storage | null => {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const readCustomCategories = (): CustomCategoriesState => {
  const storage = getStorage();
  if (!storage) {
    return { expense: [], income: [] };
  }

  try {
    const raw = storage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
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
  const storage = getStorage();
  if (!storage) return;

  try {
    const sanitized: CustomCategoriesState = {
      expense: Array.from(new Set(state.expense.map((c) => c.trim()).filter((c) => c.length > 0))),
      income: Array.from(new Set(state.income.map((c) => c.trim()).filter((c) => c.length > 0))),
    };
    storage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(sanitized));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(CUSTOM_CATEGORIES_CHANGE_EVENT));
    }
  } catch {
    // Graceful fallback for storage quota or privacy mode
  }
};

/**
 * Fetches user custom categories from Supabase vault_security table.
 */
export const fetchCloudCustomCategories = async (
  client?: SupabaseClient
): Promise<CustomCategoriesState> => {
  if (!client && !isSupabaseConfigured()) return { expense: [], income: [] };
  const sb = client ?? getSupabaseClient();
  if (!sb) return { expense: [], income: [] };

  try {
    const { data, error } = await sb
      .from('vault_security')
      .select('pin_hash')
      .eq('id', VAULT_CUSTOM_CATEGORIES_RECORD_ID)
      .maybeSingle();

    if (error || !data || !data.pin_hash) return { expense: [], income: [] };

    const parsed: unknown = JSON.parse(data.pin_hash);
    if (!isRecord(parsed)) return { expense: [], income: [] };

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

/**
 * Pushes custom categories to Supabase vault_security table.
 */
export const pushCloudCustomCategories = async (
  state: CustomCategoriesState,
  client?: SupabaseClient
): Promise<boolean> => {
  if (!client && !isSupabaseConfigured()) return false;
  const sb = client ?? getSupabaseClient();
  if (!sb) return false;

  try {
    const sanitized: CustomCategoriesState = {
      expense: Array.from(new Set(state.expense.map((c) => c.trim()).filter((c) => c.length > 0))),
      income: Array.from(new Set(state.income.map((c) => c.trim()).filter((c) => c.length > 0))),
    };

    const { error } = await sb.from('vault_security').upsert({
      id: VAULT_CUSTOM_CATEGORIES_RECORD_ID,
      pin_salt: VAULT_CATEGORIES_SALT,
      pin_hash: JSON.stringify(sanitized),
      updated_at: new Date().toISOString(),
    });

    return !error;
  } catch {
    return false;
  }
};

/**
 * Bidirectionally synchronizes custom categories between local storage and cloud.
 */
export const syncCustomCategoriesWithCloud = async (
  currentLocal?: CustomCategoriesState,
  client?: SupabaseClient
): Promise<CustomCategoriesState> => {
  const localState = currentLocal ?? readCustomCategories();
  if (!client && !isSupabaseConfigured()) return localState;

  try {
    const cloudState = await fetchCloudCustomCategories(client);
    const mergedExpense = Array.from(new Set([...cloudState.expense, ...localState.expense]));
    const mergedIncome = Array.from(new Set([...cloudState.income, ...localState.income]));

    const merged: CustomCategoriesState = {
      expense: mergedExpense,
      income: mergedIncome,
    };

    const hasDiff =
      merged.expense.length !== localState.expense.length ||
      merged.income.length !== localState.income.length;

    if (hasDiff) {
      writeCustomCategories(merged);
    }

    const localHasNewExpense = localState.expense.some((c) => !cloudState.expense.includes(c));
    const localHasNewIncome = localState.income.some((c) => !cloudState.income.includes(c));

    if (localHasNewExpense || localHasNewIncome || ((cloudState.expense.length === 0 && cloudState.income.length === 0) && (merged.expense.length > 0 || merged.income.length > 0))) {
      await pushCloudCustomCategories(merged, client);
    }

    return merged;
  } catch {
    return localState;
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
  if (isSupabaseConfigured()) {
    pushCloudCustomCategories(nextState).catch(() => {});
  }
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

  const nextState: CustomCategoriesState = {
    ...currentState,
    [type]: nextList,
  };
  writeCustomCategories(nextState);
  if (isSupabaseConfigured()) {
    pushCloudCustomCategories(nextState).catch(() => {});
  }
  return { success: true };
};
