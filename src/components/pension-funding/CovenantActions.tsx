import { useMemo, useState } from "react";
import {
  ACTIONS,
  ACTION_OWNERS,
  CONTRIBUTION_SCHEDULE,
  COVENANT,
  SCHEME,
  isOverdue,
  type ActionOwner,
  type ActionStatus,
  type TrusteeAction,
} from "./model";
import { FOCUS, STATUS, dateMid, gbpM } from "./format";
import { ActionChip, CardHeader, Chip, EmptyState, GhostButton, MicroLabel, Seg, Swatch } from "./ui";

/* 05 · Covenant and actions: the sponsor covenant register on the left,
 * the trustee actions list on the right. The actions list has a status
 * Seg and owner chips as table-scoped filters; overdue is derived from
 * the reporting month-end so it moves with the header select. */

const TH = "px-3 py-2 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase whitespace-nowrap";

/* ------------------------------------------------------------------ *
 * Covenant register
 * ------------------------------------------------------------------ */

export function CovenantRegister({ asOf }: { asOf: number }) {
  const paid = CONTRIBUTION_SCHEDULE.filter((r) => r.status === "Paid").reduce((s, r) => s + r.amount, 0);
  const due = CONTRIBUTION_SCHEDULE.filter((r) => r.status !== "Paid").reduce((s, r) => s + r.amount, 0);
  return (
    <section aria-labelledby="pf-covenant-title" className="flex h-full flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="pf-covenant-title"
        title="Sponsor covenant"
        sub={`${SCHEME.sponsor} · ${COVENANT.assessed}`}
      />
      <div className="flex items-stretch gap-4 px-4 pt-4 lg:px-5">
        <div className="flex flex-col justify-center bg-neutral-900 px-4 py-3 text-white">
          <span className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Covenant grade</span>
          <span className="mt-1 text-[34px] leading-none font-semibold tracking-tight">{COVENANT.grade}</span>
          <span className="mt-1 text-xs text-neutral-300">{COVENANT.gradeLabel}</span>
        </div>
        <dl className="flex flex-1 flex-col justify-center gap-2 text-[11px]">
          <div>
            <dt className="text-neutral-500">Credit rating</dt>
            <dd className="font-medium text-neutral-800">{COVENANT.rating}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Contingent asset</dt>
            <dd className="font-medium text-neutral-800">{COVENANT.guarantee}</dd>
          </div>
        </dl>
      </div>

      <dl className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100">
        {COVENANT.metrics.map((m) => (
          <div key={m.label} className="flex items-center justify-between gap-3 px-4 py-2 lg:px-5">
            <dt className="flex min-w-0 items-center gap-2">
              <Swatch color={m.tone === "good" ? STATUS.good : m.tone === "warn" ? STATUS.warn : STATUS.neutral} className="h-2 w-2" />
              <span className="min-w-0">
                <span className="block text-[11px] font-medium text-neutral-700">{m.label}</span>
                <span className="block truncate text-[10px] text-neutral-500">{m.note}</span>
              </span>
            </dt>
            <dd className="shrink-0 text-right">
              <span className="block font-mono text-sm font-semibold text-neutral-900 tabular-nums">{m.value}</span>
              <span className="block font-mono text-[10px] text-neutral-400 tabular-nums">{m.prior}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-auto border-t border-neutral-200">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-3 lg:px-5">
          <MicroLabel>Contribution schedule</MicroLabel>
          <span className="text-[11px] text-neutral-500">
            <span className="font-mono font-semibold text-neutral-800 tabular-nums">{gbpM(paid)}</span> paid ·{" "}
            <span className="font-mono font-semibold text-neutral-800 tabular-nums">{gbpM(due)}</span> due or scheduled
          </span>
        </div>
        <table className="mt-1.5 w-full text-left">
          <caption className="sr-only">Schedule of contributions with payment status</caption>
          <thead className="border-b border-neutral-100">
            <tr>
              <th scope="col" className={TH}>Payment</th>
              <th scope="col" className={TH}>Due</th>
              <th scope="col" className={`${TH} text-right`}>£m</th>
              <th scope="col" className={TH}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {CONTRIBUTION_SCHEDULE.map((r) => {
              const late = r.status === "Due" && r.due < asOf;
              return (
                <tr key={`${r.label}-${r.due}`}>
                  <th scope="row" className="px-3 py-1.5 text-[11px] font-medium text-neutral-800">{r.label}</th>
                  <td className={`px-3 py-1.5 font-mono text-[11px] tabular-nums whitespace-nowrap ${late ? "text-rose-700" : "text-neutral-600"}`}>
                    {dateMid(r.due)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-[11px] font-semibold text-neutral-900 tabular-nums">{gbpM(r.amount)}</td>
                  <td className="px-3 py-1.5">
                    <Chip tone={r.status === "Paid" ? "good" : late ? "bad" : r.status === "Due" ? "warn" : "neutral"} size="sm">
                      {late ? "Late" : r.status}
                    </Chip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Trustee actions
 * ------------------------------------------------------------------ */

type StatusFilter = "all" | ActionStatus;
type SortKey = "due" | "title" | "owner" | "status";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const STATUS_RANK: Record<ActionStatus, number> = { Open: 0, "In progress": 1, Complete: 2 };

function compare(a: TrusteeAction, b: TrusteeAction, key: SortKey, asOf: number): number {
  switch (key) {
    case "due":
      return a.due - b.due;
    case "title":
      return a.title.localeCompare(b.title);
    case "owner":
      return a.owner.localeCompare(b.owner);
    case "status": {
      const ra = isOverdue(a, asOf) ? -1 : STATUS_RANK[a.status];
      const rb = isOverdue(b, asOf) ? -1 : STATUS_RANK[b.status];
      return ra - rb;
    }
  }
}

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "title", label: "Action" },
  { key: "owner", label: "Owner", className: "whitespace-nowrap" },
  { key: "due", label: "Due", className: "whitespace-nowrap" },
  { key: "status", label: "Status" },
];

export function ActionsRegister({ asOf }: { asOf: number }) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [owner, setOwner] = useState<ActionOwner | null>(null);
  const [sort, setSort] = useState<Sort>({ key: "due", dir: "asc" });

  const rows = useMemo(() => {
    const m = sort.dir === "asc" ? 1 : -1;
    return ACTIONS.filter((a) => (status === "all" || a.status === status) && (owner === null || a.owner === owner)).sort(
      (a, b) => m * compare(a, b, sort.key, asOf) || a.due - b.due || a.id.localeCompare(b.id),
    );
  }, [status, owner, sort, asOf]);

  const open = ACTIONS.filter((a) => a.status !== "Complete");
  const overdue = open.filter((a) => isOverdue(a, asOf));
  const ownerCounts = new Map<ActionOwner, number>();
  for (const a of ACTIONS) if (status === "all" || a.status === status) ownerCounts.set(a.owner, (ownerCounts.get(a.owner) ?? 0) + 1);

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));

  return (
    <section aria-labelledby="pf-actions-title" className="flex h-full flex-col border border-neutral-200 bg-white">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-neutral-100 px-4 py-3 lg:px-5">
        <div>
          <h3 id="pf-actions-title" className="text-sm font-semibold text-neutral-900">
            Trustee actions
          </h3>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {open.length} open of {ACTIONS.length} · {overdue.length} overdue at {dateMid(asOf)} · sorted by {sort.key === "due" ? "due date" : sort.key}
          </p>
        </div>
        <Seg<StatusFilter>
          label="Status"
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All" },
            { value: "Open", label: "Open" },
            { value: "In progress", label: "In progress" },
            { value: "Complete", label: "Complete" },
          ]}
        />
      </header>

      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-1 lg:px-5" role="group" aria-label="Filter actions by owner">
        <MicroLabel className="mr-1">Owner</MicroLabel>
        {ACTION_OWNERS.map((o) => {
          const n = ownerCounts.get(o) ?? 0;
          const on = owner === o;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              disabled={n === 0 && !on}
              onClick={() => setOwner(on ? null : o)}
              className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] font-medium transition ${FOCUS} disabled:cursor-not-allowed disabled:opacity-40 ${
                on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
              }`}
            >
              {o}
              <span className={`font-mono tabular-nums ${on ? "text-neutral-300" : "text-neutral-400"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left">
          <caption className="sr-only">Trustee actions with owner, due date and status</caption>
          <thead className="border-b border-neutral-200 bg-neutral-50/70">
            <tr>
              {COLUMNS.map((c) => {
                const on = sort.key === c.key;
                return (
                  <th key={c.key} scope="col" aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={`${TH} ${c.className ?? ""}`}>
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={`inline-flex items-center gap-1 uppercase ${FOCUS} ${on ? "text-neutral-900" : "hover:text-neutral-800"}`}
                    >
                      {c.label}
                      <span aria-hidden className={`font-mono ${on ? "text-neutral-900" : "text-neutral-300"}`}>
                        {on ? (sort.dir === "asc" ? "▲" : "▼") : "△"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-6">
                  <EmptyState
                    title="No actions match"
                    action={
                      <GhostButton
                        onClick={() => {
                          setOwner(null);
                          setStatus("all");
                        }}
                      >
                        Clear filters
                      </GhostButton>
                    }
                  >
                    {owner ? `${owner} has no ${status === "all" ? "" : status.toLowerCase() + " "}actions.` : `No ${status.toLowerCase()} actions.`}
                  </EmptyState>
                </td>
              </tr>
            ) : (
              rows.map((a) => {
                const late = isOverdue(a, asOf);
                return (
                  <tr key={a.id} className="align-top hover:bg-neutral-50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[10px] text-neutral-400 tabular-nums">{a.id}</span>
                        <span className="text-[12px] font-medium text-neutral-900">{a.title}</span>
                      </div>
                      <p className="mt-0.5 max-w-[420px] text-[11px] leading-snug text-neutral-500">{a.detail}</p>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] whitespace-nowrap text-neutral-700">{a.owner}</td>
                    <td className={`px-3 py-2.5 font-mono text-[11px] tabular-nums whitespace-nowrap ${late ? "font-semibold text-rose-700" : "text-neutral-700"}`}>
                      {dateMid(a.due)}
                    </td>
                    <td className="px-3 py-2.5">
                      <ActionChip status={a.status} overdue={late} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && (status !== "all" || owner !== null) && (
        <div className="mt-auto border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-500 lg:px-5">
          Showing {rows.length} of {ACTIONS.length} actions.
        </div>
      )}
    </section>
  );
}
