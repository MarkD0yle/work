import { useMemo, useState, type ReactNode } from "react";
import type { Chart, Options, SVGElement } from "highcharts";
import HighchartsView from "../highcharts/HighchartsView";
import {
  AGE_BANDS,
  fmtDayLong,
  median,
  type AgeingWeek,
  type ScenarioPoint,
} from "./data";

/* The right-hand chart stack: backlog ageing, scenario productivity and the
 * typology mix. Each card carries a Chart | Table toggle that swaps the plot
 * for the same numbers as a table (the accessible twin). */

const VIOLET = "#7c3aed";
const CONTEXT = "#a3a3a3";
const INK = "#404040";
const nf = new Intl.NumberFormat("en-GB");
const pct1 = (v: number) => `${v.toFixed(1)}%`;

const TIP_ROW =
  "display:flex;gap:12px;justify-content:space-between;font-size:11px;line-height:1.55";
const MONO = "font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums";

/* ------------------------------------------------------------------ chrome */

export function ChartPanel({
  title,
  meta,
  chart,
  table,
  footer,
  empty,
}: {
  title: string;
  meta?: ReactNode;
  chart: ReactNode;
  table: ReactNode;
  footer?: ReactNode;
  empty?: boolean;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className="flex flex-col border border-neutral-200 bg-white">
      <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          {meta && <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{meta}</p>}
        </div>
        <div className="flex shrink-0 border border-neutral-200" role="group" aria-label={`${title} view`}>
          {(["chart", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`px-2 py-0.5 text-[11px] font-medium capitalize transition focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none ${
                view === v ? "bg-violet-700 text-white" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </header>
      <div className="min-w-0 px-2 py-2">
        {empty ? (
          <div className="flex h-40 flex-col items-center justify-center gap-1 text-center">
            <span className="text-xs font-medium text-neutral-600">No alerts match these filters</span>
            <span className="text-[11px] text-neutral-400">Remove a filter chip to widen the slice.</span>
          </div>
        ) : view === "chart" ? (
          chart
        ) : (
          <div className="px-2 pb-1">{table}</div>
        )}
      </div>
      {footer && !empty && (
        <div className="border-t border-neutral-100 px-4 py-2 text-[11px] leading-snug text-neutral-500">{footer}</div>
      )}
    </section>
  );
}

function MiniTable({ head, rows, align }: { head: string[]; rows: (string | number)[][]; align?: ("l" | "r")[] }) {
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b border-neutral-200 text-left">
          {head.map((h, i) => (
            <th
              key={h}
              scope="col"
              className={`py-1.5 pr-2 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase ${
                (align?.[i] ?? (i === 0 ? "l" : "r")) === "r" ? "text-right" : ""
              }`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-100">
        {rows.map((r, ri) => (
          <tr key={ri}>
            {r.map((c, i) => {
              const right = (align?.[i] ?? (i === 0 ? "l" : "r")) === "r";
              return i === 0 ? (
                <th key={i} scope="row" className="py-1.5 pr-2 text-left font-medium text-neutral-700">
                  {c}
                </th>
              ) : (
                <td
                  key={i}
                  className={`py-1.5 pr-2 text-neutral-700 ${right ? "text-right font-mono tabular-nums" : ""}`}
                >
                  {c}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------ 1. ageing */

export function BacklogAgeingCard({
  weeks,
  target,
  windowFrom,
  empty,
}: {
  weeks: AgeingWeek[];
  target: number;
  windowFrom: number;
  empty: boolean;
}) {
  const firstIn = weeks.findIndex((w) => w.t >= windowFrom);
  const last = weeks.length - 1;

  const options = useMemo<Options>(
    () => ({
      chart: { type: "column", spacing: [10, 6, 4, 2] },
      xAxis: {
        categories: weeks.map((w) => w.label),
        labels: { rotation: 0, style: { fontSize: "10px", textOverflow: "none", whiteSpace: "nowrap" } },
        plotBands:
          firstIn >= 0
            ? [
                {
                  from: firstIn - 0.5,
                  to: last + 0.5,
                  color: "rgba(124,58,237,0.07)",
                },
              ]
            : [],
      },
      yAxis: {
        title: { text: undefined },
        min: 0,
        softMax: Math.ceil(target * 1.2),
        reversedStacks: true,
        plotLines: [
          {
            value: target,
            color: INK,
            width: 1,
            dashStyle: "Dash",
            zIndex: 5,
            label: {
              text: `Target ${nf.format(target)} · 8 days' intake`,
              align: "left",
              x: 2,
              y: -5,
              style: { color: INK, fontSize: "10px", fontWeight: "600", textOutline: "3px #ffffff" },
            },
          },
        ],
        stackLabels: {
          enabled: true,
          style: { color: "#171717", fontSize: "10px", fontWeight: "600", textOutline: "none" },
          formatter() {
            return this.x === last ? nf.format(this.total ?? 0) : "";
          },
        },
      },
      legend: {
        enabled: true,
        align: "left",
        verticalAlign: "top",
        margin: 6,
        itemDistance: 12,
        padding: 2,
      },
      tooltip: {
        shared: true,
        formatter() {
          const pts = this.points ?? [];
          const w = weeks[Number(this.x)] ?? weeks[this.index ?? 0];
          const total = pts.reduce((s, p) => s + Number(p.y), 0);
          const rows = [...pts]
            .reverse()
            .map(
              (p) =>
                `<div style="${TIP_ROW}"><span style="color:#d4d4d4"><span style="display:inline-block;width:7px;height:7px;background:${p.color};margin-right:5px"></span>${p.series.name}</span><span style="${MONO}">${nf.format(Number(p.y))}</span></div>`,
            )
            .join("");
          return `<div style="min-width:150px"><div style="font-size:13px;font-weight:600">${nf.format(total)} open</div><div style="color:#a3a3a3;font-size:10px;margin-bottom:4px">Snapshot ${w ? fmtDayLong(w.t) : ""}</div>${rows}</div>`;
        },
      },
      plotOptions: {
        column: {
          stacking: "normal",
          maxPointWidth: 24,
          borderWidth: 1,
          borderColor: "#ffffff",
          groupPadding: 0.1,
        },
      },
      responsive: {
        rules: [
          {
            condition: { maxWidth: 470 },
            chartOptions: {
              xAxis: { tickPositions: weeks.map((_, i) => i).filter((i) => (last - i) % 2 === 0) },
            },
          },
        ],
      },
      series: AGE_BANDS.map((b, i) => ({
        type: "column" as const,
        name: b.label,
        color: b.color,
        data: weeks.map((w) => w.bands[i]),
      })),
    }),
    [weeks, target, firstIn, last],
  );

  const now = weeks[last];
  const aged = now ? now.bands[2] + now.bands[3] : 0;

  return (
    <ChartPanel
      title="Backlog ageing, last 12 weeks"
      meta="Open alerts each Monday, by age · shaded = in range"
      empty={empty}
      chart={<HighchartsView options={options} height={250} />}
      table={
        <MiniTable
          head={["Snapshot", ...AGE_BANDS.map((b) => b.label), "Total"]}
          rows={weeks.map((w) => [w.label, ...w.bands.map((v) => nf.format(v)), nf.format(w.total)])}
        />
      }
      footer={
        now && (
          <>
            <span className="font-medium text-neutral-700">{nf.format(aged)}</span> alerts are more than 15
            days old;{" "}
            {now.total > target ? (
              <>
                the backlog sits <span className="font-medium text-neutral-700">{nf.format(now.total - target)}</span>{" "}
                over target.
              </>
            ) : (
              <>the backlog is within target.</>
            )}
          </>
        )
      }
    />
  );
}

