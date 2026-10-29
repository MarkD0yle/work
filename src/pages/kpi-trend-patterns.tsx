import { useMemo, useState } from "react";
import SparklineStats from "../components/stats/SparklineStats";
import TargetStats, { TargetLegend } from "../components/stats/TargetStats";
import DriverStats from "../components/stats/DriverStats";
import {
  CardHeader,
  PatternNotes,
  PatternSection,
} from "../components/stats/StatChrome";
import { navigateToPage } from "../lib/navigation";
import {
  PERIOD_LABEL,
  driverMetrics,
  formatDay,
  seriesWindows,
  statusOf,
  targetMetrics,
  type Period,
} from "../lib/stats-trend";

export const title = "KPI Trend Patterns";

/* KPI Trend Patterns — three ways to show whether a KPI is moving and
 * whether it matters, each extending the KPI Strip on Ops Overview.
 * Every pattern keeps its own period toggle, as it would when shipped on
 * its own. Anatomy notes live in components/stats/. */

const PATTERNS = [
  { id: "sparkline", title: "Sparkline Stats", question: "Is today normal?" },
  { id: "target", title: "Target Stats", question: "Are we on target?" },
  { id: "drivers", title: "Driver Stats", question: "What moved it?" },
];

export default function KpiTrendPatternsPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
          UI patterns
        </div>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-neutral-900">
          KPI Trend Patterns
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Three ways to show whether a number is moving and whether it matters.
          Each builds on the{" "}
          <button
            type="button"
            onClick={() => navigateToPage("ops-overview")}
            className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-900"
          >
            KPI Strip on Ops Overview
          </button>{" "}
          and uses the same operation&apos;s numbers, so you can compare them
          side by side.
        </p>
      </div>

      <nav
        aria-label="Patterns on this page"
        className="grid gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-3"
      >
        {PATTERNS.map((p, i) => (
          <a
            key={p.id}
            href={`#${p.id}`}
            className="bg-white px-4 py-3 hover:bg-neutral-50"
          >
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="text-sm font-medium text-neutral-900">{p.title}</div>
            <div className="text-[11px] text-neutral-500">{p.question}</div>
          </a>
        ))}
      </nav>

      <SparklineSection />
      <TargetSection />
      <DriversSection />
    </div>
  );
}

function SparklineSection() {
  const [period, setPeriod] = useState<Period>("30d");
  const windows = useMemo(() => seriesWindows(period), [period]);
  const dates = windows[0].dates;

  return (
    <PatternSection
      id="sparkline"
      index={1}
      title="Sparkline Stats"
      question="Is today normal?"
      description="Each stat carries its daily history, the period average and a shaded usual range, so you can tell a real break from normal noise. Hover or arrow-key through any sparkline and every tile moves to that day."
    >
      <div className="border border-neutral-200 bg-white">
        <CardHeader
          label={`Firm-wide · daily, ${period === "ytd" ? "year to date" : `last ${PERIOD_LABEL[period]}`}`}
          aside={`${formatDay(dates[0])} – ${formatDay(dates[dates.length - 1])} · ${dates.length} trading days`}
          period={period}
          onPeriodChange={setPeriod}
        />
        <SparklineStats windows={windows} />
      </div>
      <PatternNotes
        useWhen={[
          "The question is whether today is normal, not just whether it went up. The usual range answers that at a glance.",
          "Metrics are noisy day to day, so one delta against an average would cry wolf.",
          "Readers compare the same day across metrics: a spike in exceptions next to a dip in SLA on the same date.",
        ]}
        avoidWhen={[
          "There is a target to hit. Use Target Stats, because a sparkline shows history, not distance to a goal.",
          "The next question is which desk or team caused the change. Use Driver Stats.",
          "There are more than about six metrics. The sparklines get too narrow to scrub, so use a table with a trend column.",
        ]}
      />
    </PatternSection>
  );
}

function TargetSection() {
  const [period, setPeriod] = useState<Period>("30d");
  const metrics = useMemo(() => targetMetrics(period), [period]);
  const label = PERIOD_LABEL[period];

  const statuses = metrics.map(statusOf);
  const onTarget = statuses.filter((s) => s === "on" || s === "slipping").length;
  const slipping = statuses.filter((s) => s === "slipping").length;

  return (
    <PatternSection
      id="target"
      index={2}
      title="Target Stats"
      question="Are we on target?"
      description="Each metric sits on a track with its target. The hollow marker is last period and the filled one is now, so the row shows whether the target is met and whether the metric is moving toward it or away from it."
    >
      <div className="border border-neutral-200 bg-white">
        <CardHeader
          label={`Service levels · this ${label} vs prior ${label}`}
          aside={
            <>
              <span className="font-medium text-neutral-700">
                {onTarget} of {metrics.length}
              </span>{" "}
              meeting target
              {slipping > 0 && (
                <span className="text-amber-700"> · {slipping} slipping</span>
              )}
            </>
          }
          period={period}
          onPeriodChange={setPeriod}
        />
        <TargetStats metrics={metrics} />
        <TargetLegend periodLabel={label} />
      </div>
      <PatternNotes
        useWhen={[
          "Every metric has an agreed target or SLA, and the question is whether you are meeting it.",
          "The metric is close to its target. The track zooms to the range that matters, which a bar starting at zero cannot do.",
          "Direction matters as much as position. A metric that is still meeting its target but getting worse is the one to catch early.",
        ]}
        avoidWhen={[
          "There is no target. A bare track has no reference point, so use Sparkline Stats.",
          "The day-by-day shape matters, such as a sudden drop versus a slow drift. The track shows only two points.",
          "Targets are soft or disputed. Drawing a target line makes it look official.",
        ]}
      />
    </PatternSection>
  );
}

function DriversSection() {
  const [period, setPeriod] = useState<Period>("30d");
  const metrics = useMemo(() => driverMetrics(period), [period]);
  const label = PERIOD_LABEL[period];

  return (
    <PatternSection
      id="drivers"
      index={3}
      title="Driver Stats"
      question="What moved it?"
      description="Pick a stat to see what moved it. The change is split by desk, team or source, sorted by size, and the rows add up to the headline delta, so the explanation always reconciles."
    >
      <div className="border border-neutral-200 bg-white">
        <CardHeader
          label={`Firm-wide · today vs ${label} daily avg`}
          period={period}
          onPeriodChange={setPeriod}
        />
        <DriverStats metrics={metrics} periodLabel={label} />
      </div>
      <PatternNotes
        useWhen={[
          "A delta will prompt someone to ask who or what caused it. Answer that on the same screen.",
          "The metric is a count that adds up: trades, exceptions, files, breaks.",
          "Changes can cancel out, for example Custody up while Middle Office is down. The diverging bars show both.",
        ]}
        avoidWhen={[
          "The metric is a rate, median or percentile. These don't split into parts that add up, so show the rate for each segment side by side instead.",
          "There are more than about 8 drivers. Group the tail into Other or switch to a sortable table.",
          "The question is about history rather than cause. Use Sparkline Stats.",
        ]}
      />
    </PatternSection>
  );
}
