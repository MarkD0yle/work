import type { Basis, Cause, Confidence, ExceptionRow, Scope } from "./model";
import { CAUSES, DESK_BY_ID, SCOPE_LABEL } from "./model";
import { CAUSE_COLOR, FOCUS, STATUS, dateLong, gbpM, times } from "./format";
import { CauseChip, MicroLabel, SignOffBadge, Swatch } from "./ui";

/* The exception log. Its root-cause chips are a table-only filter (the
 * header filters scope everything; these scope just the rows), so they sit
 * in the card and say so. The count before the chip filter always equals
 * the traffic-light count. */

const TH = "px-3 py-2 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase whitespace-nowrap";
const NUM = "px-3 py-2.5 text-right font-mono text-[11px] tabular-nums whitespace-nowrap";

function PnlCell({ value, breached }: { value: number; breached: boolean }) {
  return (
    <td className={`${NUM} ${breached ? "font-semibold text-neutral-950" : "text-neutral-500"}`}>
      <span className="inline-flex items-center justify-end gap-1.5">
        {breached && (
          <span title="Loss exceeds VaR">
            <Swatch color={STATUS.bad} className="h-2 w-2" />
            <span className="sr-only">exceeds VaR: </span>
          </span>
        )}
        {gbpM(value)}
      </span>
    </td>
  );
}

export function ExceptionLog({
  rows,
  scope,
  basis,
  conf,
  win,
  cause,
  onCause,
}: {
  rows: ExceptionRow[];
  scope: Scope;
  basis: Basis;
  conf: Confidence;
  win: string;
  cause: Cause | "all";
  onCause: (c: Cause | "all") => void;
}) {
  const counts = new Map<Cause, number>();
  for (const r of rows) counts.set(r.cause, (counts.get(r.cause) ?? 0) + 1);
  const shown = cause === "all" ? rows : rows.filter((r) => r.cause === cause);
  const chips: { id: Cause | "all"; label: string; n: number; color?: string }[] = [
    { id: "all", label: "All causes", n: rows.length },
    ...CAUSES.map((c) => ({ id: c, label: c, n: counts.get(c) ?? 0, color: CAUSE_COLOR[c] })),
  ];

  return (
    <section aria-labelledby="vb-log-title" className="border border-neutral-200 bg-white">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-neutral-100 px-4 py-3">
        <div>
          <h2 id="vb-log-title" className="text-sm font-semibold text-neutral-900">
            Exception log
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {rows.length} exception{rows.length === 1 ? "" : "s"} · {SCOPE_LABEL[scope]} ·{" "}
            {basis === "hypo" ? "hypothetical" : "actual"} P&amp;L · {conf}% · {win} days · newest first.
            <span className="ml-2 inline-flex items-center gap-1 align-middle">
              <Swatch color={STATUS.bad} className="h-2 w-2" /> marks the P&amp;L that breached VaR
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <MicroLabel>Table filter · Root cause</MicroLabel>
          <div role="group" aria-label="Filter the exception log by root cause" className="flex flex-wrap gap-1.5">
            {chips.map((c) => {
              const on = cause === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  disabled={c.n === 0 && c.id !== "all"}
                  onClick={() => onCause(on && c.id !== "all" ? "all" : c.id)}
                  className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[11px] font-medium transition ${FOCUS} disabled:cursor-not-allowed disabled:opacity-40 ${
                    on
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                  }`}
                >
                  {c.color && <Swatch color={c.color} className="h-2 w-2" />}
                  {c.label}
                  <span className={`font-mono tabular-nums ${on ? "text-neutral-300" : "text-neutral-400"}`}>{c.n}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left">
          <caption className="sr-only">
            VaR exceptions for {SCOPE_LABEL[scope]}, newest first
          </caption>
          <thead className="border-b border-neutral-200 bg-neutral-50/70">
            <tr>
              <th scope="col" className={TH}>Date</th>
              <th scope="col" className={TH}>Desk</th>
              <th scope="col" className={`${TH} text-right`}>VaR {conf}%</th>
              <th scope="col" className={`${TH} text-right`}>Hypo P&amp;L</th>
              <th scope="col" className={`${TH} text-right`}>Actual P&amp;L</th>
              <th scope="col" className={`${TH} text-right`}>Excess</th>
              <th scope="col" className={`${TH} text-right`}>Loss ÷ VaR</th>
              <th scope="col" className={TH}>Root cause</th>
              <th scope="col" className={TH}>Explanation</th>
              <th scope="col" className={TH}>Sign-off</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {shown.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center">
                  <div className="text-sm font-medium text-neutral-700">
                    {rows.length === 0
                      ? "No exceptions in this window"
                      : `No ${cause === "all" ? "" : cause.toLowerCase() + " "}exceptions in this slice`}
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    {rows.length === 0
                      ? `The ${basis === "hypo" ? "hypothetical" : "actual"} loss never exceeded ${conf}% VaR for ${SCOPE_LABEL[scope]}. Too few exceptions can fail Kupiec too: the model may be conservative.`
                      : "Clear the root-cause table filter to see every exception."}
                  </div>
                  {rows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onCause("all")}
                      className={`mt-3 border border-neutral-300 px-2.5 py-1 text-[11px] font-medium text-neutral-800 hover:border-neutral-900 ${FOCUS}`}
                    >
                      Show all causes
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              shown.map((r) => (
                <tr key={r.key} className="align-top hover:bg-neutral-50">
                  <th scope="row" className="px-3 py-2.5 text-left text-[11px] font-medium whitespace-nowrap text-neutral-900">
                    {dateLong(r.t)}
                  </th>
                  <td className="px-3 py-2.5 text-[11px] whitespace-nowrap text-neutral-800">
                    {SCOPE_LABEL[r.scope]}
                    {r.driver && (
                      <span className="block text-[10px] text-neutral-500">led by {DESK_BY_ID[r.driver].label}</span>
                    )}
                  </td>
                  <td className={`${NUM} text-neutral-700`}>{gbpM(r.var)}</td>
                  <PnlCell value={r.hypo} breached={r.hypoExc} />
                  <PnlCell value={r.actual} breached={r.actualExc} />
                  <td className={`${NUM} font-semibold text-neutral-950`}>{gbpM(r.excess)}</td>
                  <td className={`${NUM} text-neutral-700`}>{times(r.excessX)}</td>
                  <td className="px-3 py-2.5">
                    <CauseChip cause={r.cause} />
                  </td>
                  <td className="max-w-[380px] min-w-[260px] px-3 py-2.5 text-[11px] leading-snug text-neutral-600">
                    {r.note}
                  </td>
                  <td className="px-3 py-2.5">
                    <SignOffBadge status={r.signoff} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {shown.length > 0 && cause !== "all" && (
        <div className="border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-500">
          Showing {shown.length} of {rows.length} exceptions. The traffic light still counts all {rows.length}.
        </div>
      )}
    </section>
  );
}
