import { useMemo, useRef, useState } from "react";
import type { Options } from "highcharts";
import HighchartsView from "../highcharts/HighchartsView";
import {
  ACCENT,
  AC_BY_ID,
  ASSET_CLASSES,
  CAT,
  CHANNELS,
  CH_BY_ID,
  INK,
  LAST,
  MINUS,
  PERIOD_BY_ID,
  money,
  pct,
  type AssetClass,
  type Channel,
  type PeriodKey,
  type Summary,
} from "./data";
import { EmptyState, Swatch, Tile, ViewToggle, type View } from "./ui";
import { useWidth } from "./hooks";

/* The two Highcharts tiles (sankey, monthly sales vs redemptions) and the
 * hero's SVG sparkline. Each chart tile carries a Chart | Table toggle whose
 * table is the accessible twin of the same numbers. */

const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Tooltip body: value first (bold), label second, optional detail rows. */
function tip(value: string, label: string, rows: [string, string][] = []) {
  const detail = rows
    .map(
      ([k, v]) =>
        `<div style="display:flex;justify-content:space-between;gap:14px;font-size:10.5px;color:#a3a3a3;margin-top:2px">` +
        `<span>${k}</span><span style="font-family:${MONO};font-variant-numeric:tabular-nums;color:#e5e5e5">${v}</span></div>`,
    )
    .join("");
  return (
    `<div style="min-width:150px">` +
    `<div style="font-family:${MONO};font-variant-numeric:tabular-nums;font-weight:600;font-size:12.5px;color:#fafafa">${value}</div>` +
    `<div style="color:#d4d4d4;font-size:11px;margin-top:1px">${label}</div>${detail}</div>`
  );
}

const TH = "px-2 py-1.5 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase";
const TD_NUM = "px-2 py-1.5 text-right font-mono text-[11px] text-neutral-800 tabular-nums";

/* --- 1. Sankey: channel → asset class, gross sales ------------------------------ */

