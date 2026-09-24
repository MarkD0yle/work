import { useEffect, useMemo, useState } from "react";
import {
  INVESTIGATORS,
  INVESTIGATOR_BY_ID,
  SCENARIO_BY_CODE,
  STAGE_ORDER,
  type Op,
  type QueueRow,
  type Risk,
  type StageLabel,
} from "./data";
import { Check, FOCUS } from "./ui";

/* Investigator queue: open alerts sorted by SLA risk, with bulk selection
 * and a sticky action bar. Actions go up to the page as ops, which replays
 * them over the dataset, so a closure moves the funnel and KPIs too. */

type SortKey = "id" | "customer" | "typology" | "risk" | "score" | "sla" | "assignee" | "stage";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const PAGE = 25;
const RISK_RANK: Record<Risk, number> = { Low: 0, Medium: 1, High: 2, PEP: 3 };
const nf = new Intl.NumberFormat("en-GB");

const RISK_CHIP: Record<Risk, string> = {
  Low: "border-neutral-200 bg-neutral-50 text-neutral-600",
  Medium: "border-amber-200 bg-amber-50 text-amber-800",
  High: "border-rose-200 bg-rose-50 text-rose-700",
  PEP: "border-violet-300 bg-violet-100 text-violet-800",
};
const STAGE_MARK: Record<StageLabel, string> = {
  New: "border border-violet-500 bg-white",
  "L1 review": "bg-violet-300",
  "Awaiting RFI": "bg-neutral-400",
  "L2 review": "bg-violet-700",
};

function assigneeName(id: string | null) {
  return id ? (INVESTIGATOR_BY_ID.get(id)?.name ?? "") : "";
}

function compare(a: QueueRow, b: QueueRow, key: SortKey): number {
  switch (key) {
    case "id":
      return a.alert.id.localeCompare(b.alert.id);
    case "customer":
      return a.alert.customer.localeCompare(b.alert.customer);
    case "typology":
      return a.alert.typology.localeCompare(b.alert.typology);
    case "risk":
      return RISK_RANK[a.alert.risk] - RISK_RANK[b.alert.risk];
    case "score":
      return a.alert.score - b.alert.score;
    case "sla":
      return a.left - b.left;
    case "assignee":
      return assigneeName(a.alert.assignee).localeCompare(assigneeName(b.alert.assignee));
    case "stage":
      return STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
  }
}

const COLUMNS: { key: SortKey; label: string; width?: number; right?: boolean }[] = [
  { key: "id", label: "Alert", width: 80 },
  { key: "customer", label: "Customer", width: 104 },
  { key: "typology", label: "Typology" },
  { key: "risk", label: "Risk", width: 62 },
  { key: "score", label: "Score", width: 66 },
  { key: "sla", label: "Age · SLA", width: 126 },
  { key: "assignee", label: "Assignee", width: 96 },
  { key: "stage", label: "Stage", width: 96 },
];

