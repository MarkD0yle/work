import { useMemo, useState } from "react";
import MonthGrid, {
  type DayState,
} from "../components/date-picker/MonthGrid";
import {
  TODAY,
  addDays,
  addMonths,
  countBusinessDays,
  formatLong,
  holidayOn,
  yearMonthOf,
  type YearMonth,
} from "../components/date-picker/calendar-utils";
import { isWeekend } from "../lib/calendars";
import Modal from "../components/patterns/Modal";

export const title = "Date Range Picker";

/* Date Range Picker
 *
 * A lookback-window control for the reporting / trend / blotter screens. The
 * page shows a trigger field with the committed window and its day counts;
 * clicking it opens a modal with two months side by side — click a start,
 * click an end, drag-hover previews the span. Presets cover the windows an ops
 * desk actually reaches for (MTD, last full week, T-30 …). The window is
 * provisional until Apply commits it.
 *
 * Range maths run against the NY calendar so the "business days" count
 * excludes weekends and US closures — the count operators care about when the
 * window feeds a reconciliation or P&L pull.
 */

const RANGE_CALENDAR = "XNYS" as const;

interface Range {
  start: string | null;
  end: string | null;
}

interface Preset {
  label: string;
  compute: () => Range;
}

/* Presets are computed from TODAY (the prototype's operating day) so they
 * land on populated 2026 months with real holiday data in view. */
const PRESETS: Preset[] = [
  { label: "Today", compute: () => ({ start: TODAY, end: TODAY }) },
  { label: "Last 7 days", compute: () => ({ start: addDays(TODAY, -6), end: TODAY }) },
  { label: "Last 30 days", compute: () => ({ start: addDays(TODAY, -29), end: TODAY }) },
  {
    label: "Week to date",
    compute: () => ({ start: startOfWeek(TODAY), end: TODAY }),
  },
  {
    label: "Last full week",
    compute: () => {
      const thisMonday = startOfWeek(TODAY);
      const lastMonday = addDays(thisMonday, -7);
      return { start: lastMonday, end: addDays(lastMonday, 4) };
    },
  },
  {
    label: "Month to date",
    compute: () => {
      const { year, month } = yearMonthOf(TODAY);
      return { start: `${ymPrefix(year, month)}-01`, end: TODAY };
    },
  },
];

function startOfWeek(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const mondayOffset = (d.getUTCDay() + 6) % 7;
  return addDays(date, -mondayOffset);
}

