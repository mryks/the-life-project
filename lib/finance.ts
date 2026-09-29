import { accounts } from './accounts';
import type {
  AccountId,
  ExpenseCategory,
  FinancialEvent,
  IncomeCategory,
  IncomeEvent,
  LedgerEntry,
  OpeningBalanceEvent,
  BackupParseResult,
  BackupSummary,
  FinancialBackupEnvelope,
} from './types';
import { GO_LIVE_DATE, OPENING_BALANCE_DATE, incomeCategories } from './types';

export const FINANCE_STORAGE_KEY = 'thelife-finance';
export const FINANCE_STORAGE_VERSION = 2;
const FINANCE_CHANGE_EVENT = 'thelife-finance-change';

export const expenseCategories: ExpenseCategory[] = [
  'Home & Family', 'Food & Drinks', 'Transportation', 'Shopping', 'Utilities',
  'Medical', 'Investments', '𝓡', 'Other',
];

export { incomeCategories };

export const isIncomeCategory = (value: unknown): value is IncomeCategory =>
  typeof value === 'string' && (incomeCategories as readonly string[]).includes(value);

export interface FinanceStats {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  categoryTotals: Record<ExpenseCategory, number>;
  pieData: Array<{ name: ExpenseCategory; value: number }>;
}

export interface ParsedStorage {
  events: FinancialEvent[];
  shouldPersist: boolean;
}

let cachedStorageValue: string | null | undefined;
let cachedEvents: FinancialEvent[] = [];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isAccountId = (value: unknown): value is AccountId =>
  typeof value === 'string' && accounts.some((account) => account.id === value);

const isExpenseCategory = (value: unknown): value is ExpenseCategory =>
  typeof value === 'string' && expenseCategories.includes(value as ExpenseCategory);

const isDateOnly = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
};

const isEventBase = (value: Record<string, unknown>): value is Record<string, unknown> & {
  id: string;
  date: string;
  description: string;
  amount: number;
} =>
  typeof value.id === 'string' && value.id.trim().length > 0 &&
  isDateOnly(value.date) && typeof value.description === 'string' && value.description.trim().length > 0 &&
  typeof value.amount === 'number' && Number.isSafeInteger(value.amount);

export const isPrototypeSeedEvent = (event: FinancialEvent): boolean =>
  event.type === 'income' &&
  event.accountId === 'g' &&
  event.amount === 18565800 &&
  event.description === 'initial balance' &&
  (event.id === 'prototype-initial-balance' || event.id === '1');

export const parseEvent = (value: unknown): FinancialEvent | null => {
  if (!isRecord(value) || !isEventBase(value) || typeof value.type !== 'string') return null;

  if (value.type === 'opening-balance') {
    if ('category' in value || 'relatedEventId' in value || 'sourceAccountId' in value || 'destinationAccountId' in value) return null;
    if (!isAccountId(value.accountId) || value.date !== OPENING_BALANCE_DATE) return null;
    return {
      id: value.id,
      date: OPENING_BALANCE_DATE,
      description: value.description,
      amount: value.amount,
      type: 'opening-balance',
      accountId: value.accountId,
    };
  }

  // Normal financial events must have positive amounts
  if (value.amount <= 0) return null;

  if (value.type === 'income') {
    if (!isAccountId(value.accountId) || !isIncomeCategory(value.category)) return null;
    const isCashback = value.category === 'Cashback';
    if (isCashback && (typeof value.relatedEventId !== 'string' || value.relatedEventId.length === 0)) return null;
    if (!isCashback && value.relatedEventId !== undefined) return null;
    const event: IncomeEvent = {
      id: value.id,
      date: value.date,
      description: value.description,
      amount: value.amount,
      type: 'income',
      accountId: value.accountId,
      category: value.category,
      ...(isCashback ? { relatedEventId: value.relatedEventId as string } : {}),
    };
    return event;
  }
  if (value.type === 'expense') {
    if (!isAccountId(value.accountId) || !isExpenseCategory(value.category)) return null;
    return { id: value.id, date: value.date, description: value.description, amount: value.amount, type: 'expense', accountId: value.accountId, category: value.category };
  }
  if (value.type === 'transfer') {
    if ('category' in value || !isAccountId(value.sourceAccountId) || !isAccountId(value.destinationAccountId) || value.sourceAccountId === value.destinationAccountId) return null;
    return { id: value.id, date: value.date, description: value.description, amount: value.amount, type: 'transfer', sourceAccountId: value.sourceAccountId, destinationAccountId: value.destinationAccountId };
  }
  if (value.type === 'refund') {
    if ('category' in value || !isAccountId(value.accountId) || typeof value.relatedEventId !== 'string' || value.relatedEventId.length === 0) return null;
    return { id: value.id, date: value.date, description: value.description, amount: value.amount, type: 'refund', accountId: value.accountId, relatedEventId: value.relatedEventId };
  }
  return null;
};