export function Queue({
  rows,
  load,
  onBulk,
  notice,
  onUndo,
  onDismiss,
  hasFilters,
  onClearFilters,
}: {
  rows: QueueRow[];
  /** Open alerts per investigator across the whole book (not the filtered slice). */
  load: Map<string, number>;
  onBulk: (ids: string[], op: Op, text: string) => void;
  notice: string | null;
  onUndo: () => void;
  onDismiss: () => void;
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  const [sort, setSort] = useState<Sort>({ key: "sla", dir: "asc" });
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [assignOpen, setAssignOpen] = useState(false);

  const sorted = useMemo(() => {
    const m = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort(
      (a, b) =>
        m * compare(a, b, sort.key) || a.left - b.left || b.alert.score - a.alert.score || a.alert.id.localeCompare(b.alert.id),
    );
  }, [rows, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const pg = Math.min(page, pages - 1);
  const visible = sorted.slice(pg * PAGE, pg * PAGE + PAGE);

  // Selection only ever refers to rows still in the (filtered, open) queue.
  const selected = useMemo(() => rows.filter((r) => picked.has(r.alert.id)), [rows, picked]);
  const selIds = selected.map((r) => r.alert.id);
  const pageAll = visible.length > 0 && visible.every((r) => picked.has(r.alert.id));
  const pageSome = visible.some((r) => picked.has(r.alert.id));

  const breached = rows.filter((r) => r.left < 0).length;
  const unassigned = rows.filter((r) => !r.alert.assignee).length;

  useEffect(() => {
    if (!assignOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-aml-assign]")) setAssignOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAssignOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [assignOpen]);

  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const togglePage = (on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const r of visible) {
        if (on) next.add(r.alert.id);
        else next.delete(r.alert.id);
      }
      return next;
    });
  const clearSel = () => {
    setPicked(new Set());
    setAssignOpen(false);
  };

  const plural = (n: number) => `${nf.format(n)} alert${n === 1 ? "" : "s"}`;
  const act = (op: Op) => {
    if (selIds.length === 0) return;
    let text: string;
    if (op.kind === "assign") {
      text = `${plural(selIds.length)} ${op.to ? `assigned to ${assigneeName(op.to)}` : "unassigned"}`;
    } else if (op.kind === "fp") {
      text = `${plural(selIds.length)} closed as false positive`;
    } else {
      const l2 = selected.filter((r) => r.stage === "L2 review").length;
      const l1 = selected.length - l2;
      text = [l1 ? `${plural(l1)} escalated to L2` : "", l2 ? `${plural(l2)} opened as cases` : ""]
        .filter(Boolean)
        .join(" · ");
    }
    onBulk(selIds, op, text);
    clearSel();
  };

  const sortBy = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "score" ? "desc" : "asc" }));
    setPage(0);
  };

  return (
    <section className="flex flex-col border border-neutral-200 bg-white" aria-labelledby="aml-queue-title">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-neutral-100 px-4 py-2.5">
        <div>
          <h2 id="aml-queue-title" className="text-sm font-semibold text-neutral-900">
            Investigator queue
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">Open alerts, most at risk of breaching SLA first</p>
        </div>
        <dl className="flex items-baseline gap-4 text-[11px]">
          {[
            { k: "Open", v: rows.length },
            { k: "Past SLA", v: breached },
            { k: "Unassigned", v: unassigned },
          ].map((s) => (
            <div key={s.k} className="flex items-baseline gap-1.5">
              <dt className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">{s.k}</dt>
              <dd className="font-mono font-semibold text-neutral-800 tabular-nums">{nf.format(s.v)}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div aria-live="polite">
        {notice && (
          <div className="flex items-center gap-3 border-b border-violet-100 bg-violet-50 px-4 py-1.5 text-xs text-violet-900">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M3.5 8.5l3 3 6-7" />
            </svg>
            <span className="min-w-0 flex-1">{notice}</span>
            <button type="button" onClick={onUndo} className={`font-semibold underline underline-offset-2 hover:text-violet-700 ${FOCUS}`}>
              Undo
            </button>
            <button type="button" onClick={onDismiss} aria-label="Dismiss" className={`text-violet-500 hover:text-violet-900 ${FOCUS}`}>
              ✕
            </button>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <span className="text-sm font-medium text-neutral-700">
            {hasFilters ? "No open alerts match these filters" : "Queue clear: no open alerts"}
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className={`border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 ${FOCUS}`}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-xs" style={{ minWidth: 740 }}>
            <colgroup>
              <col style={{ width: 32 }} />
              {COLUMNS.map((c) => (
                <col key={c.key} style={c.width ? { width: c.width } : undefined} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/70 text-left">
                <th scope="col" className="py-2 pl-4">
                  <Check
                    checked={pageAll}
                    indeterminate={!pageAll && pageSome}
                    onChange={(on) => togglePage(on)}
                    label="Select all alerts on this page"
                  />
                </th>
                {COLUMNS.map((c) => {
                  const on = sort.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className="px-1.5 py-2"
                    >
                      <button
                        type="button"
                        onClick={() => sortBy(c.key)}
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold tracking-widest uppercase ${FOCUS} ${
                          on ? "text-violet-800" : "text-neutral-400 hover:text-neutral-700"
                        }`}
                      >
                        {c.label}
                        <span aria-hidden className={on ? "" : "opacity-0"}>
                          {on && sort.dir === "desc" ? "↓" : "↑"}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {visible.map((r) => {
                const a = r.alert;
                const sel = picked.has(a.id);
                const who = a.assignee ? INVESTIGATOR_BY_ID.get(a.assignee) : undefined;
                const scen = SCENARIO_BY_CODE.get(a.scenario);
                const frac = Math.min(1, r.age / r.sla);
                const tone = r.left < 0 ? "bad" : r.left <= 3 ? "warn" : "ok";
                return (
                  <tr key={a.id} className={sel ? "bg-violet-50" : "hover:bg-neutral-50"} aria-selected={sel}>
                    <td className="py-2 pl-4">
                      <Check checked={sel} onChange={(on) => toggle(a.id, on)} label={`Select ${a.id}`} />
                    </td>
                    <td className="px-1.5 py-1.5 font-mono tabular-nums" title={scen ? `${scen.code} · ${scen.name}` : undefined}>
                      <div className="text-[11px] text-neutral-800">{a.id}</div>
                      <div className="text-[10px] text-neutral-400">{a.scenario}</div>
                    </td>
                    <td className="px-1.5 py-1.5" title={`${a.line} · ${a.region}`}>
                      <div className="font-mono text-[11px] text-neutral-700 tabular-nums">{a.customer}</div>
                      <div className="truncate text-[10px] text-neutral-400">{a.line}</div>
                    </td>
                    <td className="px-1.5 py-1.5 leading-snug text-neutral-800">{a.typology}</td>
                    <td className="px-1.5 py-2">
                      <span className={`inline-block border px-1.5 py-px text-[10px] font-semibold ${RISK_CHIP[a.risk]}`}>
                        {a.risk}
                      </span>
                    </td>
                    <td className="px-1.5 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 text-right font-mono text-[11px] text-neutral-800 tabular-nums">{a.score}</span>
                        <span className="h-1.5 w-8 bg-neutral-100" aria-hidden>
                          <span className="block h-full bg-violet-500" style={{ width: `${a.score}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className="px-1.5 py-1.5">
                      <div className="flex items-baseline justify-between gap-2 text-[11px]">
                        <span className="font-mono text-neutral-700 tabular-nums">{r.age}d</span>
                        <span
                          className={`inline-flex items-center gap-1 font-medium whitespace-nowrap ${
                            tone === "bad" ? "text-rose-700" : tone === "warn" ? "text-amber-700" : "text-neutral-500"
                          }`}
                        >
                          {tone === "bad" && (
                            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
                              <path d="M8 1 15 14H1L8 1Zm-.75 5v4h1.5V6h-1.5Zm0 5v1.5h1.5V11h-1.5Z" />
                            </svg>
                          )}
                          {tone === "warn" && (
                            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                              <path d="M8 4v4l2.5 1.5M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0Z" />
                            </svg>
                          )}
                          {r.left < 0 ? `Breached ${-r.left}d` : r.left === 0 ? "Due today" : `${r.left}d left`}
                        </span>
                      </div>
                      <div className="mt-1 h-1 bg-neutral-100" aria-hidden>
                        <div
                          className={`h-full ${tone === "bad" ? "bg-rose-600" : tone === "warn" ? "bg-amber-500" : "bg-neutral-400"}`}
                          style={{ width: `${frac * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-1.5 py-2">
                      {who ? (
                        <span className="flex min-w-0 items-center gap-1.5" title={`${who.name} · ${who.team}`}>
                          <span
                            className={`inline-flex h-5 w-5 shrink-0 items-center justify-center text-[9px] font-semibold text-white ${
                              who.team === "L2" ? "bg-violet-800" : "bg-neutral-700"
                            }`}
                            aria-hidden
                          >
                            {who.initials}
                          </span>
                          <span className="truncate text-[11px] text-neutral-700">{who.name.replace(/^(\S+) (\S).*$/, "$1 $2.")}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center border border-dashed border-neutral-300 text-[10px]" aria-hidden>
                            ?
                          </span>
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-1.5 py-2">
                      <span className="flex items-center gap-1.5 text-[11px] text-neutral-700">
                        <span className={`h-2 w-2 shrink-0 ${STAGE_MARK[r.stage]}`} aria-hidden />
                        <span className="truncate">{r.stage}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <footer className="flex items-center justify-between gap-3 border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-500">
          <span>
            Showing{" "}
            <span className="font-mono text-neutral-800 tabular-nums">
              {nf.format(pg * PAGE + 1)}–{nf.format(pg * PAGE + visible.length)}
            </span>{" "}
            of <span className="font-mono text-neutral-800 tabular-nums">{nf.format(rows.length)}</span>
          </span>
          <div className="flex items-center gap-1">
            <span className="mr-2 font-mono tabular-nums">
              Page {pg + 1} / {pages}
            </span>
            {[
              { label: "Previous", glyph: "‹", to: pg - 1, off: pg === 0 },
              { label: "Next", glyph: "›", to: pg + 1, off: pg >= pages - 1 },
            ].map((b) => (
              <button
                key={b.label}
                type="button"
                aria-label={`${b.label} page`}
                disabled={b.off}
                onClick={() => setPage(b.to)}
                className={`inline-flex h-6 w-6 items-center justify-center border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 ${FOCUS}`}
              >
                {b.glyph}
              </button>
            ))}
          </div>
        </footer>
      )}

      {selected.length > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="sticky bottom-0 z-20 flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white"
        >
          <span className="px-1 font-semibold">
            <span className="font-mono tabular-nums">{nf.format(selected.length)}</span> selected
          </span>
          {selected.length < rows.length && (
            <button
              type="button"
              onClick={() => setPicked(new Set(rows.map((r) => r.alert.id)))}
              className={`px-1 text-neutral-400 underline underline-offset-2 hover:text-white ${FOCUS}`}
            >
              Select all {nf.format(rows.length)}
            </button>
          )}
          <span className="px-1 text-neutral-600" aria-hidden>
            ·
          </span>
          <div className="relative" data-aml-assign>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={assignOpen}
              onClick={() => setAssignOpen((o) => !o)}
              className={`inline-flex items-center gap-1 border border-neutral-700 px-2 py-1 font-medium hover:bg-neutral-800 ${FOCUS}`}
            >
              Assign to <span aria-hidden>▾</span>
            </button>
            {assignOpen && (
              <div
                role="menu"
                className="absolute bottom-full left-0 z-30 mb-1 w-60 border border-neutral-200 bg-white py-1 text-neutral-800 shadow-lg shadow-neutral-900/20"
              >
                {(["L1", "L2"] as const).map((team) => (
                  <div key={team}>
                    <div className="px-3 pt-1.5 pb-1 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
                      {team === "L1" ? "L1 analysts" : "L2 investigators"}
                    </div>
                    {INVESTIGATORS.filter((i) => i.team === team).map((i) => (
                      <button
                        key={i.id}
                        type="button"
                        role="menuitem"
                        onClick={() => act({ kind: "assign", to: i.id })}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-violet-50 ${FOCUS}`}
                      >
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center text-[9px] font-semibold text-white ${
                            team === "L2" ? "bg-violet-800" : "bg-neutral-700"
                          }`}
                          aria-hidden
                        >
                          {i.initials}
                        </span>
                        <span className="flex-1">{i.name}</span>
                        <span className="font-mono text-[10px] text-neutral-400 tabular-nums">{load.get(i.id) ?? 0} open</span>
                      </button>
                    ))}
                  </div>
                ))}
                <div className="mt-1 border-t border-neutral-100 pt-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => act({ kind: "assign", to: null })}
                    className={`w-full px-3 py-1.5 text-left text-neutral-500 hover:bg-neutral-50 ${FOCUS}`}
                  >
                    Unassign
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => act({ kind: "fp" })}
            className={`border border-neutral-700 px-2 py-1 font-medium hover:bg-neutral-800 ${FOCUS}`}
          >
            Close as false positive
          </button>
          <button
            type="button"
            onClick={() => act({ kind: "escalate" })}
            title="L1 alerts move to L2 review; L2 alerts open a case"
            className={`bg-violet-600 px-2 py-1 font-medium hover:bg-violet-500 ${FOCUS}`}
          >
            Escalate
          </button>
          <button
            type="button"
            onClick={clearSel}
            aria-label="Clear selection"
            className={`ml-auto px-2 py-1 text-neutral-400 hover:text-white ${FOCUS}`}
          >
            ✕
          </button>
        </div>
      )}
    </section>
  );
}
