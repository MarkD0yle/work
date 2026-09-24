import { useEffect, useMemo, useState } from "react";
import { OWNERS, STAGES, type CaseRow, type Owner, type Stage } from "./model";
import { FOCUS, HOLD_SHORT, STATUS, dateShort, days, daysSigned, gbpCompact, int, pct, timeShort } from "./format";
import { AlertIcon, Check, EmptyState, SortTh, type SortDir } from "./ui";

/* The ageing case list: open cases past SLA, or every open case in the
 * selected stage. Rows are selectable with a sticky bulk-action bar
 * (Chase, Reassign, Escalate). Actions are kept as an operations log on
 * the page, replayed over the rows, so Undo is a pop. */

export type CaseOp =
  | { kind: "chase"; ids: string[]; at: number }
  | { kind: "escalate"; ids: string[]; at: number }
  | { kind: "reassign"; ids: string[]; at: number; to: string };

type SortKey = "ref" | "applicant" | "product" | "ltv" | "loan" | "stage" | "age" | "owner" | "hold";
type Sort = { key: SortKey; dir: SortDir };

const PAGE = 25;

const COLUMNS: { key: SortKey; label: string; right?: boolean }[] = [
  { key: "ref", label: "Case" },
  { key: "applicant", label: "Applicant" },
  { key: "product", label: "Product" },
  { key: "ltv", label: "LTV", right: true },
  { key: "loan", label: "Loan", right: true },
  { key: "stage", label: "Stage" },
  { key: "age", label: "In stage · SLA" },
  { key: "owner", label: "Owner" },
  { key: "hold", label: "Hold reason" },
];

const DEFAULT_DIR: Record<SortKey, SortDir> = {
  ref: "asc",
  applicant: "asc",
  product: "asc",
  ltv: "desc",
  loan: "desc",
  stage: "asc",
  age: "desc",
  owner: "asc",
  hold: "asc",
};

function compare(a: CaseRow, b: CaseRow, key: SortKey, marks: Map<string, Mark>): number {
  const ownerOf = (r: CaseRow) => marks.get(r.id)?.owner ?? r.owner;
  switch (key) {
    case "ref":
      return a.id.localeCompare(b.id);
    case "applicant":
      return a.applicant.localeCompare(b.applicant);
    case "product":
      return a.product.localeCompare(b.product);
    case "ltv":
      return a.ltv - b.ltv;
    case "loan":
      return a.loan - b.loan;
    case "stage":
      return a.stage - b.stage;
    case "age":
      return a.overSla - b.overSla;
    case "owner":
      return ownerOf(a).name.localeCompare(ownerOf(b).name);
    case "hold":
      return (a.holdReason ?? "~").localeCompare(b.holdReason ?? "~");
  }
}

interface Mark {
  chased?: number;
  escalated?: number;
  owner?: Owner;
}

const OWNER_BY_ID = new Map(OWNERS.map((o) => [o.id, o]));

function replay(ops: CaseOp[]): Map<string, Mark> {
  const marks = new Map<string, Mark>();
  for (const op of ops) {
    for (const id of op.ids) {
      const m = marks.get(id) ?? {};
      if (op.kind === "chase") m.chased = op.at;
      else if (op.kind === "escalate") m.escalated = op.at;
      else m.owner = OWNER_BY_ID.get(op.to);
      marks.set(id, m);
    }
  }
  return marks;
}

const TEAMS = [...new Set(OWNERS.map((o) => o.team))];

