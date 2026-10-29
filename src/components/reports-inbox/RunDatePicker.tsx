import { useEffect, useRef, useState } from "react";
import MonthGrid, { type DayState } from "../date-picker/MonthGrid";
import { addDays, parseYmd, yearMonthOf, type YearMonth } from "../date-picker/calendar-utils";
import { SegmentedControl, tokens } from "../patterns";
import { TODAY, periodLabel } from "./model";

const { button, cx, border, text } = tokens;

/* RunDatePicker — "Run for…" a date or a date range.
 *
 * A button that opens a small calendar under it. Pick one business day, or
 * switch to Range and pick a start and an end. Presets cover the common
 * asks (yesterday, last week, month to date). Weekends and future days are
 * off, because there are no trades to report on. Nothing runs until the
 * user presses Run, and the button says exactly what will run. */

type Mode = "date" | "range";

const isWeekend = (d: string) => {
  const day = parseYmd(d).getUTCDay();
  return day === 0 || day === 6;
};

/** Step back to the nearest weekday. */
function weekday(d: string): string {
  let x = d;
  while (isWeekend(x)) x = addDays(x, -1);
  return x;
}

function businessDays(start: string, end: string): number {
  let n = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) if (!isWeekend(d)) n++;
  return n;
}

const PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: "Today", range: () => [TODAY, TODAY] },
  { label: "Previous business day", range: () => { const d = weekday(addDays(TODAY, -1)); return [d, d]; } },
  { label: "Last 5 business days", range: () => { let s = TODAY; for (let i = 1; i < 5; i++) s = weekday(addDays(s, -1)); return [s, TODAY]; } },
  { label: "Month to date", range: () => [`${TODAY.slice(0, 8)}01`, TODAY] },
  {
    label: "Last month",
    range: () => {
      const first = `${TODAY.slice(0, 8)}01`;
      const end = addDays(first, -1);
      return [`${end.slice(0, 8)}01`, end];
    },
  },
];

export function RunDatePicker({
  onRun,
  disabled = false,
  label = "Run for…",
}: {
  onRun: (start: string, end: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("date");
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [month, setMonth] = useState<YearMonth>(yearMonthOf(TODAY));
  const root = useRef<HTMLDivElement>(null);

  // Close on a click outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const reset = () => {
    setStart(null);
    setEnd(null);
    setHover(null);
  };

  const pick = (d: string) => {
    if (mode === "date" || !start || end) {
      setStart(d);
      setEnd(mode === "date" ? d : null);
      return;
    }
    if (d < start) {
      setEnd(start);
      setStart(d);
    } else setEnd(d);
  };

  const preset = (r: [string, string]) => {
    setMode(r[0] === r[1] ? "date" : "range");
    setStart(r[0]);
    setEnd(r[1]);
    setMonth(yearMonthOf(r[1]));
  };

  const dayState = (d: string): DayState => {
    if (d > TODAY || isWeekend(d)) return { disabled: true, tone: isWeekend(d) ? "weekend" : "normal" };
    const hi = end ?? (mode === "range" && start && hover && hover > start ? hover : null);
    return {
      selected: d === start || d === end,
      rangeStart: mode === "range" && d === start && !!hi,
      rangeEnd: mode === "range" && d === end,
      inRange: !!(start && end && d > start && d < end),
      preview: !end && !!(start && hi && d > start && d <= hi),
      tone: d === TODAY ? "today" : "normal",
    };
  };

  const ready = start && end;
  const days = ready ? businessDays(start, end) : 0;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className={button.secondary}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <rect x="2" y="3" width="12" height="11" />
          <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
        </svg>
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose dates to run"
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          className={cx("absolute top-full right-0 z-30 mt-1 flex w-[min(34rem,calc(100vw-2rem))] flex-col bg-white shadow-lg sm:flex-row", border.default)}
        >
          <div className={cx("flex flex-row flex-wrap gap-1 border-b p-3 sm:w-44 sm:flex-col sm:border-r sm:border-b-0", border.divider)}>
            <div className={cx("mb-1 w-full", text.eyebrow)}>Quick picks</div>
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className={cx(button.ghost, "justify-start")} onClick={() => preset(p.range())}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex-1 p-3">
            <div className="mb-3">
              <SegmentedControl<Mode>
                label="Run for"
                size="xs"
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  reset();
                }}
                options={[
                  { value: "date", label: "One date" },
                  { value: "range", label: "Date range" },
                ]}
              />
            </div>
            <MonthGrid month={month} onMonthChange={setMonth} getDayState={dayState} onSelect={pick} onHover={setHover} />
            <div className={cx("mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3", border.subtle)}>
              <span className={text.muted}>
                {ready
                  ? `${days} business day${days === 1 ? "" : "s"}`
                  : mode === "range" && start
                    ? "Now pick an end date"
                    : "Pick a date"}
              </span>
              <span className="flex gap-2">
                <button type="button" className={button.ghost} onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={button.primary}
                  disabled={!ready}
                  onClick={() => {
                    if (!start || !end) return;
                    onRun(start, end);
                    setOpen(false);
                    reset();
                  }}
                >
                  {ready ? `Run for ${periodLabel(start, end)}` : "Run"}
                </button>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