export const validateFinancialEvents = (events: FinancialEvent[]): boolean => {
  const parsedEvents = events.map(parseEvent);
  if (parsedEvents.some((event): event is null => event === null)) return false;
  const validEvents = parsedEvents as FinancialEvent[];
  const eventById = new Map<string, FinancialEvent>();
  const openingBalanceAccounts = new Set<AccountId>();

  for (const event of validEvents) {
    if (eventById.has(event.id)) return false;
    eventById.set(event.id, event);
    if (event.type === 'opening-balance') {
      if (openingBalanceAccounts.has(event.accountId)) return false;
      openingBalanceAccounts.add(event.accountId);
    }
  }

  const cashbackParents = new Set<string>();
  const refundsByExpense = new Map<string, number>();
  for (const event of validEvents) {
    if (event.type === 'income') {
      const isCashback = event.category === 'Cashback';
      if (isCashback !== Boolean(event.relatedEventId)) return false;
      if (event.relatedEventId) {
        const parent = eventById.get(event.relatedEventId);
        if (!parent || parent.type !== 'expense' || parent.accountId !== event.accountId || cashbackParents.has(parent.id)) return false;
        cashbackParents.add(parent.id);
      }
    }
    if (event.type === 'refund') {
      const parent = eventById.get(event.relatedEventId);
      if (!parent || parent.type !== 'expense' || parent.accountId !== event.accountId) return false;
      refundsByExpense.set(parent.id, (refundsByExpense.get(parent.id) ?? 0) + event.amount);
    }
  }
  return [...refundsByExpense].every(([expenseId, totalRefunds]) => {
    const expense = eventById.get(expenseId);
    return expense?.type === 'expense' && totalRefunds <= expense.amount;
  });
};

export const hasOpeningBalanceEvents = (events: FinancialEvent[]): boolean =>
  events.some((event) => event.type === 'opening-balance');

export const validateNormalTransactionDate = (
  date: string,
  hasOpeningBalances: boolean
): boolean => {
  if (!isDateOnly(date)) return false;
  if (hasOpeningBalances && date < GO_LIVE_DATE) return false;
  return true;
};

const migrateLegacyEvents = (value: unknown[]): FinancialEvent[] | null => {
  const events: FinancialEvent[] = [];
  for (const item of value) {
    if (!isRecord(item) || !isEventBase(item) || typeof item.type !== 'string') return null;
    if (item.type === 'income' && isAccountId(item.accountId)) {
      if (
        item.accountId === 'g' &&
        item.amount === 18565800 &&
        item.description === 'initial balance' &&
        (item.id === 'prototype-initial-balance' || item.id === '1')
      ) {
        events.push({
          id: item.id,
          date: OPENING_BALANCE_DATE,
          description: 'Opening balance',
          amount: 18565800,
          type: 'opening-balance',
          accountId: 'g',
        });
      } else {
        const category: IncomeCategory = item.category === 'Other'
          ? 'Others'
          : isIncomeCategory(item.category)
            ? item.category
            : 'Others';
        events.push({ id: item.id, date: item.date, description: item.description, amount: item.amount, type: 'income', accountId: item.accountId, category });
      }
    } else if (item.type === 'expense' && isAccountId(item.accountId)) {
      events.push({ id: item.id, date: item.date, description: item.description, amount: item.amount, type: 'expense', accountId: item.accountId, category: isExpenseCategory(item.category) ? item.category : 'Other' });
    } else if (item.type === 'transfer' && isAccountId(item.accountId) && isAccountId(item.destinationId) && item.accountId !== item.destinationId) {
      events.push({ id: item.id, date: item.date, description: item.description, amount: item.amount, type: 'transfer', sourceAccountId: item.accountId, destinationAccountId: item.destinationId });
    } else return null;
  }
  return validateFinancialEvents(events) ? events : null;
};

