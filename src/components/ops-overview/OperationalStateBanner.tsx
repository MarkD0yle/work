import type { OperationalState, QlikSummary } from "../../lib/qlik";
import { SEVERITY_TONES, type Severity } from "../../lib/severity-tokens";

function formatClock(ts: string) {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* Spec v0.1.2 §1.5 — four L0 states: clean / watch / at-risk / broken.
 *
 * `watch` is the new state introduced by v0.1.2: at least one past_typical
 * breach exists but nothing has slipped a required SLA yet. The banner
 * renders in cream tone — visible but quiet, so it doesn't create alarm
 * fatigue. Phrasing is informational, not actionable.
 *
 * Hard rule (spec §6, rule 24): the system-health strip is quieter than
 * this banner. Always. */

const STATE_TO_SEVERITY: Record<OperationalState, Severity> = {
  broken: "benchmark",
  "at-risk": "required",
  watch: "typical",
  clean: "clean",
};

const STATE_TO_ICON: Record<OperationalState, { bg: string; char: string }> = {
  broken: { bg: "bg-red-500", char: "■" },
  "at-risk": { bg: "bg-amber-500", char: "▲" },
  watch: { bg: "bg-yellow-300", char: "·" },
  clean: { bg: "bg-neutral-300", char: "✓" },
};

const STATE_LABEL: Record<OperationalState, string> = {
  broken: "Broken",
  "at-risk": "At risk",
  watch: "Watch",
  clean: "Clean",
};

export default function OperationalStateBanner({
  state,
  summary,
  lensLabel,
}: {
  state: OperationalState;
  summary: QlikSummary;
  lensLabel?: string;
}) {
  const tokens = SEVERITY_TONES[STATE_TO_SEVERITY[state]].banner;
  const icon = STATE_TO_ICON[state];

  const sentence =
    state === "clean"
      ? `All monitors green. ${summary.monitorSummary.infoWarnings} info ${
          summary.monitorSummary.infoWarnings === 1 ? "warning" : "warnings"
        }.`
      : state === "watch"
        ? // Quieter copy — situational awareness, not action.
          `${summary.monitorSummary.midLevelFlags || "Some"} stage${
            summary.monitorSummary.midLevelFlags === 1 ? "" : "s"
          } running slow vs typical pace. No SLA breached.`
        : `${summary.monitorSummary.midLevelFlags} monitor${
            summary.monitorSummary.midLevelFlags === 1 ? "" : "s"
          } mid-level, ${summary.monitorSummary.infoWarnings} info ${
            summary.monitorSummary.infoWarnings === 1 ? "warning" : "warnings"
          }.`;

  return (
    <section
      aria-live="polite"
      aria-label="Operational state"
      className={`flex items-center gap-5 rounded-lg border ${tokens.border} ${tokens.bg} px-6 py-5`}
    >
      <span
        aria-hidden
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${icon.bg} text-sm font-bold text-white`}
      >
        {icon.char}
      </span>
      <div className="flex-1">
        <div className="flex items-baseline gap-3">
          <span className={`text-3xl font-semibold tracking-tight ${tokens.text}`}>
            {STATE_LABEL[state]}
          </span>
          {lensLabel && (
            <span className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
              · {lensLabel} lens
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-neutral-700">{sentence}</p>
      </div>
      <div className="text-right text-xs text-neutral-500">
        <div className="font-medium text-neutral-700">
          Qlik refresh {formatClock(summary.lastRefresh)} ET
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-neutral-400">
          polls every 60s
        </div>
      </div>
    </section>
  );
}
