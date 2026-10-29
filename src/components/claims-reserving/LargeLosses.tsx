import { Fragment, useMemo, useState } from "react";
import {
  LOB_LABEL,
  fmtDate,
  fmtMoney,
  fmtNum,
  type ClaimStatus,
  type LargeLoss,
} from "./model";
import { FOCUS, IconAlert, IconCheck, IconChevron, IconOpen, MicroLabel } from "./ui";

/* Large-loss register: every claim at or above £1m in the current slice.
 * Rows expand to the claim's reserve history and file notes. */

type SortKey = "ref" | "lossDate" | "incurred" | "paid" | "outstanding" | "ri" | "net" | "status";
const PAGE = 12;

const STATUS_STYLE: Record<ClaimStatus, { cls: string; Icon: typeof IconOpen }> = {
  Open: { cls: "border-amber-200 bg-amber-50 text-amber-800", Icon: IconOpen },
  Litigated: { cls: "border-rose-200 bg-rose-50 text-rose-700", Icon: IconAlert },
  Settled: { cls: "border-emerald-200 bg-emerald-50 text-emerald-700", Icon: IconCheck },
};
const STATUS_ORDER: Record<ClaimStatus, number> = { Litigated: 0, Open: 1, Settled: 2 };

export function StatusChip({ status }: { status: ClaimStatus }) {
  const { cls, Icon } = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      <Icon className="h-2.5 w-2.5" />
      {status}
    </span>
  );
}

function SortIcon({ state }: { state: 1 | -1 | 0 }) {
  return (
    <svg viewBox="0 0 8 12" className="h-3 w-2" aria-hidden="true">
      <path d="M4 1 7 5H1z" fill={state === 1 ? "#0f766e" : "#d4d4d4"} />
      <path d="M4 11 1 7h6z" fill={state === -1 ? "#0f766e" : "#d4d4d4"} />
    </svg>
  );
}

