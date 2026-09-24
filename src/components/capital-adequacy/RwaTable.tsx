import { Fragment, useState } from "react";
import { BUSINESS_GROUPS, LEAVES, RISK_TYPES, type LeafId, type RiskType, type Snapshot } from "./model";
import { num, pct, signed, toneOf } from "./format";
import { Delta, FOCUS } from "./ui";

/* Section 3 signature table: RWAs by business line x risk type.
 *
 * Group rows are subtotals and expand into their business lines; the grand
 * total reconciles to the reporting-date column of the stacked chart above
 * it (checked, not assumed). Business lines an entity doesn't carry are
 * dropped, and a group with a single line has nothing to expand. */

interface Row {
  exposure: number;
  rwa: Record<RiskType, number>;
  total: number;
  prevTotal: number | null;
}

const EMPTY_RISK = (): Record<RiskType, number> => ({ credit: 0, ccr: 0, cva: 0, market: 0, op: 0 });

function aggregate(leaves: LeafId[], cur: Snapshot, prev: Snapshot | null): Row {
  const rwa = EMPTY_RISK();
  let exposure = 0;
  let total = 0;
  let prevTotal: number | null = prev ? 0 : null;
  for (const l of leaves) {
    const v = cur.leaves[l];
    exposure += v.exposure;
    total += v.total;
    for (const rt of RISK_TYPES) rwa[rt.id] += v.rwa[rt.id];
    if (prev && prevTotal !== null) prevTotal += prev.leaves[l].total;
  }
  return { exposure, rwa, total, prevTotal };
}

const LEAF_LABEL = Object.fromEntries(LEAVES.map((l) => [l.id, l.label])) as Record<LeafId, string>;

const TD = "px-2 py-2 text-right font-mono tabular-nums";

