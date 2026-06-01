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

export const title = "Date Range Picker";

/* Date Range Picker
 *
 * A lookback-window control for the reporting / trend / blotter screens. Two
 * months side by side; click a start, click an end, drag-hover previews the
 * span. Presets cover the windows an ops desk actually reaches for (MTD, last
 * full week, T-30 …).
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

export default function DateRangePicker() {
  const [range, setRange] = useState<Range>(() =>
    PRESETS[1].compute(),
  );
  const [hover, setHover] = useState<string | null>(null);
  const [leftMonth, setLeftMonth] = useState<YearMonth>(() =>
    addMonths(yearMonthOf(TODAY), -1),
  );
  const rightMonth = addMonths(leftMonth, 1);

  function handleSelect(date: string) {
    setRange((cur) => {
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
    setRange(r);
    if (r.start) setLeftMonth(yearMonthOf(r.start));
  }

  // The effective end while mid-selection (start chosen, hovering a cell).
  const previewEnd = range.start && !range.end ? hover : null;

  const getDayState = useMemo(
    () =>
      (date: string): DayState => {
        const { start, end } = range;
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
    [range, previewEnd],
  );

  const spanDays =
    range.start && range.end
      ? Math.round(
          (Date.parse(`${range.end}T12:00:00Z`) -
            Date.parse(`${range.start}T12:00:00Z`)) /
            86_400_000,
        ) + 1
      : range.start
        ? 1
        : 0;
  const businessDays =
    range.start && range.end
      ? countBusinessDays(RANGE_CALENDAR, range.start, range.end)
      : range.start
        ? countBusinessDays(RANGE_CALENDAR, range.start, range.start)
        : 0;

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

      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        {/* Dual-month calendar */}
        <div
          className="rounded-lg border border-neutral-200 bg-white p-4"
          onMouseLeave={() => setHover(null)}
        >
          <div className="grid gap-8 sm:grid-cols-2">
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
        </div>

        {/* Presets + summary */}
        <div className="w-full lg:w-64">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-2 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              Presets
            </div>
            <div className="flex flex-col gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="rounded-md px-2.5 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
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
                  {range.end ?? (range.start ? "select end…" : "—")}
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
            <button
              type="button"
              onClick={() => setRange({ start: null, end: null })}
              className="mt-3 w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
