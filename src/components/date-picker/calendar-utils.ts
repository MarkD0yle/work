/* ------------------------------------------------------------------ *
 * Date-picker calendar helpers
 *
 * Thin layer over lib/calendars.ts. Everything here works on yyyy-mm-dd
 * strings and parses through UTC-noon (matching calendars.ts) so the grids
 * stay timezone-free and never day-shift under a local offset.
 *
 * "Today" for the pickers is CURRENT_BUSINESS_DATE — the same mock operating
 * day the rest of the prototype evaluates against — so the calendars land on
 * a populated 2026 month where the real holiday data is relevant.
 * ------------------------------------------------------------------ */

import {
  CALENDARS,
  closureOn,
  isMarketClosed,
  isWeekend,
  CURRENT_BUSINESS_DATE,
  type CalendarId,
  type Closure,
} from "../../lib/calendars";

/** yyyy-mm-dd for the prototype's operating day. */
export const TODAY = CURRENT_BUSINESS_DATE;

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export { WEEKDAY_LABELS };

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface YearMonth {
  year: number;
  /** 0-11 */
  month: number;
}

export function parseYmd(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

export function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function yearMonthOf(date: string): YearMonth {
  const d = parseYmd(date);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

export function addDays(date: string, n: number): string {
  const d = parseYmd(date);
  d.setUTCDate(d.getUTCDate() + n);
  return toYmd(d);
}

export function addMonths({ year, month }: YearMonth, n: number): YearMonth {
  const total = year * 12 + month + n;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export function monthLabel({ year, month }: YearMonth): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

/** Six Monday-first weeks (42 cells) covering the given month. */
export function monthMatrix({ year, month }: YearMonth): string[][] {
  const first = new Date(Date.UTC(year, month, 1, 12));
  const mondayOffset = (first.getUTCDay() + 6) % 7; // days since Monday
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - mondayOffset);

  const weeks: string[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < 6; w++) {
    const row: string[] = [];
    for (let d = 0; d < 7; d++) {
      row.push(toYmd(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
}

export function isSameMonth(date: string, ym: YearMonth): boolean {
  const d = parseYmd(date);
  return d.getUTCFullYear() === ym.year && d.getUTCMonth() === ym.month;
}

/** Closure (full or early-close) on a date for a calendar, or null. */
export function holidayOn(calendarId: CalendarId, date: string): Closure | null {
  return closureOn(calendarId, date);
}

export function isBusinessDay(calendarId: CalendarId, date: string): boolean {
  return !isMarketClosed(calendarId, date);
}

/** Count of business (open) days in [from, to] inclusive, on a calendar. */
export function countBusinessDays(
  calendarId: CalendarId,
  from: string,
  to: string,
): number {
  if (from > to) [from, to] = [to, from];
  let count = 0;
  let cursor = from;
  while (cursor <= to) {
    if (!isMarketClosed(calendarId, cursor)) count++;
    cursor = addDays(cursor, 1);
  }
  return count;
}

/** Add `n` open business days, skipping weekends and full closures. */
export function addBusinessDays(
  calendarId: CalendarId,
  date: string,
  n: number,
): string {
  let cursor = date;
  let remaining = n;
  // Guard against an unbounded loop on a pathologically closed calendar.
  for (let i = 0; i < 60 && remaining > 0; i++) {
    cursor = addDays(cursor, 1);
    if (!isMarketClosed(calendarId, cursor)) remaining--;
  }
  return cursor;
}

/** Human label for why a day can't be picked, or null if it's open. */
export function unavailableReason(
  calendarId: CalendarId,
  date: string,
): string | null {
  if (isWeekend(date)) return "Weekend";
  const c = closureOn(calendarId, date);
  if (c?.kind === "full") return c.name;
  return null;
}

export function formatLong(date: string): string {
  return parseYmd(date).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export { CALENDARS };
export type { CalendarId };
