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
import Modal from "../components/patterns/Modal";

export const title = "Settlement Date Picker";

/* Settlement Date Picker
 *
 * Pick a trade date and a currency; the screen resolves the settlement date
 * by stepping the standard T+n convention forward over the currency's
 * settlement calendar — XNYS for USD, XLON for GBP, XTKS for JPY, and TARGET2
 * for EUR. Closures and weekends are skipped, so the settlement date can land
 * several calendar days past the naive T+n.
 *
 * The page shows a trigger field with the committed trade date / currency /
 * convention and the resolved settlement; clicking it opens a modal where the
 * hop is drawn on the grid — trade date filled, settlement date ringed in
 * green, skipped closures flagged amber — and the choice is provisional until
 * Apply commits it.
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

/** Closed days the convention skipped between trade and settlement. */
function skippedDays(
  calendarId: CalendarId,
  tradeDate: string,
  settlement: string,
): { date: string; reason: string }[] {
  const out: { date: string; reason: string }[] = [];
  let cursor = addDays(tradeDate, 1);
  while (cursor < settlement) {
    if (!isBusinessDay(calendarId, cursor)) {
      const closure = holidayOn(calendarId, cursor);
      out.push({ date: cursor, reason: closure?.name ?? "Weekend" });
    }
    cursor = addDays(cursor, 1);
  }
  return out;
}

export default function SettlementDatePicker() {
  // Committed selection — what the page summarises.
  const [ccy, setCcy] = useState<Currency>("EUR");
  const [lag, setLag] = useState<number>(DEFAULT_LAG.EUR);
  const [tradeDate, setTradeDate] = useState<string>(() =>
    nearestTradeDate(CURRENCY_SETTLEMENT_CALENDAR.EUR, TODAY),
  );

  // Provisional selection while the modal is open.
  const [open, setOpen] = useState(false);
  const [draftCcy, setDraftCcy] = useState<Currency>(ccy);
  const [draftLag, setDraftLag] = useState<number>(lag);
  const [draftTrade, setDraftTrade] = useState<string>(tradeDate);
  const [draftMonth, setDraftMonth] = useState<YearMonth>(() =>
    yearMonthOf(tradeDate),
  );

  function openPicker() {
    setDraftCcy(ccy);
    setDraftLag(lag);
    setDraftTrade(tradeDate);
    setDraftMonth(yearMonthOf(tradeDate));
    setOpen(true);
  }

  function apply() {
    setCcy(draftCcy);
    setLag(draftLag);
    setTradeDate(draftTrade);
    setOpen(false);
  }

  // Committed-side resolution.
  const calendarId = CURRENCY_SETTLEMENT_CALENDAR[ccy] as CalendarId;
  const settlement = useMemo(
    () => addBusinessDays(calendarId, tradeDate, lag),
    [calendarId, tradeDate, lag],
  );
  const skipped = useMemo(
    () => skippedDays(calendarId, tradeDate, settlement),
    [calendarId, tradeDate, settlement],
  );
  const cal = CALENDARS[calendarId];

  // Draft-side resolution, for the grid + modal summary.
  const draftCalId = CURRENCY_SETTLEMENT_CALENDAR[draftCcy] as CalendarId;
  const draftSettlement = useMemo(
    () => addBusinessDays(draftCalId, draftTrade, draftLag),
    [draftCalId, draftTrade, draftLag],
  );
  const draftSkipped = useMemo(
    () => skippedDays(draftCalId, draftTrade, draftSettlement),
    [draftCalId, draftTrade, draftSettlement],
  );

  const getDayState = useMemo(
    () =>
      (date: string): DayState => {
        const closure = holidayOn(draftCalId, date);
        const weekend = isWeekend(date);
        const fullClosure = closure?.kind === "full";
        const isTrade = date === draftTrade;
        const isSettle = date === draftSettlement;
        const skippedHere = date > draftTrade && date < draftSettlement;

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
              : `${closure.name} — ${CALENDARS[draftCalId].label} closed`;
        } else if (weekend) {
          state.title = "Weekend";
        }
        if (isSettle) {
          state.marker = "green";
          state.title = `Settlement (T+${draftLag})`;
        }
        return state;
      },
    [draftCalId, draftTrade, draftSettlement, draftLag],
  );

  const draftCal = CALENDARS[draftCalId];

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

      {/* Trigger field — opens the calendar in a modal. */}
      <div className="mb-6 max-w-md">
        <label className="mb-1.5 block text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
          Trade date &amp; convention
        </label>
        <button
          type="button"
          onClick={openPicker}
          className="flex w-full items-center gap-3 rounded-md border border-neutral-300 bg-white px-3 py-2 text-left transition-colors hover:border-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
        >
          <span className="font-mono text-sm text-neutral-900">
            {tradeDate}
          </span>
          <span className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500">
            {ccy}
          </span>
          <span className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500">
            T+{lag}
          </span>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="ml-auto h-4 w-4 text-neutral-400"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Resolution detail — read-only, reflects the committed selection. */}
      <div className="max-w-md rounded-lg border border-neutral-200 bg-white p-5">
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Select trade date"
        description="Settlement resolves over the currency's calendar, skipping weekends and closures."
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
            >
              Apply
            </button>
          </>
        }
      >
        {/* Controls */}
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-400">Currency</span>
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setDraftCcy(c);
                  setDraftLag(DEFAULT_LAG[c]);
                  const calId = CURRENCY_SETTLEMENT_CALENDAR[c] as CalendarId;
                  const nearest = nearestTradeDate(calId, draftTrade);
                  setDraftTrade(nearest);
                  setDraftMonth(yearMonthOf(nearest));
                }}
                className={
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors " +
                  (c === draftCcy
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
                onClick={() => setDraftLag(n)}
                className={
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors " +
                  (n === draftLag
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100")
                }
              >
                T+{n}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-2 text-xs text-neutral-500">
          {draftCal.label} · {draftCal.timezone}
        </div>
        <MonthGrid
          month={draftMonth}
          onMonthChange={setDraftMonth}
          getDayState={getDayState}
          onSelect={(d) => {
            if (!isBusinessDay(draftCalId, d)) return;
            setDraftTrade(d);
            setDraftMonth(yearMonthOf(d));
          }}
        />

        <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-neutral-100 pt-3 text-[11px] text-neutral-500">
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

        {/* Draft resolution summary */}
        <div className="mt-4 flex items-center gap-3 rounded-md bg-neutral-50 px-3 py-2 text-xs">
          <span className="text-neutral-500">
            Trade{" "}
            <span className="font-mono text-neutral-900">{draftTrade}</span>
          </span>
          <span className="text-neutral-300">→</span>
          <span className="text-neutral-500">
            Settles T+{draftLag}{" "}
            <span className="font-mono text-emerald-700">
              {draftSettlement}
            </span>
          </span>
          {draftSkipped.length > 0 && (
            <span className="ml-auto text-neutral-400">
              {draftSkipped.length} skipped
            </span>
          )}
        </div>
      </Modal>
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