export function SankeyTile({ s, area, period }: { s: Summary; area: string; period: PeriodKey }) {
  const [view, setView] = useState<View>("chart");

  const model = useMemo(() => {
    const total = s.sankey.reduce((a, l) => a + l.sales, 0);
    const chTot = new Map<Channel, number>();
    const acTot = new Map<AssetClass, number>();
    const cell = new Map<string, number>();
    for (const l of s.sankey) {
      chTot.set(l.ch, (chTot.get(l.ch) ?? 0) + l.sales);
      acTot.set(l.ac, (acTot.get(l.ac) ?? 0) + l.sales);
      cell.set(`${l.ch}|${l.ac}`, l.sales);
    }
    return {
      total,
      chTot,
      acTot,
      cell,
      chans: CHANNELS.filter((c) => (chTot.get(c.id) ?? 0) > 0),
      acs: ASSET_CLASSES.filter((a) => (acTot.get(a.id) ?? 0) > 0),
    };
  }, [s.sankey]);

  const options = useMemo<Options>(() => {
    const { total, chTot, acTot, chans, acs } = model;
    const labelFor = (id: string) => {
      const [kind, key] = id.split(":");
      const name = kind === "ch" ? CH_BY_ID[key as Channel].label : AC_BY_ID[key as AssetClass].label;
      const v = kind === "ch" ? (chTot.get(key as Channel) ?? 0) : (acTot.get(key as AssetClass) ?? 0);
      return (
        `<span style="font-weight:600;color:#262626">${name}</span><br/>` +
        `<span style="font-family:${MONO};color:#525252">${money(v)}` +
        `<span style="color:#a3a3a3"> · ${pct((v / total) * 100, 0)}</span></span>`
      );
    };
    return {
      chart: { type: "sankey", marginLeft: 124, marginRight: 124, spacing: [12, 4, 12, 4] },
      // The theme's global x crosshair means nothing on a sankey.
      xAxis: { crosshair: false },
      accessibility: {
        point: { valueDescriptionFormat: "{point.fromNode.name} to {point.toNode.name}, {point.weight:.0f} million pounds." },
      },
      tooltip: {
        formatter() {
          const p = this as unknown as {
            isNode?: boolean;
            id?: string;
            name?: string;
            sum?: number;
            weight?: number;
            fromNode?: { id: string; name: string };
            toNode?: { name: string };
          };
          if (p.isNode) {
            const v = p.sum ?? 0;
            const side = p.id?.startsWith("ch:") ? "sold through this channel" : "sold into this asset class";
            return tip(money(v), `${p.name} · ${side}`, [["Share of gross sales", pct((v / total) * 100)]]);
          }
          const w = p.weight ?? 0;
          const chId = (p.fromNode?.id ?? "").slice(3) as Channel;
          const chTotal = chTot.get(chId) ?? w;
          return tip(money(w), `${p.fromNode?.name} → ${p.toNode?.name}`, [
            ["Share of gross sales", pct((w / total) * 100)],
            [`Share of ${p.fromNode?.name}`, pct((w / chTotal) * 100)],
          ]);
        },
      },
      plotOptions: {
        sankey: {
          nodeWidth: 12,
          nodePadding: 22,
          linkOpacity: 0.35,
          borderWidth: 0,
          minLinkWidth: 1,
          states: { hover: { linkOpacity: 0.7 }, inactive: { linkOpacity: 0.1, opacity: 0.4 } },
          dataLabels: {
            enabled: true,
            crop: false,
            overflow: "allow",
            nodeFormatter() {
              const p = (this as unknown as { point: { id: string } }).point;
              return labelFor(p.id);
            },
            style: { fontFamily: SANS, fontSize: "11px", fontWeight: "400", textOutline: "none", color: INK },
          },
        },
      },
      series: [
        {
          type: "sankey",
          name: "Gross sales",
          nodes: [
            // colour, colorIndex and dataLabels are set on every node and link,
            // keyed by entity: chart.update() merges point options, so anything
            // left implicit would carry over from the previous filter state.
            ...chans.map((c) => ({
              id: `ch:${c.id}`,
              name: c.label,
              column: 0,
              color: "#525252",
              colorIndex: CHANNELS.findIndex((x) => x.id === c.id),
              dataLabels: { align: "right" as const, x: -18 },
            })),
            ...acs.map((a) => ({
              id: `ac:${a.id}`,
              name: a.label,
              column: 1,
              color: a.color,
              colorIndex: ASSET_CLASSES.findIndex((x) => x.id === a.id),
              dataLabels: { align: "left" as const, x: 18 },
            })),
          ],
          data: s.sankey.map((l) => ({
            from: `ch:${l.ch}`,
            to: `ac:${l.ac}`,
            weight: l.sales,
            color: AC_BY_ID[l.ac].color,
            colorIndex: ASSET_CLASSES.findIndex((x) => x.id === l.ac),
          })),
        },
      ],
    };
  }, [model, s.sankey]);

  const empty = model.total <= 0;

  return (
    <Tile
      area={area}
      title="Where gross sales came from, and went"
      subtitle={`Gross sales by channel → asset class · ${PERIOD_BY_ID[period].range}`}
      actions={<ViewToggle subject="Sales sankey" value={view} onChange={setView} />}
      footer={
        empty ? undefined : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              <span className="font-mono text-neutral-800 tabular-nums">{money(model.total)}</span> gross
              sales. Band width is £; colour follows the asset class it lands in.
            </span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {model.acs.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1.5 text-neutral-600">
                  <Swatch color={a.color} />
                  {a.label}
                </span>
              ))}
            </span>
          </div>
        )
      }
    >
      {empty ? (
        <EmptyState title="No gross sales in this slice" body="Widen the filters to see where sales came from." />
      ) : view === "chart" ? (
        <HighchartsView options={options} height={316} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Gross sales by channel and asset class, £</caption>
            <thead>
              <tr className="border-b border-neutral-200">
                <th scope="col" className={TH}>
                  Channel
                </th>
                {model.acs.map((a) => (
                  <th key={a.id} scope="col" className={`${TH} text-right`}>
                    <span className="inline-flex items-center gap-1.5">
                      <Swatch color={a.color} className="h-2 w-2" />
                      {a.label}
                    </span>
                  </th>
                ))}
                <th scope="col" className={`${TH} text-right`}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {model.chans.map((c) => (
                <tr key={c.id}>
                  <th scope="row" className="px-2 py-1.5 text-xs font-medium text-neutral-800">
                    {c.label}
                  </th>
                  {model.acs.map((a) => (
                    <td key={a.id} className={TD_NUM}>
                      {money(model.cell.get(`${c.id}|${a.id}`) ?? 0)}
                    </td>
                  ))}
                  <td className={`${TD_NUM} font-semibold`}>{money(model.chTot.get(c.id) ?? 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-200">
                <th scope="row" className="px-2 py-1.5 text-xs font-semibold text-neutral-900">
                  Total
                </th>
                {model.acs.map((a) => (
                  <td key={a.id} className={`${TD_NUM} font-semibold`}>
                    {money(model.acTot.get(a.id) ?? 0)}
                  </td>
                ))}
                <td className={`${TD_NUM} font-semibold`}>{money(model.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Tile>
  );
}

/* --- 3. Monthly gross sales vs redemptions, net as a line ---------------------- */

function axisMoney(v: number, bn: boolean) {
  const sign = v < 0 ? MINUS : "";
  const a = Math.abs(v);
  return bn ? `${sign}£${(a / 1000).toFixed(a % 1000 === 0 ? 0 : 1)}bn` : `${sign}£${Math.round(a)}m`;
}

export function MonthlyTile({ s, area, period }: { s: Summary; area: string; period: PeriodKey }) {
  const [view, setView] = useState<View>("chart");
  const p = PERIOD_BY_ID[period];

  const options = useMemo<Options>(() => {
    const labels = s.monthly.map((m) => `${m.label.slice(0, 3)}${m.bucket === LAST ? "*" : ""}`);
    const maxAbs = Math.max(1, ...s.monthly.flatMap((m) => [m.sales, m.red, Math.abs(m.net)]));
    const bn = maxAbs >= 800;
    const j0 = Math.max(0, p.from - 1);
    return {
      chart: { type: "column", spacing: [10, 4, 4, 0] },
      xAxis: {
        categories: labels,
        tickLength: 0,
        labels: { autoRotation: undefined, rotation: 0, style: { fontSize: "10px", textOverflow: "none" } },
        plotBands:
          period === "12M"
            ? []
            : [
                {
                  from: j0 - 0.5,
                  to: labels.length - 0.5,
                  color: "rgba(2,132,199,0.07)",
                  label: {
                    text: p.label,
                    align: "left",
                    x: 6,
                    y: 12,
                    style: { color: "#0369a1", fontSize: "10px", fontWeight: "600" },
                  },
                },
              ],
      },
      yAxis: {
        title: { text: undefined },
        labels: { formatter: (ctx) => axisMoney(Number(ctx.value), bn) },
        // zIndex 2, not 3: at 3 the plot-line group ties with the series group
        // and its DOM order flips after chart.update(), so the baseline would
        // draw over the columns only after a filter round trip.
        plotLines: [{ id: "zero", value: 0, color: "#a3a3a3", width: 1, zIndex: 2 }],
      },
      legend: {
        enabled: true,
        align: "right",
        verticalAlign: "top",
        floating: false,
        margin: 4,
        itemDistance: 14,
        symbolHeight: 9,
        symbolWidth: 9,
        padding: 0,
      },
      tooltip: {
        shared: true,
        formatter() {
          const ctx = this as unknown as { x?: number | string; points?: { point: { index: number } }[] };
          const i = ctx.points?.[0]?.point.index ?? 0;
          const m = s.monthly[i];
          const name = m.bucket === LAST ? `${m.label} (1–18 Sep)` : m.label;
          return tip(money(m.net, { signed: true }), `Net flows · ${name}`, [
            ["Gross sales", money(m.sales)],
            ["Redemptions", money(m.red)],
          ]);
        },
      },
      plotOptions: {
        column: { maxPointWidth: 24, groupPadding: 0.16, pointPadding: 0.04 },
        series: { states: { inactive: { opacity: 0.35 } } },
      },
      series: [
        { type: "column", name: "Gross sales", color: CAT[0], data: s.monthly.map((m) => m.sales) },
        { type: "column", name: "Redemptions", color: CAT[1], data: s.monthly.map((m) => m.red) },
        {
          type: "line",
          name: "Net flows",
          color: INK,
          lineWidth: 2,
          zIndex: 5,
          marker: { enabled: false, radius: 4, lineWidth: 2, lineColor: "#ffffff", symbol: "square" },
          states: { hover: { lineWidthPlus: 0 } },
          data: s.monthly.map((m) => m.net),
        },
      ],
    };
  }, [s.monthly, p, period]);

  return (
    <Tile
      area={area}
      title="Monthly sales vs redemptions"
      subtitle="Gross, Oct 25 – Sep 26 · one £ axis · line = net flow"
      actions={<ViewToggle subject="Monthly flows" value={view} onChange={setView} />}
      footer={
        <span>
          * Sep 26 is month to date (1–18 Sep).{" "}
          {period !== "12M" && (
            <>
              Shaded months are the <span className="font-medium text-neutral-700">{p.long.toLowerCase()}</span>{" "}
              window.
            </>
          )}
        </span>
      }
    >
      {view === "chart" ? (
        <HighchartsView options={options} height={284} />
      ) : (
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Monthly gross sales, redemptions and net flows</caption>
          <thead>
            <tr className="border-b border-neutral-200">
              <th scope="col" className={TH}>
                Month
              </th>
              <th scope="col" className={`${TH} text-right`}>
                Gross sales
              </th>
              <th scope="col" className={`${TH} text-right`}>
                Redemptions
              </th>
              <th scope="col" className={`${TH} text-right`}>
                Net
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {s.monthly.map((m) => (
              <tr key={m.bucket} className={m.bucket >= p.from ? "bg-sky-50/50" : undefined}>
                <th scope="row" className="px-2 py-1 font-mono text-[11px] font-normal text-neutral-700">
                  {m.bucket === LAST ? `${m.label}*` : m.label}
                </th>
                <td className={`${TD_NUM} py-1`}>{money(m.sales)}</td>
                <td className={`${TD_NUM} py-1`}>{money(m.red)}</td>
                <td className={`${TD_NUM} py-1 font-semibold`}>{money(m.net, { signed: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Tile>
  );
}

/* --- hero sparkline (SVG, pixel-exact via ResizeObserver) ------------------------ */

export function NetSparkline({
  data,
  from,
  height = 64,
}: {
  data: { bucket: number; label: string; net: number }[];
  from: number;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const w = Math.max(120, useWidth(ref, 240));
  const n = data.length;
  const pad = { l: 4, r: 8, t: 6, b: 6 };
  const vals = data.map((d) => d.net);
  const max = Math.max(0, ...vals);
  const min = Math.min(0, ...vals);
  const span = max - min || 1;
  const step = (w - pad.l - pad.r) / Math.max(1, n - 1);
  const x = (i: number) => pad.l + i * step;
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (height - pad.t - pad.b);
  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const areaPath = `${line}L${x(n - 1).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`;
  const j0 = Math.max(0, from - 1);
  const bandX = j0 === 0 ? 0 : x(j0) - step / 2;
  const last = data[n - 1];
  const peak = vals.indexOf(Math.max(...vals));

  return (
    <div ref={ref} className="w-full">
      <svg
        width={w}
        height={height}
        role="img"
        aria-label={`Net flows by month, ${data[0]?.label} to ${last?.label}: ${data
          .map((d) => `${d.label} ${money(d.net, { signed: true })}`)
          .join(", ")}`}
        className="block"
      >
        {from > 0 && <rect x={bandX} y={0} width={w - bandX} height={height} fill="#f0f9ff" />}
        <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke="#d4d4d4" strokeWidth={1} />
        <path d={areaPath} fill={ACCENT} fillOpacity={0.1} />
        <path d={line} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="square" />
        <rect
          x={x(peak) - 3}
          y={y(vals[peak]) - 3}
          width={6}
          height={6}
          fill="#ffffff"
          stroke={ACCENT}
          strokeWidth={1.5}
        />
        <rect
          x={x(n - 1) - 5}
          y={y(vals[n - 1]) - 5}
          width={10}
          height={10}
          fill={ACCENT}
          stroke="#ffffff"
          strokeWidth={2}
        />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-neutral-400 tabular-nums">
        <span>{data[0]?.label}</span>
        <span>
          peak {data[peak]?.label} {money(vals[peak], { signed: true })}
        </span>
        <span>
          {last?.label} MTD {money(last?.net ?? 0, { signed: true })}
        </span>
      </div>
    </div>
  );
}