/* --------------------------------------------------- 2. scenario scatter */

/* The quadrant wash and its label are drawn with the renderer on every
 * render, reading the medians back off the axis plot lines, so a resize or
 * a filter change always redraws them in the right place. */
const QUADRANT = new WeakMap<Chart, SVGElement[]>();
function drawQuadrant(chart: Chart) {
  QUADRANT.get(chart)?.forEach((el) => el.destroy());
  QUADRANT.delete(chart);
  const xa = chart.xAxis[0];
  const ya = chart.yAxis[0];
  const mx = xa?.options.plotLines?.[0]?.value;
  const my = ya?.options.plotLines?.[0]?.value;
  if (mx == null || my == null) return;
  const right = chart.plotLeft + chart.plotWidth;
  const bottom = chart.plotTop + chart.plotHeight;
  const x0 = Math.max(chart.plotLeft, Math.min(right, xa.toPixels(mx, false)));
  const y0 = Math.max(chart.plotTop, Math.min(bottom, ya.toPixels(my, false)));
  const wash = chart.renderer
    .rect(x0, y0, Math.max(0, right - x0), Math.max(0, bottom - y0))
    .attr({ fill: "rgba(124,58,237,0.06)", zIndex: 0 })
    .add();
  const label = chart.renderer
    .text("High volume, low yield → tune", right - 6, bottom - 7)
    .attr({ align: "right", zIndex: 4 })
    .css({ color: "#525252", fontSize: "10px", fontWeight: "600" })
    .add();
  QUADRANT.set(chart, [wash, label]);
}

