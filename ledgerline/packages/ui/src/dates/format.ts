import type { BusinessDate, DateBasis } from '@ledgerline/contracts';
import { dayOfWeek } from './calendar';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export const MONTH_NAMES = MONTHS;

/** "13 Nov 2026": day first, month as a word, so US and European readers see the same date. */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d} ${MONTHS[Number.parseInt(m ?? '1', 10) - 1]} ${y}`;
}

/** "Fri 13 Nov 2026". */
export const formatIsoDateLong = (iso: string): string => `${WEEKDAYS[dayOfWeek(iso)]} ${formatIsoDate(iso)}`;

export const weekdayName = (iso: string): string => WEEKDAYS_LONG[dayOfWeek(iso)] as string;

/** Display text for a business date. Null is a dash; pair it with the "No date" label for screen readers. */
export function formatBusinessDate(date: BusinessDate): string {
  return date.value === null ? '—' : formatIsoDate(date.value);
}

/** "Oct 2026" for a period ending 2026-10-31. */
export function formatPeriod(periodEnd: string): string {
  return `${MONTHS[Number.parseInt(periodEnd.slice(5, 7), 10) - 1]} ${periodEnd.slice(0, 4)}`;
}

export const BASIS_LABELS: Record<DateBasis, string> = {
  trade: 'Trade',
  settle: 'Settle',
  effective: 'Effective',
  ledger: 'Ledger',
  valuation: 'Valuation',
};
