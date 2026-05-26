import { useMemo, useState, type ReactNode } from "react";
import {
  PIPELINE_STAGE_ORDER,
  type PipelineStageName,
  type PipelineState,
} from "../../lib/qlik";
import PipelineRow from "./PipelineRow";

/* Pipeline visualisation — supplementary surface above MonitorList.
 *
 * Filters (multi-dimensional, all combine with AND):
 *   - Scope:  at-risk / mine / all
 *   - Region: Lux / London / NY / Singapore (or all)
 *   - Stage:  Rebalance / Estimates / Actuals / Reporting (or all)
 *
 * Filter pills carry status colour: a region pill shows an amber tick
 * when that region has past-benchmark pipelines — operator sees the
 * problem dimension before clicking. Same for stage. */

type Scope = "at_risk" | "mine" | "all";
type RegionFilter = "all" | PipelineState["region"];
type StageFilter = "all" | PipelineStageName;

const REGIONS: PipelineState["region"][] = ["Lux", "London", "NY", "Singapore"];

export default function PipelineView({
  pipelines,
  onMonitorClick,
  onPipelineClick,
}: {
  pipelines: PipelineState[];
  onMonitorClick?: (monitorId: string) => void;
  onPipelineClick?: (pipelineId: string) => void;
}) {
  const [scope, setScope] = useState<Scope>("at_risk");
  const [region, setRegion] = useState<RegionFilter>("all");
  const [stage, setStage] = useState<StageFilter>("all");
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");

  // Per-dimension issue counts so filter pills can colour themselves.
  const regionIssueCount = useMemo(() => {
    const map: Record<PipelineState["region"], number> = {
      Lux: 0,
      London: 0,
      NY: 0,
      Singapore: 0,
    };
    for (const p of pipelines) {
      if (p.isHolidayToday) continue;
      const bad = p.stages.some(
        (s) =>
          s.status === "past_typical" ||
          s.status === "past_required" ||
          s.status === "past_benchmark" ||
          s.status === "failed",
      );
      if (bad) map[p.region] += 1;
    }
    return map;
  }, [pipelines]);

  const stageIssueCount = useMemo(() => {
    const map: Record<PipelineStageName, number> = {
      Rebalance: 0,
      Estimates: 0,
      Actuals: 0,
      Reporting: 0,
    };
    for (const p of pipelines) {
      if (p.isHolidayToday) continue;
      for (const s of p.stages) {
        if (
          s.status === "past_typical" ||
          s.status === "past_required" ||
          s.status === "past_benchmark" ||
          s.status === "failed"
        ) {
          map[s.name] += 1;
        }
      }
    }
    return map;
  }, [pipelines]);

  const filtered = useMemo(() => {
    let rows = pipelines;
    if (scope === "at_risk") {
      rows = rows.filter(
        (p) =>
          p.worstStatus === "at_risk" ||
          p.worstStatus === "broken" ||
          p.worstStatus === "watch",
      );
    } else if (scope === "mine") {
      rows = rows.filter((p) => p.isMine);
    }
    if (region !== "all") {
      rows = rows.filter((p) => p.region === region);
    }
    if (stage !== "all") {
      rows = rows.filter((p) =>
        p.stages.some(
          (s) =>
            s.name === stage &&
            (s.status === "past_typical" ||
              s.status === "past_required" ||
              s.status === "past_benchmark" ||
              s.status === "failed" ||
              s.status === "in_progress"),
        ),
      );
    }

    const severity: Record<PipelineState["worstStatus"], number> = {
      broken: 0,
      at_risk: 1,
      watch: 2,
      working: 3,
      clean: 4,
      holiday: 5,
    };
    return [...rows].sort((a, b) => {
      const sa = severity[a.worstStatus];
      const sb = severity[b.worstStatus];
      if (sa !== sb) return sa - sb;
      return b.worstAgeMin - a.worstAgeMin;
    });
  }, [pipelines, scope, region, stage]);

  const activeFilterCount =
    (scope !== "at_risk" ? 0 : 0) + // scope is always selected, doesn't count
    (region !== "all" ? 1 : 0) +
    (stage !== "all" ? 1 : 0);

  return (
    <section aria-label="Pipeline" className="mt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
          Pipeline
        </h2>
      </div>

      <div className="mb-3 flex flex-col gap-2.5 rounded-lg border border-neutral-200 bg-white px-4 py-3">
        {/* Row 1: Scope (left) — Density + count (right) */}
        <div className="flex flex-wrap items-center gap-3">
          <FilterGroup label="Scope">
            <ScopePill active={scope === "at_risk"} onClick={() => setScope("at_risk")} tone="amber">
              At-risk
            </ScopePill>
            <ScopePill active={scope === "mine"} onClick={() => setScope("mine")} tone="blue">
              My clients
            </ScopePill>
            <ScopePill active={scope === "all"} onClick={() => setScope("all")} tone="neutral">
              All
            </ScopePill>
          </FilterGroup>

          <div className="ml-auto flex items-center gap-3 text-xs text-neutral-500">
            <span>
              {filtered.length} of {pipelines.length}
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setRegion("all");
                    setStage("all");
                  }}
                  className="ml-2 text-blue-700 hover:underline"
                >
                  clear filters
                </button>
              )}
            </span>
            <div className="flex items-center gap-1 rounded-full border border-neutral-300 p-0.5">
              {(["compact", "comfortable"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDensity(d)}
                  className={`rounded-full px-2.5 py-0.5 capitalize transition ${
                    density === d
                      ? "bg-neutral-800 text-white"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Region filter — colour-aware */}
        <FilterGroup label="Region">
          <DimensionPill
            active={region === "all"}
            onClick={() => setRegion("all")}
            count={Object.values(regionIssueCount).reduce((a, b) => a + b, 0)}
          >
            All
          </DimensionPill>
          {REGIONS.map((r) => (
            <DimensionPill
              key={r}
              active={region === r}
              onClick={() => setRegion(r)}
              count={regionIssueCount[r]}
            >
              {r}
            </DimensionPill>
          ))}
        </FilterGroup>

        {/* Row 3: Stage filter — colour-aware */}
        <FilterGroup label="Stage">
          <DimensionPill
            active={stage === "all"}
            onClick={() => setStage("all")}
            count={Object.values(stageIssueCount).reduce((a, b) => a + b, 0)}
          >
            All
          </DimensionPill>
          {PIPELINE_STAGE_ORDER.map((s) => (
            <DimensionPill
              key={s}
              active={stage === s}
              onClick={() => setStage(s)}
              count={stageIssueCount[s]}
            >
              {s}
            </DimensionPill>
          ))}
        </FilterGroup>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-500">
          No pipelines match this filter combination.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((p) => (
            <PipelineRow
              key={p.id}
              pipeline={p}
              density={density}
              onMonitorClick={onMonitorClick}
              onPipelineClick={onPipelineClick}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ---- Filter primitives — colour is the message ---- */

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-12 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

function ScopePill({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone: "amber" | "blue" | "neutral";
  children: ReactNode;
}) {
  // Scope pill keeps its tone always visible (active or inactive) — the user
  // should know "At-risk" is the red-zone pill before they look at the label.
  const activeCls = {
    amber: "border-amber-400 bg-amber-100 text-amber-900",
    blue: "border-blue-500 bg-blue-100 text-blue-900",
    neutral: "border-neutral-700 bg-neutral-900 text-white",
  }[tone];
  const inactiveCls = {
    amber: "border-amber-200 bg-white text-amber-700 hover:bg-amber-50",
    blue: "border-blue-200 bg-white text-blue-700 hover:bg-blue-50",
    neutral: "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active ? activeCls : inactiveCls
      }`}
    >
      {children}
    </button>
  );
}

function DimensionPill({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: ReactNode;
}) {
  // Dimension pill shows a status dot if THIS dimension has past-benchmark
  // pipelines. Operator sees "Lux has problems" before clicking.
  const hasIssue = count > 0;
  const cls = active
    ? hasIssue
      ? "border-amber-500 bg-amber-100 text-amber-900"
      : "border-neutral-700 bg-neutral-900 text-white"
    : hasIssue
      ? "border-amber-300 bg-white text-neutral-700 hover:bg-amber-50/40"
      : "border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-50";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${cls}`}
    >
      {hasIssue && (
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
      )}
      <span>{children}</span>
      <span
        className={`font-mono text-[10px] tabular-nums ${
          hasIssue
            ? active
              ? "text-amber-900"
              : "text-amber-700"
            : active
              ? "text-white/70"
              : "text-neutral-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
