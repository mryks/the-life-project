// src/lib/accounts.ts
import type { Account, AccountGroup, AccountId, FinancialEvent } from './types';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
type SupabaseClient = ReturnType<typeof getSupabaseClient>;

export const DEFAULT_ACCOUNTS: Account[] = [
  // 10 Liquid Accounts (Kas, Bank, E-Wallet, Personal)
  { id: 'c', name: 'C', fullName: 'Cash', colorClass: 'bg-amber-800', group: 'liquid' },
  { id: 'b', name: 'B', fullName: 'BNI', colorClass: 'bg-gradient-to-br from-blue-500 to-teal-400', group: 'liquid' },
  { id: 'g', name: 'G', fullName: 'GoPay', colorClass: 'bg-green-500', group: 'liquid' },
  { id: 's', name: 'S', fullName: 'ShopeePay', colorClass: 'bg-gradient-to-br from-orange-400 to-red-500', group: 'liquid' },
  { id: 'jy', name: 'JY', fullName: 'Jago Yoel', colorClass: 'bg-gradient-to-br from-purple-500 to-pink-400', group: 'liquid' },
  { id: 'e', name: 'E', fullName: 'e-money', colorClass: 'bg-gradient-to-br from-gray-200 to-gray-400', group: 'liquid' },
  { id: 'sea', name: 'SEA', fullName: 'SeaBank', colorClass: 'bg-gradient-to-br from-pink-100 to-orange-100', group: 'liquid' },
  { id: 'q', name: 'Q', fullName: 'Bank Saqu', colorClass: 'bg-gradient-to-br from-pink-400 to-orange-400', group: 'liquid' },
  { id: 'j', name: 'J', fullName: 'Jago', colorClass: 'bg-gradient-to-br from-orange-400 to-yellow-400', group: 'liquid' },
  { id: 'cla', name: 'CLA', fullName: 'Clara', colorClass: 'bg-lime-400', group: 'liquid' },

  // 7 Investment Accounts (Sekuritas, Saham, Kripto, Portofolio)
  { id: 'k', name: 'K', fullName: 'KOINS', colorClass: 'bg-gradient-to-br from-amber-700 to-gray-500', group: 'investment' },
  { id: 'h', name: 'H', fullName: 'HP', colorClass: 'bg-sky-300', group: 'investment' },
  { id: 'sb', name: 'SB', fullName: 'Stockbit', colorClass: 'bg-emerald-800', group: 'investment' },
  { id: 'poe', name: 'POE', fullName: 'POEMS', colorClass: 'bg-red-900', group: 'investment' },
  { id: 'kb', name: 'KB', fullName: 'KB', colorClass: 'bg-yellow-400', group: 'investment' },
  { id: 'i', name: 'I', fullName: 'IPOT', colorClass: 'bg-gradient-to-br from-red-800 to-amber-900', group: 'investment' },
  { id: 'p', name: 'P', fullName: 'Portfolio', colorClass: 'bg-purple-600', group: 'investment' },
];

export const accounts: Account[] = DEFAULT_ACCOUNTS;

export const liquidAccounts = DEFAULT_ACCOUNTS.filter((acc) => acc.group === 'liquid');
export const investmentAccounts = DEFAULT_ACCOUNTS.filter((acc) => acc.group === 'investment');

export const liquidAccountIds: AccountId[] = liquidAccounts.map((acc) => acc.id);
export const investmentAccountIds: AccountId[] = investmentAccounts.map((acc) => acc.id);

export const CUSTOM_ACCOUNTS_STORAGE_KEY = 'thelife-custom-accounts';
export const CUSTOM_ACCOUNTS_CHANGE_EVENT = 'thelife-custom-accounts-change';
export const VAULT_CUSTOM_ACCOUNTS_RECORD_ID = 'vault-custom-accounts';
export const VAULT_ACCOUNTS_SALT = 'accounts_metadata_v1';

/**
 * Fast format check for account slug: 1-32 chars alphanumeric, dash, underscore.
 * Used defensively during deserialization to never drop valid transactions.
 */
export const isValidAccountIdFormat = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 32) return false;
  return /^[a-z0-9_-]+$/.test(trimmed);
};

