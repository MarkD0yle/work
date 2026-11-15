/**
 * Business-date maths on ISO YYYY-MM-DD strings.
 * Pure integer calendar arithmetic: no `Date`, so no timezone can ever shift a business date.
 */

/** Days since 1970-01-01 for a civil date (Howard Hinnant's algorithm). */
export function toEpochDay(iso: string): number {
  const y0 = Number.parseInt(iso.slice(0, 4), 10);
  const m = Number.parseInt(iso.slice(5, 7), 10);
  const d = Number.parseInt(iso.slice(8, 10), 10);
  const y = m <= 2 ? y0 - 1 : y0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

const pad = (n: number, width: number) => String(n).padStart(width, '0');
export const toIso = (y: number, m: number, d: number): string => `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;

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
  return toIso(yoe + era * 400 + (m <= 2 ? 1 : 0), m, d);
}

export const addDays = (iso: string, n: number): string => fromEpochDay(toEpochDay(iso) + n);

/** 0 = Sunday … 6 = Saturday. */
export const dayOfWeek = (iso: string): number => (((toEpochDay(iso) + 4) % 7) + 7) % 7;

export const isWeekend = (iso: string): boolean => dayOfWeek(iso) % 6 === 0;

export const isBusinessDay = (iso: string, holidays: ReadonlySet<string>): boolean =>
  !isWeekend(iso) && !holidays.has(iso);

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

export function daysInMonth(y: number, m: number): number {
  return m === 2
    ? y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
      ? 29
      : 28
    : [4, 6, 9, 11].includes(m)
      ? 30
      : 31;
}

/** True for a real calendar date in ISO form. */
export function isValidIso(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [y, mo, d] = [m[1], m[2], m[3]].map((x) => Number.parseInt(x as string, 10)) as [
    number,
    number,
    number,
  ];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

/** Adds calendar months; the day is clamped to the end of the target month (31 Jan + 1 month = 28 or 29 Feb). */
export function addMonths(iso: string, n: number): string {
  const total = Number.parseInt(iso.slice(0, 4), 10) * 12 + (Number.parseInt(iso.slice(5, 7), 10) - 1) + n;
  const y = Math.floor(total / 12);
  const m = (((total % 12) + 12) % 12) + 1;
  return toIso(y, m, Math.min(Number.parseInt(iso.slice(8, 10), 10), daysInMonth(y, m)));
}

export function endOfMonth(iso: string): string {
  const y = Number.parseInt(iso.slice(0, 4), 10);
  const m = Number.parseInt(iso.slice(5, 7), 10);
  return toIso(y, m, daysInMonth(y, m));
}

export const startOfMonth = (iso: string): string => `${iso.slice(0, 8)}01`;

export type BusinessDayRule = 'following' | 'modifiedFollowing' | 'preceding' | 'none';

/** Applies a business-day rule to a date that may fall on a weekend or holiday. */
export function adjustToBusinessDay(
  iso: string,
  rule: BusinessDayRule,
  holidays: ReadonlySet<string>,
): string {
  if (rule === 'none' || isBusinessDay(iso, holidays)) return iso;
  const forward = addBusinessDays(iso, 1, holidays);
  const back = addBusinessDays(iso, -1, holidays);
  if (rule === 'preceding') return back;
  // Modified following: roll forward unless that leaves the month, then roll back instead.
  if (rule === 'modifiedFollowing' && forward.slice(0, 7) !== iso.slice(0, 7)) return back;
  return forward;
}