type PointCustom = { code: string; label: string; sars: number; volume: number };

export function ScenarioScatterCard({
  points,
  totalSars,
  empty,
}: {
  points: ScenarioPoint[];
  totalSars: number;
  empty: boolean;
}) {
  const { medX, medY, tune, worst, tuneCodes, ticks } = useMemo(() => {
    const medX = median(points.map((p) => p.volume)) ?? 0;
    const medY = median(points.map((p) => p.conv)) ?? 0;
    const tune = points.filter((p) => p.volume > medX && p.conv <= medY);
    // Worst offenders: the most alerts worked per SAR filed. Ordered by
    // volume so the leftmost label can sit left of its point and the rest
    // above-right, which keeps neighbours on a log axis from colliding.
    const worst = new Map(
      [...tune]
        .sort((a, b) => b.volume / (b.sars + 1) - a.volume / (a.sars + 1))
        .slice(0, 3)
        .sort((a, b) => a.volume - b.volume)
        .map((p, i) => [p.code, i] as const),
    );
    // Ticks from 0 up; the axis runs a little below 0 so the quadrant label
    // has a clear strip under the lowest-yield points.
    const top = Math.max(4, Math.max(0, ...points.map((p) => p.conv)) * 1.08);
    const step = [1, 2, 2.5, 5, 10, 20].find((s) => top / s <= 5) ?? 25;
    const ticks = Array.from({ length: Math.ceil(top / step) + 1 }, (_, i) => i * step);
    return { medX, medY, tune, worst, tuneCodes: new Set(tune.map((p) => p.code)), ticks };
  }, [points]);

  const options = useMemo<Options>(
    () => ({
      chart: {
        type: "scatter",
        spacing: [12, 8, 4, 2],
        events: {
          render() {
            drawQuadrant(this);
          },
        },
      },
      legend: { enabled: false },
      xAxis: {
        type: "logarithmic",
        title: { text: "Alerts generated in range (log scale)" },
        gridLineWidth: 1,
        minPadding: 0.08,
        maxPadding: 0.08,
        plotLines: [
          {
            value: medX,
            color: CONTEXT,
            width: 1,
            dashStyle: "Dash",
            zIndex: 3,
            label: {
              text: `Median ${nf.format(Math.round(medX))}`,
              rotation: 0,
              align: "left",
              x: 4,
              y: 12,
              style: { color: "#737373", fontSize: "10px" },
            },
          },
        ],
      },
      yAxis: {
        title: { text: "SAR conversion" },
        tickPositions: ticks,
        min: -ticks[ticks.length - 1] * 0.12,
        max: ticks[ticks.length - 1],
        startOnTick: false,
        endOnTick: false,
        labels: { format: "{value}%" },
        plotLines: [
          {
            value: medY,
            color: CONTEXT,
            width: 1,
            dashStyle: "Dash",
            zIndex: 3,
            label: {
              text: `Median ${pct1(medY)}`,
              align: "left",
              x: 4,
              y: -5,
              style: { color: "#737373", fontSize: "10px" },
            },
          },
        ],
      },
      tooltip: {
        formatter() {
          const c = this.options.custom as PointCustom;
          return `<div style="min-width:170px"><div style="font-size:13px;font-weight:600">${pct1(Number(this.y))} SAR conversion</div><div style="color:#d4d4d4;font-size:11px;margin:1px 0 4px">${c.code} · ${c.label}</div><div style="${TIP_ROW}"><span style="color:#a3a3a3">Alerts</span><span style="${MONO}">${nf.format(c.volume)}</span></div><div style="${TIP_ROW}"><span style="color:#a3a3a3">SARs filed</span><span style="${MONO}">${nf.format(c.sars)}</span></div></div>`;
        },
      },
      plotOptions: {
        scatter: {
          marker: { symbol: "square", radius: 5, lineWidth: 2, lineColor: "#ffffff" },
          states: { hover: { halo: { size: 0 } } },
          dataLabels: {
            style: { color: "#262626", fontSize: "10px", fontWeight: "600", textOutline: "2px #ffffff" },
          },
        },
      },
      series: [
        {
          type: "scatter",
          name: "Detection scenarios",
          /* HighchartsView calls chart.update(), which merges per-point
           * options: a label or colour from one filter state can outlive it,
           * and points sharing an x value get dropped when matched. Keying
           * the series id to the data swaps the whole series instead. */
          id: `scenarios:${points.map((p) => `${p.code}-${p.volume}-${p.sars}`).join("|")}`,
          data: points.map((p) => ({
            id: p.code,
            x: p.volume,
            y: p.conv,
            color: tuneCodes.has(p.code) ? VIOLET : CONTEXT,
            custom: { code: p.code, label: p.name, sars: p.sars, volume: p.volume } satisfies PointCustom,
            dataLabels: worst.has(p.code)
              ? worst.get(p.code) === 0 && worst.size > 1
                ? { enabled: true, allowOverlap: true, format: p.code, align: "right", verticalAlign: "middle", x: -9, y: 0 }
                : { enabled: true, allowOverlap: true, format: p.code, align: "center", verticalAlign: "bottom", x: 0, y: -8 }
              : { enabled: false },
          })),
        },
      ],
    }),
    [points, medX, medY, ticks, tuneCodes, worst],
  );

  return (
    <ChartPanel
      title="Scenario productivity"
      meta="Alert volume against SAR conversion in range, per scenario"
      empty={empty}
      chart={<HighchartsView options={options} height={270} />}
      table={
        <MiniTable
          head={["Scenario", "Alerts", "SARs", "Conv."]}
          rows={[...points]
            .sort((a, b) => b.volume - a.volume)
            .map((p) => [`${p.code} · ${p.name}`, nf.format(p.volume), nf.format(p.sars), pct1(p.conv)])}
        />
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2" style={{ background: VIOLET }} aria-hidden />
            Tune candidates: above-median volume, below-median yield ({tune.length})
          </span>
          {totalSars < 12 && (
            <span className="inline-flex items-center gap-1 text-amber-700">
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
                <path d="M8 1 15 14H1L8 1Zm-.75 5v4h1.5V6h-1.5Zm0 5v1.5h1.5V11h-1.5Z" />
              </svg>
              Only {totalSars} SARs in range; yields are noisy. Use 90D or QTD.
            </span>
          )}
        </div>
      }
    />
  );
}

