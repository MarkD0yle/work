import { useEffect, useMemo, useRef, useState } from "react";
import { Banner, ChipToggle, FilterBar, FilterSelect, PageHeader, SegmentedControl, Tabs, tokens, type Option } from "../components/patterns";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { HistoryPanel } from "../components/reports-inbox/HistoryPanel";
import { ActionBar, type RunRequest } from "../components/reports-inbox/ActionBar";
import { ThreadList, type Selection } from "../components/reports-inbox/ThreadList";
import {
  ME,
  THREADS,
  needsAttention,
  nowIso,
  periodLabel,
  shortWhen,
  type Frequency,
  type Kind,
  type Run,
  type RunStatus,
  type Thread,
} from "../components/reports-inbox/model";

export const title = "BestX · Reports Inbox";
export const section = "dashboards";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * BestX — Reports inbox
 *
 * Every report BestX produces, in one mail-style inbox:
 *   - Scheduled & analytics: recurring reports with recipients and a
 *     frequency. Feed the Trend, Cost, Benchmark and RFQ views.
 *   - Exceptions: condition-driven checks that flag trades to investigate.
 *   - Post-trade: TCA on an uploaded trade file.
 *   - Regulatory: best execution and disclosure packs with distribution.
 *
 * One definition = one thread. Each run is a message in it, newest on
 * top. The list is full width. Click a report and the action bar above
 * the list fills in and stays put while you scroll: run now, run for a
 * date or range, download, review. The report opens in place to show its
 * set-up and every run, each of which can be re-run for its own date.
 *
 * Two layouts to compare, switched in the header (remembered per browser):
 *   A · In the list   — a report opens in place, history under its row.
 *   B · Side panel    — the list stays one line per report; the picked
 *                       report's set-up and history dock on the right.
 * Both keep the same action bar above the list.
 *
 * Processing (ingestion, CSV parsing, recalcs) is a separate tab, not a
 * report type. People don't read it; reports depend on it. So it gets its
 * own view, and when a job fails the banner says which reports it holds
 * up, with a retry that releases them.
 * ------------------------------------------------------------------ */

type Layout = "inline" | "panel";

type TabId = "all" | Exclude<Kind, "processing"> | "processing";

const REPORT_TABS: { value: TabId; label: string }[] = [
  { value: "all", label: "All reports" },
  { value: "analytics", label: "Scheduled & analytics" },
  { value: "exception", label: "Exceptions" },
  { value: "posttrade", label: "Post-trade" },
  { value: "regulatory", label: "Regulatory" },
];

const STATUS_OPTIONS: { value: RunStatus; label: string }[] = [
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "running", label: "Running" },
  { value: "waiting", label: "Waiting on input" },
];

const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "Daily", label: "Daily" },
  { value: "Weekly", label: "Weekly" },
  { value: "Monthly", label: "Monthly" },
  { value: "Quarterly", label: "Quarterly" },
  { value: "On upload", label: "On upload" },
];

const inTab = (t: Thread, tab: TabId) =>
  tab === "processing" ? t.kind === "processing" : t.kind !== "processing" && (tab === "all" || t.kind === tab);

/** What a finished run says, based on the last good run of the same report. */
function finishedRun(t: Thread, run: Run): Run {
  const prev = t.runs.find((r) => r.status === "succeeded" && r.id !== run.id);
  const base = { ...run, duration: prev?.duration ?? "1m 00s" };
  switch (t.kind) {
    case "exception": {
      const n = prev?.exceptions ?? 0;
      return {
        ...base,
        status: "succeeded",
        exceptions: n,
        unreviewed: n,
        summary: n === 0 ? "No exceptions found." : `${n} exceptions found. ${n} not yet reviewed.`,
      };
    }
    case "regulatory":
      return { ...base, status: "succeeded", distributed: false, summary: "Draft ready. Needs sign-off before distribution." };
    case "posttrade":
      // A failed upload fails again until the file is fixed.
      if (!prev) {
        const failed = t.runs.find((r) => r.status === "failed");
        return { ...base, status: "failed", trades: failed?.trades, rejected: failed?.rejected, summary: failed?.summary ?? "File could not be read." };
      }
      return { ...base, status: "succeeded", trades: prev.trades, summary: `${prev.trades?.toLocaleString("en-GB")} trades analysed.` };
    case "processing":
      return { ...base, status: "succeeded", trades: prev?.trades, rejected: undefined, summary: prev?.summary ?? "Completed." };
    default:
      return { ...base, status: "succeeded", summary: `Sent to ${t.recipients.length} recipient${t.recipients.length === 1 ? "" : "s"}.` };
  }
}