function Sparkline({ history, incurred }: { history: LargeLoss["history"]; incurred: number }) {
  const W = 260;
  const H = 64;
  const pad = { l: 4, r: 4, t: 8, b: 6 };
  const max = Math.max(incurred, ...history.map((h) => h.v)) * 1.08;
  const x = (k: number) => pad.l + (k / Math.max(1, history.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  // Reserves move in steps at review points, so draw a step line.
  let d = `M${x(0)},${y(history[0].v)}`;
  for (let k = 1; k < history.length; k++) d += ` H${x(k)} V${y(history[k].v)}`;
  const first = history[0];
  const last = history[history.length - 1];
  return (
    <figure className="m-0">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Incurred reserve from £${first.v.toFixed(2)}m in ${first.q} to £${last.v.toFixed(2)}m in ${last.q}`}>
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#e5e5e5" />
        <line x1={pad.l} x2={W - pad.r} y1={y(incurred)} y2={y(incurred)} stroke="#a3a3a3" strokeDasharray="3 3" />
        <path d={`${d} V${H - pad.b} H${x(0)} Z`} fill="rgba(13,148,136,0.10)" />
        <path d={d} fill="none" stroke="#0d9488" strokeWidth={2} />
        <rect x={x(history.length - 1) - 3.5} y={y(last.v) - 3.5} width={7} height={7} fill="#0d9488" stroke="#fff" strokeWidth={2} />
      </svg>
      <figcaption className="mt-1 flex justify-between font-mono text-[10px] text-neutral-500 tabular-nums" style={{ width: W }}>
        <span>{first.q} · £{first.v.toFixed(2)}m</span>
        <span>{last.q} · £{last.v.toFixed(2)}m</span>
      </figcaption>
    </figure>
  );
}

export function LargeLossRegister({ losses, scope }: { losses: LargeLoss[]; scope: string }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "incurred", dir: -1 });
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    const val = (l: LargeLoss): number | string =>
      sort.key === "status" ? STATUS_ORDER[l.status] : (l[sort.key] as number | string);
    return [...losses].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return c * sort.dir || b.incurred - a.incurred;
    });
  }, [losses, sort]);

  const shown = showAll ? sorted : sorted.slice(0, PAGE);
  const tot = losses.reduce(
    (a, l) => ({ inc: a.inc + l.incurred, net: a.net + l.net, ri: a.ri + l.ri, os: a.os + l.outstanding }),
    { inc: 0, net: 0, ri: 0, os: 0 },
  );
  const nOpen = losses.filter((l) => l.status !== "Settled").length;
  const nLit = losses.filter((l) => l.status === "Litigated").length;

  const cols: { key: SortKey | null; label: string; align: "left" | "right"; w?: number }[] = [
    { key: "ref", label: "Claim ref", align: "left", w: 128 },
    { key: null, label: "LOB", align: "left", w: 136 },
    { key: null, label: "Event / peril", align: "left" },
    { key: "lossDate", label: "Date of loss", align: "left", w: 104 },
    { key: "incurred", label: "Incurred", align: "right", w: 80 },
    { key: "paid", label: "Paid", align: "right", w: 72 },
    { key: "outstanding", label: "O/S reserve", align: "right", w: 84 },
    { key: "ri", label: "RI recovery", align: "right", w: 84 },
    { key: "net", label: "Net", align: "right", w: 72 },
    { key: "status", label: "Status", align: "left", w: 100 },
  ];

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "ref" || key === "status" ? 1 : -1 }));

  return (
    <section className="border border-neutral-200 bg-white" aria-labelledby="ll-title">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-neutral-100 px-4 py-3">
        <div>
          <h2 id="ll-title" className="text-sm font-semibold text-neutral-900">Large-loss register</h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {scope} · individual claims with incurred of £1m or more · £m · expand a row for its reserve history
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1">
          {[
            { k: "Claims", v: String(losses.length) },
            { k: "Incurred", v: fmtMoney(tot.inc) },
            { k: "Outstanding", v: fmtMoney(tot.os) },
            { k: "RI recovery", v: fmtMoney(tot.ri) },
            { k: "Net", v: fmtMoney(tot.net) },
            { k: "Open · litigated", v: `${nOpen} · ${nLit}` },
          ].map((s) => (
            <div key={s.k} className="flex flex-col">
              <dt className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">{s.k}</dt>
              <dd className="font-mono text-xs font-semibold text-neutral-900 tabular-nums">{s.v}</dd>
            </div>
          ))}
        </dl>
      </header>

      {losses.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
          <span className="text-sm font-medium text-neutral-700">No claims of £1m or more in this slice</span>
          <span className="text-[11px] text-neutral-500">Widen the accident-year range or switch to another line of business.</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-[11px]">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/70">
                <th scope="col" className="w-8 px-2 py-2">
                  <span className="sr-only">Expand</span>
                </th>
                {cols.map((c) => {
                  const on = c.key && sort.key === c.key;
                  return (
                    <th
                      key={c.label}
                      scope="col"
                      aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
                      className={`px-2 py-2 text-[10px] font-semibold tracking-wide whitespace-nowrap text-neutral-500 uppercase ${c.align === "right" ? "text-right" : "text-left"}`}
                      style={c.w ? { width: c.w } : undefined}
                    >
                      {c.key ? (
                        <button
                          type="button"
                          onClick={() => onSort(c.key as SortKey)}
                          className={`inline-flex items-center gap-1 uppercase hover:text-neutral-900 ${FOCUS} ${on ? "text-neutral-900" : ""}`}
                        >
                          {c.label}
                          <SortIcon state={on ? sort.dir : 0} />
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => {
                const isOpen = open === l.ref;
                const num = "px-2 py-2 text-right font-mono tabular-nums";
                return (
                  <Fragment key={l.ref}>
                    <tr
                      className={`border-b border-neutral-100 transition ${isOpen ? "bg-teal-50/70" : "hover:bg-neutral-50"}`}
                      style={isOpen ? { boxShadow: "inset 3px 0 0 #0d9488" } : undefined}
                    >
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={`ll-${l.ref}`}
                          aria-label={`${isOpen ? "Collapse" : "Expand"} ${l.ref}`}
                          onClick={() => setOpen(isOpen ? null : l.ref)}
                          className={`flex h-5 w-5 items-center justify-center border border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-900 ${FOCUS}`}
                        >
                          <IconChevron open={isOpen} className="h-2.5 w-2.5" />
                        </button>
                      </td>
                      <td className="px-2 py-2 font-mono text-neutral-800">{l.ref}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-neutral-600">{LOB_LABEL[l.lob]}</td>
                      <td className="px-2 py-2 text-neutral-800">{l.event}</td>
                      <td className="px-2 py-2 font-mono text-neutral-600 tabular-nums">{fmtDate(l.lossDate)}</td>
                      <td className={`${num} font-semibold text-neutral-900`}>{fmtNum(l.incurred, 2)}</td>
                      <td className={`${num} text-neutral-700`}>{fmtNum(l.paid, 2)}</td>
                      <td className={`${num} text-neutral-700`}>{l.outstanding > 0 ? fmtNum(l.outstanding, 2) : <span className="text-neutral-300">–</span>}</td>
                      <td className={`${num} text-neutral-700`}>{l.ri > 0 ? fmtNum(l.ri, 2) : <span className="text-neutral-300">–</span>}</td>
                      <td className={`${num} text-neutral-900`}>{fmtNum(l.net, 2)}</td>
                      <td className="px-2 py-2"><StatusChip status={l.status} /></td>
                    </tr>
                    {isOpen && (
                      <tr id={`ll-${l.ref}`} className="border-b border-neutral-200 bg-teal-50/30" style={{ boxShadow: "inset 3px 0 0 #0d9488" }}>
                        <td />
                        <td colSpan={cols.length} className="px-2 pt-3 pb-4">
                          <div className="grid gap-6 md:grid-cols-[auto_1fr]">
                            <div>
                              <MicroLabel className="text-neutral-400">Incurred reserve history</MicroLabel>
                              <div className="mt-2"><Sparkline history={l.history} incurred={l.incurred} /></div>
                              <p className="mt-2 text-[10px] text-neutral-500">{l.riBasis}</p>
                            </div>
                            <div>
                              <MicroLabel className="text-neutral-400">File notes</MicroLabel>
                              <ol className="mt-2 flex flex-col gap-2 border-l border-neutral-300 pl-3">
                                {l.notes.map((n, k) => (
                                  <li key={k} className="relative text-[11px] leading-snug text-neutral-700">
                                    <span className="absolute top-1 h-2 w-2 border border-white bg-teal-600" style={{ left: -16.5 }} aria-hidden="true" />
                                    <span className="mr-2 font-mono text-[10px] text-neutral-500 tabular-nums">{fmtDate(n.date)}</span>
                                    {n.text}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {sorted.length > PAGE && (
            <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-500">
              <span>
                Showing {shown.length} of {sorted.length}
              </span>
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className={`border border-neutral-300 px-2.5 py-1 font-medium text-neutral-700 hover:bg-neutral-100 ${FOCUS}`}
              >
                {showAll ? `Show top ${PAGE}` : `Show all ${sorted.length}`}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