export const parseStoredEvents = (value: string | null): ParsedStorage => {
  if (value === null) {
    return {
      events: [{
        id: 'prototype-opening-balance-g',
        date: OPENING_BALANCE_DATE,
        description: 'Opening balance',
        amount: 18565800,
        type: 'opening-balance',
        accountId: 'g',
      }],
      shouldPersist: true,
    };
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const events = migrateLegacyEvents(parsed);
      return { events: events ?? [], shouldPersist: events !== null };
    }
    if (!isRecord(parsed) || !Array.isArray(parsed.events)) return { events: [], shouldPersist: false };

    if (parsed.version === 1) {
      const rawEvents = parsed.events.map((event: unknown) => {
        if (isRecord(event) && event.type === 'income' && event.category === 'Other') {
          return parseEvent({ ...event, category: 'Others' });
        }
        return parseEvent(event);
      });
      if (rawEvents.some((event): event is null => event === null)) return { events: [], shouldPersist: false };
      const migratedEvents = (rawEvents as FinancialEvent[]).map((event): FinancialEvent => {
        if (isPrototypeSeedEvent(event)) {
          return {
            id: event.id,
            date: OPENING_BALANCE_DATE,
            description: 'Opening balance',
            amount: event.amount,
            type: 'opening-balance',
            accountId: 'g',
          };
        }
        return event;
      });
      return validateFinancialEvents(migratedEvents)
        ? { events: migratedEvents, shouldPersist: true }
        : { events: [], shouldPersist: false };
    }

    if (parsed.version === FINANCE_STORAGE_VERSION) {
      const events = parsed.events.map(parseEvent);
      if (events.some((event): event is null => event === null)) return { events: [], shouldPersist: false };
      const validEvents = events as FinancialEvent[];
      return validateFinancialEvents(validEvents) ? { events: validEvents, shouldPersist: false } : { events: [], shouldPersist: false };
    }

    return { events: [], shouldPersist: false };
  } catch {
    return { events: [], shouldPersist: false };
  }
};

export const serializeEvents = (events: FinancialEvent[]) => JSON.stringify({ version: FINANCE_STORAGE_VERSION, events });

export const readFinancialEvents = (): FinancialEvent[] => {
  if (typeof window === 'undefined') return cachedEvents;
  const value = window.localStorage.getItem(FINANCE_STORAGE_KEY);
  if (value === cachedStorageValue) return cachedEvents;
  const parsed = parseStoredEvents(value);
  cachedEvents = parsed.events;
  cachedStorageValue = value;
  if (parsed.shouldPersist) writeFinancialEvents(cachedEvents);
  return cachedEvents;
};

export const writeFinancialEvents = (events: FinancialEvent[]): void => {
  if (!validateFinancialEvents(events)) throw new Error('Cannot persist invalid financial events.');
  if (typeof window === 'undefined') return;
  const value = serializeEvents(events);
  window.localStorage.setItem(FINANCE_STORAGE_KEY, value);
  cachedStorageValue = value;
  cachedEvents = events;
  window.dispatchEvent(new Event(FINANCE_CHANGE_EVENT));
};

export const subscribeToFinancialEvents = (listener: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === FINANCE_STORAGE_KEY) {
      cachedStorageValue = undefined;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(FINANCE_CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(FINANCE_CHANGE_EVENT, listener);
  };
};

export const compareEventsNewestFirst = (left: FinancialEvent, right: FinancialEvent): number =>
  right.date.localeCompare(left.date) || right.id.localeCompare(left.id);

