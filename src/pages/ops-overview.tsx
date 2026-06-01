import { useEffect, useMemo, useRef, useState } from "react";
import {
  deriveOperationalState,
  deriveSummary,
  fetchPipelineDetail,
  fetchPipelineStates,
  type OperationalState,
  type PipelineDetail,
  type PipelineState,
  type QlikMonitor,
  ME,
  effectiveState,
  useMonitorActions,
} from "../lib/qlik";
import {
  readUrlSort,
  writeUrlSort,
  type GridSortMode,
} from "../lib/grid-sort";
import {
  readUrlView,
  savedViewsRepo,
  writeUrlView,
} from "../lib/saved-views";
import { useSavedViews } from "../hooks/useSavedViews";
import SavedViewTabs from "../components/ops-overview/SavedViewTabs";
import { useFileForensic } from "../hooks/useFileForensic";
import FileForensicSheet from "../components/forensic/FileForensicSheet";
import PageHeader from "../components/ops-overview/PageHeader";
import LensBar, {
  LENS_LABEL,
  type Lens,
} from "../components/ops-overview/LensBar";
import ManagementStrip, {
  MANAGEMENT_METRICS,
  type Period,
} from "../components/ops-overview/ManagementStrip";
import OperationalStateBanner from "../components/ops-overview/OperationalStateBanner";
import SystemHealthStrip from "../components/ops-overview/SystemHealthStrip";
import MonitorList from "../components/ops-overview/MonitorList";
import PipelineView from "../components/ops-overview/PipelineView";
import MandateGrid from "../components/ops-overview/MandateGrid";
import PipelineDrawer from "../components/ops-overview/PipelineDrawer";
import CleanDayPanel from "../components/ops-overview/CleanDayPanel";
import HolidayHeaderStrip from "../components/ops-overview/HolidayHeaderStrip";
import StageTrendStrip from "../components/ops-overview/StageTrendStrip";
import ExceptionHeatmap from "../components/ops-overview/ExceptionHeatmap";

export const title = "Ops Overview";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * Ops Overview — v0.1 spec, Qlik-backed
 *
 * This page is now a thin composer. Data layer lives in src/lib/qlik.ts;
 * sub-surfaces live in src/components/ops-overview/.
 * ------------------------------------------------------------------ */

import { fetchMonitors } from "../lib/qlik";

function readUrlState(): OperationalState | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("state");
  if (
    raw === "clean" ||
    raw === "watch" ||
    raw === "at-risk" ||
    raw === "broken"
  )
    return raw;
  return null;
}

function readUrlPeriod(): Period | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("period");
  if (raw === "30d" || raw === "90d" || raw === "ytd") return raw;
  return null;
}

function writeUrlParams(state: OperationalState, period: Period) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("state", state);
  url.searchParams.set("period", period);
  window.history.replaceState({}, "", url.toString());
}

function applyLens(
  monitors: QlikMonitor[],
  lens: Lens,
  actions: ReturnType<typeof useMonitorActions>,
): QlikMonitor[] {
  switch (lens) {
    case "needs_attention":
      // Spec v0.1.1 §6.1 — (status: red OR amber) AND (owner: me OR unowned)
      return monitors.filter((m) => {
        if (m.status !== "red" && m.status !== "amber") return false;
        const e = effectiveState(m, actions);
        if (e.kind === "unacked") return true; // unowned
        if (e.kind === "acked" && e.actor === ME) return true; // mine
        return false;
      });
    case "all":
      return monitors;
    case "red":
      return monitors.filter((m) => m.status === "red");
    case "amber":
      return monitors.filter(
        (m) => m.status === "red" || m.status === "amber",
      );
    case "unacked":
      return monitors.filter((m) => {
        if (m.status !== "red" && m.status !== "amber") return false;
        return effectiveState(m, actions).kind === "unacked";
      });
    case "mine":
      return monitors.filter((m) => {
        const e = effectiveState(m, actions);
        return e.kind === "acked" && e.actor === ME;
      });
    case "process":
    case "data":
    case "rule":
    case "system":
      return monitors.filter((m) => m.category === lens);
  }
}

/* Pipeline-side equivalent of applyLens. Translates the same conceptual
 * filter to mandate rows so MandateGrid and PipelineView track the lens
 * the same way MonitorList does.
 *
 * Bug fix: lens only filtered monitors; pipelines were unscoped. Adding
 * the parallel filter so chips visibly affect the heatmap + chevron rows. */
