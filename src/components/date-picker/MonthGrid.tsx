import {
  WEEKDAY_LABELS,
  isSameMonth,
  monthLabel,
  monthMatrix,
  type YearMonth,
} from "./calendar-utils";

/* Shared month-calendar primitive for the date-picker screens.
 *
 * Layout and selection live here; what each day *means* (disabled, holiday,
 * selected, in-range…) is delegated to the caller through `getDayState`, so
 * the same grid drives the single-date, range and settlement pickers without
 * baking any one screen's rules into it.
 *
 * Monday-first to match a trading week. Stays on the neutral house palette;
 * the only hues that appear are the ones a DayState opts into. */

export type DayTone =
  | "normal"
  | "weekend"
  | "holiday"
  | "today"
  | "trade"
  | "settlement";

export interface DayState {
  disabled?: boolean;
  selected?: boolean;
  /** Between (and excluding) the range endpoints. */
  inRange?: boolean;
  rangeStart?: boolean;
  rangeEnd?: boolean;
  /** Hover preview while a range's second endpoint is being chosen. */
  preview?: boolean;
  tone?: DayTone;
  /** Native title / tooltip — used for closure names. */
  title?: string;
  /** Tiny dot marker shown under the day number. */
  marker?: "amber" | "neutral" | "blue" | "green";
}

interface MonthGridProps {
  month: YearMonth;
  onMonthChange?: (next: YearMonth) => void;
  getDayState: (date: string) => DayState;
  onSelect: (date: string) => void;
  onHover?: (date: string | null) => void;
  /** Hide the month header + nav (for a static second pane in a dual view). */
  hideNav?: boolean;
}

const MARKER_DOT: Record<NonNullable<DayState["marker"]>, string> = {
  amber: "bg-amber-500",
  neutral: "bg-neutral-400",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
};

function dayClasses(state: DayState, inMonth: boolean): string {
  const base =
    "relative flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors";

  if (state.disabled) {
    return `${base} cursor-not-allowed text-neutral-300 line-through decoration-neutral-300`;
  }
  if (state.rangeStart || state.rangeEnd || state.selected) {
    return `${base} bg-neutral-900 font-semibold text-white`;
  }
  if (state.inRange) {
    return `${base} bg-neutral-200 text-neutral-800`;
  }
  if (state.preview) {
    return `${base} bg-neutral-100 text-neutral-700`;
  }

  const tone =
    state.tone === "holiday"
      ? "text-amber-700"
      : state.tone === "weekend"
        ? "text-neutral-400"
        : inMonth
          ? "text-neutral-800"
          : "text-neutral-300";

  const ring =
    state.tone === "settlement"
      ? " ring-1 ring-inset ring-emerald-500 font-semibold text-emerald-700"
      : state.tone === "today"
        ? " ring-1 ring-inset ring-blue-400 font-semibold text-blue-700"
        : "";

  return `${base} cursor-pointer hover:bg-neutral-100 ${tone}${ring}`;
}

export default function MonthGrid({
  month,
  onMonthChange,
  getDayState,
  onSelect,
  onHover,
  hideNav,
}: MonthGridProps) {
  const weeks = monthMatrix(month);

  return (
    <div className="select-none">
      {!hideNav && (
        <div className="mb-3 flex items-center justify-between">
          <NavButton
            label="Previous month"
            dir="prev"
            onClick={() => onMonthChange?.(stepMonth(month, -1))}
          />
          <div className="text-sm font-semibold text-neutral-900">
            {monthLabel(month)}
          </div>
          <NavButton
            label="Next month"
            dir="next"
            onClick={() => onMonthChange?.(stepMonth(month, 1))}
          />
        </div>
      )}
      {hideNav && (
        <div className="mb-3 text-center text-sm font-semibold text-neutral-900">
          {monthLabel(month)}
        </div>
      )}

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((w) => (
          <div
            key={w}
            className="flex h-7 items-center justify-center text-[11px] font-medium tracking-wide text-neutral-400 uppercase"
          >
            {w}
          </div>
        ))}

        {weeks.flat().map((date) => {
          const inMonth = isSameMonth(date, month);
          const state = getDayState(date);
          const dayNum = Number(date.slice(8, 10));
          return (
            <div key={date} className="flex items-center justify-center">
              <button
                type="button"
                title={state.title}
                disabled={state.disabled}
                onClick={() => onSelect(date)}
                onMouseEnter={() => onHover?.(date)}
                onMouseLeave={() => onHover?.(null)}
                className={dayClasses(state, inMonth)}
              >
                {dayNum}
                {state.marker && (
                  <span
                    className={`absolute bottom-1 h-1 w-1 rounded-full ${MARKER_DOT[state.marker]}`}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function stepMonth(ym: YearMonth, n: number): YearMonth {
  const total = ym.year * 12 + ym.month + n;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

function NavButton({
  label,
  dir,
  onClick,
}: {
  label: string;
  dir: "prev" | "next";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        {dir === "prev" ? (
          <path
            fillRule="evenodd"
            d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.24a.75.75 0 0 1 0-1.06l4.25-4.24a.75.75 0 0 1 1.06 0Z"
            clipRule="evenodd"
          />
        ) : (
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 0 1 0-1.06L10.94 10 7.21 6.29a.75.75 0 1 1 1.06-1.06l4.25 4.24a.75.75 0 0 1 0 1.06l-4.25 4.24a.75.75 0 0 1-1.06 0Z"
            clipRule="evenodd"
          />
        )}
      </svg>
    </button>
  );
}