export default function ReportsInbox() {
  const [threads, setThreads] = useState<Thread[]>(THREADS);
  const [layout, setLayout] = useLocalStorage<Layout>("reports-inbox.layout", "inline");
  const [tab, setTab] = useState<TabId>("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<RunStatus | "">("");
  const [freq, setFreq] = useState<Frequency | "">("");
  const [attention, setAttention] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [mine, setMine] = useState(false);
  const [selected, setSelected] = useState<Selection | null>({ threadId: "e-spread", runId: null });
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["e-spread"]));
  const fileInput = useRef<HTMLInputElement>(null);
  // Ids for runs and uploads made on this page.
  const seq = useRef(0);

  // Mock run timers. Cleared on unmount so a run can't finish on a dead page.
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const update = (id: string, fn: (t: Thread) => Thread) => setThreads((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));

  /** Finish a run. When a processing job succeeds, release the reports
   * that were waiting on it. */
  const finish = (threadId: string, runId: string) => {
    const isJob = threads.find((x) => x.id === threadId)?.kind === "processing";
    setThreads((ts) => {
      const t = ts.find((x) => x.id === threadId);
      const run = t?.runs.find((r) => r.id === runId);
      if (!t || !run) return ts;
      const done = finishedRun(t, run);
      const release = t.kind === "processing" && done.status === "succeeded";
      return ts.map((x) => {
        if (x.id === threadId) return { ...x, unread: true, runs: x.runs.map((r) => (r.id === runId ? done : r)) };
        if (release && x.inputs?.includes(threadId) && x.runs[0]?.status === "waiting") {
          const [w, ...rest] = x.runs;
          return { ...x, unread: true, runs: [{ ...w, status: "running" as const, summary: `${t.name} finished. Running now.` }, ...rest] };
        }
        return x;
      });
    });
    // Released reports were scheduled runs, so a running scheduled run
    // that depends on this job is one we just released.
    if (isJob) {
      later(2200, () =>
        setThreads((ts) =>
          ts.map((x) => {
            const r = x.runs[0];
            if (!x.inputs?.includes(threadId) || r?.status !== "running" || r.trigger !== "Schedule") return x;
            return { ...x, unread: true, runs: [finishedRun(x, r), ...x.runs.slice(1)] };
          }),
        ),
      );
    }
  };

  /** Start a manual run. `period` is the dates it covers, when the user
   * picked them; otherwise it runs for the report's usual period. */
  const runFor = (t: Thread, period?: string) => {
    const id = `${t.id}-m${++seq.current}`;
    const run: Run = {
      id,
      at: nowIso(),
      status: "running",
      trigger: "Manual",
      by: ME,
      period,
      summary: period ? `Running for ${period}.` : "Manual run started.",
    };
    update(t.id, (x) => ({ ...x, runs: [run, ...x.runs] }));
    setSelected({ threadId: t.id, runId: null });
    later(2500, () => finish(t.id, id));
  };

  const runRequest = (t: Thread, req: RunRequest) => runFor(t, req ? periodLabel(req.start, req.end) : undefined);
  const rerunOf = (t: Thread, r: Run) => {
    const day = r.at.slice(0, 10);
    runFor(t, r.period ?? periodLabel(day, day));
  };

  const upload = (fileName: string) => {
    const id = `t-up-${++seq.current}`;
    const runId = `${id}-0`;
    const name = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
    const thread: Thread = {
      id,
      kind: "posttrade",
      name,
      description: "Post-trade TCA on an uploaded trade file.",
      frequency: "On upload",
      owner: ME,
      recipients: [],
      file: fileName,
      outputs: ["Cost", "Benchmark"],
      inputs: ["p-csv", "p-mkt"],
      unread: false,
      runs: [{ id: runId, at: nowIso(), status: "running", trigger: "Upload", by: ME, summary: "Parsing file and matching to market data." }],
    };
    setThreads((ts) => [thread, ...ts]);
    setTab("posttrade");
    setSelected({ threadId: id, runId: null });
    later(3000, () =>
      update(id, (x) => ({
        ...x,
        unread: true,
        runs: [{ ...x.runs[0], status: "succeeded", duration: "2m 48s", trades: 2140, summary: "2,140 trades analysed." }],
      })),
    );
  };

  /** Selecting a report also opens it, so its history is one click away. */
  const select = (s: Selection) => {
    setSelected(s);
    setExpanded((e) => (e.has(s.threadId) ? e : new Set(e).add(s.threadId)));
    update(s.threadId, (t) => (t.unread ? { ...t, unread: false } : t));
  };

  const openThread = (threadId: string) => {
    const t = threads.find((x) => x.id === threadId);
    if (t && !inTab(t, tab)) setTab(t.kind === "processing" ? "processing" : "all");
    select({ threadId, runId: null });
  };

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const clearFilters = () => {
    setQuery("");
    setStatus("");
    setFreq("");
    setAttention(false);
    setUnreadOnly(false);
    setMine(false);
  };

  /* ---------------- Derived ---------------- */

  const sorted = useMemo(() => threads.slice().sort((a, b) => (a.runs[0].at < b.runs[0].at ? 1 : -1)), [threads]);
  const q = query.trim().toLowerCase();
  const visible = sorted.filter(
    (t) =>
      inTab(t, tab) &&
      (!q || t.name.toLowerCase().includes(q) || (t.file ?? "").toLowerCase().includes(q) || t.runs[0].summary.toLowerCase().includes(q)) &&
      (!status || t.runs[0].status === status) &&
      (!freq || t.frequency === freq) &&
      (!attention || needsAttention(t)) &&
      (!unreadOnly || t.unread) &&
      (!mine || t.owner === ME || t.runs.some((r) => r.by === ME)),
  );

  const inScope = sorted.filter((t) => inTab(t, tab));
  const attentionCount = inScope.filter(needsAttention).length;
  const unreadCount = inScope.filter((t) => t.unread).length;

  const tabOptions = (defs: { value: TabId; label: string }[]): Option<TabId>[] =>
    defs.map((d) => ({ ...d, count: threads.filter((t) => inTab(t, d.value) && t.unread).length || undefined }));

  // A selection hidden by the filters clears the action bar.
  const sel = selected && visible.some((t) => t.id === selected.threadId) ? selected : null;
  const selThread = sel ? (threads.find((t) => t.id === sel.threadId) ?? null) : null;
  const selRun = selThread ? (selThread.runs.find((r) => r.id === sel?.runId) ?? selThread.runs[0]) : null;

  const failedJobs = threads.filter((t) => t.kind === "processing" && t.runs[0].status === "failed");
  const jobCount = threads.filter((t) => t.kind === "processing").length;

  const active = [
    status && { key: "status", label: `Status: ${STATUS_OPTIONS.find((o) => o.value === status)?.label}`, onRemove: () => setStatus("") },
    freq && { key: "freq", label: `Frequency: ${freq}`, onRemove: () => setFreq("") },
    attention && { key: "attention", label: "Needs attention", onRemove: () => setAttention(false) },
    unreadOnly && { key: "unread", label: "Unread", onRemove: () => setUnreadOnly(false) },
    mine && { key: "mine", label: "Mine", onRemove: () => setMine(false) },
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

  const header = (
    <>
      {/* sm:pl-36 clears the app's fixed Home pill; below sm it sits above. */}
      <PageHeader
        className="pt-16 sm:pt-4 sm:pl-36"
        eyebrow="BestX · Reports"
        title="Reports inbox"
        description="Every report run lands here. Open a report to see its earlier runs."
        meta={
          <button
            type="button"
            onClick={() => setTab("processing")}
            className={tokens.cx(
              "inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] font-medium",
              tokens.radius.pill,
              tokens.tone[failedJobs.length ? "negative" : "positive"].soft,
              tokens.focus,
            )}
          >
            <span aria-hidden className={tokens.cx("h-1.5 w-1.5 rounded-full", tokens.tone[failedJobs.length ? "negative" : "positive"].solid)} />
            Data processing: {jobCount - failedJobs.length} of {jobCount} jobs OK
          </button>
        }
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f.name);
                e.target.value = "";
              }}
            />
            <SegmentedControl<Layout>
              label="Layout"
              value={layout}
              onChange={setLayout}
              options={[
                { value: "inline", label: "A · In the list" },
                { value: "panel", label: "B · Side panel" },
              ]}
            />
            <button type="button" className={tokens.button.secondary} onClick={() => fileInput.current?.click()}>
              Upload trade file
            </button>
            <button type="button" className={tokens.button.primary}>
              New report
            </button>
          </>
        }
      />
    </>
  );

  const banners = failedJobs.length > 0 && (
      <div className="flex flex-col gap-2 px-6 pt-4">
        {failedJobs.map((job) => {
          const held = threads.filter((t) => t.inputs?.includes(job.id) && t.runs[0].status === "waiting");
          return (
            <Banner
              key={job.id}
              tone="negative"
              title={`${job.name} failed at ${shortWhen(job.runs[0].at)}.`}
              action={{ label: "Retry now", onClick: () => runFor(job) }}
            >
              {job.runs[0].summary}{" "}
              {held.length > 0 &&
                `${held.length} report${held.length === 1 ? " is" : "s are"} waiting on it: ${held.map((h) => h.name).join(", ")}.`}
            </Banner>
          );
        })}
      </div>
  );

  const controls = (
    <>
      {/* sm:pl-32 keeps the tabs clear of the fixed Home pill once stuck. */}
      <div className="flex flex-wrap items-end gap-x-5 gap-y-2 border-b border-neutral-200 bg-white px-4 pt-3 sm:pl-32">
        <Tabs<TabId> label="Report type" tabs={tabOptions(REPORT_TABS)} value={tab} onChange={setTab} />
        <span aria-hidden className="mb-2 h-4 w-px bg-neutral-300" />
        <Tabs<TabId> label="Processing" tabs={tabOptions([{ value: "processing", label: "Processing" }])} value={tab} onChange={setTab} />
      </div>
      <FilterBar
        search={query}
        onSearch={setQuery}
        searchPlaceholder={tab === "processing" ? "Search jobs" : "Search reports, files"}
        active={active}
        onClearAll={clearFilters}
      >
        <FilterSelect label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        {tab !== "processing" && <FilterSelect label="Frequency" value={freq} options={FREQ_OPTIONS} onChange={setFreq} />}
        <ChipToggle label="Needs attention" pressed={attention} onChange={setAttention} count={attentionCount} />
        <ChipToggle label="Unread" pressed={unreadOnly} onChange={setUnreadOnly} count={unreadCount} />
        {tab !== "processing" && <ChipToggle label="Mine" pressed={mine} onChange={setMine} />}
      </FilterBar>
      <ActionBar
        thread={selThread}
        run={selRun}
        onRun={runRequest}
        onTogglePause={(t) => update(t.id, (x) => ({ ...x, paused: !x.paused }))}
        onClear={() => setSelected(null)}
        onBackToLatest={() => sel && select({ threadId: sel.threadId, runId: null })}
        onUploadAgain={() => fileInput.current?.click()}
      />
    </>
  );

  const list = (
    <ThreadList
      threads={visible}
      allThreads={threads}
      selected={sel}
      expanded={expanded}
      showKind={tab === "all"}
      onSelect={select}
      onToggle={toggle}
      onRerun={rerunOf}
      onOpenThread={openThread}
      onClearFilters={clearFilters}
      inline={layout === "inline"}
    />
  );

  if (layout === "panel") {
    // B · Side panel. Nothing scrolls the page from lg up: the top stays put
    // and the list and panel scroll on their own. On a phone the panel is a
    // full-screen sheet above the list, under the bottom action bar.
    return (
      <div className="flex h-full flex-col overflow-y-auto bg-neutral-50 lg:overflow-hidden">
        {header}
        {banners}
        <div className="flex flex-col px-6 py-4 max-sm:px-0 max-sm:pb-48 lg:min-h-0 lg:flex-1">
          <section aria-label="Reports inbox" className={tokens.cx("flex flex-col lg:min-h-0 lg:flex-1", tokens.border.default)}>
            <div className="shrink-0 border-b border-neutral-200">{controls}</div>
            <div className={tokens.cx("grid grid-cols-1 lg:min-h-0 lg:flex-1", selThread && "lg:grid-cols-[minmax(0,1fr)_30rem]")}>
              <div className="min-w-0 bg-white lg:min-h-0 lg:overflow-y-auto">{list}</div>
              {selThread && selRun && (
                <div className="z-20 min-w-0 bg-white max-lg:fixed max-lg:inset-0 max-lg:pt-16 max-lg:pb-40 lg:min-h-0">
                  <HistoryPanel
                    thread={selThread}
                    run={selRun}
                    selected={sel}
                    allThreads={threads}
                    onSelect={select}
                    onRerun={rerunOf}
                    onOpenThread={openThread}
                    onClose={() => setSelected(null)}
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // A · In the list. The page scrolls; from sm up the tabs, filters and
  // action bar stick to the top. On a phone only the action bar stays,
  // pinned to the bottom.
  return (
    <div className="h-full overflow-y-auto bg-neutral-50">
      {header}
      {banners}
      <div className="px-6 py-4 max-sm:px-0 max-sm:pb-48">
        <section aria-label="Reports inbox" className={tokens.border.default}>
          <div className="border-b border-neutral-200 sm:sticky sm:top-0 sm:z-20">{controls}</div>
          {list}
        </section>
      </div>
    </div>
  );
}
