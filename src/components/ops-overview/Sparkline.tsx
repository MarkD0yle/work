import type { AnomalyState } from "../../lib/anomaly-detection";

/* Spec §8 Sparkline — generic, reusable.
 *
 * Renders a horizontal bar sparkline. Today (last bar) is visually
 * distinct:
 *   - Solid fill when day is complete
 *   - Striped fill when day is partial (mid-day) — spec §3.2
 *   - Severity-tinted from anomaly state — spec §6
 *
 * Past bars are neutral muted; click on a past bar drills into a
 * historical day drawer (spec §5.2). Today is never click-able. */

interface BarInfo {
  date: string;
  count: number;
  isToday: boolean;
  isPartial: boolean;
}

export default function Sparkline({
  bars,
  todayAnomaly,
  onPastBarClick,
  ariaLabel,
}: {
  bars: BarInfo[];
  todayAnomaly: AnomalyState;
  onPastBarClick?: (date: string) => void;
  ariaLabel?: string;
}) {
  const maxCount = Math.max(1, ...bars.map((b) => b.count));
  const todayFillBase = todayBarColour(todayAnomaly);

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="flex h-8 items-end gap-px"
    >
      {bars.map((b, i) => {
        // Height: zero-counts still show a faint baseline so empty days
        // don't read as missing data.
        const heightPct = b.count === 0 ? 6 : Math.max(12, (b.count / maxCount) * 100);
        if (b.isToday) {
          const stripe = b.isPartial
            ? "bg-[repeating-linear-gradient(45deg,_currentColor_0,_currentColor_3px,_transparent_3px,_transparent_6px)]"
            : "";
          return (
            <span
              key={i}
              title={tooltipText(b, todayAnomaly)}
              className={`flex-1 rounded-sm ${todayFillBase} ${stripe}`}
              style={{ height: `${heightPct}%` }}
            />
          );
        }
        const isClickable = !!onPastBarClick;
        return (
          <button
            key={i}
            type="button"
            disabled={!isClickable}
            onClick={() => isClickable && onPastBarClick?.(b.date)}
            title={tooltipText(b, todayAnomaly, false)}
            aria-label={`${b.date}: ${b.count} breached`}
            className={`flex-1 rounded-sm bg-neutral-300 transition ${
              isClickable ? "cursor-pointer hover:bg-neutral-400" : "cursor-default"
            }`}
            style={{ height: `${heightPct}%` }}
          />
        );
      })}
    </div>
  );
}

function todayBarColour(state: AnomalyState): string {
  if (state.insufficient) return "bg-neutral-400 text-neutral-400";
  if (state.magnitude === "significant" && state.direction === "above") {
    return "bg-red-500 text-red-500";
  }
  if (state.magnitude === "elevated" && state.direction === "above") {
    return "bg-amber-500 text-amber-500";
  }
  if (state.magnitude === "significant" && state.direction === "below") {
    // Spec §4.4 — don't celebrate below loudly. Muted green only.
    return "bg-emerald-400 text-emerald-400";
  }
  if (state.magnitude === "elevated" && state.direction === "below") {
    return "bg-blue-400 text-blue-400";
  }
  return "bg-neutral-500 text-neutral-500";
}

function tooltipText(b: BarInfo, anomaly: AnomalyState, includeAnomaly = true): string {
  const lines = [
    new Date(b.date).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
    `${b.count} breached${b.isPartial ? " (mid-day)" : ""}`,
  ];
  if (includeAnomaly && !anomaly.insufficient) {
    const sign = anomaly.sigmaFromMean >= 0 ? "+" : "−";
    lines.push(
      `${sign}${Math.abs(anomaly.sigmaFromMean).toFixed(1)}σ vs window`,
    );
  }
  return lines.join("\n");
}
