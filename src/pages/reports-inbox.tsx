import { useEffect, useMemo, useRef, useState } from "react";
import { Banner, ChipToggle, FilterBar, FilterSelect, PageHeader, SplitView, Tabs, tokens, type Option } from "../components/patterns";
import { ReadingPane } from "../components/reports-inbox/ReadingPane";
import { ThreadList, type Selection } from "../components/reports-inbox/ThreadList";
import {
  ME,
  THREADS,
  needsAttention,
  nowIso,
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
 * top. Open a thread to see earlier runs; select any run to read it.
 *
 * Processing (ingestion, CSV parsing, recalcs) is a separate tab, not a
 * report type. People don't read it; reports depend on it. So it gets its
 * own view, and when a job fails the banner says which reports it holds
 * up, with a retry that releases them.
 * ------------------------------------------------------------------ */

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

  const rerun = (t: Thread, of?: Run) => {
    const id = `${t.id}-m${++seq.current}`;
    const run: Run = {
      id,
      at: nowIso(),
      status: "running",
      trigger: "Manual",
      by: ME,
      summary: of ? `Re-running for ${shortWhen(of.at)}.` : "Manual run started.",
    };
    update(t.id, (x) => ({ ...x, runs: [run, ...x.runs] }));
    setSelected({ threadId: t.id, runId: null });
    later(2500, () => finish(t.id, id));
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

  const select = (s: Selection) => {
    setSelected(s);
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

  // Fall back to the first visible thread so the pane is never blank while
  // the list has something in it.
  const sel = selected && visible.some((t) => t.id === selected.threadId) ? selected : visible[0] ? { threadId: visible[0].id, runId: null } : null;
  const selThread = sel ? (threads.find((t) => t.id === sel.threadId) ?? null) : null;
  const selRun = selThread ? (selThread.runs.find((r) => r.id === sel?.runId) ?? selThread.runs[0]) : null;

  const jobs = Object.fromEntries(threads.filter((t) => t.kind === "processing").map((t) => [t.id, t]));
  const dependents = selThread?.kind === "processing" ? threads.filter((t) => t.inputs?.includes(selThread.id)) : [];

  const failedJobs = threads.filter((t) => t.kind === "processing" && t.runs[0].status === "failed");
  const jobCount = Object.keys(jobs).length;

  const active = [
    status && { key: "status", label: `Status: ${STATUS_OPTIONS.find((o) => o.value === status)?.label}`, onRemove: () => setStatus("") },
    freq && { key: "freq", label: `Frequency: ${freq}`, onRemove: () => setFreq("") },
    attention && { key: "attention", label: "Needs attention", onRemove: () => setAttention(false) },
    unreadOnly && { key: "unread", label: "Unread", onRemove: () => setUnreadOnly(false) },
    mine && { key: "mine", label: "Mine", onRemove: () => setMine(false) },
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-neutral-50 lg:overflow-hidden">
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
            <button type="button" className={tokens.button.secondary} onClick={() => fileInput.current?.click()}>
              Upload trade file
            </button>
            <button type="button" className={tokens.button.primary}>
              New report
            </button>
          </>
        }
      >
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
          <Tabs<TabId> label="Report type" tabs={tabOptions(REPORT_TABS)} value={tab} onChange={setTab} />
          <span aria-hidden className="mb-2 h-4 w-px bg-neutral-300" />
          <Tabs<TabId> label="Processing" tabs={tabOptions([{ value: "processing", label: "Processing" }])} value={tab} onChange={setTab} />
        </div>
      </PageHeader>

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

      {failedJobs.length > 0 && (
        <div className="px-6 pt-4">
          {failedJobs.map((job) => {
            const held = threads.filter((t) => t.inputs?.includes(job.id) && t.runs[0].status === "waiting");
            return (
              <Banner
                key={job.id}
                tone="negative"
                title={`${job.name} failed at ${shortWhen(job.runs[0].at)}.`}
                action={{ label: "Retry now", onClick: () => rerun(job) }}
              >
                {job.runs[0].summary}{" "}
                {held.length > 0 &&
                  `${held.length} report${held.length === 1 ? " is" : "s are"} waiting on it: ${held.map((h) => h.name).join(", ")}.`}
              </Banner>
            );
          })}
        </div>
      )}

      <div className="px-6 py-4 lg:min-h-0 lg:flex-1">
        <SplitView
          fill
          detailWidth="reading"
          list={
            <ThreadList
              threads={visible}
              selected={sel}
              expanded={expanded}
              showKind={tab === "all"}
              onSelect={select}
              onToggle={toggle}
              onClearFilters={clearFilters}
            />
          }
          detail={
            <ReadingPane
              thread={selThread}
              run={selRun}
              jobs={jobs}
              dependents={dependents}
              onRerun={rerun}
              onTogglePause={(t) => update(t.id, (x) => ({ ...x, paused: !x.paused }))}
              onOpenThread={openThread}
              onUploadAgain={() => fileInput.current?.click()}
            />
          }
        />
      </div>
    </div>
  );
}
