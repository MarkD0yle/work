import { useEffect, useMemo, useState } from "react";
import {
  LIFECYCLE_STAGE_ORDER,
  ME,
  monitorActionsRepo,
  pipelineNotesRepo,
  usePipelineNotes,
  type AccountSummary,
  type LifecycleStage,
  type LifecycleStatus,
  type PipelineDetail,
  type ProcessingGroupSummary,
} from "../../lib/qlik";

/* PipelineDrawer — per-pipeline deep context overlay.
 *
 * Built from the sidebar mock you shared, with three cuts on the original:
 *   - No redundant "NOW" badge (the red ✕ on the breached step already says it)
 *   - No decorative top progress bar ("3/6 complete" + visual sequence are enough)
 *   - Upcoming closures rendered as three short lines, not a wrapped string
 *
 * Snooze degrades to per-monitor 'deferred' resolve under the hood, so
 * spec §4.6 ("no bulk actions in v0.1") is not violated — one user-visible
 * action, full per-monitor audit trail.
 *
 * Notes are pipeline-scoped, stored in a separate repo from the monitor
 * action log.
 */

function formatAum(aum: number): string {
  if (aum >= 1e9) return `$${(aum / 1e9).toFixed(2)}B`;
  if (aum >= 1e6) return `$${(aum / 1e6).toFixed(0)}M`;
  return `$${aum}`;
}