function applyLensToPipelines(
  pipelines: PipelineState[],
  lens: Lens,
  monitors: QlikMonitor[],
  actions: ReturnType<typeof useMonitorActions>,
): PipelineState[] {
  if (lens === "all") return pipelines;

  // Pipelines have stages with statuses + monitorIds. We reuse the monitor
  // filter logic on the referenced monitors to keep semantics consistent.
  const monitorById = new Map(monitors.map((m) => [m.id, m]));

  const stageHasBreach = (s: PipelineState["stages"][number]) =>
    s.status === "past_typical" ||
    s.status === "past_required" ||
    s.status === "past_benchmark" ||
    s.status === "failed";

  const stageHasRed = (s: PipelineState["stages"][number]) =>
    s.status === "past_benchmark" || s.status === "failed";

  const pipelineMonitors = (p: PipelineState): QlikMonitor[] => {
    const ids = new Set<string>();
    for (const s of p.stages) for (const id of s.monitorIds) ids.add(id);
    return Array.from(ids)
      .map((id) => monitorById.get(id))
      .filter((m): m is QlikMonitor => !!m);
  };

  const anyUnacked = (p: PipelineState) =>
    pipelineMonitors(p).some(
      (m) =>
        (m.status === "red" || m.status === "amber") &&
        effectiveState(m, actions).kind === "unacked",
    );

  switch (lens) {
    case "needs_attention":
      // (any breach tier on a stage) AND (mine OR has at least one unacked monitor)
      return pipelines.filter(
        (p) =>
          !p.isHolidayToday &&
          p.stages.some(stageHasBreach) &&
          (p.isMine || anyUnacked(p)),
      );
    case "red":
      return pipelines.filter((p) => p.stages.some(stageHasRed));
    case "amber":
      return pipelines.filter((p) => p.stages.some(stageHasBreach));
    case "unacked":
      return pipelines.filter(
        (p) => p.stages.some(stageHasBreach) && anyUnacked(p),
      );
    case "mine":
      return pipelines.filter((p) => p.isMine);
    case "process":
    case "data":
    case "rule":
    case "system":
      return pipelines.filter((p) =>
        pipelineMonitors(p).some((m) => m.category === lens),
      );
  }
}