export function CaseList({
  rows,
  stage,
  breachesOnly,
  onClearStage,
  onShowAll,
  ops,
  onOps,
}: {
  rows: CaseRow[];
  stage: Stage | null;
  breachesOnly: boolean;
  onClearStage: () => void;
  onShowAll: () => void;
  ops: CaseOp[];
  onOps: (ops: CaseOp[]) => void;
}) {
  const [sort, setSort] = useState<Sort>({ key: "age", dir: "desc" });
  const [limit, setLimit] = useState(PAGE);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [assignOpen, setAssignOpen] = useState(false);
  const [dismissed, setDismissed] = useState<CaseOp | null>(null);

  const marks = useMemo(() => replay(ops), [ops]);

  const sorted = useMemo(() => {
    const m = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => m * compare(a, b, sort.key, marks) || b.overSla - a.overSla || a.id.localeCompare(b.id));
  }, [rows, sort, marks]);

  const visible = sorted.slice(0, limit);
  const selected = useMemo(() => rows.filter((r) => picked.has(r.id)), [rows, picked]);
  const selIds = selected.map((r) => r.id);
  const pageAll = visible.length > 0 && visible.every((r) => picked.has(r.id));
  const pageSome = visible.some((r) => picked.has(r.id));

  useEffect(() => {
    if (!assignOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-mp-assign]")) setAssignOpen(false);
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
        if (on) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });
  const clearSel = () => {
    setPicked(new Set());
    setAssignOpen(false);
  };

  const act = (op: CaseOp) => {
    onOps([...ops, op]);
    clearSel();
  };
  const last = ops[ops.length - 1];
  const notice = last && last !== dismissed ? last : null;
  const noticeText = (op: CaseOp) => {
    const n = `${int(op.ids.length)} case${op.ids.length === 1 ? "" : "s"}`;
    if (op.kind === "chase") return `${n} chased at ${timeShort(op.at)}`;
    if (op.kind === "escalate") return `${n} escalated to the ops lead`;
    return `${n} reassigned to ${OWNER_BY_ID.get(op.to)?.name ?? "—"}`;
  };

  const sortBy = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: DEFAULT_DIR[key] }));

  const breaches = rows.filter((r) => r.breach).length;
  const value = rows.reduce((s, r) => s + r.loan, 0);
  const title = stage ? `${stage.label} cases` : "Ageing cases";
  const scopeLine = stage
    ? breachesOnly
      ? `Open cases in ${stage.label} past its ${stage.sla}-day SLA`
      : `Every open case in ${stage.label} · SLA ${stage.sla} business days`
    : breachesOnly
      ? "Open cases past their stage SLA, across all six stages"
      : "Every open case, longest past SLA first";

  return (
    <section className="flex flex-col border border-neutral-200 bg-white" aria-labelledby="mp-cases-title">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-neutral-100 px-4 py-3">
        <div>
          <h2 id="mp-cases-title" className="text-sm font-semibold text-neutral-900">
            {title}
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {scopeLine} · sorted {sort.key === "age" ? "by days past SLA" : `by ${COLUMNS.find((c) => c.key === sort.key)?.label.toLowerCase()}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <dl className="flex items-baseline gap-4 text-[11px]">
            {[
              { k: "Cases", v: int(rows.length) },
              { k: "Past SLA", v: int(breaches) },
              { k: "Value", v: gbpCompact(value) },
            ].map((s) => (
              <div key={s.k} className="flex items-baseline gap-1.5">
                <dt className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">{s.k}</dt>
                <dd className="font-mono font-semibold text-neutral-800 tabular-nums">{s.v}</dd>
              </div>
            ))}
          </dl>
          {stage && (
            <button
              type="button"
              onClick={onClearStage}
              className={`border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-800 hover:border-neutral-900 ${FOCUS}`}
            >
              Clear stage
            </button>
          )}
        </div>
      </header>

      <div aria-live="polite">
        {notice && (
          <div className="flex items-center gap-3 border-b border-neutral-200 bg-neutral-100 px-4 py-1.5 text-xs text-neutral-800">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M3.5 8.5l3 3 6-7" />
            </svg>
            <span className="min-w-0 flex-1">{noticeText(notice)}</span>
            <button
              type="button"
              onClick={() => onOps(ops.slice(0, -1))}
              className={`font-semibold underline underline-offset-2 hover:text-neutral-950 ${FOCUS}`}
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => setDismissed(notice)}
              aria-label="Dismiss"
              className={`text-neutral-500 hover:text-neutral-900 ${FOCUS}`}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={stage ? `No cases past SLA in ${stage.label}` : "Nothing past SLA in this slice"}
          body={
            stage
              ? `Every open ${stage.label.toLowerCase()} case is inside its ${stage.sla}-day SLA for this channel and product.`
              : "No open case is past its stage SLA for this channel and product combination."
          }
          action={
            <div className="flex gap-2">
              {breachesOnly && (
                <button
                  type="button"
                  onClick={onShowAll}
                  className={`border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-800 hover:border-neutral-900 ${FOCUS}`}
                >
                  Show all open cases
                </button>
              )}
              {stage && (
                <button
                  type="button"
                  onClick={onClearStage}
                  className={`border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-800 hover:border-neutral-900 ${FOCUS}`}
                >
                  Clear stage
                </button>
              )}
            </div>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-xs" style={{ minWidth: 1040 }}>
            <caption className="sr-only">{scopeLine}</caption>
            <colgroup>
              <col style={{ width: 34 }} />
              <col style={{ width: 104 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 118 }} />
              <col style={{ width: 62 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 132 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 130 }} />
              <col />
            </colgroup>
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/70">
                <th scope="col" className="py-2 pl-4">
                  <Check
                    checked={pageAll}
                    indeterminate={!pageAll && pageSome}
                    onChange={togglePage}
                    label="Select all cases shown"
                  />
                </th>
                {COLUMNS.map((c) => (
                  <SortTh
                    key={c.key}
                    label={c.label}
                    active={sort.key === c.key}
                    dir={sort.dir}
                    align={c.right ? "right" : "left"}
                    onClick={() => sortBy(c.key)}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {visible.map((r) => {
                const sel = picked.has(r.id);
                const mark = marks.get(r.id);
                const owner = mark?.owner ?? r.owner;
                const frac = Math.min(1, r.daysInStage / (r.stageDef.sla * 2));
                const slaFrac = 0.5;
                const tone = r.breach ? "bad" : r.overSla > -0.5 ? "warn" : "ok";
                return (
                  <tr key={r.id} className={sel ? "bg-neutral-100" : "hover:bg-neutral-50"} aria-selected={sel}>
                    <td className="py-2 pl-4">
                      <Check checked={sel} onChange={(on) => toggle(r.id, on)} label={`Select ${r.id}`} />
                    </td>
                    <td className="px-2 py-1.5 font-mono tabular-nums">
                      <div className="text-[11px] text-neutral-800">{r.id}</div>
                      <div className="text-[10px] text-neutral-400">{dateShort(r.appliedAt)}</div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="truncate text-[11px] text-neutral-800">{r.applicant}</div>
                      <div className="truncate text-[10px] text-neutral-400">{r.introducer.name}</div>
                    </td>
                    <td className="px-2 py-1.5 text-[11px] text-neutral-800">{r.product}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[11px] text-neutral-700 tabular-nums">{pct(r.ltv, 1)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[11px] text-neutral-800 tabular-nums">{gbpCompact(r.loan)}</td>
                    <td className="px-2 py-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] text-neutral-800">
                        <span className="font-mono text-[10px] text-neutral-400 tabular-nums">{r.stage + 1}</span>
                        <span className="truncate">{STAGES[r.stage].label}</span>
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-baseline justify-between gap-2 text-[11px]">
                        <span className="font-mono text-neutral-800 tabular-nums">
                          {days(r.daysInStage)}
                          <span className="text-neutral-400"> / {r.stageDef.sla}d</span>
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 font-mono text-[10px] font-medium tabular-nums ${
                            tone === "bad" ? "text-rose-700" : tone === "warn" ? "text-amber-700" : "text-neutral-500"
                          }`}
                        >
                          {tone === "bad" && <AlertIcon color={STATUS.bad} className="h-2.5 w-2.5" />}
                          {daysSigned(r.overSla)}
                        </span>
                      </div>
                      <div className="relative mt-1 h-1 bg-neutral-100" aria-hidden>
                        <div
                          className={`h-full ${tone === "bad" ? "bg-rose-600" : tone === "warn" ? "bg-amber-500" : "bg-neutral-400"}`}
                          style={{ width: `${frac * 100}%` }}
                        />
                        <div className="absolute inset-y-[-1px] w-px bg-neutral-900" style={{ left: `${slaFrac * 100}%` }} />
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="truncate text-[11px] text-neutral-800">{owner.name}</div>
                      <div className="truncate text-[10px] text-neutral-400">
                        {mark?.owner ? "Reassigned · " : ""}
                        {owner.team}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap items-center gap-1">
                        {r.holdReason ? (
                          <span className="inline-block border border-neutral-200 bg-white px-1.5 py-px text-[10px] font-medium text-neutral-700">
                            {HOLD_SHORT[r.holdReason]}
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-400">—</span>
                        )}
                        {mark?.chased && (
                          <span className="inline-block border border-neutral-900 bg-neutral-900 px-1.5 py-px text-[9px] font-semibold text-white uppercase">
                            Chased {timeShort(mark.chased)}
                          </span>
                        )}
                        {mark?.escalated && (
                          <span className="inline-block border border-rose-200 bg-rose-50 px-1.5 py-px text-[9px] font-semibold text-rose-800 uppercase">
                            Escalated
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-500">
          <span>
            Showing <span className="font-mono text-neutral-800 tabular-nums">{int(visible.length)}</span> of{" "}
            <span className="font-mono text-neutral-800 tabular-nums">{int(rows.length)}</span>
          </span>
          {visible.length < rows.length && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className={`border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-800 hover:border-neutral-900 ${FOCUS}`}
            >
              Show {int(Math.min(PAGE, rows.length - visible.length))} more
            </button>
          )}
        </footer>
      )}

      {selected.length > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="sticky bottom-0 z-20 flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white"
        >
          <span className="px-1 font-semibold">
            <span className="font-mono tabular-nums">{int(selected.length)}</span> selected
          </span>
          {selected.length < rows.length && (
            <button
              type="button"
              onClick={() => setPicked(new Set(rows.map((r) => r.id)))}
              className={`px-1 text-neutral-400 underline underline-offset-2 hover:text-white ${FOCUS}`}
            >
              Select all {int(rows.length)}
            </button>
          )}
          <span className="px-1 text-neutral-600" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={() => act({ kind: "chase", ids: selIds, at: Date.now() })}
            title="Send a chase to the party holding the case"
            className={`border border-neutral-700 px-2 py-1 font-medium hover:bg-neutral-800 ${FOCUS}`}
          >
            Chase
          </button>
          <div className="relative" data-mp-assign>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={assignOpen}
              onClick={() => setAssignOpen((o) => !o)}
              className={`inline-flex items-center gap-1 border border-neutral-700 px-2 py-1 font-medium hover:bg-neutral-800 ${FOCUS}`}
            >
              Reassign <span aria-hidden>▾</span>
            </button>
            {assignOpen && (
              <div
                role="menu"
                className="absolute bottom-full left-0 z-30 mb-1 max-h-72 w-60 overflow-y-auto border border-neutral-200 bg-white py-1 text-neutral-800 shadow-lg shadow-neutral-900/20"
              >
                {TEAMS.map((team) => (
                  <div key={team}>
                    <div className="px-3 pt-1.5 pb-1 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">{team}</div>
                    {OWNERS.filter((o) => o.team === team).map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        role="menuitem"
                        onClick={() => act({ kind: "reassign", ids: selIds, at: Date.now(), to: o.id })}
                        className={`flex w-full items-center px-3 py-1.5 text-left hover:bg-neutral-100 ${FOCUS}`}
                      >
                        {o.name}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => act({ kind: "escalate", ids: selIds, at: Date.now() })}
            title="Flag to the underwriting ops lead"
            className={`bg-white px-2 py-1 font-medium text-neutral-900 hover:bg-neutral-200 ${FOCUS}`}
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
