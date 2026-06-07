import { useMemo, useState } from "react";
import MonthGrid, {
  type DayState,
} from "../components/date-picker/MonthGrid";
import {
  CALENDARS,
  TODAY,
  formatLong,
  holidayOn,
  isBusinessDay,
  unavailableReason,
  yearMonthOf,
  type CalendarId,
  type YearMonth,
} from "../components/date-picker/calendar-utils";
import { isWeekend, nextOpenDay } from "../lib/calendars";
import Modal from "../components/patterns/Modal";

export const title = "Business Date Picker";

/* Business Date Picker
 *
 * Pick a single operating day against a chosen exchange calendar. Weekends
 * and full closures are non-business and can't be selected — the file the
 * operator is reasoning about simply isn't produced then. Early-close days
 * stay selectable but are flagged (amber dot + tooltip) because the market
 * still trades, just on a pulled-forward cutoff.
 *
 * The picker lives in a modal: the page shows a trigger field with the
 * committed business date and a read-only summary; clicking it opens the
 * exchange calendar, where the choice is provisional until Apply commits it.
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
  // Committed selection — what the page summarises.
  const [calendarId, setCalendarId] = useState<CalendarId>("XNYS");
  const [selected, setSelected] = useState<string>(TODAY);

  // Provisional selection while the modal is open.
  const [open, setOpen] = useState(false);
  const [draftCal, setDraftCal] = useState<CalendarId>(calendarId);
  const [draftSel, setDraftSel] = useState<string>(selected);
  const [draftMonth, setDraftMonth] = useState<YearMonth>(() =>
    yearMonthOf(selected),
  );

  function openPicker() {
    setDraftCal(calendarId);
    setDraftSel(selected);
    setDraftMonth(yearMonthOf(selected));
    setOpen(true);
  }

  function apply() {
    setCalendarId(draftCal);
    setSelected(draftSel);
    setOpen(false);
  }

  // Day classification for the grid, driven by the *draft* calendar/date.
  const getDayState = useMemo(
    () =>
      (date: string): DayState => {
        const closure = holidayOn(draftCal, date);
        const weekend = isWeekend(date);
        const fullClosure = closure?.kind === "full";
        const disabled = weekend || fullClosure;

        const state: DayState = {
          disabled,
          selected: date === draftSel,
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
              : `${CALENDARS[draftCal].label} closed — ${closure.name}`;
        } else if (weekend) {
          state.title = "Weekend — market closed";
        }
        return state;
      },
    [draftCal, draftSel],
  );

  // Committed-side summary.
  const cal = CALENDARS[calendarId];
  const reason = unavailableReason(calendarId, selected);
  const selectedClosure = holidayOn(calendarId, selected);
  const earlyClose =
    selectedClosure?.kind === "early-close"
      ? selectedClosure.earlyCloseTime
      : null;
  const open_ = isBusinessDay(calendarId, selected);
  const nextOpen = open_ ? null : nextOpenDay(calendarId, selected);

  const draftCalLabel = CALENDARS[draftCal].label;
  const draftIsBusiness = isBusinessDay(draftCal, draftSel);

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

      {/* Trigger field — opens the calendar in a modal. */}
      <div className="mb-6 max-w-sm">
        <label className="mb-1.5 block text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
          As-of business date
        </label>
        <button
          type="button"
          onClick={openPicker}
          className="flex w-full items-center gap-3 rounded-md border border-neutral-300 bg-white px-3 py-2 text-left transition-colors hover:border-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
        >
          <span className="font-mono text-sm text-neutral-900">{selected}</span>
          <span className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500">
            {calendarId}
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

      {/* Selection summary — read-only, reflects the committed date. */}
      <div className="max-w-sm rounded-lg border border-neutral-200 bg-white p-5">
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
            <dd className={open_ ? "text-emerald-700" : "text-amber-700"}>
              {open_ ? "Open — business day" : `Closed — ${reason}`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-400">Settlement next open</dt>
            <dd className="font-mono text-neutral-800">{nextOpen ?? "—"}</dd>
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
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Select business date"
        description="Weekends and full closures are locked out; early-close days stay open but carry a flag."
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
              disabled={!draftIsBusiness}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
            >
              Apply
            </button>
          </>
        }
      >
        {/* Calendar selector */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {CALENDAR_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setDraftCal(id)}
              className={
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors " +
                (id === draftCal
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100")
              }
            >
              {id}
            </button>
          ))}
        </div>

        <div className="mb-2 text-xs text-neutral-500">{draftCalLabel}</div>
        <MonthGrid
          month={draftMonth}
          onMonthChange={setDraftMonth}
          getDayState={getDayState}
          onSelect={(d) => {
            if (!isBusinessDay(draftCal, d)) return;
            setDraftSel(d);
            setDraftMonth(yearMonthOf(d));
          }}
        />

        <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
          <div className="flex items-center gap-4 text-[11px] text-neutral-500">
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
          <button
            type="button"
            onClick={() => {
              setDraftSel(TODAY);
              setDraftMonth(yearMonthOf(TODAY));
            }}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Today
          </button>
        </div>

        <div className="mt-4 rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          Selecting{" "}
          <span className="font-mono text-neutral-900">{draftSel}</span> —{" "}
          {formatLong(draftSel)}
        </div>
      </Modal>
    </div>
  );
}
