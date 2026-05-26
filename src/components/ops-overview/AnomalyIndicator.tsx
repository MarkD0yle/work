import type { AnomalyState } from "../../lib/anomaly-detection";

/* Spec §4.3 — anomaly symbol + text + colour.
 * Spec §4.4 — significant below renders muted, not celebrated. */

export default function AnomalyIndicator({ state }: { state: AnomalyState }) {
  if (state.insufficient) {
    return (
      <div className="text-[10px] text-neutral-400 italic">
        insufficient history
      </div>
    );
  }

  if (state.magnitude === "normal") {
    return (
      <div className="flex items-center gap-1 text-[10px] text-neutral-500">
        <span aria-hidden>●</span>
        <span>flat</span>
      </div>
    );
  }

  const above = state.direction === "above";
  const sigmaText = `${state.sigmaFromMean >= 0 ? "+" : "−"}${Math.abs(state.sigmaFromMean).toFixed(1)}σ ${above ? "above" : "below"}`;

  // Symbol per §4.3
  const symbol =
    state.magnitude === "significant"
      ? above
        ? "▲▲"
        : "▼▼"
      : above
        ? "▲"
        : "▼";

  // Colour per §4.3 + §4.4 (below stays muted)
  const colourCls =
    state.magnitude === "significant"
      ? above
        ? "text-red-700 font-semibold"
        : "text-emerald-600"
      : above
        ? "text-amber-700"
        : "text-blue-600";

  return (
    <div className={`flex items-center gap-1 text-[10px] ${colourCls}`}>
      <span aria-hidden>{symbol}</span>
      <span>{sigmaText}</span>
    </div>
  );
}