export const deriveLedgerEntries = (events: FinancialEvent[]): LedgerEntry[] => {
  const expenseById = new Map(events.filter((event) => event.type === 'expense').map((event) => [event.id, event]));
  const entries = events.flatMap((event): LedgerEntry[] => {
    if (event.type === 'opening-balance') {
      return [{
        eventId: event.id,
        date: event.date,
        description: event.description || 'Opening balance',
        accountId: event.accountId,
        amount: Math.abs(event.amount),
        direction: event.amount >= 0 ? 'in' : 'out',
        eventType: event.type,
      }];
    }
    if (event.type === 'transfer') return [
      { eventId: event.id, date: event.date, description: event.description, accountId: event.sourceAccountId, amount: event.amount, direction: 'out', eventType: event.type, counterpartyAccountId: event.destinationAccountId },
      { eventId: event.id, date: event.date, description: event.description, accountId: event.destinationAccountId, amount: event.amount, direction: 'in', eventType: event.type, counterpartyAccountId: event.sourceAccountId },
    ];
    if (event.type === 'refund') return [{ eventId: event.id, date: event.date, description: event.description, accountId: event.accountId, amount: event.amount, direction: 'in', eventType: event.type, category: expenseById.get(event.relatedEventId)?.category }];
    return [{ eventId: event.id, date: event.date, description: event.description, accountId: event.accountId, amount: event.amount, direction: event.type === 'expense' ? 'out' : 'in', eventType: event.type, category: event.category }];
  });
  return entries.sort((left, right) => right.date.localeCompare(left.date) || right.eventId.localeCompare(left.eventId) || left.direction.localeCompare(right.direction));
};

export const getAccountBalances = (events: FinancialEvent[]): Record<AccountId, number> => {
  const balances = Object.fromEntries(accounts.map((account) => [account.id, 0])) as Record<AccountId, number>;
  for (const entry of deriveLedgerEntries(events)) balances[entry.accountId] += entry.direction === 'in' ? entry.amount : -entry.amount;
  return balances;
};

export const calculateFinanceStats = (events: FinancialEvent[], currentDate: string): FinanceStats => {
  const month = currentDate.slice(0, 7);
  const expensesById = new Map(events.filter((event) => event.type === 'expense').map((event) => [event.id, event]));
  const categoryTotals = Object.fromEntries(expenseCategories.map((category) => [category, 0])) as Record<ExpenseCategory, number>;
  let monthlyIncome = 0;
  let monthlyExpense = 0;
  for (const event of events) {
    if (!event.date.startsWith(month)) continue;
    if (event.type === 'income') monthlyIncome += event.amount;
    if (event.type === 'expense') {
      monthlyExpense += event.amount;
      categoryTotals[event.category] += event.amount;
    }
    if (event.type === 'refund') {
      const originalExpense = expensesById.get(event.relatedEventId);
      if (originalExpense) {
        monthlyExpense -= event.amount;
        categoryTotals[originalExpense.category] -= event.amount;
      }
    }
  }
  const totalBalance = deriveLedgerEntries(events).reduce((total, entry) => total + (entry.direction === 'in' ? entry.amount : -entry.amount), 0);
  return { totalBalance, monthlyIncome, monthlyExpense, categoryTotals, pieData: expenseCategories.filter((category) => categoryTotals[category] !== 0).map((name) => ({ name, value: categoryTotals[name] })) };
};

export const calculateNetExpenseForDate = (events: FinancialEvent[], date: string): number => {
  return events.reduce((total, event) => {
    if (event.date !== date) return total;
    if (event.type === 'expense') return total + event.amount;
    return event.type === 'refund' ? total - event.amount : total;
  }, 0);
};

export const deleteFinancialEvent = (events: FinancialEvent[], eventId: string): FinancialEvent[] => {
  const event = events.find((candidate) => candidate.id === eventId);
  if (!event) return events;
  return event.type === 'expense'
    ? events.filter((candidate) => candidate.id !== eventId && (!('relatedEventId' in candidate) || candidate.relatedEventId !== eventId))
    : events.filter((candidate) => candidate.id !== eventId);
};

