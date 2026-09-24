import { useMemo, useState } from "react";
import { BUCKETS, type Bucket, type Focus, type MarketRow, type Matrix } from "./model";
import { BUCKET_COLOR, FOCUS, INK, STATUS, days1, focusLabel, gbpC, gbpM, heat, inkOn, num0, pct } from "./format";
import { CardHeader, ClearButton, EmptyState, RegimeChip, Swatch } from "./ui";

/* Row three of the console: who is responsible and how old it is.
 *
 * The ageing matrix is a CSS-grid heatmap rather than a chart: counts in
 * cells, a single-hue ramp for magnitude, and every cell a button that
 * scopes the blotter below. The market table is a bar-in-cell league table
 * so the six markets can be compared on rate, size, age and penalties at
 * once. */

const sameFocus = (a: Focus | null, b: Focus) =>
  a !== null && a.counterparty === b.counterparty && a.bucket === b.bucket;

/* ------------------------------------------------------------------ *
 * Ageing matrix
 * ------------------------------------------------------------------ */

export function AgeingMatrix({
  matrix,
  focus,
  onFocus,
}: {
  matrix: Matrix;
  focus: Focus | null;
  onFocus: (f: Focus | null) => void;
}) {
  const max = Math.max(1, ...matrix.rows.flatMap((r) => r.cells.map((c) => c.n)));
  const covered = matrix.rows.reduce((s, r) => s + r.n, 0);
  const toggle = (f: Focus) => onFocus(sameFocus(focus, f) ? null : f);

  // Dim what is outside the focus so the scope of the blotter is visible here too.
  const inFocus = (cpty: string | null, bucket: Bucket | null) =>
    !focus ||
    ((focus.counterparty === null || focus.counterparty === cpty) && (focus.bucket === null || focus.bucket === bucket));

  const cellBtn = (on: boolean, dim: boolean) =>
    `flex h-8 w-full items-center justify-center font-mono text-[11px] tabular-nums transition ${FOCUS} ${
      on ? "ring-2 ring-neutral-900 ring-inset" : ""
    } ${dim ? "opacity-35" : ""}`;

  return (
    <section aria-labelledby="sf-matrix-title" className="flex h-full flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="sf-matrix-title"
        title="Ageing by counterparty"
        sub={
          matrix.total === 0
            ? "Failing instructions by counterparty and age bucket"
            : `Top ${matrix.rows.length} of ${matrix.counterparties} counterparties, ${pct((100 * covered) / matrix.total, 0)} of ${num0(matrix.total)} fails · click a cell, a name or a bucket to scope the blotter`
        }
        right={focus ? <ClearButton onClick={() => onFocus(null)}>Clear {focusLabel(focus)}</ClearButton> : undefined}
      />
      {matrix.total === 0 ? (
        <EmptyState title="No failing instructions in this slice" body="Widen the market, asset class or direction filters." />
      ) : (
        <div className="overflow-x-auto px-4 pt-3 pb-3">
          <div
            role="grid"
            aria-label="Failing instructions by counterparty and age bucket"
            className="grid gap-px border border-neutral-200 bg-neutral-200"
            style={{ gridTemplateColumns: "minmax(200px, 1.7fr) repeat(5, minmax(52px, 1fr)) minmax(56px, 0.7fr)", minWidth: 600 }}
          >
            {/* header row */}
            <div role="row" className="contents">
              <div role="columnheader" className="flex items-end bg-white px-2 py-1.5">
                <span className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Counterparty</span>
              </div>
              {BUCKETS.map((b, i) => {
                const bi = i as Bucket;
                const on = sameFocus(focus, { counterparty: null, bucket: bi });
                return (
                  <div key={b.label} role="columnheader" className="bg-white">
                    <button
                      type="button"
                      aria-pressed={on}
                      title={`Scope the blotter to ${b.label}`}
                      onClick={() => toggle({ counterparty: null, bucket: bi })}
                      className={`flex h-full w-full flex-col items-center justify-end gap-1 px-1 py-1.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase hover:bg-neutral-50 ${FOCUS} ${
                        on ? "ring-2 ring-neutral-900 ring-inset" : ""
                      }`}
                    >
                      <Swatch color={BUCKET_COLOR[bi]} className="h-1.5 w-5" />
                      {b.label}
                    </button>
                  </div>
                );
              })}
              <div role="columnheader" className="flex items-end justify-end bg-white px-2 py-1.5">
                <span className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Total</span>
              </div>
            </div>

            {matrix.rows.map((r) => {
              const rowOn = sameFocus(focus, { counterparty: r.counterparty, bucket: null });
              return (
                <div key={r.counterparty} role="row" className="contents">
                  <div role="rowheader" className="bg-white">
                    <button
                      type="button"
                      aria-pressed={rowOn}
                      title={`Scope the blotter to ${r.counterparty}`}
                      onClick={() => toggle({ counterparty: r.counterparty, bucket: null })}
                      className={`flex h-8 w-full items-center justify-between gap-2 px-2 text-left hover:bg-neutral-50 ${FOCUS} ${
                        rowOn ? "ring-2 ring-neutral-900 ring-inset" : ""
                      } ${inFocus(r.counterparty, null) ? "" : "opacity-35"}`}
                    >
                      <span className="truncate text-[11px] font-medium text-neutral-800">{r.counterparty}</span>
                      <span className="shrink-0 font-mono text-[10px] text-neutral-400 tabular-nums">{gbpM(r.value)}</span>
                    </button>
                  </div>
                  {r.cells.map((c, i) => {
                    const bi = i as Bucket;
                    const t = c.n / max;
                    const on = sameFocus(focus, { counterparty: r.counterparty, bucket: bi });
                    const dim = !inFocus(r.counterparty, bi);
                    return (
                      <div key={BUCKETS[i].label} role="gridcell" className="bg-white">
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-label={`${r.counterparty}, ${BUCKETS[i].label}: ${c.n} failing, ${gbpM(c.value)}`}
                          title={`${r.counterparty} · ${BUCKETS[i].label}: ${c.n} failing · ${gbpM(c.value)}`}
                          onClick={() => toggle({ counterparty: r.counterparty, bucket: bi })}
                          className={cellBtn(on, dim)}
                          style={{
                            background: c.n === 0 ? "#ffffff" : heat(t),
                            color: c.n === 0 ? "#d4d4d4" : inkOn(t),
                            fontWeight: c.n > 0 && t > 0.6 ? 600 : 400,
                          }}
                        >
                          {c.n === 0 ? "·" : c.n}
                        </button>
                      </div>
                    );
                  })}
                  <div role="gridcell" className={`flex h-8 items-center justify-end bg-white px-2 font-mono text-[11px] font-semibold text-neutral-900 tabular-nums ${inFocus(r.counterparty, null) ? "" : "opacity-35"}`}>
                    {r.n}
                  </div>
                </div>
              );
            })}

            {/* totals row: every counterparty in the slice, not just the top rows */}
            <div role="row" className="contents">
              <div role="rowheader" className="flex h-8 items-center bg-neutral-50 px-2 text-[11px] font-semibold text-neutral-900">
                All {matrix.counterparties} counterparties
              </div>
              {matrix.colTotals.map((n, i) => (
                <div key={BUCKETS[i].label} role="gridcell" className={`flex h-8 items-center justify-center bg-neutral-50 font-mono text-[11px] font-semibold text-neutral-900 tabular-nums ${inFocus(null, i as Bucket) ? "" : "opacity-35"}`}>
                  {n}
                </div>
              ))}
              <div role="gridcell" className="flex h-8 items-center justify-end bg-neutral-50 px-2 font-mono text-[11px] font-semibold text-neutral-900 tabular-nums">
                {matrix.total}
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-10" style={{ background: `linear-gradient(90deg, ${heat(0)}, ${heat(1)})` }} />
              Fewer → more failing instructions (max {max})
            </span>
            <span>Row value is the counterparty&rsquo;s failing value in the slice.</span>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Fails by market: bar-in-cell league table
 * ------------------------------------------------------------------ */

type SortKey = "market" | "rate" | "n" | "value" | "avgAge" | "net";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const COLS: { key: SortKey; label: string; right?: boolean; title: string }[] = [
  { key: "market", label: "Market", title: "Sort by market" },
  { key: "rate", label: "Fails rate", right: true, title: "Failing ÷ due to settle today, by value" },
  { key: "n", label: "Count", right: true, title: "Failing instructions" },
  { key: "value", label: "Value", right: true, title: "Failing value, £m" },
  { key: "avgAge", label: "Age", right: true, title: "Average business days since ISD" },
  { key: "net", label: "Penalties", right: true, title: "Net received less paid, month to date" },
];

function keyOf(r: MarketRow, k: SortKey): number | string {
  switch (k) {
    case "market":
      return r.market.label;
    case "rate":
      return r.rate;
    case "n":
      return r.n;
    case "value":
      return r.value;
    case "avgAge":
      return r.avgAge;
    case "net":
      return r.net;
  }
}

function Bar({ frac, color }: { frac: number; color: string }) {
  return (
    <span aria-hidden className="inline-block h-2.5 w-10 shrink-0 bg-neutral-100">
      <span className="block h-full" style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%`, background: color }} />
    </span>
  );
}

/** Diverging bar: paid grows left from centre in rose, received grows right in green. */
function NetBar({ v, max }: { v: number; max: number }) {
  const half = (Math.min(1, Math.abs(v) / (max || 1)) * 100) / 2;
  return (
    <span aria-hidden className="relative inline-block h-2.5 w-10 shrink-0 bg-neutral-100">
      <span className="absolute inset-y-0 left-1/2 w-px bg-neutral-400" />
      <span
        className="absolute inset-y-0"
        style={{
          left: v >= 0 ? "50%" : `${50 - half}%`,
          width: `${half}%`,
          background: v >= 0 ? STATUS.good : STATUS.bad,
        }}
      />
    </span>
  );
}

export function MarketTable({ rows }: { rows: MarketRow[] }) {
  const [sort, setSort] = useState<Sort>({ key: "rate", dir: "desc" });

  const sorted = useMemo(() => {
    const m = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const ka = keyOf(a, sort.key);
      const kb = keyOf(b, sort.key);
      const c = typeof ka === "string" && typeof kb === "string" ? ka.localeCompare(kb) : Number(ka) - Number(kb);
      return m * c || a.market.label.localeCompare(b.market.label);
    });
  }, [rows, sort]);

  const maxRate = Math.max(...rows.map((r) => r.rate), 0.01);
  const maxValue = Math.max(...rows.map((r) => r.value), 1);
  const maxNet = Math.max(...rows.map((r) => Math.abs(r.net)), 1);
  const totN = rows.reduce((s, r) => s + r.n, 0);
  const totValue = rows.reduce((s, r) => s + r.value, 0);
  const totDue = rows.reduce((s, r) => s + r.due, 0);
  const totAge = totN > 0 ? rows.reduce((s, r) => s + r.avgAge * r.n, 0) / totN : 0;
  const totNet = rows.reduce((s, r) => s + r.net, 0);

  const sortBy = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "market" ? "asc" : "desc" }));

  return (
    <section aria-labelledby="sf-mkt-title" className="flex h-full flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="sf-mkt-title"
        title="Fails by market"
        sub="Today's slice per market · bars scale to the largest market shown · penalties are month to date"
      />
      {rows.length === 0 ? (
        <EmptyState title="No markets selected" body="Select at least one market in the header." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ minWidth: 520 }}>
            <caption className="sr-only">Fails by market: rate, count, value, average age and net penalties</caption>
            <thead>
              <tr className="border-b border-neutral-200">
                {COLS.map((c) => {
                  const on = sort.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={`px-2.5 py-2 ${c.right ? "text-right" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => sortBy(c.key)}
                        title={c.title}
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold tracking-widest uppercase ${FOCUS} ${
                          on ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-700"
                        }`}
                      >
                        {c.label}
                        <span aria-hidden className={on ? "" : "opacity-0"}>
                          {on && sort.dir === "asc" ? "↑" : "↓"}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sorted.map((r) => {
                const none = r.market.regime === "none";
                return (
                  <tr key={r.market.id} className="hover:bg-neutral-50">
                    <th scope="row" className="px-2.5 py-1">
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-[11px] font-medium whitespace-nowrap text-neutral-800">{r.market.label}</span>
                        <RegimeChip regime={r.market.regime} />
                      </div>
                    </th>
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center justify-end gap-2">
                        <Bar frac={r.rate / maxRate} color={INK} />
                        <span className="w-11 text-right font-mono text-[11px] text-neutral-800 tabular-nums">{pct(r.rate, 2)}</span>
                      </div>
                    </td>
                    <td className={`px-2.5 py-1.5 text-right font-mono text-[11px] tabular-nums ${r.n === 0 ? "text-neutral-300" : "text-neutral-800"}`}>
                      {r.n}
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center justify-end gap-2">
                        <Bar frac={r.value / maxValue} color="#6366f1" />
                        <span className="w-12 text-right font-mono text-[11px] text-neutral-800 tabular-nums">{gbpM(r.value)}</span>
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5 text-right">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-neutral-800 tabular-nums">
                        {r.n > 0 && <Swatch color={BUCKET_COLOR[r.avgAge < 1 ? 0 : r.avgAge < 2 ? 1 : r.avgAge < 4 ? 2 : r.avgAge < 8 ? 3 : 4]} className="h-2 w-2" />}
                        {r.n > 0 ? days1(r.avgAge) : "—"}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center justify-end gap-2">
                        {none ? <span className="w-10" /> : <NetBar v={r.net} max={maxNet} />}
                        <span className={`w-14 text-right font-mono text-[11px] tabular-nums ${none ? "text-neutral-300" : "text-neutral-800"}`}>
                          {none ? "—" : gbpC(r.net, true)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-200 bg-neutral-50">
                <th scope="row" className="px-2.5 py-2 text-[11px] font-semibold text-neutral-900">All selected</th>
                <td className="px-2.5 py-2 text-right font-mono text-[11px] font-semibold text-neutral-900 tabular-nums">
                  {pct(totDue > 0 ? (100 * totValue) / totDue : 0, 2)}
                </td>
                <td className="px-2.5 py-2 text-right font-mono text-[11px] font-semibold text-neutral-900 tabular-nums">{num0(totN)}</td>
                <td className="px-2.5 py-2 text-right font-mono text-[11px] font-semibold text-neutral-900 tabular-nums">{gbpM(totValue)}</td>
                <td className="px-2.5 py-2 text-right font-mono text-[11px] font-semibold text-neutral-900 tabular-nums">{totN > 0 ? days1(totAge) : "—"}</td>
                <td className="px-2.5 py-2 text-right font-mono text-[11px] font-semibold text-neutral-900 tabular-nums">{gbpC(totNet, true)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
