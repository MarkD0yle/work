/* ------------------------------------------------------------------ *
 * Market & settlement calendars
 *
 * The calendar layer answers two questions the arrival scheduler needs:
 *
 *   1. Is a feed's SOURCE market closed today?  → the file is not produced,
 *      so its absence is expected (gray), never a breach (red).
 *   2. Is a DEPENDENCY (e.g. TARGET2 EUR settlement) closed today?  → the
 *      file is still expected, but its timing shifts to the next open day,
 *      and "late" is measured against the shifted deadline.
 *
 * Two calendar kinds are modelled:
 *   - Exchange calendars (XNYS, XLON, XLUX, XSES, XTKS) — when a market is
 *     closed, feeds sourced from that region don't run.
 *   - Settlement calendars (TARGET2) — when EUR settlement is shut, EUR-leg
 *     timing shifts even if the exchange that produced the file was open.
 *
 * Dates are real 2026 holiday calendars. Closures are keyed yyyy-mm-dd for
 * O(1) lookup. `early-close` carries the pulled-forward cutoff (local HH:MM).
 * ------------------------------------------------------------------ */

import type { PipelineState } from "./qlik";

type Region = PipelineState["region"]; // "Lux" | "London" | "NY" | "Singapore"
type Currency = "USD" | "EUR" | "GBP" | "JPY";

export type CalendarId =
  | "XNYS" // New York Stock Exchange
  | "XLON" // London Stock Exchange
  | "XLUX" // Luxembourg / Euronext (+ Lux public holidays)
  | "XSES" // Singapore Exchange
  | "XTKS" // Tokyo Stock Exchange
  | "TARGET2"; // Eurosystem EUR settlement

export type ClosureKind = "full" | "early-close";

export interface Closure {
  /** yyyy-mm-dd */
  date: string;
  name: string;
  kind: ClosureKind;
  /** local HH:MM the market shuts on an early-close day */
  earlyCloseTime?: string;
}

export interface MarketCalendar {
  id: CalendarId;
  label: string;
  /** IANA-ish label for display; the scheduler treats times as local. */
  timezone: string;
  closures: Closure[];
}

/* Real 2026 closures. Weekend-only closures are omitted — the scheduler
 * treats Saturday/Sunday as non-business days independently (see isWeekend),
 * so e.g. Boxing Day falling on a Saturday needs no entry here. */

const XNYS_CLOSURES: Closure[] = [
  { date: "2026-01-01", name: "New Year's Day", kind: "full" },
  { date: "2026-01-19", name: "Martin Luther King Jr. Day", kind: "full" },
  { date: "2026-02-16", name: "Washington's Birthday", kind: "full" },
  { date: "2026-04-03", name: "Good Friday", kind: "full" },
  { date: "2026-05-25", name: "Memorial Day", kind: "full" },
  { date: "2026-06-19", name: "Juneteenth", kind: "full" },
  { date: "2026-07-03", name: "Independence Day (observed)", kind: "full" },
  { date: "2026-09-07", name: "Labor Day", kind: "full" },
  { date: "2026-11-26", name: "Thanksgiving", kind: "full" },
  { date: "2026-11-27", name: "Day after Thanksgiving", kind: "early-close", earlyCloseTime: "13:00" },
  { date: "2026-12-24", name: "Christmas Eve", kind: "early-close", earlyCloseTime: "13:00" },
  { date: "2026-12-25", name: "Christmas Day", kind: "full" },
];

const XLON_CLOSURES: Closure[] = [
  { date: "2026-01-01", name: "New Year's Day", kind: "full" },
  { date: "2026-04-03", name: "Good Friday", kind: "full" },
  { date: "2026-04-06", name: "Easter Monday", kind: "full" },
  { date: "2026-05-04", name: "Early May Bank Holiday", kind: "full" },
  { date: "2026-05-25", name: "Spring Bank Holiday", kind: "full" },
  { date: "2026-08-31", name: "Summer Bank Holiday", kind: "full" },
  { date: "2026-12-24", name: "Christmas Eve", kind: "early-close", earlyCloseTime: "12:30" },
  { date: "2026-12-25", name: "Christmas Day", kind: "full" },
  { date: "2026-12-28", name: "Boxing Day (substitute)", kind: "full" },
  { date: "2026-12-31", name: "New Year's Eve", kind: "early-close", earlyCloseTime: "12:30" },
];

/* Luxembourg/Euronext exchange + Lux public holidays. Whit Monday and the
 * National Day are Lux public holidays the local fund-admin source observes
 * even though Euronext core does not — they belong on the SOURCE calendar
 * for Lux-sourced feeds, which is what this calendar represents. */
const XLUX_CLOSURES: Closure[] = [
  { date: "2026-01-01", name: "New Year's Day", kind: "full" },
  { date: "2026-04-03", name: "Good Friday", kind: "full" },
  { date: "2026-04-06", name: "Easter Monday", kind: "full" },
  { date: "2026-05-01", name: "Labour Day", kind: "full" },
  { date: "2026-05-25", name: "Whit Monday", kind: "full" },
  { date: "2026-06-23", name: "Luxembourg National Day", kind: "full" },
  { date: "2026-12-25", name: "Christmas Day", kind: "full" },
  { date: "2026-12-26", name: "St. Stephen's Day", kind: "full" },
];

const XSES_CLOSURES: Closure[] = [
  { date: "2026-01-01", name: "New Year's Day", kind: "full" },
  { date: "2026-02-17", name: "Chinese New Year", kind: "full" },
  { date: "2026-02-18", name: "Chinese New Year", kind: "full" },
  { date: "2026-04-03", name: "Good Friday", kind: "full" },
  { date: "2026-05-01", name: "Labour Day", kind: "full" },
  { date: "2026-06-01", name: "Vesak Day (observed)", kind: "full" },
  { date: "2026-08-10", name: "National Day (observed)", kind: "full" },
  { date: "2026-12-25", name: "Christmas Day", kind: "full" },
];

