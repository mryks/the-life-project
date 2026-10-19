// Storage key for session-scoped privacy masking of nominals
export const PRIVACY_STORAGE_KEY = 'thelife-hide-nominals';
export const PRIVACY_CHANGE_EVENT = 'thelife-privacy-change';

/**
 * Reads the hide nominals preference from sessionStorage.
 * Default behavior: Nominals are HIDDEN (true) unless explicitly toggled during the active session.
 */
export function readHideNominals(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = window.sessionStorage.getItem(PRIVACY_STORAGE_KEY);
    // Only if explicitly set to 'false' do we reveal nominals. Default is true (hidden).
    return val !== 'false';
  } catch {
    return true;
  }
}

/**
 * Writes the hide nominals preference to sessionStorage and dispatches a change event.
 */
export function writeHideNominals(hide: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PRIVACY_STORAGE_KEY, String(hide));
    window.dispatchEvent(new CustomEvent(PRIVACY_CHANGE_EVENT, { detail: { hide } }));
  } catch {
    // Graceful fallback for restricted environments
  }
}

/**
 * Standard masked nominal representation
 */
export const MASKED_NOMINAL = 'Rp ••••••';

/**
 * Formats a nominal amount, returning MASKED_NOMINAL when hideNominals is true.
 */
export function formatMaskedNominal(
  amount: number,
  hideNominals: boolean,
  formatter: (n: number) => string,
  options?: {
    prefix?: string;
    showPlusSign?: boolean;
    isExpense?: boolean;
    suffix?: string;
  }
): string {
  const prefix = options?.prefix ?? '';
  const suffix = options?.suffix ?? '';
  const showPlusSign = options?.showPlusSign ?? false;
  const isExpense = options?.isExpense ?? false;

  if (hideNominals) {
    if (showPlusSign) return `+Rp ••••••${suffix}`;
    if (isExpense) return `-Rp ••••••${suffix}`;
    return `${prefix ? `${prefix} ` : ''}Rp ••••••${suffix}`;
  }

  const formatted = formatter(amount);
  if (showPlusSign && amount > 0) return `+${formatted}${suffix}`;
  if (isExpense && amount > 0) return `-${formatted}${suffix}`;
  return `${prefix ? `${prefix} ` : ''}${formatted}${suffix}`;
}