function ymPrefix(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Inclusive calendar-day span of a range (0 when no start). */
function spanOf(range: Range): number {
  if (!range.start) return 0;
  if (!range.end) return 1;
  return (
    Math.round(
      (Date.parse(`${range.end}T12:00:00Z`) -
        Date.parse(`${range.start}T12:00:00Z`)) /
        86_400_000,
    ) + 1
  );
}

function businessDaysOf(range: Range): number {
  if (!range.start) return 0;
  return countBusinessDays(RANGE_CALENDAR, range.start, range.end ?? range.start);
}

export default function DateRangePicker() {
  // Committed window — what the page summarises.
  const [range, setRange] = useState<Range>(() => PRESETS[1].compute());

  // Provisional window while the modal is open.
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Range>(range);
  const [hover, setHover] = useState<string | null>(null);
  const [leftMonth, setLeftMonth] = useState<YearMonth>(() =>
    addMonths(yearMonthOf(range.start ?? TODAY), -1),
  );
  const rightMonth = addMonths(leftMonth, 1);

  function openPicker() {
    setDraft(range);
    setHover(null);
    setLeftMonth(addMonths(yearMonthOf(range.start ?? TODAY), -1));
    setOpen(true);
  }

  function apply() {
    setRange(draft);
    setOpen(false);
  }

  function handleSelect(date: string) {
    setDraft((cur) => {
      // No start, or a complete range already → begin a fresh range.
      if (!cur.start || (cur.start && cur.end)) {
        return { start: date, end: null };
      }
      // Second click closes the range, ordered low→high.
      if (date < cur.start) return { start: date, end: cur.start };
      return { start: cur.start, end: date };
    });
  }

  function applyPreset(p: Preset) {
    const r = p.compute();
    setDraft(r);
    if (r.start) setLeftMonth(addMonths(yearMonthOf(r.start), -1));
  }

  // The effective end while mid-selection (start chosen, hovering a cell).
  const previewEnd = draft.start && !draft.end ? hover : null;

  const getDayState = useMemo(
    () =>
      (date: string): DayState => {
        const { start, end } = draft;
        const closure = holidayOn(RANGE_CALENDAR, date);
        const weekend = isWeekend(date);

        const lo = start && previewEnd && previewEnd < start ? previewEnd : start;
        const hi =
          end ??
          (start && previewEnd
            ? previewEnd < start
              ? start
              : previewEnd
            : null);

        const isStart = !!lo && date === lo;
        const isEnd = !!hi && date === hi;
        const inside = !!lo && !!hi && date > lo && date < hi;
        const previewing = !end && !!previewEnd;

        return {
          rangeStart: isStart,
          rangeEnd: isEnd,
          inRange: inside && !previewing,
          preview: inside && previewing,
          tone:
            date === TODAY
              ? "today"
              : closure
                ? "holiday"
                : weekend
                  ? "weekend"
                  : "normal",
          marker: closure ? "amber" : undefined,
          title: closure ? closure.name : weekend ? "Weekend" : undefined,
        };
      },
    [draft, previewEnd],
  );

  const spanDays = spanOf(range);
  const businessDays = businessDaysOf(range);
  const rangeLabel = range.start
    ? range.end && range.end !== range.start
      ? `${range.start} → ${range.end}`
      : range.start
    : "No range selected";

  return (
    <div>
      <div className="mb-6">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
          Date pickers
        </div>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-neutral-900">
          Date Range Picker
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          A lookback window for trend, blotter and reconciliation pulls. Click
          a start then an end, or pick a preset. Business-day count excludes
          weekends and NYSE closures.
        </p>
      </div>

      {/* Trigger field — opens the dual-month calendar in a modal. */}
      <div className="mb-6 max-w-sm">
        <label className="mb-1.5 block text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
          Lookback window
        </label>
        <button
          type="button"
          onClick={openPicker}
          className="flex w-full items-center gap-3 rounded-md border border-neutral-300 bg-white px-3 py-2 text-left transition-colors hover:border-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
        >
          <span
            className={
              "font-mono text-sm " +
              (range.start ? "text-neutral-900" : "text-neutral-400")
            }
          >
            {rangeLabel}
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

      {/* Selection summary — read-only, reflects the committed window. */}
      <div className="max-w-sm rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-2 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
          Selected window
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">From</span>
            <span className="font-mono text-neutral-900">
              {range.start ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">To</span>
            <span className="font-mono text-neutral-900">
              {range.end ?? "—"}
            </span>
          </div>
        </div>
        {range.start && (
          <div className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
            {range.start === range.end || !range.end
              ? formatLong(range.start)
              : `${formatLong(range.start)} → ${formatLong(range.end)}`}
          </div>
        )}
        <div className="mt-3 flex gap-4 text-sm">
          <div>
            <div className="text-xl font-semibold text-neutral-900">
              {spanDays}
            </div>
            <div className="text-[11px] text-neutral-400">calendar days</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-neutral-900">
              {businessDays}
            </div>
            <div className="text-[11px] text-neutral-400">business days</div>
          </div>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Select date range"
        description="Click a start then an end, or pick a preset. Business-day count excludes weekends and NYSE closures."
        size="xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDraft({ start: null, end: null })}
              className="mr-auto rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Clear
            </button>
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
              disabled={!draft.start}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
            >
              Apply
            </button>
          </>
        }
      >
        {/* Presets */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Dual-month calendar */}
        <div className="grid gap-8 sm:grid-cols-2" onMouseLeave={() => setHover(null)}>
          <MonthGrid
            month={leftMonth}
            onMonthChange={setLeftMonth}
            getDayState={getDayState}
            onSelect={handleSelect}
            onHover={setHover}
          />
          <MonthGrid
            month={rightMonth}
            onMonthChange={(m) => setLeftMonth(addMonths(m, -1))}
            getDayState={getDayState}
            onSelect={handleSelect}
            onHover={setHover}
          />
        </div>

        {/* Draft summary */}
        <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs">
          <div className="flex gap-6">
            <span className="text-neutral-500">
              From{" "}
              <span className="font-mono text-neutral-900">
                {draft.start ?? "—"}
              </span>
            </span>
            <span className="text-neutral-500">
              To{" "}
              <span className="font-mono text-neutral-900">
                {draft.end ?? (draft.start ? "select end…" : "—")}
              </span>
            </span>
          </div>
          <div className="flex gap-4">
            <span className="text-neutral-500">
              <span className="font-semibold text-neutral-900">
                {spanOf(draft)}
              </span>{" "}
              cal
            </span>
            <span className="text-neutral-500">
              <span className="font-semibold text-neutral-900">
                {businessDaysOf(draft)}
              </span>{" "}
              biz
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
