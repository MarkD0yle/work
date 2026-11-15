import { addBusinessDays, addDays, addMonths, endOfMonth, isValidIso, startOfMonth, toIso } from './calendar';
import { MONTH_NAMES } from './format';

export type DateParseResult =
  | {
      ok: true;
      /** ISO date, or null for an empty entry. */
      value: string | null;
      /** True when a shortcut such as `t+2` or `eom` was expanded. */
      shortcut: boolean;
    }
  | { ok: false; reason: string };

export interface DateParseOptions {
  /** The business date "today" means. Comes from the engine, not the browser clock. */
  today: string;
  /** Holidays of the calendar in force, as ISO dates. `t+2` skips them. */
  holidays?: ReadonlySet<string>;
  /** Order for all-numeric dates such as 03/04/2026. Day first unless told otherwise. */
  order?: 'dmy' | 'mdy';
}

const HELP = 'Enter a date such as 2026-11-13 or 13 Nov 2026, or a shortcut: t, t+2, -1m, eom.';

function fromParts(y: number, m: number, d: number): DateParseResult {
  const year = y < 100 ? 2000 + y : y;
  const iso = toIso(year, m, d);
  return isValidIso(iso)
    ? { ok: true, value: iso, shortcut: false }
    : { ok: false, reason: `${d}/${m}/${year} is not a real date. ${HELP}` };
}

/**
 * Parses what a user typed into a date field (SPEC 7.6).
 *
 * Shortcuts: `t` today · `t+2` / `t-1` business days from today · `+3d` `-1w` `-1m` `+1y` calendar offsets ·
 * `eom` / `som` end and start of this month.
 * Typed: ISO `2026-11-13` · `13 Nov 2026` · `13/11/2026` (or month first with `order: 'mdy'`) · `20261113`.
 */
export function parseDateInput(input: string, options: DateParseOptions): DateParseResult {
  const text = input.trim().toLowerCase();
  if (text === '' || text === '—' || text === '-') return { ok: true, value: null, shortcut: false };
  const { today, holidays = new Set<string>(), order = 'dmy' } = options;
  const shortcut = (value: string): DateParseResult => ({ ok: true, value, shortcut: true });

  if (text === 't' || text === 'today') return shortcut(today);
  if (text === 'eom') return shortcut(endOfMonth(today));
  if (text === 'som') return shortcut(startOfMonth(today));

  const business = /^t\s*([+-])\s*(\d{1,3})$/.exec(text);
  if (business)
    return shortcut(
      addBusinessDays(
        today,
        (business[1] === '-' ? -1 : 1) * Number.parseInt(business[2] as string, 10),
        holidays,
      ),
    );

  const offset = /^([+-])\s*(\d{1,3})\s*([dwmy])$/.exec(text);
  if (offset) {
    const n = (offset[1] === '-' ? -1 : 1) * Number.parseInt(offset[2] as string, 10);
    const unit = offset[3];
    return shortcut(
      unit === 'd'
        ? addDays(today, n)
        : unit === 'w'
          ? addDays(today, n * 7)
          : addMonths(today, unit === 'm' ? n : n * 12),
    );
  }

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso)
    return fromParts(
      Number.parseInt(iso[1] as string, 10),
      Number.parseInt(iso[2] as string, 10),
      Number.parseInt(iso[3] as string, 10),
    );

  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  if (compact)
    return fromParts(
      Number.parseInt(compact[1] as string, 10),
      Number.parseInt(compact[2] as string, 10),
      Number.parseInt(compact[3] as string, 10),
    );

  const numeric = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text);
  if (numeric) {
    const [a, b, y] = [numeric[1], numeric[2], numeric[3]].map((x) => Number.parseInt(x as string, 10)) as [
      number,
      number,
      number,
    ];
    return order === 'mdy' ? fromParts(y, a, b) : fromParts(y, b, a);
  }

  const worded = /^(\d{1,2})[\s-]*([a-z]{3,9})[\s-]*(\d{2}|\d{4})$/.exec(text);
  if (worded) {
    const month = MONTH_NAMES.findIndex((m) => (worded[2] as string).startsWith(m.toLowerCase())) + 1;
    if (month > 0)
      return fromParts(
        Number.parseInt(worded[3] as string, 10),
        month,
        Number.parseInt(worded[1] as string, 10),
      );
  }

  return { ok: false, reason: HELP };
}
