import type { ReactNode } from "react";
import { Sparkline } from "./Sparkline";
import { border, cx, radius, space, surface, text, tone as toneTokens, type Tone } from "./tokens";

/* MetricCard — one number and what it means.
 *
 * Reading order is fixed: label → value → delta → context. The delta's
 * colour comes from whether the move is good, not whether it is up:
 * `goodWhen="down"` makes a falling fails rate green. A tone rail on the
 * top edge flags a metric that has crossed a threshold, so a row of cards
 * can be scanned by colour before it is read.
 *
 * MetricGrid lays cards out on one gap and a fixed column count, so a KPI
 * row looks the same on every screen. */

export type Delta = {
  /** Signed change, already in display units, e.g. 2.4 for +2.4%. */
  value: number;
  /** Rendered text, e.g. "+2.4%" or "+£1.2m". Defaults to the signed value. */
  label?: string;
  /** Comparison basis, e.g. "vs yesterday". */
  basis?: string;
  /** Which direction is good. "none" keeps the delta neutral. */
  goodWhen?: "up" | "down" | "none";
};

function deltaTone(d: Delta): Tone {
  if (d.value === 0 || d.goodWhen === "none") return "neutral";
  const up = d.value > 0;
  const good = (d.goodWhen ?? "up") === "up" ? up : !up;
  return good ? "positive" : "negative";
}

export function DeltaText({ delta }: { delta: Delta }) {
  const t = deltaTone(delta);
  const arrow = delta.value > 0 ? "▲" : delta.value < 0 ? "▼" : "■";
  const label = delta.label ?? `${delta.value > 0 ? "+" : ""}${delta.value}`;
  return (
    <span className="inline-flex items-baseline gap-1 text-xs">
      <span className={cx("font-medium tabular-nums", toneTokens[t].text)}>
        <span aria-hidden className="mr-0.5 text-[9px]">{arrow}</span>
        {label}
      </span>
      {delta.basis && <span className="text-neutral-500">{delta.basis}</span>}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  unit,
  delta,
  caption,
  status,
  trend,
  footer,
  onClick,
  selected = false,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: Delta;
  /** One line of context: target, threshold, as-of. */
  caption?: ReactNode;
  /** Threshold state — draws the tone rail. Omit when on track. */
  status?: Tone;
  trend?: { values: number[]; band?: { lo: number; hi: number }; label: string };
  footer?: ReactNode;
  /** Makes the card a filter/drill trigger. */
  onClick?: () => void;
  selected?: boolean;
}) {
  const body = (
    <>
      {status && <span aria-hidden className={cx("absolute inset-x-0 top-0 h-0.5", toneTokens[status].solid)} />}
      <div className={text.eyebrow}>{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={text.value}>{value}</span>
        {unit && <span className="text-sm text-neutral-500">{unit}</span>}
      </div>
      {delta && (
        <div className="mt-1">
          <DeltaText delta={delta} />
        </div>
      )}
      {trend && (
        <Sparkline
          className="mt-2 h-8 w-full"
          values={trend.values}
          band={trend.band}
          label={trend.label}
          tone={status ?? "neutral"}
        />
      )}
      {caption && <div className={cx("mt-1.5", text.muted)}>{caption}</div>}
      {footer && <div className={cx("mt-3 border-t pt-2", border.subtle)}>{footer}</div>}
    </>
  );

  const shell = cx(
    "relative block w-full min-w-0 text-left",
    surface.card,
    border.default,
    radius.container,
    space.cardPad,
    selected && "ring-2 ring-neutral-900 ring-inset",
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={selected} className={cx(shell, surface.hover)}>
        {body}
      </button>
    );
  }
  return <div className={shell}>{body}</div>;
}

const COLS: Record<2 | 3 | 4 | 5 | 6, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5",
  6: "sm:grid-cols-3 lg:grid-cols-6",
};

export function MetricGrid({
  columns = 4,
  children,
}: {
  columns?: 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
}) {
  return <div className={cx("grid grid-cols-1", space.gap, COLS[columns])}>{children}</div>;
}