const hasRelatedEvents = (events: FinancialEvent[], expenseId: string): boolean =>
  events.some((event) => 'relatedEventId' in event && event.relatedEventId === expenseId);

export const replaceFinancialEvent = (events: FinancialEvent[], replacement: FinancialEvent): FinancialEvent[] | null => {
  const previous = events.find((event) => event.id === replacement.id);
  if (!previous) return null;
  if (previous.type === 'transfer' || replacement.type === 'transfer') {
    if (previous.type !== 'transfer' || replacement.type !== 'transfer') return null;
  }
  if (previous.type === 'opening-balance' || replacement.type === 'opening-balance') {
    if (previous.type !== 'opening-balance' || replacement.type !== 'opening-balance') return null;
  }
  if (previous.type === 'refund' || replacement.type === 'refund') {
    if (previous.type !== 'refund' || replacement.type !== 'refund') return null;
  }
  if (previous.type === 'expense' && replacement.type !== 'expense' && hasRelatedEvents(events, previous.id)) return null;
  if (previous.type === 'income' && previous.relatedEventId) return null;
  const next = events.map((event) => event.id === replacement.id ? replacement : event);
  return validateFinancialEvents(next) ? next : null;
};

export const createEventId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `event-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const todayDate = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

export const isPositiveInteger = (value: number): boolean => Number.isSafeInteger(value) && value > 0;

export const getOpeningBalances = (events: FinancialEvent[]): Record<AccountId, OpeningBalanceEvent | undefined> => {
  const map = Object.fromEntries(accounts.map((acc) => [acc.id, undefined])) as Record<AccountId, OpeningBalanceEvent | undefined>;
  for (const event of events) {
    if (event.type === 'opening-balance') {
      map[event.accountId] = event;
    }
  }
  return map;
};

export const setOpeningBalance = (
  events: FinancialEvent[],
  accountId: AccountId,
  amount: number
): FinancialEvent[] => {
  if (!Number.isSafeInteger(amount)) throw new Error('Opening balance amount must be an integer.');
  const existing = events.find(
    (event): event is OpeningBalanceEvent => event.type === 'opening-balance' && event.accountId === accountId
  );
  const updatedEvent: OpeningBalanceEvent = {
    id: existing ? existing.id : createEventId(),
    date: OPENING_BALANCE_DATE,
    description: 'Opening balance',
    amount,
    type: 'opening-balance',
    accountId,
  };
  const nextEvents = existing
    ? events.map((event) => (event.id === existing.id ? updatedEvent : event))
    : [...events, updatedEvent];
  if (!validateFinancialEvents(nextEvents)) {
    throw new Error('Setting opening balance resulted in invalid financial events.');
  }
  return nextEvents;
};

export const clearOpeningBalance = (
  events: FinancialEvent[],
  accountId: AccountId
): FinancialEvent[] => {
  const nextEvents = events.filter(
    (event) => !(event.type === 'opening-balance' && event.accountId === accountId)
  );
  if (!validateFinancialEvents(nextEvents)) {
    throw new Error('Clearing opening balance resulted in invalid financial events.');
  }
  return nextEvents;
};

export const hasNormalTransactionsForAccount = (
  events: FinancialEvent[],
  accountId: AccountId
): boolean => {
  return events.some((event) => {
    if (event.type === 'opening-balance') return false;
    if (event.type === 'transfer') {
      return event.sourceAccountId === accountId || event.destinationAccountId === accountId;
    }
    return event.accountId === accountId;
  });
};

export const createBackupEnvelope = (events: FinancialEvent[]): FinancialBackupEnvelope => ({
  version: FINANCE_STORAGE_VERSION,
  exportedAt: new Date().toISOString(),
  events,
});

export const serializeBackup = (events: FinancialEvent[]): string =>
  JSON.stringify(createBackupEnvelope(events), null, 2);

export const getBackupFilename = (date: string = todayDate()): string =>
  `the-life-project-backup-${date}.json`;

export const summarizeEvents = (events: FinancialEvent[]): BackupSummary => {
  const openingBalanceAccounts = new Set<AccountId>();
  let incomeCount = 0;
  let expenseCount = 0;
  let transferCount = 0;
  let refundCount = 0;

  for (const event of events) {
    if (event.type === 'opening-balance') {
      openingBalanceAccounts.add(event.accountId);
    } else if (event.type === 'income') {
      incomeCount += 1;
    } else if (event.type === 'expense') {
      expenseCount += 1;
    } else if (event.type === 'transfer') {
      transferCount += 1;
    } else if (event.type === 'refund') {
      refundCount += 1;
    }
  }

  return {
    totalEvents: events.length,
    openingBalanceAccounts: openingBalanceAccounts.size,
    incomeCount,
    expenseCount,
    transferCount,
    refundCount,
  };
};

export const parseAndValidateBackup = (rawText: string): BackupParseResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { success: false, error: 'Malformed JSON: Unable to parse file.' };
  }

  if (Array.isArray(parsed)) {
    const migrated = migrateLegacyEvents(parsed);
    if (!migrated) {
      return { success: false, error: 'Legacy backup contains invalid financial events.' };
    }
    return {
      success: true,
      version: 1,
      events: migrated,
      summary: summarizeEvents(migrated),
    };
  }

  if (!isRecord(parsed)) {
    return { success: false, error: 'Invalid backup format: root must be a JSON object or array.' };
  }

  if (parsed.version === 1) {
    if (!Array.isArray(parsed.events)) {
      return { success: false, error: 'Invalid v1 backup: "events" must be an array.' };
    }
    const rawEvents = parsed.events.map((event: unknown) => {
      if (isRecord(event) && event.type === 'income' && event.category === 'Other') {
        return parseEvent({ ...event, category: 'Others' });
      }
      return parseEvent(event);
    });
    if (rawEvents.some((event): event is null => event === null)) {
      return { success: false, error: 'V1 backup contains malformed events.' };
    }
    const migratedEvents = (rawEvents as FinancialEvent[]).map((event): FinancialEvent => {
      if (isPrototypeSeedEvent(event)) {
        return {
          id: event.id,
          date: OPENING_BALANCE_DATE,
          description: 'Opening balance',
          amount: event.amount,
          type: 'opening-balance',
          accountId: 'g',
        };
      }
      return event;
    });
    if (!validateFinancialEvents(migratedEvents)) {
      return { success: false, error: 'V1 backup violates financial domain invariants.' };
    }
    return {
      success: true,
      version: 1,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : undefined,
      events: migratedEvents,
      summary: summarizeEvents(migratedEvents),
    };
  }

  if (parsed.version === FINANCE_STORAGE_VERSION) {
    if (!Array.isArray(parsed.events)) {
      return { success: false, error: 'Invalid v2 backup: "events" must be an array.' };
    }
    const parsedEvents = parsed.events.map(parseEvent);
    if (parsedEvents.some((event): event is null => event === null)) {
      return { success: false, error: 'Backup contains invalid or malformed financial events.' };
    }
    const validEvents = parsedEvents as FinancialEvent[];
    if (!validateFinancialEvents(validEvents)) {
      return { success: false, error: 'Backup violates financial domain invariants.' };
    }
    return {
      success: true,
      version: 2,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : undefined,
      events: validEvents,
      summary: summarizeEvents(validEvents),
    };
  }

  return {
    success: false,
    error: `Unsupported backup version: ${String(parsed.version)}.`,
  };
};

/**
 * Defensive restore boundary:
 * Re-validates the events using the authoritative validator before persistence.
 * Impossibility of persisting unvalidated FinancialEvent[] guaranteed.
 */
export const restoreFinancialEvents = (events: FinancialEvent[]): void => {
  if (!validateFinancialEvents(events)) {
    throw new Error('Cannot restore invalid financial events: dataset failed financial validation.');
  }
  writeFinancialEvents(events);
};

export const downloadBackupFile = (content: string, filename: string): void => {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
