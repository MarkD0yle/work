import { useMemo, useState } from "react";
import { BANDS, PRODUCTS, aggregate, metrics as M, monthEnd, type Agg, type Segment } from "./model";
import { FOCUS, TONE_TEXT, countCompact, gbp, pct, signedPp, toneOf } from "./format";
import { Card, Sparkline } from "./chrome";

/* Segment league table: product groups with score-band rows, sortable by
 * any column (groups sort by their subtotal, bands within each group). */

type SortKey = "name" | "bal" | "acc" | "dpd30" | "npl" | "nco" | "d30";

interface LeagueRow {
  key: string;
  order: number;
  label: string;
  hint?: string;
  bal: number;
  acc: number;
  dpd30: number;
  npl: number;
  nco: number;
  d30: number;
  trend: number[];
}

function leagueRow(key: string, order: number, label: string, a: Agg, k: number, hint?: string): LeagueRow {
  return {
    key,
    order,
    label,
    hint,
    bal: a.bal[k],
    acc: a.acc[k],
    dpd30: M.dpd30(a, k),
    npl: M.npl(a, k),
    nco: M.nco(a, k),
    d30: M.dpd30(a, k) - M.dpd30(a, k - 1),
    trend: Array.from({ length: 12 }, (_, i) => M.dpd30(a, k - 11 + i)),
  };
}

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "name", label: "Segment", align: "left" },
  { key: "bal", label: "Balance", align: "right" },
  { key: "acc", label: "Accounts", align: "right" },
  { key: "dpd30", label: "30+ DPD", align: "right" },
  { key: "npl", label: "NPL 90+", align: "right" },
  { key: "nco", label: "NCO ann.", align: "right" },
  { key: "d30", label: "Δ30+ m/m", align: "right" },
];

export function LeagueTable({ segs, agg, asOf }: { segs: Segment[]; agg: Agg; asOf: number }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "dpd30",
    dir: "desc",
  });

  const groups = useMemo(() => {
    const out: { head: LeagueRow; children: LeagueRow[] }[] = [];
    PRODUCTS.forEach((p, pi) => {
      const ps = segs.filter((s) => s.p === pi);
      if (ps.length === 0) return;
      const children: LeagueRow[] = [];
      BANDS.forEach((b, bi) => {
        const bs = ps.filter((s) => s.b === bi);
        if (bs.length === 0) return;
        children.push(leagueRow(`${p.id}-${b.id}`, bi, `Band ${b.label}`, aggregate(bs), asOf, b.range));
      });
      out.push({ head: leagueRow(p.id, pi, p.label, aggregate(ps), asOf), children });
    });
    return out;
  }, [segs, asOf]);

  const sorted = useMemo(() => {
    const cmp = (a: LeagueRow, b: LeagueRow) => {
      const d = sort.key === "name" ? a.order - b.order : a[sort.key] - b[sort.key];
      return sort.dir === "asc" ? d : -d;
    };
    return [...groups]
      .sort((a, b) => cmp(a.head, b.head))
      .map((g) => ({ ...g, children: [...g.children].sort(cmp) }));
  }, [groups, sort]);

  const total = useMemo(() => leagueRow("total", 0, "All segments in view", agg, asOf), [agg, asOf]);

  const onSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );

  const cells = (r: LeagueRow, strong: boolean) => {
    const t = toneOf(r.d30, false, 0.00005);
    const num = `px-3 py-1.5 text-right font-mono tabular-nums ${strong ? "font-semibold text-neutral-900" : "text-neutral-700"}`;
    return (
      <>
        <td className={num}>{gbp(r.bal)}</td>
        <td className={num}>{countCompact(r.acc)}</td>
        <td className={num}>{pct(r.dpd30)}</td>
        <td className={num}>{pct(r.npl)}</td>
        <td className={num}>{pct(r.nco)}</td>
        <td className={`px-3 py-1.5 text-right font-mono tabular-nums ${TONE_TEXT[t]} ${strong ? "font-semibold" : ""}`}>
          {signedPp(r.d30)}
        </td>
        <td className="py-1.5 pr-4 pl-3">
          <Sparkline
            values={r.trend}
            height={18}
            className="ml-auto"
            label={`${r.label} 30+ DPD, 12 months: ${pct(r.trend[0])} to ${pct(r.trend[11])}`}
          />
        </td>
      </>
    );
  };

  return (
    <Card
      title="Segment league table"
      subtitle={`Product × score band at ${monthEnd(asOf)} · click a column to sort`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">
            Balance, accounts and arrears by product and score band, sortable by column
          </caption>
          <colgroup>
            <col />
            {COLUMNS.slice(1).map((c) => (
              <col key={c.key} style={{ width: 104 }} />
            ))}
            <col style={{ width: 112 }} />
          </colgroup>
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/60">
              {COLUMNS.map((c) => {
                const on = sort.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    className={`p-0 text-[10px] font-semibold tracking-wider uppercase ${
                      c.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(c.key)}
                      className={`inline-flex w-full items-center gap-1 py-2 transition ${FOCUS} ${
                        c.align === "right" ? "justify-end px-3" : "px-4"
                      } ${on ? "text-indigo-700" : "text-neutral-500 hover:text-neutral-900"}`}
                    >
                      {c.label}
                      <span aria-hidden className={`font-mono text-[9px] ${on ? "" : "text-neutral-300"}`}>
                        {on ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
              <th scope="col" className="py-2 pr-4 pl-3 text-right text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
                30+ trend 12M
              </th>
            </tr>
          </thead>
          {sorted.map((g) => (
            <tbody key={g.head.key} className="border-b border-neutral-200">
              <tr className="bg-neutral-50">
                <th scope="rowgroup" className="px-4 py-1.5 text-left text-xs font-semibold text-neutral-900">
                  {g.head.label}
                </th>
                {cells(g.head, true)}
              </tr>
              {g.children.map((r) => (
                <tr key={r.key} className="border-t border-neutral-100 hover:bg-indigo-50/40">
                  <th scope="row" className="py-1.5 pr-4 pl-8 text-left font-normal text-neutral-700">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex h-4 w-4 items-center justify-center border border-neutral-300 font-mono text-[10px] font-semibold text-neutral-700">
                        {r.label.slice(-1)}
                      </span>
                      <span className="font-mono text-[11px] text-neutral-500 tabular-nums">{r.hint}</span>
                    </span>
                  </th>
                  {cells(r, false)}
                </tr>
              ))}
            </tbody>
          ))}
          <tfoot>
            <tr className="border-t-2 border-neutral-300">
              <th scope="row" className="px-4 py-2 text-left text-xs font-semibold text-neutral-900">
                {total.label}
              </th>
              {cells(total, true)}
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
