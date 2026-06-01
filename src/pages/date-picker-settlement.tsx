import { useMemo, useState } from "react";
import MonthGrid, {
  type DayState,
} from "../components/date-picker/MonthGrid";
import {
  CALENDARS,
  TODAY,
  addBusinessDays,
  addDays,
  formatLong,
  holidayOn,
  isBusinessDay,
  yearMonthOf,
  type CalendarId,
  type YearMonth,
} from "../components/date-picker/calendar-utils";
import {
  CURRENCY_SETTLEMENT_CALENDAR,
  isWeekend,
} from "../lib/calendars";

export const title = "Settlement Date Picker";

/* Settlement Date Picker
 *
 * Pick a trade date and a currency; the screen resolves the settlement date
 * by stepping the standard T+n convention forward over the currency's
 * settlement calendar — XNYS for USD, XLON for GBP, XTKS for JPY, and TARGET2
 * for EUR. Closures and weekends are skipped, so the settlement date can land
 * several calendar days past the naive T+n.
 *
 * The hop is drawn on the grid: trade date filled, settlement date ringed in
 * green, and any closed day the convention skipped over flagged amber. This
 * is the calendars layer (lib/calendars) doing the same shift the arrival
 * scheduler applies to EUR cash legs, made interactive.
 */

type Currency = "USD" | "EUR" | "GBP" | "JPY";

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "JPY"];

/* Conventional settlement lag by currency/instrument. Equities moved to T+1
 * in the US/UK; EUR cash legs here model T+2 to exercise the TARGET2 shift. */
const DEFAULT_LAG: Record<Currency, number> = {
  USD: 1,
  GBP: 1,
  EUR: 2,
  JPY: 2,
};

