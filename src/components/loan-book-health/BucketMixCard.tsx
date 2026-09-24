import { useMemo, useState } from "react";
import type { Options, SeriesColumnOptions } from "highcharts";
import HighchartsView from "../highcharts/HighchartsView";
import { BUCKETS, metrics as M, monthShort, type Agg } from "./model";
import { BUCKET_COLOURS, VIEW_OPTIONS, gbp, nf, pct, type View } from "./format";
import { Card, Seg } from "./chrome";

/* DPD bucket mix: arrears buckets as % of balance over 24 month-ends, an
 * ordinal one-hue ramp (light = mild, dark = severe). */

export function BucketMixCard({ agg, asOf }: { agg: Agg; asOf: number }) {
  const [view, setView] = useState<View>("chart");
  const rows = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => {
        const k = asOf - 23 + i;
        return {
          k,
          shares: [1, 2, 3, 4].map((j) => M.bucketShare(agg, k, j)),
          amounts: [1, 2, 3, 4].map((j) => agg.bk[k * 5 + j]),
        };
      }),
    [agg, asOf],
  );

  const options = useMemo<Options>(() => {
    const last = rows.length - 1;
    const series: SeriesColumnOptions[] = BUCKETS.slice(1).map((b, j) => ({
      type: "column",
      id: `bucket-${j + 1}`,
      name: `${b} DPD`,
      color: BUCKET_COLOURS[j],
      data: rows.map((r) => r.shares[j] * 100),
    }));
    return {
      chart: { type: "column", spacing: [8, 8, 4, 4] },
      xAxis: {
        categories: rows.map((r) => monthShort(r.k)),
        tickPositions: rows.map((_, i) => i).filter((i) => (last - i) % 3 === 0),
        labels: { rotation: 0, style: { textOverflow: "none", whiteSpace: "nowrap" } },
        crosshair: false,
      },
      yAxis: {
        min: 0,
        title: { text: undefined },
        labels: { format: "{value}%" },
        stackLabels: {
          enabled: true,
          crop: false,
          overflow: "allow",
          style: {
            color: "#171717",
            fontSize: "10px",
            fontWeight: "600",
            textOutline: "none",
          },
          formatter() {
            return this.x === last ? `${nf(2).format(this.total ?? 0)}%` : "";
          },
        },
      },
      legend: {
        enabled: true,
        align: "left",
        verticalAlign: "top",
        symbolHeight: 10,
        symbolWidth: 10,
        itemDistance: 14,
      },
      tooltip: {
        shared: false,
        formatter() {
          const r = rows[this.x as number];
          const j = this.series.index;
          const total = r.shares.reduce((a, b) => a + b, 0);
          return `<b style="font-size:12px">${pct(r.shares[j])}</b> of balance<br/><span style="color:#d4d4d4">${this.series.name} · ${monthShort(r.k)}</span><br/><span style="color:#a3a3a3">${gbp(r.amounts[j])} · all arrears ${pct(total)}</span>`;
        },
      },
      plotOptions: {
        column: {
          stacking: "normal",
          borderWidth: 1,
          borderColor: "#ffffff",
          maxPointWidth: 24,
          pointPadding: 0.06,
          groupPadding: 0.08,
          states: { inactive: { opacity: 0.5 } },
        },
      },
      series,
    };
  }, [rows]);

  return (
    <Card
      className="flex-1"
      title="DPD bucket mix"
      subtitle="Arrears as % of balance, 24 month-ends (Current excluded)"
      controls={<Seg label="Bucket mix view" value={view} onChange={setView} options={VIEW_OPTIONS} />}
    >
      {view === "chart" ? (
        <div className="px-1 pt-2 pb-1">
          <HighchartsView options={options} height={420} />
        </div>
      ) : (
        <div className="px-4 pt-2 pb-3">
          <table className="w-full text-[11px]">
            <caption className="sr-only">Arrears buckets as a share of balance by month</caption>
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th scope="col" className="py-1 pr-2 text-left font-medium">Month</th>
                {BUCKETS.slice(1).map((b, j) => (
                  <th key={b} scope="col" className="py-1 pl-2 text-right font-medium">
                    <span className="inline-flex items-center gap-1">
                      <span aria-hidden className="block h-2 w-2" style={{ background: BUCKET_COLOURS[j] }} />
                      {b}
                    </span>
                  </th>
                ))}
                <th scope="col" className="py-1 pl-2 text-right font-medium">All</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {[...rows].reverse().map((r) => (
                <tr key={r.k}>
                  <th scope="row" className="py-0.5 pr-2 text-left font-normal text-neutral-600">
                    {monthShort(r.k)}
                  </th>
                  {r.shares.map((s, j) => (
                    <td key={j} className="py-0.5 pl-2 text-right font-mono text-neutral-800 tabular-nums">
                      {pct(s)}
                    </td>
                  ))}
                  <td className="py-0.5 pl-2 text-right font-mono font-medium text-neutral-900 tabular-nums">
                    {pct(r.shares.reduce((a, b) => a + b, 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