const XTKS_CLOSURES: Closure[] = [
  { date: "2026-01-01", name: "New Year's Day", kind: "full" },
  { date: "2026-01-02", name: "Bank Holiday", kind: "full" },
  { date: "2026-01-12", name: "Coming of Age Day", kind: "full" },
  { date: "2026-02-11", name: "National Foundation Day", kind: "full" },
  { date: "2026-02-23", name: "Emperor's Birthday", kind: "full" },
  { date: "2026-04-29", name: "Shōwa Day", kind: "full" },
  { date: "2026-05-04", name: "Greenery Day", kind: "full" },
  { date: "2026-05-05", name: "Children's Day", kind: "full" },
  { date: "2026-12-31", name: "Year-end Holiday", kind: "full" },
];

/* TARGET2 — the Eurosystem real-time settlement system. Closes on only six
 * days a year; EUR cash legs cannot settle on these dates regardless of
 * whether the originating exchange traded. This is the canonical EUR
 * "dependency" calendar. */
const TARGET2_CLOSURES: Closure[] = [
  { date: "2026-01-01", name: "New Year's Day", kind: "full" },
  { date: "2026-04-03", name: "Good Friday", kind: "full" },
  { date: "2026-04-06", name: "Easter Monday", kind: "full" },
  { date: "2026-05-01", name: "Labour Day", kind: "full" },
  { date: "2026-12-25", name: "Christmas Day", kind: "full" },
  { date: "2026-12-26", name: "Boxing Day", kind: "full" },
];

export const CALENDARS: Record<CalendarId, MarketCalendar> = {
  XNYS: { id: "XNYS", label: "New York (NYSE)", timezone: "America/New_York", closures: XNYS_CLOSURES },
  XLON: { id: "XLON", label: "London (LSE)", timezone: "Europe/London", closures: XLON_CLOSURES },
  XLUX: { id: "XLUX", label: "Luxembourg", timezone: "Europe/Luxembourg", closures: XLUX_CLOSURES },
  XSES: { id: "XSES", label: "Singapore (SGX)", timezone: "Asia/Singapore", closures: XSES_CLOSURES },
  XTKS: { id: "XTKS", label: "Tokyo (TSE)", timezone: "Asia/Tokyo", closures: XTKS_CLOSURES },
  TARGET2: { id: "TARGET2", label: "TARGET2 (EUR settlement)", timezone: "Europe/Frankfurt", closures: TARGET2_CLOSURES },
};

/* Region → the exchange calendar a feed sourced in that region observes. */
export const REGION_CALENDAR: Record<Region, CalendarId> = {
  NY: "XNYS",
  London: "XLON",
  Lux: "XLUX",
  Singapore: "XSES",
};

/* Currency → the settlement calendar its cash leg depends on. Only EUR has a
 * dedicated settlement system here (TARGET2); other currencies settle against
 * their home exchange calendar. */
export const CURRENCY_SETTLEMENT_CALENDAR: Record<Currency, CalendarId> = {
  EUR: "TARGET2",
  USD: "XNYS",
  GBP: "XLON",
  JPY: "XTKS",
};

/* ------------------------------------------------------------------ *
 * Date helpers — all operate on yyyy-mm-dd strings to stay timezone-free.
 * ------------------------------------------------------------------ */

export function isWeekend(date: string): boolean {
  // Parse as UTC noon to avoid any local-offset day-shift.
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function closureOn(calendarId: CalendarId, date: string): Closure | null {
  return CALENDARS[calendarId].closures.find((c) => c.date === date) ?? null;
}

/** A market is closed if it's a weekend or carries a full closure that day. */
export function isMarketClosed(calendarId: CalendarId, date: string): boolean {
  if (isWeekend(date)) return true;
  const c = closureOn(calendarId, date);
  return c?.kind === "full";
}

/** The early-close cutoff for a date, or null if the market trades normally. */
export function earlyCloseOn(calendarId: CalendarId, date: string): string | null {
  const c = closureOn(calendarId, date);
  return c?.kind === "early-close" ? c.earlyCloseTime ?? null : null;
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Next open business day for a calendar, starting the day AFTER `date`. */
export function nextOpenDay(calendarId: CalendarId, date: string): string {
  let cursor = addDays(date, 1);
  // Guard against an unbounded loop if a calendar were ever fully closed.
  for (let i = 0; i < 14; i++) {
    if (!isMarketClosed(calendarId, cursor)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

/** The closures within `days` of `date` (inclusive), across the given
 *  calendars, sorted by date — used to render an "upcoming closures" strip. */
export function upcomingClosures(
  calendarIds: CalendarId[],
  fromDate: string,
  days = 14,
): { calendarId: CalendarId; closure: Closure }[] {
  const until = addDays(fromDate, days);
  const out: { calendarId: CalendarId; closure: Closure }[] = [];
  for (const id of calendarIds) {
    for (const closure of CALENDARS[id].closures) {
      if (closure.date >= fromDate && closure.date <= until) {
        out.push({ calendarId: id, closure });
      }
    }
  }
  return out.sort((a, b) => a.closure.date.localeCompare(b.closure.date));
}

/* The business date the prototype evaluates against. Real impl uses the
 * operating day from the ops calendar; here it's a constant so flipping it to
 * a holiday (e.g. "2026-05-25") demonstrates the suppression behaviour. */
export const CURRENT_BUSINESS_DATE = "2026-05-29";