function formatCutoffCountdown(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatNoteTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PipelineDrawer({
  detail,
  onClose,
}: {
  detail: PipelineDetail;
  onClose: () => void;
}) {
  const [noteText, setNoteText] = useState("");
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozing, setSnoozing] = useState(false);
  const [snoozeReason, setSnoozeReason] = useState("");
  const notes = usePipelineNotes(detail.id);

  // Default-expand any PG that isn't clean. Single-PG mandates expand the
  // only one so the lifecycle view is visible immediately.
  const initialOpenPGs = useMemo(() => {
    const set = new Set<string>();
    const nonClean = detail.processingGroups.filter(
      (g) => g.status !== "clean" && g.status !== "holiday",
    );
    if (nonClean.length > 0) {
      for (const g of nonClean) set.add(g.id);
    } else if (detail.processingGroups.length === 1) {
      set.add(detail.processingGroups[0].id);
    }
    return set;
  }, [detail.processingGroups]);
  const [openPGs, setOpenPGs] = useState<Set<string>>(initialOpenPGs);

  // Reset expanded PGs when the drawer switches to a different mandate.
  useEffect(() => {
    setOpenPGs(initialOpenPGs);
  }, [detail.id, initialOpenPGs]);

  function togglePG(id: string) {
    setOpenPGs((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Close on Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pgCount = detail.processingGroups.length;
  const cleanPGs = detail.processingGroups.filter(
    (g) => g.status === "clean" || g.status === "holiday",
  ).length;

  const statusPill =
    detail.worstStatus === "broken" || detail.worstStatus === "at_risk"
      ? { label: "Act now", cls: "border-red-300 bg-red-50 text-red-700", dot: "bg-red-500" }
      : detail.worstStatus === "watch"
        ? { label: "Watch", cls: "border-amber-300 bg-amber-50 text-amber-800", dot: "bg-amber-500" }
        : detail.worstStatus === "working"
          ? { label: "Working", cls: "border-blue-300 bg-blue-50 text-blue-700", dot: "bg-blue-500" }
          : detail.worstStatus === "holiday"
            ? { label: "Holiday", cls: "border-neutral-200 bg-neutral-50 text-neutral-400", dot: "bg-neutral-300" }
            : { label: "On track", cls: "border-neutral-300 bg-neutral-50 text-neutral-600", dot: "bg-neutral-400" };

  async function postNote() {
    if (!noteText.trim()) return;
    const body = noteText.trim();
    setNoteText("");
    await pipelineNotesRepo.add(detail.id, ME, body);
  }

  async function confirmSnooze() {
    if (!snoozeReason.trim() || detail.affectedMonitorIds.length === 0) return;
    setSnoozing(true);
    try {
      // Spec §4.6 — no bulk actions surface. We degrade to N per-monitor
      // 'deferred' resolves, each individually recorded in the action log.
      // Operator sees ONE click; audit trail sees N actions.
      const ts = new Date().toISOString();
      const sharedNote = `Pipeline snooze · ${snoozeReason.trim()}`;
      for (const monitorId of detail.affectedMonitorIds) {
        await monitorActionsRepo.record(
          {
            monitorId,
            qlikRefreshTimestamp: ts,
            action: "resolve",
            actor: ME,
            resolutionReason: "deferred",
            note: sharedNote,
          },
          { optimistic: false },
        );
      }
      // Also leave a pipeline-scoped note for the audit trail.
      await pipelineNotesRepo.add(
        detail.id,
        ME,
        `Snoozed pipeline — ${snoozeReason.trim()} (${detail.affectedMonitorIds.length} monitor${detail.affectedMonitorIds.length === 1 ? "" : "s"} marked deferred)`,
      );
      setSnoozeOpen(false);
      setSnoozeReason("");
    } finally {
      setSnoozing(false);
    }
  }

  return (
    <aside
      role="region"
      aria-label={`Pipeline detail · ${detail.clientName} ${detail.groupName}`}
      className="flex h-full flex-col overflow-hidden bg-white"
    >
        {/* Header */}
        <header className="flex items-start gap-3 border-b border-neutral-200 px-5 pt-4 pb-4">
          <div className="min-w-0 flex-1">
            {/* Spec v0.1.1 §4.3 — "Act now" word pill removed.
                Severity is carried by the dot alone; the action bar below
                the header conveys urgency. */}
            <div className="mb-2 flex items-center gap-1.5">
              <Tag tone="region">{detail.region}</Tag>
              <Tag tone="neutral">{detail.cadence}</Tag>
              <span
                aria-label={`Status: ${statusPill.label}`}
                className={`inline-flex h-2.5 w-2.5 rounded-full ${statusPill.dot}`}
              />
            </div>
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              {detail.clientName} · mandate
            </div>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-900">
              {detail.mandateName}
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {pgCount} processing group{pgCount === 1 ? "" : "s"}
              {cleanPGs < pgCount && (
                <>
                  {" · "}
                  <span className="font-medium text-amber-700">
                    {pgCount - cleanPGs} need{pgCount - cleanPGs === 1 ? "s" : ""} attention
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M4.28 4.28a.75.75 0 0 1 1.06 0L10 8.94l4.66-4.66a.75.75 0 1 1 1.06 1.06L11.06 10l4.66 4.66a.75.75 0 1 1-1.06 1.06L10 11.06l-4.66 4.66a.75.75 0 1 1-1.06-1.06L8.94 10 4.28 5.34a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* Spec v0.1.1 §4 — sticky action bar above the fold.
              Primary action visible without scrolling regardless of depth. */}
          <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-5 py-3">
            {snoozeOpen ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
                    Snooze · reason required
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    marks{" "}
                    <span className="font-semibold text-neutral-700">
                      {detail.affectedMonitorIds.length}
                    </span>{" "}
                    monitor{detail.affectedMonitorIds.length === 1 ? "" : "s"}{" "}
                    deferred
                  </span>
                </div>
                <input
                  autoFocus
                  type="text"
                  value={snoozeReason}
                  onChange={(e) => setSnoozeReason(e.target.value)}
                  placeholder="e.g. Known feed delay from custodian, expected 13:00"
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={confirmSnooze}
                    disabled={!snoozeReason.trim() || snoozing}
                    className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:bg-neutral-300"
                  >
                    {snoozing ? "Snoozing…" : "Confirm snooze"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSnoozeOpen(false)}
                    disabled={snoozing}
                    className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <span className="ml-auto text-[10px] text-neutral-400">
                    Each monitor recorded individually
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // L3 stub — would route to existing client workflow detail
                  }}
                  className="flex-1 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                >
                  Open processing group
                </button>
                <button
                  type="button"
                  onClick={() => setSnoozeOpen(true)}
                  disabled={detail.affectedMonitorIds.length === 0}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                  title={
                    detail.affectedMonitorIds.length === 0
                      ? "Nothing to snooze — pipeline has no active issues"
                      : undefined
                  }
                >
                  Snooze
                </button>
              </div>
            )}
          </div>

          {/* Meta grid: owner / aum / currency / cutoff */}
          <section className="grid grid-cols-2 border-b border-neutral-200">
            <Meta label="Owner">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white">
                  {detail.owner.initials}
                </span>
                <span className="text-sm font-medium text-neutral-900">
                  {detail.owner.name}
                </span>
              </div>
            </Meta>
            <Meta label="AUM" border="left">
              <span className="text-sm font-semibold tabular-nums text-neutral-900">
                {formatAum(detail.aum)}
              </span>
            </Meta>
            <Meta label="Base currency" border="top">
              <span className="text-sm font-semibold tabular-nums text-neutral-900">
                {detail.baseCurrency}
              </span>
            </Meta>
            <Meta label="Cutoff" border="top-left">
              <span className="text-sm font-semibold tabular-nums text-neutral-900">
                {detail.cutoffTime}
              </span>
              <span className="ml-1.5 text-xs text-neutral-500">
                ({formatCutoffCountdown(detail.cutoffCountdownMin)})
              </span>
            </Meta>
          </section>

          {/* Processing groups — the mandate's container content.
              Each PG is a collapsible card with its own lifecycle. */}
          <section className="border-b border-neutral-200 px-5 py-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
                Processing Groups
              </h3>
              <span className="text-xs text-neutral-500">
                {cleanPGs}/{pgCount} clean
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {detail.processingGroups.map((pg) => (
                <ProcessingGroupCard
                  key={pg.id}
                  group={pg}
                  open={openPGs.has(pg.id)}
                  onToggle={() => togglePG(pg.id)}
                />
              ))}
            </div>
          </section>

          {/* Spec — Account roll-up (Qlik "NPV Projects" equivalent).
              Each mandate has 1+ accounts; only the affected one(s) show
              non-clean status. */}
          <AccountsSection accounts={detail.accounts} />

          {/* Market dependencies + closures */}
          <section className="border-b border-neutral-200 px-5 py-4">
            <h3 className="mb-3 text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
              Market dependencies
            </h3>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {detail.marketDependencies.map((d) => (
                <span
                  key={d.ccy}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                    d.isOpen
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-neutral-200 bg-neutral-50 text-neutral-500"
                  }`}
                  title={d.isOpen ? "Market open" : "Market closed"}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      d.isOpen ? "bg-emerald-500" : "bg-neutral-400"
                    }`}
                  />
                  <span className="font-semibold">{d.ccy}</span>
                  <span className={d.isOpen ? "text-emerald-700/70" : "text-neutral-400"}>
                    {d.market}
                  </span>
                </span>
              ))}
            </div>
            {/* Spec v0.1.1 §9.3 — Upcoming closures removed from mandate
                detail; surfaced at app-level via HolidayHeaderStrip. */}
          </section>

          {/* Notes */}
          <section className="px-5 py-4">
            <h3 className="mb-3 text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
              Notes
            </h3>
            {notes.length === 0 ? (
              <p className="mb-3 text-xs text-neutral-500">
                No pipeline notes yet.
              </p>
            ) : (
              <ul className="mb-3 flex flex-col gap-2">
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-neutral-700">
                        {n.author}
                      </span>
                      <span className="font-mono text-[10px] text-neutral-400">
                        {formatNoteTime(n.timestamp)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-700">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                postNote();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note…"
                className="flex-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400"
              />
              <button
                type="submit"
                disabled={!noteText.trim()}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:bg-neutral-300"
              >
                Post
              </button>
            </form>
          </section>
        </div>

    </aside>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone: "region" | "neutral" }) {
  const cls =
    tone === "region"
      ? "border-violet-200 bg-violet-50 text-violet-800"
      : "border-neutral-200 bg-white text-neutral-700";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${cls}`}
    >
      {children}
    </span>
  );
}

function Meta({
  label,
  children,
  border,
}: {
  label: string;
  children: React.ReactNode;
  border?: "left" | "top" | "top-left";
}) {
  const borderCls =
    border === "left"
      ? "border-l border-neutral-200"
      : border === "top"
        ? "border-t border-neutral-200"
        : border === "top-left"
          ? "border-t border-l border-neutral-200"
          : "";
  return (
    <div className={`px-5 py-3 ${borderCls}`}>
      <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
        {label}
      </div>
      <div className="mt-1 flex items-center">{children}</div>
    </div>
  );
}

const PG_STATUS_PILL: Record<
  ProcessingGroupSummary["status"],
  { label: string; cls: string; dot: string }
> = {
  broken: { label: "Broken", cls: "border-red-300 bg-red-50 text-red-700", dot: "bg-red-500" },
  at_risk: { label: "At risk", cls: "border-red-300 bg-red-50 text-red-700", dot: "bg-red-500" },
  watch: { label: "Watch", cls: "border-amber-300 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  working: { label: "Working", cls: "border-blue-300 bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  clean: { label: "On track", cls: "border-neutral-200 bg-neutral-50 text-neutral-600", dot: "bg-neutral-400" },
  holiday: { label: "Holiday", cls: "border-neutral-200 bg-neutral-50 text-neutral-400", dot: "bg-neutral-300" },
};

const PG_SUMMARY_TONE: Record<ProcessingGroupSummary["status"], string> = {
  broken: "text-red-700",
  at_risk: "text-red-700",
  watch: "text-amber-800",
  working: "text-blue-700",
  clean: "text-neutral-500",
  holiday: "text-neutral-400",
};

function ProcessingGroupCard({
  group,
  open,
  onToggle,
}: {
  group: ProcessingGroupSummary;
  open: boolean;
  onToggle: () => void;
}) {
  const pill = PG_STATUS_PILL[group.status];
  const completedCount = group.lifecycleStages.filter(
    (s) => s.status === "complete",
  ).length;
  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-neutral-50"
      >
        <span
          aria-hidden
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${pill.dot}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold text-neutral-900">
              {group.name}
            </span>
            {group.isPrimary && (
              <span className="text-[9px] font-semibold tracking-wider text-neutral-400 uppercase">
                primary
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-baseline gap-2 text-[11px] text-neutral-500">
            <span>{group.cadence}</span>
            <span className="text-neutral-300">·</span>
            <span className={`truncate ${PG_SUMMARY_TONE[group.status]}`}>
              {group.summaryLine}
            </span>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${pill.cls}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
          {pill.label}
        </span>
        <span aria-hidden className="ml-1 self-center text-[10px] text-neutral-400">
          {open ? "▼" : "▶"}
        </span>
      </button>

      {open && (
        <div className="border-t border-neutral-100 bg-neutral-50/40 px-3 py-3">
          <div className="mb-2 flex items-baseline justify-between text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
            <span>Lifecycle</span>
            <span className="font-mono text-neutral-400">
              {completedCount}/{LIFECYCLE_STAGE_ORDER.length}
            </span>
          </div>
          <ol className="flex flex-col gap-1">
            {group.lifecycleStages.map((stage, idx) => (
              <LifecycleRow key={stage.name} stage={stage} index={idx + 1} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

const STATUS_ICON: Record<
  LifecycleStatus,
  { bg: string; text: string; glyph: string }
> = {
  complete: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    glyph: "✓",
  },
  in_progress: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    glyph: "◐",
  },
  past_typical: { bg: "bg-yellow-200", text: "text-yellow-900", glyph: "·" },
  past_required: { bg: "bg-amber-400", text: "text-amber-950", glyph: "!" },
  past_benchmark: { bg: "bg-red-500", text: "text-white", glyph: "!" },
  failed: { bg: "bg-red-700", text: "text-white", glyph: "✕" },
  pending: { bg: "bg-neutral-100", text: "text-neutral-400", glyph: "" },
  now: { bg: "bg-amber-100", text: "text-amber-800", glyph: "◐" },
};

function AccountsSection({ accounts }: { accounts: AccountSummary[] }) {
  if (accounts.length === 0) return null;
  const nonClean = accounts.filter(
    (a) => a.status !== "clean" && a.status !== "holiday",
  );
  const dotClass = (s: AccountSummary["status"]) =>
    s === "broken" || s === "at_risk"
      ? "bg-red-500"
      : s === "watch"
        ? "bg-amber-500"
        : s === "working"
          ? "bg-blue-500"
          : "bg-neutral-300";
  return (
    <section className="border-b border-neutral-200 px-5 py-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
          Accounts
        </h3>
        <span className="text-xs text-neutral-500">
          {accounts.length - nonClean.length}/{accounts.length} clean
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {accounts.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs"
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${dotClass(a.status)}`}
            />
            <span className="flex-1 truncate text-neutral-700">{a.name}</span>
            <span className="text-[10px] text-neutral-500">
              {a.status === "clean" ? "on track" : a.status.replace("_", " ")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LifecycleRow({
  stage,
  index,
}: {
  stage: LifecycleStage;
  index: number;
}) {
  const icon = STATUS_ICON[stage.status];
  const isNow =
    stage.status === "past_typical" ||
    stage.status === "past_required" ||
    stage.status === "past_benchmark" ||
    stage.status === "failed" ||
    stage.status === "in_progress";
  const wrapper = isNow
    ? "bg-red-50 border border-red-200 rounded-md px-2 py-1.5"
    : "px-2 py-1.5";
  return (
    <li className={`flex items-start gap-3 ${wrapper}`}>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[10px] font-mono text-neutral-400">
        {index}
      </span>
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[10px] font-bold ${icon.bg} ${icon.text}`}
      >
        {icon.glyph}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`text-sm font-semibold ${
              stage.status === "pending"
                ? "text-neutral-400"
                : isNow
                  ? "text-red-900"
                  : "text-neutral-900"
            }`}
          >
            {stage.name}
          </span>
          {stage.time && (
            <span
              className={`font-mono text-[11px] tabular-nums ${
                stage.status === "pending"
                  ? "text-neutral-400"
                  : "text-neutral-600"
              }`}
            >
              {stage.time}
            </span>
          )}
        </div>
        {stage.detail && (
          <p className="mt-0.5 text-xs text-red-800">{stage.detail}</p>
        )}
      </div>
    </li>
  );
}