const getStorage = (): Storage | null => {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads user-created custom accounts from localStorage.
 */
export const readCustomAccounts = (): Account[] => {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(CUSTOM_ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const validAccounts: Account[] = [];
    for (const item of parsed) {
      if (!isRecord(item)) continue;
      if (typeof item.id !== 'string' || !item.id.trim()) continue;
      if (typeof item.name !== 'string' || !item.name.trim()) continue;
      if (typeof item.fullName !== 'string' || !item.fullName.trim()) continue;
      const group: AccountGroup = item.group === 'investment' ? 'investment' : 'liquid';

      validAccounts.push({
        id: item.id.trim().toLowerCase() as AccountId,
        name: item.name.trim().toUpperCase().slice(0, 4),
        fullName: item.fullName.trim(),
        colorClass: typeof item.colorClass === 'string' && item.colorClass ? item.colorClass : 'bg-stone-600',
        colorStyle: typeof item.colorStyle === 'string' && item.colorStyle ? item.colorStyle : undefined,
        group,
        isCustom: true,
      });
    }

    return validAccounts;
  } catch {
    return [];
  }
};

/**
 * Writes custom accounts to localStorage and triggers change event.
 */
export const writeCustomAccounts = (customAccounts: Account[]): void => {
  const storage = getStorage();
  if (!storage) return;

  try {
    const sanitized = customAccounts.map((acc) => ({
      id: acc.id.trim().toLowerCase(),
      name: acc.name.trim().toUpperCase().slice(0, 4),
      fullName: acc.fullName.trim(),
      colorClass: acc.colorClass || 'bg-stone-600',
      colorStyle: acc.colorStyle || undefined,
      group: acc.group,
      isCustom: true,
    }));

    storage.setItem(CUSTOM_ACCOUNTS_STORAGE_KEY, JSON.stringify(sanitized));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(CUSTOM_ACCOUNTS_CHANGE_EVENT));
    }
  } catch {
    // Graceful fallback for storage quota or privacy mode
  }
};

/**
 * Fetches user custom accounts from Supabase vault_security table.
 */
export const fetchCloudCustomAccounts = async (
  client?: SupabaseClient
): Promise<Account[]> => {
  if (!client && !isSupabaseConfigured()) return [];
  const sb = client ?? getSupabaseClient();
  if (!sb) return [];

  try {
    const { data, error } = await sb
      .from('vault_security')
      .select('pin_hash')
      .eq('id', VAULT_CUSTOM_ACCOUNTS_RECORD_ID)
      .maybeSingle();

    if (error || !data || !data.pin_hash) return [];

    const parsed: unknown = JSON.parse(data.pin_hash);
    if (!Array.isArray(parsed)) return [];

    const validAccounts: Account[] = [];
    for (const item of parsed) {
      if (!isRecord(item)) continue;
      if (typeof item.id !== 'string' || !item.id.trim()) continue;
      if (typeof item.name !== 'string' || !item.name.trim()) continue;
      if (typeof item.fullName !== 'string' || !item.fullName.trim()) continue;
      const group: AccountGroup = item.group === 'investment' ? 'investment' : 'liquid';

      validAccounts.push({
        id: item.id.trim().toLowerCase() as AccountId,
        name: item.name.trim().toUpperCase().slice(0, 4),
        fullName: item.fullName.trim(),
        colorClass: typeof item.colorClass === 'string' && item.colorClass ? item.colorClass : 'bg-stone-600',
        colorStyle: typeof item.colorStyle === 'string' && item.colorStyle ? item.colorStyle : undefined,
        group,
        isCustom: true,
      });
    }

    return validAccounts;
  } catch {
    return [];
  }
};

/**
 * Pushes custom accounts to Supabase vault_security table.
 */
export const pushCloudCustomAccounts = async (
  customAccounts: Account[],
  client?: SupabaseClient
): Promise<boolean> => {
  if (!client && !isSupabaseConfigured()) return false;
  const sb = client ?? getSupabaseClient();
  if (!sb) return false;

  try {
    const sanitized = customAccounts.map((acc) => ({
      id: acc.id.trim().toLowerCase(),
      name: acc.name.trim().toUpperCase().slice(0, 4),
      fullName: acc.fullName.trim(),
      colorClass: acc.colorClass || 'bg-stone-600',
      colorStyle: acc.colorStyle || undefined,
      group: acc.group,
      isCustom: true,
    }));

    const { error } = await sb.from('vault_security').upsert({
      id: VAULT_CUSTOM_ACCOUNTS_RECORD_ID,
      pin_salt: VAULT_ACCOUNTS_SALT,
      pin_hash: JSON.stringify(sanitized),
      updated_at: new Date().toISOString(),
    });

    return !error;
  } catch {
    return false;
  }
};

