import type { OperationalState, QlikSummary } from "../../lib/qlik";
import { SEVERITY_TONES, type Severity } from "../../lib/severity-tokens";

function formatClock(ts: string) {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* Spec §2.1 — sourced from QlikSummary, NOT derived from synthetic data.
 * Calm-default discipline retained from prior spec: clean = neutral grey. */

export default function OperationalStateBanner({
  state,
  summary,
  lensLabel,
}: {
  state: OperationalState;
  summary: QlikSummary;
  lensLabel?: string;
}) {
  // Spec v0.1.1 §1.4 — L0 banner uses the `.banner` tier (loudest).
  const severity: Severity =
    state === "broken" ? "broken" : state === "at-risk" ? "atrisk" : "clean";
  const tokens = SEVERITY_TONES[severity].banner;
  const iconBg =
    state === "broken"
      ? "bg-red-500"
      : state === "at-risk"
        ? "bg-amber-500"
        : "bg-neutral-300";
  const iconChar =
    state === "broken" ? "■" : state === "at-risk" ? "▲" : "✓";

  const stateLabel =
    state === "clean" ? "Clean" : state === "at-risk" ? "At risk" : "Broken";

  const sentence =
    state === "clean"
      ? `All monitors green. ${summary.monitorSummary.infoWarnings} info ${
          summary.monitorSummary.infoWarnings === 1 ? "warning" : "warnings"
        }.`
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
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${iconBg} text-sm font-bold text-white`}
      >
        {iconChar}
      </span>
      <div className="flex-1">
        <div className="flex items-baseline gap-3">
          <span className={`text-3xl font-semibold tracking-tight ${tokens.text}`}>
            {stateLabel}
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
