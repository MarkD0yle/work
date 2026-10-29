import { useMemo, useState } from "react";
import type { Options, SeriesLineOptions } from "highcharts";
import HighchartsView from "../highcharts/HighchartsView";
import { referenceCurve, vintageCurves, type Segment } from "./model";
import {
  ACCENT,
  FOCUS,
  MUTED_SERIES,
  REF_INK,
  TONE_TEXT,
  VIEW_OPTIONS,
  gbp,
  nf,
  pct,
  signedPp,
  toneOf,
  type View,
} from "./format";
import { Card, EmptyInline, Micro, Seg } from "./chrome";

/* Hero: vintage curves in emphasis form. Every vintage is gray context, one
 * selected vintage wears the accent, and a dashed 2023–24 book average is
 * the reference. Select by clicking a line or a chip. */

const TABLE_MOBS = [3, 6, 9, 12, 18, 24, 30, 36];

export function VintageCard({ segs, asOf }: { segs: Segment[]; asOf: number }) {
  const [metric, setMetric] = useState<0 | 1>(0);
  const [view, setView] = useState<View>("chart");
  const [picked, setPicked] = useState<string | null>(null);

  const curves = useMemo(
    () => vintageCurves(segs, metric, asOf).filter((c) => c.mob >= 3),
    [segs, metric, asOf],
  );
  const ref = useMemo(() => referenceCurve(curves), [curves]);
  // Default: the latest vintage with at least six months on book.
  const fallback = [...curves].reverse().find((c) => c.mob >= 6) ?? curves[curves.length - 1];
  const selected = curves.find((c) => c.vintage.id === picked) ?? fallback;
  const selId = selected?.vintage.id;
  const metricLabel = metric === 0 ? "ever 30+ DPD" : "cumulative charge-off";
  const metricTitle = metric === 0 ? "Ever 30+ DPD" : "Cumulative net charge-off";

  /* HighchartsView calls chart.update(..., oneToOne), which merges per-point
   * options into existing series: an end label or marker from one state can
   * survive into the next. The labelled series (reference + selected) are
   * therefore keyed by their data, so any change of slice, metric or as-of
   * month replaces them outright instead of merging into them. */
  const sliceKey = useMemo(() => {
    let h = 2166136261;
    for (const s of segs)
      for (let i = 0; i < s.id.length; i++) {
        h ^= s.id.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
    return (h >>> 0).toString(36);
  }, [segs]);
  const dataKey = `${sliceKey}-${metric}-${asOf}`;

  const options = useMemo<Options>(() => {
    const sel = curves.find((c) => c.vintage.id === selId);
    const refPts = ref
      .map((v, m) => (v == null ? null : ([m, v * 100] as [number, number])))
      .filter((p): p is [number, number] => p !== null);
    const others: SeriesLineOptions[] = curves
      .map((c, vi) => ({ c, vi }))
      .filter(({ c }) => c.vintage.id !== selId)
      .map(({ c, vi }) => ({
        type: "line",
        id: `ctx-${c.vintage.id}`,
        custom: { vid: c.vintage.id },
        name: c.vintage.label,
        color: MUTED_SERIES,
        // Fixed per vintage: re-added series are appended, so array order
        // alone would make the stacking depend on selection history.
        zIndex: 1 + vi,
        data: c.values.map((v, m) => [m, v * 100]),
      }));
    const refSeries: SeriesLineOptions = {
      type: "line",
      id: `ref-${dataKey}`,
      name: "Book avg 2023–24",
      color: REF_INK,
      dashStyle: "Dash",
      lineWidth: 1.5,
      zIndex: 40,
      // Reference only: vintage tooltips already quote it, and it must not
      // steal clicks from the vintage lines it runs through.
      enableMouseTracking: false,
      data: refPts.map(([x, y], i) =>
        i !== refPts.length - 1
          ? { x, y, dataLabels: { enabled: false } }
          : {
              x,
              y,
              dataLabels: {
                enabled: true,
                format: "2023–24 avg",
                align: "left",
                verticalAlign: "middle",
                x: 6,
                crop: false,
                overflow: "allow",
                backgroundColor: "rgba(255,255,255,0.92)",
                padding: 2,
                style: { color: REF_INK, fontWeight: "500" },
              },
            },
      ),
    };
    const nearEnd = (sel?.mob ?? 0) >= 27;
    const selSeries: SeriesLineOptions[] = sel
      ? [
          {
            type: "line",
            id: `sel-${sel.vintage.id}-${dataKey}`,
            custom: { vid: sel.vintage.id },
            name: sel.vintage.label,
            color: ACCENT,
            lineWidth: 2.5,
            zIndex: 50,
            data: sel.values.map((v, m) =>
              m === sel.mob
                ? {
                    x: m,
                    y: v * 100,
                    marker: { enabled: true, radius: 4 },
                    dataLabels: {
                      enabled: true,
                      format: `${sel.vintage.label} · ${nf(2).format(v * 100)}%`,
                      // Near the right edge the reference label lives there too,
                      // so the selected label sits above-left of its end point.
                      align: nearEnd ? "right" : "left",
                      verticalAlign: nearEnd ? "bottom" : "middle",
                      x: nearEnd ? -4 : 8,
                      y: nearEnd ? -8 : 0,
                      allowOverlap: true,
                      crop: false,
                      overflow: "allow",
                      backgroundColor: "rgba(255,255,255,0.92)",
                      padding: 3,
                      style: { color: "#171717", fontWeight: "600", fontSize: "11px" },
                    },
                  }
                : { x: m, y: v * 100, marker: { enabled: false }, dataLabels: { enabled: false } },
            ),
          },
        ]
      : [];

    return {
      chart: { type: "line", marginRight: 96, spacing: [12, 8, 4, 4] },
      xAxis: {
        min: 0,
        max: 36,
        tickInterval: 6,
        title: { text: "Months on book" },
        crosshair: false,
      },
      yAxis: {
        min: 0,
        title: { text: undefined },
        labels: { format: "{value}%" },
      },
      legend: { enabled: false },
      tooltip: {
        shared: false,
        formatter() {
          const m = this.x as number;
          const isRef = String(this.series.options.id).startsWith("ref-");
          const r = ref[m];
          const cmp =
            !isRef && r != null
              ? `<br/><span style="color:#a3a3a3">2023–24 avg ${nf(2).format(r * 100)}%</span>`
              : "";
          return `<b style="font-size:12px">${nf(2).format(this.y ?? 0)}%</b> ${metricLabel}<br/><span style="color:#d4d4d4">${this.series.name} · ${m} MOB</span>${cmp}`;
        },
      },
      plotOptions: {
        series: {
          lineWidth: 2,
          cursor: "pointer",
          stickyTracking: false,
          marker: {
            enabled: false,
            radius: 4,
            lineWidth: 2,
            lineColor: "#ffffff",
            symbol: "circle",
          },
          states: { hover: { lineWidthPlus: 1 }, inactive: { opacity: 0.35 } },
          events: {
            click() {
              const vid = (this.options.custom as { vid?: string } | undefined)?.vid;
              if (vid) setPicked(vid);
            },
          },
        },
      },
      series: [...others, refSeries, ...selSeries],
    };
  }, [curves, ref, selId, metricLabel, dataKey]);

  const refAtSel = selected ? ref[selected.mob] : null;
  const selVal = selected ? selected.values[selected.mob] : 0;
  const gap = refAtSel != null ? selVal - refAtSel : 0;

  return (
    <Card
      title="Vintage curves"
      subtitle={`${metricTitle} by months on book, % of originated balance · quarterly vintages 2023 Q3 – 2026 Q1`}
      controls={
        <>
          <Seg
            label="Vintage metric"
            value={metric}
            onChange={setMetric}
            options={[
              { value: 0, label: "30+ DPD" },
              { value: 1, label: "Cumulative charge-off" },
            ]}
          />
          <Seg label="Vintage view" value={view} onChange={setView} options={VIEW_OPTIONS} />
        </>
      }
    >
      {curves.length === 0 || !selected ? (
        <EmptyInline text="No vintages have three months on book in this slice." />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pt-3">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-600">
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="block h-[3px] w-4" style={{ background: ACCENT }} />
                Selected vintage
              </li>
              <li className="flex items-center gap-1.5">
                <svg aria-hidden width="16" height="3">
                  <line x1="0" y1="1.5" x2="16" y2="1.5" stroke={REF_INK} strokeWidth="1.5" strokeDasharray="4 2" />
                </svg>
                Book average, 2023–24 vintages
              </li>
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="block h-[2px] w-4" style={{ background: MUTED_SERIES }} />
                Other vintages
              </li>
            </ul>
            {refAtSel != null && (
              <p className="text-[11px] text-neutral-600">
                <span className="font-semibold text-neutral-900">{selected.vintage.label}</span> at{" "}
                {selected.mob} MOB:{" "}
                <span className="font-mono font-semibold text-neutral-900 tabular-nums">
                  {pct(selVal)}
                </span>{" "}
                vs <span className="font-mono tabular-nums">{pct(refAtSel)}</span> avg{" "}
                <span className={`font-medium ${TONE_TEXT[toneOf(gap, false, 0.0002)]}`}>
                  {signedPp(gap)}
                </span>
              </p>
            )}
          </div>

          {view === "chart" ? (
            <div className="px-1 pt-1">
              <HighchartsView options={options} height={320} />
            </div>
          ) : (
            <div className="overflow-x-auto px-4 pt-3 pb-1">
              <table className="w-full text-[11px]">
                <caption className="sr-only">
                  {`Cumulative ${metricLabel} by vintage and months on book`}
                </caption>
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500">
                    <th scope="col" className="py-1.5 pr-3 text-left font-medium">Vintage</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">Originated</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">MOB</th>
                    {TABLE_MOBS.map((m) => (
                      <th key={m} scope="col" className="py-1.5 pl-3 text-right font-medium">
                        {m}m
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {curves.map((c) => {
                    const on = c.vintage.id === selId;
                    return (
                      <tr key={c.vintage.id} className={on ? "bg-indigo-50" : ""}>
                        <th
                          scope="row"
                          className={`py-1 pr-3 text-left font-medium ${on ? "text-indigo-900" : "text-neutral-700"}`}
                        >
                          {c.vintage.label}
                        </th>
                        <td className="py-1 pr-3 text-right font-mono text-neutral-600 tabular-nums">
                          {gbp(c.volume)}
                        </td>
                        <td className="py-1 pr-3 text-right font-mono text-neutral-600 tabular-nums">
                          {c.mob}
                        </td>
                        {TABLE_MOBS.map((m) => (
                          <td key={m} className="py-1 pl-3 text-right font-mono text-neutral-800 tabular-nums">
                            {m <= c.mob ? pct(c.values[m]) : <span className="text-neutral-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  <tr className="border-t border-neutral-300">
                    <th scope="row" className="py-1 pr-3 text-left font-medium text-neutral-900">
                      Avg 2023–24
                    </th>
                    <td className="py-1 pr-3" />
                    <td className="py-1 pr-3" />
                    {TABLE_MOBS.map((m) => (
                      <td key={m} className="py-1 pl-3 text-right font-mono font-medium text-neutral-900 tabular-nums">
                        {ref[m] != null ? pct(ref[m]!) : <span className="text-neutral-300">—</span>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div
            role="group"
            aria-label="Select vintage"
            className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-neutral-100 px-4 py-2.5"
          >
            <Micro className="mr-1">Vintage</Micro>
            {curves.map((c) => {
              const on = c.vintage.id === selId;
              return (
                <button
                  key={c.vintage.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked(c.vintage.id)}
                  className={`flex items-center gap-1.5 border px-2 py-1 text-[11px] font-medium transition ${FOCUS} ${
                    on
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
                  }`}
                >
                  {c.vintage.label}
                  <span
                    className={`font-mono text-[10px] tabular-nums ${on ? "text-indigo-100" : "text-neutral-400"}`}
                  >
                    {c.mob}m
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}