export function RwaTable({
  current,
  compare,
  compareLabel,
  chartTotal,
}: {
  current: Snapshot;
  compare: Snapshot | null;
  compareLabel: string;
  chartTotal: number;
}) {
  const groups = BUSINESS_GROUPS.map((g) => ({
    ...g,
    leaves: g.leaves.filter((l) => current.present[l]),
  })).filter((g) => g.leaves.length > 0);
  const expandable = groups.filter((g) => g.leaves.length > 1);

  const [open, setOpen] = useState<Record<string, boolean>>({ retail: true, commercial: false, cib: true });
  const allOpen = expandable.every((g) => open[g.id]);
  const setAll = (v: boolean) => setOpen(Object.fromEntries(expandable.map((g) => [g.id, v])));

  const grand = aggregate(
    groups.flatMap((g) => g.leaves),
    current,
    compare,
  );
  const diff = grand.total - chartTotal;
  const reconciles = Math.abs(diff) < 0.005;

  const cells = (r: Row, strong: boolean) => {
    const density = r.exposure > 0 ? (r.total / r.exposure) * 100 : 0;
    const d = r.prevTotal === null ? null : r.total - r.prevTotal;
    const w = strong ? "font-semibold text-neutral-900" : "text-neutral-700";
    return (
      <>
        <td className={`${TD} ${w}`}>{num(r.exposure, 1)}</td>
        {RISK_TYPES.map((rt) => (
          <td key={rt.id} className={`${TD} ${r.rwa[rt.id] < 0.05 ? "text-neutral-300" : w}`}>
            {r.rwa[rt.id] < 0.05 ? "–" : num(r.rwa[rt.id], 1)}
          </td>
        ))}
        <td className={`${TD} border-l border-neutral-100 font-semibold text-neutral-900`}>{num(r.total, 1)}</td>
        <td className={`${TD} ${w}`}>
          <span className="inline-flex items-center justify-end gap-2">
            <span aria-hidden className="relative inline-block h-1.5 w-10 bg-neutral-100">
              <span
                className="absolute inset-y-0 left-0 bg-blue-900/70"
                style={{ width: `${Math.min(100, density)}%` }}
              />
            </span>
            {pct(density, 1)}
          </span>
        </td>
        <td className={`${TD}`}>
          {d === null ? (
            <span className="text-neutral-300">—</span>
          ) : (
            <Delta text={signed(d, 2)} tone={toneOf(d, false, 0.005)} srLabel="£bn RWA change" />
          )}
        </td>
      </>
    );
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-neutral-500">
          £bn · exposure is EAD after credit risk mitigation · RWA growth consumes capital, so increases show as adverse.
        </p>
        {expandable.length > 0 && (
          <button
            type="button"
            onClick={() => setAll(!allOpen)}
            className={`border border-neutral-300 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 ${FOCUS}`}
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-xs">
          <caption className="sr-only">
            Risk-weighted assets by business line and risk type, £bn, with change versus {compareLabel}
          </caption>
          <colgroup>
            <col />
            <col style={{ width: 76 }} />
            {RISK_TYPES.map((rt) => (
              <col key={rt.id} style={{ width: 64 }} />
            ))}
            <col style={{ width: 86 }} />
            <col style={{ width: 104 }} />
            <col style={{ width: 96 }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" rowSpan={2} className="border-b border-neutral-300 px-2 pb-1.5 text-left align-bottom text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
                Business line
              </th>
              <th scope="col" rowSpan={2} className="border-b border-neutral-300 px-2 pb-1.5 text-right align-bottom text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
                Exposure
              </th>
              <th scope="colgroup" colSpan={5} className="border-b border-neutral-200 px-2 pb-1 text-center text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
                RWA by risk type
              </th>
              <th scope="col" rowSpan={2} className="border-b border-l border-neutral-300 border-l-neutral-100 px-2 pb-1.5 text-right align-bottom text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
                Total RWA
              </th>
              <th scope="col" rowSpan={2} className="border-b border-neutral-300 px-2 pb-1.5 text-right align-bottom text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
                Density
              </th>
              <th scope="col" rowSpan={2} className="border-b border-neutral-300 px-2 pb-1.5 text-right align-bottom text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
                Δ vs {compareLabel}
              </th>
            </tr>
            <tr>
              {RISK_TYPES.map((rt) => (
                <th
                  key={rt.id}
                  scope="col"
                  className="border-b border-neutral-300 px-2 py-1.5 text-right text-[10px] font-semibold tracking-wider text-neutral-500 uppercase"
                >
                  {rt.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const multi = g.leaves.length > 1;
              const isOpen = multi && !!open[g.id];
              const row = aggregate(g.leaves, current, compare);
              return (
                <Fragment key={g.id}>
                  <tr className="border-b border-neutral-100 bg-neutral-50/70">
                    <th scope="row" className="px-2 py-2 text-left font-semibold text-neutral-900">
                      {multi ? (
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => setOpen((o) => ({ ...o, [g.id]: !o[g.id] }))}
                          className={`-mx-1 inline-flex items-center gap-1.5 px-1 hover:text-blue-900 ${FOCUS}`}
                        >
                          <svg
                            viewBox="0 0 12 12"
                            aria-hidden
                            className={`h-3 w-3 text-neutral-500 transition-transform ${isOpen ? "rotate-90" : ""}`}
                          >
                            <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                          </svg>
                          {g.label}
                          <span className="font-normal text-neutral-400">({g.leaves.length})</span>
                        </button>
                      ) : (
                        <span className="pl-[18px]">{g.label}</span>
                      )}
                    </th>
                    {cells(row, true)}
                  </tr>
                  {isOpen &&
                    g.leaves.map((l) => (
                      <tr
                        key={l}
                        className="border-b border-neutral-100 hover:bg-blue-50/40"
                      >
                        <th scope="row" className="py-2 pr-2 pl-9 text-left font-normal text-neutral-700">
                          {LEAF_LABEL[l]}
                        </th>
                        {cells(aggregate([l], current, compare), false)}
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-800">
              <th scope="row" className="px-2 py-2.5 pl-[26px] text-left font-semibold text-neutral-950">
                Total
              </th>
              {cells(grand, true)}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className={`mt-2 flex items-center gap-1.5 text-[11px] ${reconciles ? "text-neutral-500" : "text-rose-700"}`}>
        <span aria-hidden className={reconciles ? "text-emerald-700" : ""}>
          {reconciles ? "✓" : "✕"}
        </span>
        {reconciles
          ? `Total RWAs of £${num(grand.total, 1)}bn reconcile to the reporting-date column of the chart above.`
          : `Total differs from the chart by £${num(diff, 2)}bn.`}
      </p>
    </div>
  );
}
