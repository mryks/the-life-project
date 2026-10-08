import { beforeEach, describe, expect, it } from 'vitest';
import {
  FINANCE_STORAGE_KEY,
  FINANCE_STORAGE_VERSION,
  calculateFinanceStats,
  createBackupEnvelope,
  deriveLedgerEntries,
  getAccountBalances,
  getBackupFilename,
  parseAndValidateBackup,
  readFinancialEvents,
  restoreFinancialEvents,
  serializeBackup,
  writeFinancialEvents,
} from '@/lib/finance';
import type { FinancialEvent } from '@/lib/types';
import {
  createCashback,
  createExpense,
  createIncome,
  createRefund,
  createTransfer,
} from './helpers/fixtures';

class LocalStorageMock {
  private store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, value); }
  removeItem(key: string) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

const mockLocalStorage = new LocalStorageMock();

describe('P1.3 Backup, Export and Restore', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: mockLocalStorage,
      dispatchEvent: () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
  });

  // 1. Export contains version 2.
  it('1. export contains version 2 in envelope', () => {
    const events: FinancialEvent[] = [createIncome({ id: 'inc-1' })];
    const envelope = createBackupEnvelope(events);
    expect(envelope.version).toBe(2);
    expect(envelope.exportedAt).toBeDefined();
    expect(typeof envelope.exportedAt).toBe('string');
  });

  // 2. Export contains all FinancialEvent types.
  it('2. export contains all FinancialEvent types', () => {
    const expense = createExpense({ id: 'exp-1' });
    const cashback = createCashback({ id: 'cb-1', relatedEventId: 'exp-1' });
    const refund = createRefund({ id: 'ref-1', relatedEventId: 'exp-1' });
    const income = createIncome({ id: 'inc-1' });
    const transfer = createTransfer({ id: 'trf-1' });

    const events: FinancialEvent[] = [expense, cashback, refund, income, transfer];
    const envelope = createBackupEnvelope(events);

    expect(envelope.events).toHaveLength(5);
    const types = envelope.events.map((e) => e.type);
    expect(types).toContain('income');
    expect(types).toContain('expense');
    expect(types).toContain('transfer');
    expect(types).toContain('refund');
  });

  // 3. Export preserves event IDs.
  it('3. export preserves event IDs exactly', () => {
    const events: FinancialEvent[] = [
      createIncome({ id: 'stable-id-1' }),
      createExpense({ id: 'stable-id-2' }),
    ];
    const envelope = createBackupEnvelope(events);
    expect(envelope.events[0].id).toBe('stable-id-1');
    expect(envelope.events[1].id).toBe('stable-id-2');
  });

  // 4. Export preserves Cashback relationships.
  it('4. export preserves Cashback relationships', () => {
    const expense = createExpense({ id: 'exp-parent' });
    const cashback = createCashback({ id: 'cb-child', relatedEventId: 'exp-parent' });
    const envelope = createBackupEnvelope([expense, cashback]);

    const exportedCb = envelope.events.find((e) => e.id === 'cb-child');
    expect(exportedCb).toBeDefined();
    if (exportedCb && exportedCb.type === 'income') {
      expect(exportedCb.category).toBe('Cashback');
      expect(exportedCb.relatedEventId).toBe('exp-parent');
    }
  });

  // 5. Export preserves Refund relationships.
  it('5. export preserves Refund relationships', () => {
    const expense = createExpense({ id: 'exp-parent' });
    const refund = createRefund({ id: 'ref-child', relatedEventId: 'exp-parent' });
    const envelope = createBackupEnvelope([expense, refund]);

    const exportedRef = envelope.events.find((e) => e.id === 'ref-child');
    expect(exportedRef).toBeDefined();
    if (exportedRef && exportedRef.type === 'refund') {
      expect(exportedRef.relatedEventId).toBe('exp-parent');
    }
  });

  // 6. Export preserves Income amounts, account, and date.
  it('6. export preserves Income amounts, account, and date', () => {
    const income = createIncome({
      id: 'inc-b',
      accountId: 'b',
      amount: 350_000,
      date: '2026-05-10',
    });
    const envelope = createBackupEnvelope([income]);
    expect(envelope.events[0]).toEqual(income);
  });

  // 7. Export does not include derived ledger entries.
  it('7. export does not include derived ledger entries', () => {
    const events: FinancialEvent[] = [
      createTransfer({ id: 'trf-1', amount: 100_000, sourceAccountId: 'g', destinationAccountId: 's' }),
    ];
    const serialized = serializeBackup(events);
    const parsed = JSON.parse(serialized);

    expect(parsed.events[0].direction).toBeUndefined();
    expect(parsed.events[0].counterpartyAccountId).toBeUndefined();
    expect(parsed.ledger).toBeUndefined();
    expect(parsed.ledgerEntries).toBeUndefined();
  });

  // 8. Export does not include balances/reports/charts.
  it('8. export does not include balances, reports, or charts', () => {
    const events: FinancialEvent[] = [
      createIncome({ id: 'inc-1', amount: 5_000_000 }),
      createExpense({ id: 'exp-1', amount: 200_000 }),
    ];
    const serialized = serializeBackup(events);
    const parsed = JSON.parse(serialized);

    expect(parsed.totalBalance).toBeUndefined();
    expect(parsed.accountBalances).toBeUndefined();
    expect(parsed.monthlyIncome).toBeUndefined();
    expect(parsed.monthlyExpense).toBeUndefined();
    expect(parsed.categoryTotals).toBeUndefined();
    expect(parsed.pieData).toBeUndefined();
  });

  // 9. Valid v2 backup imports successfully.
  it('9. valid v2 backup imports successfully', () => {
    const events: FinancialEvent[] = [
      createIncome({ id: 'inc-v2' }),
      createExpense({ id: 'exp-v2' }),
    ];
    const backupJson = serializeBackup(events);
    const result = parseAndValidateBackup(backupJson);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.version).toBe(2);
      expect(result.events).toHaveLength(2);
      expect(result.summary.totalEvents).toBe(2);
      expect(result.summary.incomeCount).toBe(1);
      expect(result.summary.expenseCount).toBe(1);
    }
  });

  // 10. Valid backup replaces the current dataset.
  it('10. valid backup replaces the current dataset completely (no merge)', () => {
    const initialEvents: FinancialEvent[] = [
      createIncome({ id: 'initial-inc', amount: 1_000_000 }),
    ];
    writeFinancialEvents(initialEvents);
    expect(readFinancialEvents()).toHaveLength(1);

    const replacementEvents: FinancialEvent[] = [
      createExpense({ id: 'replacement-exp', amount: 300_000 }),
    ];
    const backupJson = serializeBackup(replacementEvents);
    const parseResult = parseAndValidateBackup(backupJson);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      restoreFinancialEvents(parseResult.events);
    }

    const currentEvents = readFinancialEvents();
    expect(currentEvents).toHaveLength(1);
    expect(currentEvents[0].id).toBe('replacement-exp');
    expect(currentEvents.find((e) => e.id === 'initial-inc')).toBeUndefined();
  });

  // 11. Imported IDs remain unchanged.
  it('11. imported event IDs remain unchanged after restore', () => {
    const events: FinancialEvent[] = [
      createIncome({ id: 'custom-guid-12345' }),
      createExpense({ id: 'custom-guid-67890' }),
    ];
    const backupJson = serializeBackup(events);
    const parseResult = parseAndValidateBackup(backupJson);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      restoreFinancialEvents(parseResult.events);
    }

    const loaded = readFinancialEvents();
    expect(loaded[0].id).toBe('custom-guid-12345');
    expect(loaded[1].id).toBe('custom-guid-67890');
  });

  // 12. Invalid JSON is rejected.
  it('12. invalid JSON is rejected safely without throwing', () => {
    const invalidJson = '{ version: 2, events: [broken json...';
    const result = parseAndValidateBackup(invalidJson);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Malformed JSON');
    }
  });

  // 13. Unsupported version is rejected safely.
  it('13. unsupported backup version (0, 3, 99) is rejected safely', () => {
    for (const badVersion of [0, 3, 99]) {
      const badJson = JSON.stringify({
        version: badVersion,
        events: [createIncome({ id: 'inc-1' })],
      });
      const result = parseAndValidateBackup(badJson);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain(`Unsupported backup version: ${badVersion}`);
      }
    }
  });

  // 14. Invalid event is rejected safely.
  it('14. invalid event (e.g. non-integer or negative amount) is rejected safely', () => {
    const badJson = JSON.stringify({
      version: 2,
      events: [
        {
          id: 'bad-amount',
          date: '2026-10-02',
          description: 'invalid',
          amount: -500, // Negative amount for normal expense
          type: 'expense',
          accountId: 'g',
          category: 'Food & Drinks',
        },
      ],
    });
    const result = parseAndValidateBackup(badJson);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('invalid or malformed financial events');
    }
  });

  // 15. Duplicate event IDs are rejected safely.
  it('15. duplicate event IDs are rejected safely', () => {
    const duplicateJson = JSON.stringify({
      version: 2,
      events: [
        createIncome({ id: 'same-id' }),
        createExpense({ id: 'same-id' }),
      ],
    });
    const result = parseAndValidateBackup(duplicateJson);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('domain invariants');
    }
  });

  // 16. Orphan Cashback is rejected safely.
  it('16. orphan Cashback referencing non-existent expense is rejected', () => {
    const orphanCb = JSON.stringify({
      version: 2,
      events: [
        createCashback({ id: 'cb-orphan', relatedEventId: 'missing-expense-id' }),
      ],
    });
    const result = parseAndValidateBackup(orphanCb);
    expect(result.success).toBe(false);
  });

  // 17. Orphan Refund is rejected safely.
  it('17. orphan Refund referencing non-existent expense is rejected', () => {
    const orphanRef = JSON.stringify({
      version: 2,
      events: [
        createRefund({ id: 'ref-orphan', relatedEventId: 'missing-expense-id' }),
      ],
    });
    const result = parseAndValidateBackup(orphanRef);
    expect(result.success).toBe(false);
  });

  // 18. Refund total exceeding Expense is rejected safely.
  it('18. refund total exceeding original Expense is rejected safely', () => {
    const expense = createExpense({ id: 'exp-100k', amount: 100_000 });
    const refund = createRefund({ id: 'ref-150k', relatedEventId: 'exp-100k', amount: 150_000 });

    const json = JSON.stringify({
      version: 2,
      events: [expense, refund],
    });
    const result = parseAndValidateBackup(json);
    expect(result.success).toBe(false);
  });

  // 19. Invalid event type is rejected safely.
  it('19. invalid event type is rejected safely', () => {
    const json = JSON.stringify({
      version: 2,
      events: [{ id: 'bad-1', date: '2026-10-02', description: 'bad', amount: 100_000, type: 'unknown-type', accountId: 'g' }],
    });
    const result = parseAndValidateBackup(json);
    expect(result.success).toBe(false);
  });

  // 20. Invalid IncomeCategory is rejected safely.
  it('20. invalid IncomeCategory is rejected safely', () => {
    const badCat = JSON.stringify({
      version: 2,
      events: [
        {
          id: 'bad-cat',
          date: '2026-10-02',
          description: 'Bonus',
          amount: 500_000,
          type: 'income',
          accountId: 'g',
          category: 'BonusUnknown',
        },
      ],
    });
    const result = parseAndValidateBackup(badCat);
    expect(result.success).toBe(false);
  });

  // 21. Legacy "Other" is handled only through the migration boundary.
  it('21. legacy "Other" is rejected in v2 backup, but accepted and migrated in v1 backup', () => {
    // Rejected in v2
    const v2Other = JSON.stringify({
      version: 2,
      events: [
        {
          id: 'v2-other',
          date: '2026-10-02',
          description: 'Other income',
          amount: 100_000,
          type: 'income',
          accountId: 'g',
          category: 'Other',
        },
      ],
    });
    const v2Result = parseAndValidateBackup(v2Other);
    expect(v2Result.success).toBe(false);

    // Accepted and normalized in v1
    const v1Other = JSON.stringify({
      version: 1,
      events: [
        {
          id: 'v1-other',
          date: '2026-10-02',
          description: 'Other income',
          amount: 100_000,
          type: 'income',
          accountId: 'g',
          category: 'Other',
        },
      ],
    });
    const v1Result = parseAndValidateBackup(v1Other);
    expect(v1Result.success).toBe(true);
    if (v1Result.success) {
      expect(v1Result.events[0].type).toBe('income');
      if (v1Result.events[0].type === 'income') {
        expect(v1Result.events[0].category).toBe('Others');
      }
    }
  });

  // 22. Legacy v1/unversioned data imports safely when supported.
  it('22. legacy unversioned array backup imports safely and migrates', () => {
    const unversionedArray = JSON.stringify([
      {
        id: 'legacy-exp-1',
        date: '2026-10-02',
        description: 'Snacks',
        amount: 50_000,
        type: 'expense',
        accountId: 'b',
        category: 'Food & Drinks',
      },
    ]);
    const result = parseAndValidateBackup(unversionedArray);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.version).toBe(1);
      expect(result.events[0].id).toBe('legacy-exp-1');
    }
  });

  // 23. Failed import leaves current dataset unchanged.
  it('23. failed import leaves current dataset completely unchanged', () => {
    const currentEvents: FinancialEvent[] = [
      createIncome({ id: 'keep-me', amount: 1_234_567 }),
    ];
    writeFinancialEvents(currentEvents);

    const badBackup = '{ version: 2, broken json';
    const result = parseAndValidateBackup(badBackup);
    expect(result.success).toBe(false);

    // Data in storage and memory remains exactly as was
    const remaining = readFinancialEvents();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('keep-me');
    expect(remaining[0].amount).toBe(1_234_567);
  });

  // 24. Cancelled import leaves current dataset unchanged.
  it('24. cancelling import before calling restoreFinancialEvents leaves current dataset unchanged', () => {
    const currentEvents: FinancialEvent[] = [
      createExpense({ id: 'current-tx', amount: 99_000 }),
    ];
    writeFinancialEvents(currentEvents);

    const validNewEvents: FinancialEvent[] = [
      createIncome({ id: 'new-tx', amount: 500_000 }),
    ];
    const validBackup = serializeBackup(validNewEvents);
    const result = parseAndValidateBackup(validBackup);
    expect(result.success).toBe(true);

    // Simulate user clicking "Cancel": restoreFinancialEvents is NOT called
    const active = readFinancialEvents();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('current-tx');
  });

  // 25. Imported derived data is NOT persisted as a second source of truth.
  it('25. restored state only persists { version: 2, events } in localStorage', () => {
    const events: FinancialEvent[] = [
      createIncome({ id: 'inc-g', accountId: 'g', amount: 1_000_000 }),
      createExpense({ id: 'exp-1', amount: 200_000 }),
    ];
    const backup = serializeBackup(events);
    const parsed = parseAndValidateBackup(backup);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      restoreFinancialEvents(parsed.events);
    }

    const rawStored = window.localStorage.getItem(FINANCE_STORAGE_KEY);
    expect(rawStored).not.toBeNull();
    const parsedStored = JSON.parse(rawStored!);

    expect(Object.keys(parsedStored).sort()).toEqual(['events', 'version']);
    expect(parsedStored.version).toBe(FINANCE_STORAGE_VERSION);
    expect(parsedStored.exportedAt).toBeUndefined();
    expect(parsedStored.totalBalance).toBeUndefined();
    expect(parsedStored.balances).toBeUndefined();
  });

  // 26. Successful restore reconstructs balances/reports from imported events.
  it('26. successful restore reconstructs balances and reports deterministically', () => {
    const events: FinancialEvent[] = [
      createIncome({ id: 'inc-1', accountId: 'g', amount: 3_000_000, date: '2026-10-02' }),
      createExpense({ id: 'exp-1', accountId: 'g', amount: 500_000, date: '2026-10-03' }),
    ];
    const backup = serializeBackup(events);
    const parsed = parseAndValidateBackup(backup);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      restoreFinancialEvents(parsed.events);
    }

    const restoredEvents = readFinancialEvents();
    const balances = getAccountBalances(restoredEvents);
    expect(balances['g']).toBe(2_500_000);

    const stats = calculateFinanceStats(restoredEvents, '2026-10-05');
    expect(stats.totalBalance).toBe(2_500_000);
    expect(stats.monthlyIncome).toBe(3_000_000);
    expect(stats.monthlyExpense).toBe(500_000);

    const ledger = deriveLedgerEntries(restoredEvents);
    expect(ledger).toHaveLength(2);
  });

  // 27. Exporting after restore produces an equivalent financial dataset.
  it('27. exporting after restore produces an equivalent financial dataset', () => {
    const originalEvents: FinancialEvent[] = [
      createIncome({ id: 'inc-1', accountId: 'g', amount: 10_000_000 }),
      createExpense({ id: 'exp-1', accountId: 'g', amount: 200_000 }),
      createCashback({ id: 'cb-1', accountId: 'g', amount: 20_000, relatedEventId: 'exp-1' }),
      createTransfer({ id: 'trf-1', sourceAccountId: 'g', destinationAccountId: 's', amount: 500_000 }),
    ];
    const initialBackup = serializeBackup(originalEvents);
    const parseResult = parseAndValidateBackup(initialBackup);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      restoreFinancialEvents(parseResult.events);
    }

    const currentEvents = readFinancialEvents();
    const secondaryBackup = serializeBackup(currentEvents);
    const secondaryParse = parseAndValidateBackup(secondaryBackup);
    expect(secondaryParse.success).toBe(true);
    if (secondaryParse.success) {
      expect(secondaryParse.events).toEqual(originalEvents);
    }
  });

  // 28. Defensive restore validation boundary.
  it('28. restoreFinancialEvents has a defensive validation boundary rejecting invalid events', () => {
    const invalidEvents = [
      createExpense({ id: 'duplicate-id' }),
      createExpense({ id: 'duplicate-id' }),
    ];
    expect(() => restoreFinancialEvents(invalidEvents)).toThrowError(
      'Cannot restore invalid financial events: dataset failed financial validation.'
    );
  });

  it('29. getBackupFilename generates format the-life-project-backup-YYYY-MM-DD.json', () => {
    const filename = getBackupFilename('2026-09-29');
    expect(filename).toBe('the-life-project-backup-2026-09-29.json');
  });
});
