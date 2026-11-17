import { useCallback, useMemo, useState } from "react";
import type { GridState } from "ag-grid-community";
import { Overview } from "../components/data-processing-hub/Overview";
import { RecordDetails } from "../components/data-processing-hub/RecordDetails";
import { RecordsGrid } from "../components/data-processing-hub/RecordsGrid";
import { ReplayDialog } from "../components/data-processing-hub/ReplayDialog";
import { ReplayProvider } from "../components/data-processing-hub/ReplayProvider";
import {
  BUSINESS_DATES,
  SOURCES,
  SOURCE_IDS,
  loadById,
  loadView,
  loadsFor,
  num,
  recordsFor,
  type HubRecord,
  type SourceId,
} from "../components/data-processing-hub/model";
import { useReplay } from "../components/data-processing-hub/replay-context";
import { EmptyState, PageHeader, SegmentedControl, Tabs, ToastProvider, tokens } from "../components/patterns";

export const title = "Data Processing Hub";
export const section = "operations";
export const fullWidth = true;

const { button, cx, surface, text } = tokens;

/* Data Processing Hub — "How did today's data loads go, what failed, why,
 * and can I replay it?"
 *
 * A support console over three sources: FMR files, and MDM and MRD loads.
 * Everything is scoped to one business date. Four views:
 *   Overview        each source's loads, status and counts; failed counts
 *                   link into Records filtered to Failed
 *   Records         every record of one source, on AG Grid
 *   Record Details  one record explained in business terms
 *   Replay          confirm and track a replay of a whole file or load
 *
 * The page owns where the user is (date, view, source, each grid's state),
 * so moving between views never loses it. Mock data and replay state live in
 * components/data-processing-hub; nothing here calls a backend. */

type View = { name: "overview" } | { name: "records" } | { name: "record"; recordId: string; loadId: string };

/** What the Records view remembers per source while the user is elsewhere. */
type GridMemory = { grid: GridState | undefined; search: string };

const EMPTY_MEMORY: Record<SourceId, GridMemory> = {
  FMR: { grid: undefined, search: "" },
  MDM: { grid: undefined, search: "" },
  MRD: { grid: undefined, search: "" },
};

