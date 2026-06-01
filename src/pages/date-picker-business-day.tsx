import { useMemo, useState } from "react";
import MonthGrid, {
  type DayState,
} from "../components/date-picker/MonthGrid";
import {
  CALENDARS,
  TODAY,
  addDays,
  formatLong,
  holidayOn,
  isBusinessDay,
  unavailableReason,
  yearMonthOf,
  type CalendarId,
  type YearMonth,
} from "../components/date-picker/calendar-utils";
import { isWeekend, nextOpenDay } from "../lib/calendars";

export const title = "Business Date Picker";

/* Business Date Picker
 *
 * Pick a single operating day against a chosen exchange calendar. Weekends
 * and full closures are non-business and can't be selected — the file the
 * operator is reasoning about simply isn't produced then. Early-close days
 * stay selectable but are flagged (amber dot + tooltip) because the market
 * still trades, just on a pulled-forward cutoff.
 *
 * This is the same calendar layer the arrival scheduler uses (lib/calendars),
 * surfaced as a control an operator could drop onto any ops screen that needs
 * an "as-of business date".
 */

const CALENDAR_ORDER: CalendarId[] = [
  "XNYS",
  "XLON",
  "XLUX",
  "XSES",
  "XTKS",
  "TARGET2",
];

export default function BusinessDatePicker() {
  const [calendarId, setCalendarId] = useState<CalendarId>("XNYS");
  const [selected, setSelected] = useState<string>(TODAY);
  const [month, setMonth] = useState<YearMonth>(() => yearMonthOf(TODAY));

  const getDayState = useMemo(
    () =>
      (date: string): DayState => {
        const closure = holidayOn(calendarId, date);
        const weekend = isWeekend(date);
        const fullClosure = closure?.kind === "full";
        const disabled = weekend || fullClosure;

        const state: DayState = {
          disabled,
          selected: date === selected,
          tone:
            date === TODAY
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
              : `${CALENDARS[calendarId].label} closed — ${closure.name}`;
        } else if (weekend) {
          state.title = "Weekend — market closed";
        }
        return state;
      },
    [calendarId, selected],
  );

  const cal = CALENDARS[calendarId];
  const reason = unavailableReason(calendarId, selected);
  const selectedClosure = holidayOn(calendarId, selected);
  const earlyClose =
    selectedClosure?.kind === "early-close"
      ? selectedClosure.earlyCloseTime
      : null;
  const open = isBusinessDay(calendarId, selected);
  const nextOpen = open ? null : nextOpenDay(calendarId, selected);

  return (
    <div>
      <div className="mb-6">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
          Date pickers
        </div>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-neutral-900">
          Business Date Picker
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Choose an operating day against an exchange calendar. Weekends and
          full closures are non-business and locked out; early-close days stay
          open but carry a flag.
        </p>
      </div>

      {/* Calendar selector */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {CALENDAR_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setCalendarId(id)}
            className={
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors " +
              (id === calendarId
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100")
            }
          >
            {id}
          </button>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        {/* Calendar card */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="mb-2 text-xs text-neutral-500">{cal.label}</div>
          <MonthGrid
            month={month}
            onMonthChange={setMonth}
            getDayState={getDayState}
            onSelect={(d) => {
              if (!isBusinessDay(calendarId, d)) return;
              setSelected(d);
              setMonth(yearMonthOf(d));
            }}
          />
          <div className="mt-4 flex items-center gap-4 border-t border-neutral-100 pt-3 text-[11px] text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
              Early close
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
              Full closure
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded ring-1 ring-inset ring-blue-400" />
              Today
            </span>
          </div>
        </div>

        {/* Selection detail */}
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            Selected business date
          </div>
          <div className="mt-1 font-mono text-lg text-neutral-900">
            {selected}
          </div>
          <div className="text-sm text-neutral-600">{formatLong(selected)}</div>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-neutral-400">Calendar</dt>
              <dd className="text-neutral-800">{cal.label}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Timezone</dt>
              <dd className="font-mono text-neutral-800">{cal.timezone}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Status</dt>
              <dd className={open ? "text-emerald-700" : "text-amber-700"}>
                {open ? "Open — business day" : `Closed — ${reason}`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Settlement next open</dt>
              <dd className="font-mono text-neutral-800">
                {nextOpen ?? "—"}
              </dd>
            </div>
          </dl>

          {earlyClose && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span className="font-semibold">{selectedClosure?.name}</span> —
              market shuts early at{" "}
              <span className="font-mono">{earlyClose}</span> local. Expect
              actuals and NAV strike pulled forward.
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                const prev = stepToBusinessDay(calendarId, selected, -1);
                setSelected(prev);
                setMonth(yearMonthOf(prev));
              }}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              ← Prev business day
            </button>
            <button
              type="button"
              onClick={() => {
                const t = TODAY;
                setSelected(t);
                setMonth(yearMonthOf(t));
              }}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                const next = stepToBusinessDay(calendarId, selected, 1);
                setSelected(next);
                setMonth(yearMonthOf(next));
              }}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Next business day →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Step to the nearest business day in a direction, skipping closures. */
function stepToBusinessDay(
  calendarId: CalendarId,
  date: string,
  dir: 1 | -1,
): string {
  let cursor = addDays(date, dir);
  for (let i = 0; i < 14; i++) {
    if (isBusinessDay(calendarId, cursor)) return cursor;
    cursor = addDays(cursor, dir);
  }
  return cursor;
}
