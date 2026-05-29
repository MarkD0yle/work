import type { ReactNode } from "react";

/* Firm-wide ops strip — generic categorical metrics with specific
 * instances in the sub-line. The labels (INBOUND / OUTBOUND / ACTIVITY /
 * EXCEPTIONS / SLA / CYCLE TIME) are the universal ops vocabulary; the
 * sub-text grounds each tile in the actual business object today
 * (files / NAVs+reports / trades / overdue items / on-time / MTTR).
 *
 * Reading this dashboard cold, you get the firm-wide ops picture without
 * needing to know what a "NAV" or "GAM file" is. The texture comes from
 * the sub-line; the headline value is generic. */

export type Period = "30d" | "90d" | "ytd";

export const PERIOD_LABEL: Record<Period, string> = {
  "30d": "30d",
  "90d": "90d",
  ytd: "YTD",
};

export type ManagementMetrics = {
  /** Items received from upstream (files, feeds, snapshots). */
  inbound: {
    today: number;
    expected: number;
    overdue: number;
    priorAvg: number;
    /** Human-readable example, shown in sub-line. */
    instance: string;
  };
  /** Items produced and published (NAVs, reports, submissions). */
  outbound: {
    today: number;
    expected: number;
    pending: number;
    priorAvg: number;
    instance: string;
  };
  /** Work units processed (trades, transactions, allocations). */
  activity: {
    today: number;
    priorAvg: number;
    instance: string;
  };
  /** Items currently requiring action (overdue, breached, awaiting). */
  exceptions: {
    today: number;
    priorAvg: number;
    instance: string;
  };
  /** Service level — % of expected items completed on time. */
  sla: {
    current: number;
    prior: number;
    target: number;
    priorLabel: string;
  };
  /** Median issue-to-resolved cycle time in seconds. */
  cycleTime: {
    medianSec: number;
    priorMedianSec: number;
  };
};

export const MANAGEMENT_METRICS: Record<Period, ManagementMetrics> = {
  "30d": {
    inbound: {
      today: 247,
      expected: 252,
      overdue: 5,
      priorAvg: 249,
      instance: "files received",
    },
    outbound: {
      today: 52,
      expected: 59,
      pending: 7,
      priorAvg: 57,
      instance: "NAVs + reports",
    },
    activity: {
      today: 18432,
      priorAvg: 16450,
      instance: "trades booked",
    },
    exceptions: {
      today: 12,
      priorAvg: 8,
      instance: "breached or overdue",
    },
    sla: {
      current: 0.942,
      prior: 0.918,
      target: 0.95,
      priorLabel: "prior 30d",
    },
    cycleTime: { medianSec: 494, priorMedianSec: 612 },
  },
  "90d": {
    inbound: {
      today: 247,
      expected: 252,
      overdue: 5,
      priorAvg: 248,
      instance: "files received",
    },
    outbound: {
      today: 52,
      expected: 59,
      pending: 7,
      priorAvg: 56,
      instance: "NAVs + reports",
    },
    activity: {
      today: 18432,
      priorAvg: 17120,
      instance: "trades booked",
    },
    exceptions: {
      today: 12,
      priorAvg: 9,
      instance: "breached or overdue",
    },
    sla: {
      current: 0.927,
      prior: 0.901,
      target: 0.95,
      priorLabel: "prior 90d",
    },
    cycleTime: { medianSec: 580, priorMedianSec: 640 },
  },
  ytd: {
    inbound: {
      today: 247,
      expected: 252,
      overdue: 5,
      priorAvg: 246,
      instance: "files received",
    },
    outbound: {
      today: 52,
      expected: 59,
      pending: 7,
      priorAvg: 56,
      instance: "NAVs + reports",
    },
    activity: {
      today: 18432,
      priorAvg: 17890,
      instance: "trades booked",
    },
    exceptions: {
      today: 12,
      priorAvg: 10,
      instance: "breached or overdue",
    },
    sla: {
      current: 0.914,
      prior: 0.896,
      target: 0.95,
      priorLabel: "same period last year",
    },
    cycleTime: { medianSec: 612, priorMedianSec: 698 },
  },
};

function formatPct(n: number, digits = 1) {
  return `${(n * 100).toFixed(digits)}%`;
}

