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

      <div className="flex flex-1 overflow-hidden">
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
            pipelines={pipelines}
            l0State={state}
            sortMode={sortMode}
            onSortChange={setSortMode}
            onMonitorClick={focusMonitor}
            onPipelineClick={openPipelineDrawer}
          />

          {/* Spec — Stage Trend Strip replaces the Qlik-style bar charts.
              Answers "is today unusual?" — per-stage sparkline + anomaly. */}
          <StageTrendStrip fixtureKey={fixtureKey} />

          <PipelineView
            pipelines={pipelines}
            onMonitorClick={focusMonitor}
            onPipelineClick={openPipelineDrawer}
          />

            <Footnotes fixtureKey={fixtureKey} />
          </div>
        </div>

        {/* Spec v0.1.1 §3 — right rail is two stacked surfaces, not alternates.
            MonitorList is always rendered (preserves queue position underneath).
            PipelineDrawer slides in as an overlay over the monitor panel when
            a mandate is selected. */}
        <aside
          ref={monitorListRef}
          className="relative w-[440px] shrink-0 border-l border-neutral-200 bg-white"
        >
          {/* Spec v0.1.1 §8 — clean state replaces the monitor list with
              a streak + next-event + audit panel. */}
          {state === "clean" ? (
            <CleanDayPanel monitors={monitors} now={now} />
          ) : (
            <MonitorList
              monitors={scoped}
              actions={actions}
              now={now}
              pulseMonitorId={pulseMonitorId}
            />
          )}
          {drawerDetail && (
            <>
              {/* Subtle backdrop — dims the monitors slightly, signals
                  "this is now the focus, monitors are paused". */}
              <button
                type="button"
                aria-label="Close pipeline detail"
                onClick={closePipelineDrawer}
                className="absolute inset-0 z-30 bg-neutral-900/15 backdrop-blur-[1px] cursor-default"
              />
              {/* Sheet — same 440px slot, slid in. Monitor queue underneath
                  is intact (Esc / backdrop / X all return to it). */}
              <div className="absolute inset-0 z-40 bg-white shadow-xl border-l border-neutral-200">
                <PipelineDrawer
                  detail={drawerDetail}
                  onClose={closePipelineDrawer}
                />
              </div>
            </>
          )}
        </aside>
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