export default function SettlementDatePicker() {
  const [ccy, setCcy] = useState<Currency>("EUR");
  const [lag, setLag] = useState<number>(DEFAULT_LAG.EUR);
  const [tradeDate, setTradeDate] = useState<string>(() =>
    nearestTradeDate(CURRENCY_SETTLEMENT_CALENDAR.EUR, TODAY),
  );
  const [month, setMonth] = useState<YearMonth>(() => yearMonthOf(tradeDate));

  const calendarId = CURRENCY_SETTLEMENT_CALENDAR[ccy] as CalendarId;

  const settlement = useMemo(
    () => addBusinessDays(calendarId, tradeDate, lag),
    [calendarId, tradeDate, lag],
  );

  // Closed days the convention skipped over between trade and settlement.
  const skipped = useMemo(() => {
    const out: { date: string; reason: string }[] = [];
    let cursor = addDays(tradeDate, 1);
    while (cursor < settlement) {
      if (!isBusinessDay(calendarId, cursor)) {
        const closure = holidayOn(calendarId, cursor);
        out.push({
          date: cursor,
          reason: closure?.name ?? "Weekend",
        });
      }
      cursor = addDays(cursor, 1);
    }
    return out;
  }, [calendarId, tradeDate, settlement]);

  const getDayState = useMemo(
    () =>
      (date: string): DayState => {
        const closure = holidayOn(calendarId, date);
        const weekend = isWeekend(date);
        const fullClosure = closure?.kind === "full";
        const isTrade = date === tradeDate;
        const isSettle = date === settlement;
        const skippedHere = date > tradeDate && date < settlement;

        const state: DayState = {
          disabled: weekend || fullClosure,
          selected: isTrade,
          inRange: skippedHere && !weekend && !fullClosure,
          tone: isSettle
            ? "settlement"
            : date === TODAY
              ? "today"
              : closure
                ? "holiday"
                : weekend
                  ? "weekend"
                  : "normal",
        };

        if (closure) {
          state.marker = closure.kind === "early-close" ? "amber" : "neutral";
          state.title =
            closure.kind === "early-close"
              ? `${closure.name} — early close ${closure.earlyCloseTime}`
              : `${closure.name} — ${CALENDARS[calendarId].label} closed`;
        } else if (weekend) {
          state.title = "Weekend";
        }
        if (isSettle) {
          state.marker = "green";
          state.title = `Settlement (T+${lag})`;
        }
        return state;
      },
    [calendarId, tradeDate, settlement, lag],
  );

  const cal = CALENDARS[calendarId];

  return (
    <div>
      <div className="mb-6">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
          Date pickers
        </div>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-neutral-900">
          Settlement Date Picker
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Pick a trade date and currency; settlement resolves over the relevant
          settlement calendar, skipping weekends and closures. EUR settles on
          TARGET2 — flip the trade date onto a closure to watch the date shift.
        </p>
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-400">Currency</span>
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCcy(c);
                setLag(DEFAULT_LAG[c]);
                const calId = CURRENCY_SETTLEMENT_CALENDAR[c] as CalendarId;
                const nearest = nearestTradeDate(calId, tradeDate);
                setTradeDate(nearest);
                setMonth(yearMonthOf(nearest));
              }}
              className={
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors " +
                (c === ccy
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100")
              }
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-400">Convention</span>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setLag(n)}
              className={
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors " +
                (n === lag
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100")
              }
            >
              T+{n}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        {/* Calendar */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="mb-2 text-xs text-neutral-500">
            {cal.label} · {cal.timezone}
          </div>
          <MonthGrid
            month={month}
            onMonthChange={setMonth}
            getDayState={getDayState}
            onSelect={(d) => {
              if (!isBusinessDay(calendarId, d)) return;
              setTradeDate(d);
              setMonth(yearMonthOf(d));
            }}
          />
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-neutral-100 pt-3 text-[11px] text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded bg-neutral-900" />
              Trade date
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded ring-1 ring-inset ring-emerald-500" />
              Settlement
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
              Skipped closure
            </span>
          </div>
        </div>

        {/* Resolution detail */}
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
                Trade date
              </div>
              <div className="mt-0.5 font-mono text-base text-neutral-900">
                {tradeDate}
              </div>
              <div className="text-xs text-neutral-500">
                {formatLong(tradeDate)}
              </div>
            </div>
            <div className="text-neutral-300">→</div>
            <div className="flex-1 rounded-md bg-emerald-50 px-3 py-2">
              <div className="text-[10px] font-semibold tracking-widest text-emerald-700 uppercase">
                Settles T+{lag}
              </div>
              <div className="mt-0.5 font-mono text-base text-emerald-900">
                {settlement}
              </div>
              <div className="text-xs text-emerald-700">
                {formatLong(settlement)}
              </div>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-neutral-400">Currency</dt>
              <dd className="text-neutral-800">{ccy}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Settlement calendar</dt>
              <dd className="text-neutral-800">{cal.label}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Elapsed</dt>
              <dd className="text-neutral-800">
                {calendarDaysBetween(tradeDate, settlement)} calendar days
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Days skipped</dt>
              <dd className="text-neutral-800">{skipped.length}</dd>
            </div>
          </dl>

          {skipped.length > 0 ? (
            <div className="mt-4">
              <div className="mb-1.5 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
                Non-settlement days skipped
              </div>
              <ul className="space-y-1">
                {skipped.map((s) => (
                  <li
                    key={s.date}
                    className="flex items-center justify-between rounded-md bg-neutral-50 px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-mono text-neutral-700">{s.date}</span>
                    <span className="text-neutral-500">{s.reason}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-neutral-400">
                Naive {`T+${lag}`} would land on{" "}
                <span className="font-mono">{addDays(tradeDate, lag)}</span> —
                the convention rolled forward to the next open day.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-xs text-neutral-400">
              No closures in the window — settlement falls on the straight
              {` T+${lag}`} business-day hop.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** If `date` isn't a business day on the calendar, roll forward to one. */
function nearestTradeDate(calendarId: CalendarId, date: string): string {
  let cursor = date;
  for (let i = 0; i < 14; i++) {
    if (isBusinessDay(calendarId, cursor)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

function calendarDaysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) /
      86_400_000,
  );
}