export default function OpsOverview() {
  const [fixtureKey, setFixtureKey] = useState<OperationalState>(
    () => readUrlState() ?? "at-risk",
  );
  const [period, setPeriod] = useState<Period>(
    () => readUrlPeriod() ?? "30d",
  );
  const [now, setNow] = useState(() => Date.now());
  const views = useSavedViews();
  // Spec v0.1.2 §3.4 — landing view is URL param, else user's default, else
  // the system "Needs my attention" view.
  const initialView = useMemo(() => {
    const urlId = readUrlView();
    if (urlId) {
      const match = views.find((v) => v.id === urlId);
      if (match) return match;
    }
    return (
      views.find((v) => v.isDefault) ??
      views.find((v) => v.id === "sys-needs-attention") ??
      views[0]
    );
    // intentionally compute once on mount — view list mutations don't
    // re-land the user on a different view mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [activeViewId, setActiveViewId] = useState<string | null>(
    initialView?.id ?? null,
  );
  const [lens, setLens] = useState<Lens>(
    initialView?.lens ?? "needs_attention",
  );
  const [monitors, setMonitors] = useState<QlikMonitor[]>([]);
  const [pipelines, setPipelines] = useState<PipelineState[]>([]);
  const [sortMode, setSortMode] = useState<GridSortMode>(
    () => readUrlSort() ?? "smart",
  );
  const [pulseMonitorId, setPulseMonitorId] = useState<string | null>(null);
  const [drawerPipelineId, setDrawerPipelineId] = useState<string | null>(null);
  const [drawerDetail, setDrawerDetail] = useState<PipelineDetail | null>(null);
  const monitorListRef = useRef<HTMLDivElement | null>(null);

  const actions = useMonitorActions();
  const forensic = useFileForensic();

  // Real-time tick for stale-data calculation and refresh-age display.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Spec §1.1 — poll Qlik. Mock client returns immediately; the 60s
  // cadence in production is enforced here. For prototype we just load
  // on fixture change.
  useEffect(() => {
    let cancelled = false;
    fetchMonitors(fixtureKey).then((m) => {
      if (!cancelled) setMonitors(m);
    });
    fetchPipelineStates(fixtureKey).then((p) => {
      if (!cancelled) setPipelines(p);
    });
    return () => {
      cancelled = true;
    };
  }, [fixtureKey]);

  // Fetch pipeline detail whenever drawer target changes
  useEffect(() => {
    let cancelled = false;
    if (drawerPipelineId == null) {
      setDrawerDetail(null);
      return;
    }
    fetchPipelineDetail(fixtureKey, drawerPipelineId).then((d) => {
      if (!cancelled) setDrawerDetail(d);
    });
    return () => {
      cancelled = true;
    };
  }, [drawerPipelineId, fixtureKey]);

  function openPipelineDrawer(pipelineId: string) {
    setDrawerPipelineId(pipelineId);
  }

  function closePipelineDrawer() {
    setDrawerPipelineId(null);
  }

  function focusMonitor(monitorId: string) {
    // Make sure the monitor list is what's showing in the sidebar before we
    // try to scroll to a row inside it.
    setDrawerPipelineId(null);
    setPulseMonitorId(monitorId);
    const tryScroll = (attempts = 0) => {
      const el = document.querySelector<HTMLElement>(
        `[data-monitor-id="${monitorId}"]`,
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      // Maybe the row is inside the collapsed-quiet bucket — try expanding it.
      if (attempts === 0) {
        const showBtn = Array.from(
          document.querySelectorAll<HTMLButtonElement>("button"),
        ).find((b) => b.textContent?.includes("monitors clean"));
        showBtn?.click();
        setTimeout(() => tryScroll(1), 50);
      }
    };
    setTimeout(() => tryScroll(0), 60);
    setTimeout(() => setPulseMonitorId(null), 2000);
  }

  useEffect(() => {
    writeUrlParams(fixtureKey, period);
  }, [fixtureKey, period]);

  useEffect(() => {
    writeUrlSort(sortMode);
  }, [sortMode]);

  useEffect(() => {
    writeUrlView(activeViewId);
  }, [activeViewId]);

  function handleSelectView(view: { id: string; lens: Lens }) {
    setActiveViewId(view.id);
    setLens(view.lens);
    savedViewsRepo.touch(view.id);
  }

  function handleLensChange(next: Lens) {
    setLens(next);
    // Manual lens change detaches from the current view (it's no longer
    // an exact match). The "+ New view" affordance captures the new state.
    setActiveViewId(null);
  }

  const summary = useMemo(() => deriveSummary(monitors), [monitors]);
  // Spec v0.1.2 §1.5 — L0 derives from pipeline stage tiers (primary signal),
  // with monitors folded in as a fallback for non-pipeline alerts.
  const state = useMemo(
    () => deriveOperationalState(pipelines, monitors),
    [pipelines, monitors],
  );
  const scoped = useMemo(
    () => applyLens(monitors, lens, actions),
    [monitors, lens, actions],
  );
  const scopedPipelines = useMemo(
    () => applyLensToPipelines(pipelines, lens, monitors, actions),
    [pipelines, lens, monitors, actions],
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50 text-neutral-900">
      <PageHeader
        now={now}
        fixtureKey={fixtureKey}
        onFixtureChange={setFixtureKey}
      />

      {/* Spec v0.1.1 §9 — holiday context surfaced at app level, not buried
          per-mandate. */}
      <HolidayHeaderStrip />

      <div
        className="flex flex-1 overflow-hidden"
        onClickCapture={(e) => {
          // Spec v0.1.2 L4 §3.2 hard rule 27 — interacting with the overview
          // behind the sheet auto-closes it. The L3 panel (right aside) marks
          // its clicks as data-l3="true" so they're excluded.
          if (!forensic.scope) return;
          const target = e.target as HTMLElement;
          if (target.closest('[data-l3-panel="true"]')) return;
          if (target.closest('[data-forensic-sheet="true"]')) return;
          forensic.close();
        }}
      >
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1280px] px-8 py-6">
          {/* Spec v0.1.2 §4 — compact system-health strip replaces the
              v0.1.1 three-tile Qlik header (which duplicated the L0 banner)
              AND the standalone StaleBanner (one piece of UI per signal). */}
          <SystemHealthStrip summary={summary} now={now} />

          <ManagementStrip
            metrics={MANAGEMENT_METRICS[period]}
            period={period}
            onPeriodChange={setPeriod}
          />

          <SavedViewTabs
            views={views}
            activeId={activeViewId}
            currentLens={lens}
            onSelect={handleSelectView}
          />

          <LensBar
            value={lens}
            onChange={handleLensChange}
            scopedCount={scoped.length}
            totalCount={monitors.length}
          />

          <OperationalStateBanner
            state={state}
            summary={summary}
            lensLabel={lens !== "all" ? LENS_LABEL[lens] : undefined}
          />

          {/* Three tiers of zoom, top to bottom:
              MandateGrid → StageTrendStrip (today vs recent baseline)
                          → PipelineView (chevron rows) → MonitorList (sidebar)
              Plus PipelineDrawer (tier 4) — opened from any pipeline-named surface. */}
          <MandateGrid
            pipelines={scopedPipelines}
            l0State={state}
            sortMode={sortMode}
            onSortChange={setSortMode}
            onMonitorClick={focusMonitor}
            onPipelineClick={openPipelineDrawer}
            onOpenForensic={forensic.open}
          />

          {/* Spec — Stage Trend Strip replaces the Qlik-style bar charts.
              Answers "is today unusual?" — per-stage sparkline + anomaly. */}
          <StageTrendStrip fixtureKey={fixtureKey} />

          <PipelineView
            pipelines={scopedPipelines}
            onMonitorClick={focusMonitor}
            onPipelineClick={openPipelineDrawer}
            onOpenForensic={forensic.open}
          />

          {/* Exception heat map — exception type × pipeline stage. Cells
              encode severity of non-clean mandates; the SLA-breach mode
              drops hue for a light/dark + icon-only encoding. */}
          <ExceptionHeatmap />

            <Footnotes fixtureKey={fixtureKey} />
          </div>
        </div>

        {/* Spec v0.1.1 §3 — right rail is two stacked surfaces, not alternates.
            MonitorList is always rendered (preserves queue position underneath).
            PipelineDrawer slides in as an overlay over the monitor panel when
            a mandate is selected. */}
        <aside
          ref={monitorListRef}
          data-l3-panel="true"
          className="relative w-[440px] shrink-0 border-l border-neutral-200 bg-white"
        >
          {/* Spec v0.1.1 §3 — the right rail is one surface that drills down
              in place: the monitor queue, or the selected mandate detail. No
              stacked overlay — selecting a mandate swaps the panel content,
              and the drawer's own close (X) returns to the queue. */}
          {drawerDetail ? (
            <PipelineDrawer
              detail={drawerDetail}
              onClose={closePipelineDrawer}
              onOpenForensic={forensic.open}
            />
          ) : state === "clean" ? (
            <CleanDayPanel monitors={monitors} now={now} />
          ) : (
            <MonitorList
              monitors={scoped}
              actions={actions}
              now={now}
              pulseMonitorId={pulseMonitorId}
            />
          )}
        </aside>
      </div>

      {/* Spec v0.1.2 L4 — bottom sheet, mounted page-level so it overlays
          both the main content area and the L3 panel. */}
      <div data-forensic-sheet="true">
        <FileForensicSheet forensic={forensic} />
      </div>
    </div>
  );
}

function Footnotes({ fixtureKey }: { fixtureKey: OperationalState }) {
  return (
    <div className="mt-10 border-t border-neutral-200 pt-4 text-[11px] text-neutral-400">
      <p>
        v0.1 Qlik-backed · fixture <code className="font-mono">{fixtureKey}</code> ·
        Qlik feed and action store are mocked behind their spec contracts. URL
        params: <code className="font-mono">?state=clean|at-risk|broken</code>,{" "}
        <code className="font-mono">?period=30d|90d|ytd</code>. Identity stub:{" "}
        <code className="font-mono">Mark D</code> (TODO_VALIDATE — spec §6).
        Acknowledge optimistic; resolve awaits persistence (spec §4.4).
        Actions bind to <code className="font-mono">qlikRefreshTimestamp</code>{" "}
        and invalidate on monitor refresh (spec §1.2).
      </p>
    </div>
  );
}
