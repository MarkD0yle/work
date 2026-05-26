/* Management strip — firm-wide context.
 *
 * Simplified from earlier tile-based version: single horizontal flow,
 * four metrics separated by light dividers, no sparklines / drill-links
 * / progress bars / prior-period prose. Each metric is short label +
 * big number + one comparator. Period toggle kept but de-emphasised.
 *
 * Production data sources (still mocked at this layer):
 *   - On-time: % of expected monitors green over period
 *   - Days clean: streak counter from daily aggregation
 *   - Top recurring pattern: most-frequent monitor name by red events
 *   - Client-visible: subset tagged externally-visible
 */

export type Period = "30d" | "90d" | "ytd";

const PERIOD_LABEL: Record<Period, string> = {
  "30d": "30 days",
  "90d": "90 days",
  ytd: "YTD",
};

export type ManagementMetrics = {
  onTimeRate: { current: number; prior: number; target: number };
  daysClean: { current: number; longestYTD: number };
  topPattern: { label: string; sharePct: number; deltaPts: number };
  clientImpacting: { current: number; prior: number };
};

export const MANAGEMENT_METRICS: Record<Period, ManagementMetrics> = {
  "30d": {
    onTimeRate: { current: 0.942, prior: 0.918, target: 0.95 },
    daysClean: { current: 12, longestYTD: 23 },
    topPattern: { label: "Late upstream data", sharePct: 47, deltaPts: 4 },
    clientImpacting: { current: 3, prior: 0 },
  },
  "90d": {
    onTimeRate: { current: 0.927, prior: 0.901, target: 0.95 },
    daysClean: { current: 12, longestYTD: 23 },
    topPattern: { label: "Late upstream data", sharePct: 41, deltaPts: 1 },
    clientImpacting: { current: 7, prior: 5 },
  },
  ytd: {
    onTimeRate: { current: 0.914, prior: 0.896, target: 0.95 },
    daysClean: { current: 12, longestYTD: 23 },
    topPattern: { label: "Stale pricing", sharePct: 38, deltaPts: -2 },
    clientImpacting: { current: 18, prior: 22 },
  },
};

function formatPct(n: number, digits = 1) {
  return `${(n * 100).toFixed(digits)}%`;
}

function deltaPctSpan(delta: number) {
  if (Math.abs(delta) < 0.0005) {
    return <span className="text-neutral-400">±0</span>;
  }
  const arrow = delta > 0 ? "▲" : "▼";
  const color = delta > 0 ? "text-emerald-600" : "text-red-600";
  return (
    <span className={color}>
      {arrow} {formatPct(Math.abs(delta), 1)}
    </span>
  );
}

function deltaPtsSpan(delta: number, worseIsPositive = true) {
  if (delta === 0) return <span className="text-neutral-400">±0</span>;
  const arrow = delta > 0 ? "▲" : "▼";
  const isWorse = worseIsPositive ? delta > 0 : delta < 0;
  const color = isWorse ? "text-red-600" : "text-emerald-600";
  return (
    <span className={color}>
      {arrow} {Math.abs(delta).toFixed(1)}pt
    </span>
  );
}

function deltaCountSpan(delta: number, worseIsPositive = true) {
  if (delta === 0) return <span className="text-neutral-400">±0</span>;
  const arrow = delta > 0 ? "▲" : "▼";
  const isWorse = worseIsPositive ? delta > 0 : delta < 0;
  const color = isWorse ? "text-red-600" : "text-emerald-600";
  return (
    <span className={color}>
      {arrow} {Math.abs(delta)}
    </span>
  );
}

export default function ManagementStrip({
  metrics,
  period,
  onPeriodChange,
}: {
  metrics: ManagementMetrics;
  period: Period;
  onPeriodChange: (p: Period) => void;
}) {
  const onTimeDelta = metrics.onTimeRate.current - metrics.onTimeRate.prior;
  const aboveTarget = metrics.onTimeRate.current >= metrics.onTimeRate.target;
  const clientDelta = metrics.clientImpacting.current - metrics.clientImpacting.prior;

  return (
    <section
      aria-label="Management metrics"
      className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-md border border-neutral-200 bg-white px-5 py-3"
    >
      <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
        Firm-wide · {PERIOD_LABEL[period]}
      </span>

      <Metric
        label="On-time"
        value={formatPct(metrics.onTimeRate.current, 1)}
        delta={deltaPctSpan(onTimeDelta)}
        sub={
          <>
            target{" "}
            <span className={aboveTarget ? "text-emerald-700" : "text-amber-700"}>
              {formatPct(metrics.onTimeRate.target, 0)}
            </span>
          </>
        }
      />
      <Divider />

      <Metric
        label="Days clean"
        value={metrics.daysClean.current.toString()}
        sub={
          <>
            longest{" "}
            <span className="text-neutral-700">{metrics.daysClean.longestYTD}</span>
          </>
        }
      />
      <Divider />

      <Metric
        label="Top pattern"
        value={`${metrics.topPattern.sharePct}%`}
        delta={deltaPtsSpan(metrics.topPattern.deltaPts)}
        sub={metrics.topPattern.label}
      />
      <Divider />

      <Metric
        label="Client-visible"
        value={metrics.clientImpacting.current.toString()}
        valueDim={metrics.clientImpacting.current === 0}
        delta={deltaCountSpan(clientDelta)}
        sub={`vs ${metrics.clientImpacting.prior} prior`}
      />

      <div className="ml-auto flex items-center gap-1 rounded-full border border-neutral-200 p-0.5">
        {(["30d", "90d", "ytd"] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPeriodChange(p)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase transition ${
              period === p
                ? "bg-neutral-900 text-white"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  delta,
  sub,
  valueDim,
}: {
  label: string;
  value: string;
  delta?: React.ReactNode;
  sub?: React.ReactNode;
  valueDim?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <div className="text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`text-xl font-semibold tabular-nums ${
            valueDim ? "text-neutral-400" : "text-neutral-900"
          }`}
        >
          {value}
        </span>
        {delta && <span className="text-[11px] font-medium">{delta}</span>}
      </div>
      {sub && (
        <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div>
      )}
    </div>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      className="hidden h-10 w-px bg-neutral-200 lg:inline-block"
    />
  );
}