function Hub() {
  const { runs, reset } = useReplay();
  const [date, setDate] = useState(BUSINESS_DATES[0].iso);
  const [view, setView] = useState<View>({ name: "overview" });
  const [source, setSource] = useState<SourceId>("FMR");
  const [memory, setMemory] = useState(EMPTY_MEMORY);
  const [replayLoadId, setReplayLoadId] = useState<string | null>(null);
  // Bumped by "Reset demo" so the grid remounts with a clean state.
  const [epoch, setEpoch] = useState(0);

  const rows = useMemo(() => recordsFor(date, source, runs), [date, source, runs]);

  const failedBySource = useMemo(
    () => Object.fromEntries(SOURCE_IDS.map((s) => [s, loadsFor(date, s).reduce((n, l) => n + loadView(l, runs).failed, 0)])) as Record<SourceId, number>,
    [date, runs],
  );

  const saveGridState = useCallback((s: SourceId, grid: GridState) => setMemory((m) => ({ ...m, [s]: { ...m[s], grid } })), []);
  const setSearch = useCallback((s: SourceId, search: string) => setMemory((m) => ({ ...m, [s]: { ...m[s], search } })), []);
  const openRecord = useCallback((r: HubRecord) => setView({ name: "record", recordId: r.id, loadId: r.loadId }), []);
  const closeReplay = useCallback(() => setReplayLoadId(null), []);

  // A failed count on the Overview: open Records for that source with the
  // Failed filter (and the load, when the count is one load's) already on.
  // Columns and page size stay as the user left them.
  const openFailed = (s: SourceId, loadId?: string) => {
    setMemory((m) => ({
      ...m,
      [s]: {
        search: "",
        grid: {
          ...m[s].grid,
          filter: {
            filterModel: {
              status: { filterType: "set", values: ["Failed"] },
              ...(loadId ? { loadId: { filterType: "set", values: [loadId] } } : {}),
            },
          },
          pagination: { pageSize: m[s].grid?.pagination?.pageSize ?? 50, page: 0 },
        },
      },
    }));
    setSource(s);
    setView({ name: "records" });
  };

  const openRecords = (s: SourceId) => {
    setSource(s);
    setView({ name: "records" });
  };

  const changeDate = (iso: string) => {
    setDate(iso);
    // A record belongs to one date, so leave it when the date changes.
    if (view.name === "record") setView({ name: "records" });
  };

  const resetDemo = () => {
    reset();
    setMemory(EMPTY_MEMORY);
    setReplayLoadId(null);
    setView({ name: "overview" });
    setEpoch((n) => n + 1);
  };

  const record = view.name === "record" ? rows.find((r) => r.id === view.recordId) : undefined;

  return (
    <div className={cx("flex h-full flex-col", surface.page)}>
      {/* pl-36 clears the app's fixed Home pill */}
      <PageHeader
        className="shrink-0 pl-36"
        eyebrow="Operations · Support"
        title="Data Processing Hub"
        description="How each day's FMR, MDM and MRD loads went, which records failed and why, and replay for a failed file or load."
        actions={
          <>
            <div className="flex flex-col gap-1">
              <span className={text.eyebrow}>Business date</span>
              <SegmentedControl label="Business date" value={date} onChange={changeDate} options={BUSINESS_DATES.map((d) => ({ value: d.iso, label: d.short }))} />
            </div>
            <button type="button" onClick={resetDemo} className={cx(button.ghost, "self-end")} title="Clear this session's replays and saved grid views">
              Reset demo
            </button>
          </>
        }
      >
        <Tabs
          label="View"
          value={view.name === "overview" ? "overview" : "records"}
          onChange={(v) => setView(v === "overview" ? { name: "overview" } : { name: "records" })}
          tabs={[
            { value: "overview", label: "Overview" },
            { value: "records", label: "Records" },
          ]}
        />
      </PageHeader>

      {view.name === "overview" && (
        <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-5">
          <Overview date={date} onOpenFailed={openFailed} onOpenRecords={openRecords} onReplay={setReplayLoadId} />
        </main>
      )}

      {view.name === "records" && (
        <main className="flex min-h-0 flex-1 flex-col gap-3 p-4 lg:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              label="Source"
              value={source}
              onChange={setSource}
              options={SOURCE_IDS.map((s) => ({ value: s, label: failedBySource[s] > 0 ? `${SOURCES[s].label} (${num(failedBySource[s])} failed)` : SOURCES[s].label }))}
            />
            <span className={text.muted}>Select a row to see what happened to that record. Use the Columns tab on the right edge of the grid to show, hide or reorder columns.</span>
          </div>
          <RecordsGrid
            key={`${source}-${epoch}`}
            source={source}
            rows={rows}
            initialState={memory[source].grid}
            search={memory[source].search}
            onSearch={setSearch}
            onSaveState={saveGridState}
            onOpen={openRecord}
          />
        </main>
      )}

      {view.name === "record" && (
        <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-5">
          {record ? (
            <RecordDetails record={record} load={loadById(view.loadId)} onBack={() => setView({ name: "records" })} onReplay={setReplayLoadId} />
          ) : (
            <EmptyState kind="filtered" title="Record not found" description="It does not belong to the selected business date." action={{ label: "Back to records", onClick: () => setView({ name: "records" }) }} />
          )}
        </main>
      )}

      <ReplayDialog loadId={replayLoadId} onClose={closeReplay} />
    </div>
  );
}

export default function DataProcessingHubPage() {
  return (
    <ToastProvider>
      <ReplayProvider>
        <Hub />
      </ReplayProvider>
    </ToastProvider>
  );
}