/**
 * Bidirectionally synchronizes custom accounts between local storage and cloud.
 */
export const syncCustomAccountsWithCloud = async (
  currentLocalAccounts?: Account[],
  client?: SupabaseClient
): Promise<Account[]> => {
  const localList = currentLocalAccounts ?? readCustomAccounts();
  if (!client && !isSupabaseConfigured()) return localList;

  try {
    const cloudList = await fetchCloudCustomAccounts(client);
    const mergedMap = new Map<string, Account>();

    // 1. Seed cloud accounts
    for (const acc of cloudList) {
      mergedMap.set(acc.id.toLowerCase(), acc);
    }

    let localHasNew = false;
    // 2. Merge local accounts
    for (const acc of localList) {
      const key = acc.id.toLowerCase();
      if (!mergedMap.has(key)) {
        mergedMap.set(key, acc);
        localHasNew = true;
      } else {
        const existing = mergedMap.get(key)!;
        mergedMap.set(key, {
          ...existing,
          ...acc,
          colorStyle: acc.colorStyle || existing.colorStyle,
        });
      }
    }

    const merged = Array.from(mergedMap.values());

    // 3. Update localStorage if different
    const localKeys = new Set(localList.map((a) => a.id.toLowerCase()));
    const hasDiff = merged.length !== localList.length || merged.some((a) => !localKeys.has(a.id.toLowerCase()));

    if (hasDiff) {
      writeCustomAccounts(merged);
    }

    // 4. Push to cloud if local had new accounts
    if (localHasNew || (cloudList.length === 0 && merged.length > 0)) {
      await pushCloudCustomAccounts(merged, client);
    }

    return merged;
  } catch {
    return localList;
  }
};

/**
 * Returns complete accounts list: default accounts + custom accounts + any account ID referenced in events.
 */
export const getAllAccounts = (
  customAccounts?: Account[],
  events: FinancialEvent[] = []
): Account[] => {
  const custom = customAccounts ?? readCustomAccounts();
  const knownMap = new Map<string, Account>();

  for (const acc of DEFAULT_ACCOUNTS) {
    knownMap.set(acc.id, acc);
  }

  for (const acc of custom) {
    if (!knownMap.has(acc.id)) {
      knownMap.set(acc.id, acc);
    }
  }

  // Scan events to discover any account ID from cloud sync or restored backup
  for (const event of events) {
    const checkId = (id?: string) => {
      if (id && !knownMap.has(id)) {
        knownMap.set(id, {
          id: id as AccountId,
          name: id.toUpperCase().slice(0, 4),
          fullName: id.toUpperCase(),
          colorClass: 'bg-stone-500',
          group: 'liquid',
          isCustom: true,
        });
      }
    };

    if (event.type === 'income' || event.type === 'expense' || event.type === 'refund') {
      checkId(event.accountId);
    } else if (event.type === 'transfer') {
      checkId(event.sourceAccountId);
      checkId(event.destinationAccountId);
    }
  }

  return Array.from(knownMap.values());
};

export const getLiquidAccounts = (allAccounts?: Account[]): Account[] =>
  (allAccounts ?? getAllAccounts()).filter((acc) => acc.group === 'liquid');

export const getInvestmentAccounts = (allAccounts?: Account[]): Account[] =>
  (allAccounts ?? getAllAccounts()).filter((acc) => acc.group === 'investment');

export const isDefaultAccount = (id: string): boolean =>
  DEFAULT_ACCOUNTS.some((acc) => acc.id === id);

export const isLiquidAccount = (id: AccountId, allAccounts?: Account[]): boolean =>
  (allAccounts ?? getAllAccounts()).find((acc) => acc.id === id)?.group === 'liquid';

export const isInvestmentAccount = (id: AccountId, allAccounts?: Account[]): boolean =>
  (allAccounts ?? getAllAccounts()).find((acc) => acc.id === id)?.group === 'investment';

