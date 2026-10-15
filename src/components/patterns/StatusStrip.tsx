import { border, cx, focus, surface, text, tone as toneTokens, type Tone } from "./tokens";

/* StatusStrip — where work sits across a fixed sequence of stages.
 *
 * Captured → Matched → Confirmed → Settled. Each stage shows a count and,
 * when something is stuck, the count of problems in its tone. Stages are
 * buttons when `onSelect` is passed, so the strip doubles as a filter for
 * the table under it. Reads left to right: never reorder stages by count. */

export type Stage = {
  id: string;
  label: string;
  count: number;
  /** Items in trouble at this stage. */
  issues?: number;
  issueTone?: Tone;
  caption?: string;
};

export function StatusStrip({
  stages,
  selected,
  onSelect,
  label,
}: {
  stages: Stage[];
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  /** Accessible name, e.g. "Settlement stages". */
  label: string;
}) {
  return (
    <ol aria-label={label} className={cx("grid auto-cols-fr grid-flow-col overflow-x-auto", border.default, surface.card)}>
      {stages.map((s, i) => {
        const on = selected === s.id;
        const inner = (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-neutral-400 tabular-nums">{i + 1}</span>
              <span className={text.eyebrow}>{s.label}</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-semibold text-neutral-900 tabular-nums">{s.count.toLocaleString()}</span>
              {!!s.issues && (
                <span className={cx("text-xs font-medium tabular-nums", toneTokens[s.issueTone ?? "negative"].text)}>
                  {s.issues} {s.issues === 1 ? "issue" : "issues"}
                </span>
              )}
            </div>
            {s.caption && <div className={cx("mt-0.5", text.muted)}>{s.caption}</div>}
            {!!s.issues && <span aria-hidden className={cx("absolute inset-x-0 bottom-0 h-0.5", toneTokens[s.issueTone ?? "negative"].solid)} />}
          </>
        );
        const cell = cx(
          "relative min-w-32 px-4 py-3 text-left",
          i > 0 && "border-l border-neutral-200",
          on && "bg-neutral-100",
        );
        return (
          <li key={s.id} className="flex">
            {onSelect ? (
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(on ? null : s.id)}
                className={cx(cell, "w-full", surface.hover, focus)}
              >
                {inner}
              </button>
            ) : (
              <div className={cx(cell, "w-full")}>{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