/* ------------------------------------------------------- 3. typology mix */

export interface TypologyRow {
  typology: string;
  open: number;
  breached: number;
  fresh: number;
}

export function TypologyMixCard({ rows, empty, rangeLabel }: { rows: TypologyRow[]; empty: boolean; rangeLabel: string }) {
  const options = useMemo<Options>(
    () => ({
      chart: { type: "bar", spacing: [4, 30, 4, 2] },
      legend: { enabled: false },
      xAxis: {
        categories: rows.map((r) => r.typology),
        lineColor: "#e5e5e5",
        labels: { style: { color: "#404040", fontSize: "11px" } },
      },
      yAxis: {
        title: { text: undefined },
        labels: { enabled: false },
        gridLineWidth: 0,
        min: 0,
      },
      tooltip: {
        formatter() {
          const r = rows[this.index ?? 0];
          return `<div style="min-width:150px"><div style="font-size:13px;font-weight:600">${nf.format(Number(this.y))} open</div><div style="color:#d4d4d4;font-size:11px;margin:1px 0 4px">${r?.typology ?? ""}</div><div style="${TIP_ROW}"><span style="color:#a3a3a3">Past SLA</span><span style="${MONO}">${nf.format(r?.breached ?? 0)}</span></div><div style="${TIP_ROW}"><span style="color:#a3a3a3">Generated in range</span><span style="${MONO}">${nf.format(r?.fresh ?? 0)}</span></div></div>`;
        },
      },
      plotOptions: {
        bar: {
          maxPointWidth: 18,
          pointPadding: 0.12,
          groupPadding: 0.06,
          dataLabels: {
            enabled: true,
            inside: false,
            crop: false,
            overflow: "allow",
            style: { color: "#262626", fontSize: "10px", fontWeight: "600" },
          },
        },
      },
      series: [{ type: "bar", name: "Open alerts", color: VIOLET, data: rows.map((r) => r.open) }],
    }),
    [rows],
  );

  const total = rows.reduce((s, r) => s + r.open, 0);
  const top = rows[0];

  return (
    <ChartPanel
      title="Typology mix"
      meta="Open alerts by typology, as of Mon 21 Sep"
      empty={empty}
      chart={<HighchartsView options={options} height={Math.max(150, 34 + rows.length * 30)} />}
      table={
        <MiniTable
          head={["Typology", "Open", "Past SLA", `New · ${rangeLabel}`]}
          rows={rows.map((r) => [r.typology, nf.format(r.open), nf.format(r.breached), nf.format(r.fresh)])}
        />
      }
      footer={
        top &&
        total > 0 && (
          <>
            <span className="font-medium text-neutral-700">{top.typology}</span> is{" "}
            {pct1((top.open / total) * 100)} of the open book.
          </>
        )
      }
    />
  );
}
