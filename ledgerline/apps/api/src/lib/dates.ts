/**
 * Business-date helpers on ISO YYYY-MM-DD strings.
 * Pure integer calendar maths: no `Date`, so no timezone can shift a business date.
 */

/** Days since 1970-01-01 for a civil date (Howard Hinnant's algorithm). */
export function toEpochDay(iso: string): number {
  const y0 = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const y = m <= 2 ? y0 - 1 : y0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromEpochDay(day: number): string {
  const z = day + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  const pad = (n: number, w: number) => String(n).padStart(w, '0');
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

export const addDays = (iso: string, n: number): string => fromEpochDay(toEpochDay(iso) + n);

/** 0 = Sunday … 6 = Saturday. */
export const dayOfWeek = (iso: string): number => (((toEpochDay(iso) + 4) % 7) + 7) % 7;

export const isWeekend = (iso: string): boolean => {
  const dow = dayOfWeek(iso);
  return dow === 0 || dow === 6;
};

export function isBusinessDay(iso: string, holidays: ReadonlySet<string>): boolean {
  return !isWeekend(iso) && !holidays.has(iso);
}

/** Moves forward (n > 0) or back (n < 0) by business days, skipping weekends and holidays. */
export function addBusinessDays(iso: string, n: number, holidays: ReadonlySet<string> = new Set()): string {
  let day = iso;
  const step = n < 0 ? -1 : 1;
  for (let left = Math.abs(n); left > 0;) {
    day = addDays(day, step);
    if (isBusinessDay(day, holidays)) left -= 1;
  }
  return day;
}

/** Last calendar day of the month containing `iso`. */
export function endOfMonth(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const next =
    m === 12
      ? `${String(y + 1).padStart(4, '0')}-01-01`
      : `${iso.slice(0, 5)}${String(m + 1).padStart(2, '0')}-01`;
  return addDays(next, -1);
}

/** Month-end `n` months before (negative) or after the month containing `iso`. */
export function shiftMonthEnd(iso: string, n: number): string {
  const total = Number(iso.slice(0, 4)) * 12 + (Number(iso.slice(5, 7)) - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return endOfMonth(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`);
}

const LEGACY_PLACEHOLDERS = new Set(['1900-01-01', '9999-12-31', '0001-01-01']);

/** Legacy "no date" placeholders become null at the API boundary (API.md conventions). */
export function normaliseBusinessDate(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  const date = value.slice(0, 10);
  return LEGACY_PLACEHOLDERS.has(date) ? null : date;
}