export const getAccountById = (id: string, allAccounts?: Account[]): Account | undefined =>
  (allAccounts ?? getAllAccounts()).find((acc) => acc.id === id);

export const isAccountId = (value: unknown, allAccounts?: Account[]): value is AccountId => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 32) return false;
  return (allAccounts ?? getAllAccounts()).some((acc) => acc.id.toLowerCase() === trimmed);
};

export const isAccountInUse = (id: string, events: FinancialEvent[] = []): boolean => {
  return events.some((event) => {
    if (event.type === 'income' || event.type === 'expense' || event.type === 'refund') {
      return event.accountId === id;
    }
    if (event.type === 'transfer') {
      return event.sourceAccountId === id || event.destinationAccountId === id;
    }
    return false;
  });
};

/**
 * Sanitizes an account name into a valid, unique URL-friendly ID slug.
 */
export const slugifyAccountId = (name: string, existingAccounts: Account[] = getAllAccounts()): string => {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

  const fallback = base || 'acc';
  let candidate = fallback;
  let counter = 2;

  while (existingAccounts.some((a) => a.id === candidate)) {
    candidate = `${fallback}-${counter}`;
    counter++;
  }

  return candidate;
};

export interface ValidateAccountInput {
  fullName: string;
  name: string;
  group: AccountGroup;
  colorClass?: string;
  colorStyle?: string;
}

export const validateAccountInput = (
  input: ValidateAccountInput,
  existingAccounts: Account[]
): { valid: boolean; error?: string; cleanFullName: string; cleanShortCode: string } => {
  const cleanFullName = input.fullName.trim();
  const cleanShortCode = input.name.trim().toUpperCase();

  if (cleanFullName.length === 0) {
    return { valid: false, error: 'Account name cannot be empty', cleanFullName, cleanShortCode };
  }

  if (cleanFullName.length > 30) {
    return { valid: false, error: 'Account name cannot exceed 30 characters', cleanFullName, cleanShortCode };
  }

  if (cleanShortCode.length === 0) {
    return { valid: false, error: 'Short code cannot be empty', cleanFullName, cleanShortCode };
  }

  if (cleanShortCode.length > 4) {
    return { valid: false, error: 'Short code cannot exceed 4 characters', cleanFullName, cleanShortCode };
  }

  const isDuplicateName = existingAccounts.some(
    (acc) => acc.fullName.trim().toLowerCase() === cleanFullName.toLowerCase()
  );

  if (isDuplicateName) {
    return { valid: false, error: `Account "${cleanFullName}" already exists`, cleanFullName, cleanShortCode };
  }

  return { valid: true, cleanFullName, cleanShortCode };
};

export const addCustomAccount = (
  input: ValidateAccountInput,
  events: FinancialEvent[] = []
): { success: boolean; error?: string; account?: Account } => {
  const currentAccounts = getAllAccounts(undefined, events);
  const validation = validateAccountInput(input, currentAccounts);

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const customList = readCustomAccounts();
  const id = slugifyAccountId(validation.cleanFullName, currentAccounts) as AccountId;

  const newAccount: Account = {
    id,
    name: validation.cleanShortCode,
    fullName: validation.cleanFullName,
    group: input.group,
    colorClass: input.colorClass || 'bg-stone-600',
    colorStyle: input.colorStyle || undefined,
    isCustom: true,
  };

  const nextList = [...customList, newAccount];
  writeCustomAccounts(nextList);
  if (isSupabaseConfigured()) {
    pushCloudCustomAccounts(nextList).catch(() => {});
  }
  return { success: true, account: newAccount };
};

export const deleteCustomAccount = (
  id: string,
  events: FinancialEvent[] = []
): { success: boolean; error?: string } => {
  if (isDefaultAccount(id)) {
    return { success: false, error: 'Default system accounts cannot be deleted' };
  }

  if (isAccountInUse(id, events)) {
    return {
      success: false,
      error: 'Cannot delete account: it has existing transactions',
    };
  }

  const customList = readCustomAccounts();
  const nextList = customList.filter((acc) => acc.id !== id);

  writeCustomAccounts(nextList);
  if (isSupabaseConfigured()) {
    pushCloudCustomAccounts(nextList).catch(() => {});
  }
  return { success: true };
};