function formatThousands(n: number) {
  return n.toLocaleString("en-GB");
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s.toString().padStart(2, "0")}s`;
}

function deltaPct(current: number, prior: number): {
  text: string;
  sign: "up" | "down" | "flat";
} {
  if (prior === 0) return { text: "—", sign: "flat" };
  const change = (current - prior) / prior;
  if (Math.abs(change) < 0.005) return { text: "±0%", sign: "flat" };
  const pct = (change * 100).toFixed(1);
  return {
    text: `${change > 0 ? "▲" : "▼"} ${Math.abs(parseFloat(pct))}%`,
    sign: change > 0 ? "up" : "down",
  };
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
  const inboundDelta = deltaPct(metrics.inbound.today, metrics.inbound.priorAvg);
  const outboundDelta = deltaPct(metrics.outbound.today, metrics.outbound.priorAvg);
  const activityDelta = deltaPct(metrics.activity.today, metrics.activity.priorAvg);
  const exceptionsDelta = deltaPct(metrics.exceptions.today, metrics.exceptions.priorAvg);
  const slaDelta = metrics.sla.current - metrics.sla.prior;
  const slaAboveTarget = metrics.sla.current >= metrics.sla.target;
  const cycleDelta = metrics.cycleTime.medianSec - metrics.cycleTime.priorMedianSec;

  return (
    <section
      aria-label="Firm-wide operational metrics"
      className="mb-5 rounded-md border border-neutral-200 bg-white px-5 py-3"
    >
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
          Firm-wide · vs {PERIOD_LABEL[period]} avg
        </span>
        <div className="flex items-center gap-1 rounded-full border border-neutral-200 p-0.5">
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
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Inbound — items received from upstream */}
        <Metric
          label="Inbound"
          value={
            <>
              <span className="tabular-nums">{metrics.inbound.today}</span>
              <span className="ml-0.5 text-xs font-normal text-neutral-400">
                / {metrics.inbound.expected}
              </span>
            </>
          }
          delta={
            <DeltaText
              text={inboundDelta.text}
              tone={inboundDelta.sign === "down" ? "warn" : "neutral"}
            />
          }
          sub={
            <>
              <span>{metrics.inbound.instance}</span>
              {metrics.inbound.overdue > 0 && (
                <span className="text-amber-700">
                  {" · "}
                  {metrics.inbound.overdue} overdue
                </span>
              )}
            </>
          }
        />

        {/* Outbound — things we publish */}
        <Metric
          label="Outbound"
          value={
            <>
              <span className="tabular-nums">{metrics.outbound.today}</span>
              <span className="ml-0.5 text-xs font-normal text-neutral-400">
                / {metrics.outbound.expected}
              </span>
            </>
          }
          delta={
            <DeltaText
              text={outboundDelta.text}
              tone={outboundDelta.sign === "down" ? "warn" : "neutral"}
            />
          }
          sub={
            <>
              <span>{metrics.outbound.instance}</span>
              {metrics.outbound.pending > 0 && (
                <span className="text-amber-700">
                  {" · "}
                  {metrics.outbound.pending} pending
                </span>
              )}
            </>
          }
        />

        {/* Activity — volume processed */}
        <Metric
          label="Activity"
          value={<span className="tabular-nums">{formatThousands(metrics.activity.today)}</span>}
          delta={
            <DeltaText
              text={activityDelta.text}
              tone={activityDelta.sign === "up" ? "ok" : "neutral"}
            />
          }
          sub={
            <>
              <span>{metrics.activity.instance}</span>
              <span className="text-neutral-400">
                {" · "}
                vs {formatThousands(Math.round(metrics.activity.priorAvg))} avg
              </span>
            </>
          }
        />

        {/* Exceptions — things requiring action */}
        <Metric
          label="Exceptions"
          value={
            <span
              className={`tabular-nums ${
                metrics.exceptions.today === 0
                  ? "text-neutral-400"
                  : "text-amber-800"
              }`}
            >
              {metrics.exceptions.today}
            </span>
          }
          delta={
            <DeltaText
              text={exceptionsDelta.text}
              tone={exceptionsDelta.sign === "up" ? "warn" : "ok"}
            />
          }
          sub={
            <>
              <span>{metrics.exceptions.instance}</span>
              <span className="text-neutral-400">
                {" · "}
                avg {metrics.exceptions.priorAvg.toFixed(0)}
              </span>
            </>
          }
        />

        {/* SLA — service level */}
        <Metric
          label="SLA"
          value={<span className="tabular-nums">{formatPct(metrics.sla.current, 1)}</span>}
          delta={
            <DeltaText
              text={
                slaDelta === 0
                  ? "±0"
                  : `${slaDelta > 0 ? "▲" : "▼"} ${formatPct(Math.abs(slaDelta), 1)}`
              }
              tone={slaDelta > 0 ? "ok" : slaDelta < 0 ? "warn" : "neutral"}
            />
          }
          sub={
            <>
              <span>on-time rate</span>
              <span className="text-neutral-400">{" · "}target </span>
              <span
                className={
                  slaAboveTarget ? "text-emerald-700" : "text-amber-700"
                }
              >
                {formatPct(metrics.sla.target, 0)}
              </span>
            </>
          }
        />

        {/* Cycle time — issue-to-resolved speed */}
        <Metric
          label="Cycle time"
          value={
            <span className="tabular-nums">
              {formatDuration(metrics.cycleTime.medianSec)}
            </span>
          }
          delta={
            <DeltaText
              text={
                cycleDelta === 0
                  ? "±0"
                  : `${cycleDelta < 0 ? "▼" : "▲"} ${formatDuration(Math.abs(cycleDelta))}`
              }
              tone={cycleDelta < 0 ? "ok" : cycleDelta > 0 ? "warn" : "neutral"}
            />
          }
          sub={<span>median resolve</span>}
        />
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  delta,
  sub,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-lg font-semibold text-neutral-900">{value}</span>
        {delta && <span className="text-[11px] font-medium">{delta}</span>}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div>}
    </div>
  );
}

function DeltaText({
  text,
  tone,
}: {
  text: string;
  tone: "ok" | "warn" | "neutral";
}) {
  const cls =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-700"
        : "text-neutral-400";
  return <span className={cls}>{text}</span>;
}
