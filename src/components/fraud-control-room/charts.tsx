import { useMemo, useState, type CSSProperties } from "react";
import type { Options, PointOptionsObject } from "highcharts";
import HighchartsView from "../highcharts/HighchartsView";
import {
  BPD,
  BUCKET_SEC,
  MCCS,
  TODAY_MS,
  bandIndex,
  bucketBps,
  hourMccBps,
  walk,
  type RulePerf,
  type Selection,
} from "./model";
import { C, CAT, CONTEXT, HEAT, fmt1, fmtInt, hhmm, tip, withDark } from "./theme";
import { EmptyState, Panel, TwinTable, ViewToggle, type View } from "./ui";

/* The three chart panels on the wall. Each one memoises its Highcharts
 * options, merges them over the shared dark base, and carries a Chart | Table
 * toggle that swaps in the same numbers as a compact table. */

type Band = { lo: Float64Array; hi: Float64Array };
type PanelBox = { className?: string; style?: CSSProperties };

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const SHORT_MCC = ["Travel", "Electr.", "Gaming", "Grocery", "Fuel", "Fashion", "Crypto", "Gift"];

/* --- 1. Fraud bps, last 24h ------------------------------------------------- */

type TrendPoint = {
  bk: number;
  x: number;
  y: number;
  lo: number;
  hi: number;
  state: "above" | "below" | null;
};

export function FraudTrendPanel({
  sel,
  band,
  tickSec,
  tick,
  windowSec,
  windowLabel,
  reduced,
  height,
  className,
  style,
}: PanelBox & {
  sel: Selection;
  band: Band;
  tickSec: number;
  tick: number;
  windowSec: number;
  windowLabel: string;
  reduced: boolean;
  height: number;
}) {
  const [view, setView] = useState<View>("chart");
  const empty = sel.cells.length === 0;
  const bucketNow = Math.floor(tickSec / BUCKET_SEC);

  // History moves every 5 minutes; only the live bucket moves every tick.
  const base = useMemo(() => {
    const out: Omit<TrendPoint, "state">[] = [];
    for (let i = 0; i < BPD; i += 1) {
      const bk = bucketNow - (BPD - 1) + i;
      const bi = bandIndex(bk);
      out.push({
        bk,
        x: TODAY_MS + bk * BUCKET_SEC * 1000,
        y: bucketBps(bk, sel),
        lo: band.lo[bi],
        hi: band.hi[bi],
      });
    }
    return out;
  }, [sel, band, bucketNow]);

  const points = useMemo<TrendPoint[]>(
    () =>
      base.map((p, i) => {
        const y = i === base.length - 1 ? p.y * (1 + 0.035 * walk(tick, 7)) : p.y;
        return { ...p, y, state: y > p.hi ? "above" : y < p.lo ? "below" : null };
      }),
    [base, tick],
  );

  const above = points.filter((p) => p.state === "above").length;
  const last = points[points.length - 1];

  const options = useMemo<Options>(() => {
    const byX = new Map(points.map((p) => [p.x, p]));
    const lastIdx = points.length - 1;
    const winFrom = TODAY_MS + (tickSec - windowSec) * 1000;
    const winTo = TODAY_MS + tickSec * 1000;
    // Marker and label options are always spelled out, on or off: Highcharts
    // merges point updates, so an omitted option would keep a stale marker.
    const data: PointOptionsObject[] = points.map((p, i) => ({
      x: p.x,
      y: p.y,
      marker: p.state
        ? {
            enabled: true,
            symbol: "square",
            radius: 3,
            lineWidth: 1,
            lineColor: C.panel,
            fillColor: p.state === "above" ? C.bad : C.t2,
          }
        : { enabled: false },
      dataLabels:
        i === lastIdx
          ? {
              enabled: true,
              format: "{y:.1f}",
              align: "right",
              verticalAlign: "bottom",
              x: -2,
              y: -8,
              style: { color: C.t1, fontSize: "11px", fontWeight: "700" },
            }
          : { enabled: false },
    }));

    return withDark(reduced, {
      chart: { spacing: [6, 10, 2, 0] },
      legend: {
        enabled: true,
        align: "right",
        verticalAlign: "top",
        margin: 4,
        padding: 0,
        itemDistance: 14,
        symbolHeight: 8,
        symbolWidth: 12,
      },
      xAxis: {
        type: "datetime",
        tickPixelInterval: 90,
        labels: { format: "{value:%H:%M}" },
        minPadding: 0,
        maxPadding: 0,
        plotBands:
          windowSec < 86400
            ? [
                {
                  from: winFrom,
                  to: winTo,
                  color: "rgba(34,211,238,0.09)",
                  zIndex: 1,
                  label: {
                    text: `${windowLabel} window`,
                    align: "right",
                    textAlign: "right",
                    verticalAlign: "top",
                    x: -4,
                    y: 12,
                    style: { color: C.accent, fontSize: "10px", fontWeight: "600", width: 90, whiteSpace: "nowrap" },
                  },
                },
              ]
            : [],
      },
      yAxis: {
        title: { text: undefined },
        min: 0,
        tickAmount: 5,
        labels: { format: "{value:.0f}" },
      },
      tooltip: {
        shared: true,
        formatter() {
          const p = byX.get(Number(this.x));
          if (!p) return false;
          const s = p.bk * BUCKET_SEC;
          const when = `${hhmm(s)}–${hhmm(s + BUCKET_SEC)}${p.bk < 0 ? " yesterday" : ""}${
            p === points[lastIdx] ? " · live" : ""
          }`;
          const status =
            p.state === "above"
              ? `<span style="color:${C.bad}">▲</span> Above normal range`
              : p.state === "below"
                ? "▼ Below normal range"
                : "Within normal range";
          return tip(
            when,
            [
              { label: "Fraud rate", value: `${fmt1(p.y)} bps`, swatch: CAT[0], strong: true },
              { label: "Normal p10–p90", value: `${fmt1(p.lo)}–${fmt1(p.hi)}`, swatch: CONTEXT },
            ],
            status,
          );
        },
      },
      series: [
        {
          type: "arearange",
          name: "Normal (30d p10–p90)",
          data: points.map((p) => [p.x, p.lo, p.hi]),
          color: CONTEXT,
          fillOpacity: 0.3,
          lineWidth: 0,
          marker: { enabled: false },
          zIndex: 0,
          states: { hover: { enabled: false } },
        },
        {
          type: "areaspline",
          name: "Fraud bps",
          data,
          color: CAT[0],
          fillOpacity: 0.1,
          lineWidth: 2,
          zIndex: 2,
          threshold: 0,
          marker: { enabled: false, radius: 4, lineWidth: 2, lineColor: C.panel, symbol: "square" },
        },
        {
          type: "scatter",
          name: "Outside normal",
          data: [],
          color: C.bad,
          marker: { symbol: "square", radius: 4 },
          enableMouseTracking: false,
        },
      ],
    });
  }, [points, reduced, tickSec, windowSec, windowLabel]);

  return (
    <Panel
      className={className}
      style={style}
      title="Fraud rate, last 24h"
      meta={
        empty ? undefined : (
          <>
            bps of sales value · 5-min grain ·{" "}
            <span style={{ color: C.t1 }}>
              {above} of {BPD}
            </span>{" "}
            buckets above normal · now{" "}
            <span className="font-mono tabular-nums" style={{ color: C.t1 }}>
              {fmt1(last.y)}
            </span>
          </>
        )
      }
      right={<ViewToggle name="Fraud rate" view={view} onChange={setView} />}
    >
      {empty ? (
        <EmptyState>Select at least one scheme to see fraud rate.</EmptyState>
      ) : view === "chart" ? (
        <HighchartsView options={options} height={height} />
      ) : (
        <TwinTable
          label="Fraud rate by 5-minute bucket, newest first"
          height={height}
          head={[
            { label: "Bucket" },
            { label: "Fraud bps", align: "right" },
            { label: "Normal p10", align: "right" },
            { label: "Normal p90", align: "right" },
            { label: "Status" },
          ]}
          rows={points
            .slice()
            .reverse()
            .map((p) => [
              `${hhmm(p.bk * BUCKET_SEC)}${p.bk < 0 ? " (yday)" : ""}`,
              fmt1(p.y),
              fmt1(p.lo),
              fmt1(p.hi),
              p.state === "above" ? (
                <span>
                  <span style={{ color: C.bad }}>▲</span> Above
                </span>
              ) : p.state === "below" ? (
                "▼ Below"
              ) : (
                <span style={{ color: C.t2 }}>Normal</span>
              ),
            ])}
        />
      )}
    </Panel>
  );
}

/* --- 2. Heatmap: hour of day × MCC group ------------------------------------ */

export function HeatmapPanel({
  sel,
  tickSec,
  reduced,
  height,
  className,
  style,
}: PanelBox & { sel: Selection; tickSec: number; reduced: boolean; height: number }) {
  const [view, setView] = useState<View>("chart");
  const empty = sel.cells.length === 0;
  const bucketNow = Math.floor(tickSec / BUCKET_SEC);
  const curHour = Math.floor(bandIndex(bucketNow) / 12);
  const grid = useMemo(() => hourMccBps(bucketNow, sel), [bucketNow, sel]);

  const hottest = useMemo(() => {
    let best = { h: 0, m: 0, v: 0 };
    grid.forEach((row, h) =>
      row.forEach((v, m) => {
        if (v > best.v) best = { h, m, v };
      }),
    );
    return best;
  }, [grid]);

  // Linear scale up to a rounded ceiling over the slice's hottest cell, so
  // the cells under attack are the brightest thing on the panel.
  const ceiling = Math.max(10, Math.ceil(hottest.v / 10) * 10);

  const options = useMemo<Options>(() => {
    const data: PointOptionsObject[] = [];
    grid.forEach((row, h) =>
      row.forEach((v, m) => {
        // Unique ids: heatmap cells share x values, and without an id
        // Highcharts matches updated points by x and drops cells on update.
        data.push({ id: `c${h}-${m}`, x: h, y: m, value: Math.min(ceiling, v), custom: { raw: v } });
      }),
    );
    return withDark(reduced, {
      chart: { type: "heatmap", spacing: [8, 2, 2, 0] },
      xAxis: {
        categories: HOURS,
        crosshair: false,
        lineWidth: 0,
        tickLength: 0,
        gridLineWidth: 0,
        labels: {
          rotation: 0,
          step: 1,
          style: { fontSize: "9px" },
          formatter() {
            const h = Number(this.pos);
            return h === curHour
              ? `<span style="color:${C.accent};font-weight:700">${this.value}</span>`
              : String(this.value);
          },
        },
        plotLines: [
          { value: curHour - 0.5, color: C.accent, width: 1, zIndex: 5 },
          { value: curHour + 0.5, color: C.accent, width: 1, zIndex: 5 },
        ],
      },
      yAxis: {
        categories: [...MCCS],
        reversed: true,
        title: { text: undefined },
        gridLineWidth: 0,
        labels: { style: { color: C.t2, fontSize: "10px", fontFamily: "inherit" } },
      },
      colorAxis: {
        min: 0,
        max: ceiling,
        startOnTick: false,
        endOnTick: false,
        tickPositions: [0, ceiling / 2, ceiling],
        stops: HEAT.map((c, i) => [i / (HEAT.length - 1), c] as [number, string]),
        labels: { style: { color: C.t2, fontSize: "9px" } },
        gridLineColor: C.panel,
      },
      legend: {
        enabled: true,
        layout: "vertical",
        align: "right",
        verticalAlign: "middle",
        margin: 6,
        padding: 2,
        symbolWidth: 8,
        symbolHeight: Math.max(80, height - 70),
        title: { text: "bps", style: { color: C.t2, fontSize: "9px", fontWeight: "600" } },
      },
      tooltip: {
        formatter() {
          const p = this as unknown as { x: number; y: number; custom: { raw: number } };
          const yday = p.x > curHour;
          return tip(
            `${HOURS[p.x]}:00–${HOURS[(p.x + 1) % 24]}:00 ${yday ? "yesterday" : "today"}${
              p.x === curHour ? " · live" : ""
            }`,
            [
              { label: MCCS[p.y], value: `${fmt1(p.custom.raw)} bps`, strong: true },
            ],
            "Fraud losses as bps of sales value",
          );
        },
      },
      series: [
        {
          type: "heatmap",
          name: "Fraud bps",
          data,
          borderWidth: 1,
          borderColor: C.panel,
          states: { hover: { brightness: 0.15 } },
        },
      ],
    });
  }, [grid, curHour, reduced, height, ceiling]);

  return (
    <Panel
      className={className}
      style={style}
      title="Where it's hitting"
      meta={
        empty ? undefined : (
          <>
            fraud bps · hour × merchant group · 24h · hottest{" "}
            <span style={{ color: C.t1 }}>
              {MCCS[hottest.m]} {HOURS[hottest.h]}:00
            </span>
          </>
        )
      }
      right={<ViewToggle name="Heatmap" view={view} onChange={setView} />}
    >
      {empty ? (
        <EmptyState>Select at least one scheme to see the heatmap.</EmptyState>
      ) : view === "chart" ? (
        <HighchartsView options={options} height={height} />
      ) : (
        <TwinTable
          label="Fraud bps by hour of day and merchant category group"
          height={height}
          head={[{ label: "Hour" }, ...SHORT_MCC.map((m) => ({ label: m, align: "right" as const }))]}
          rows={grid.map((row, h) => [
            <span key="h" style={{ color: h === curHour ? C.accent : undefined }}>
              {HOURS[h]}:00{h > curHour ? " (yday)" : ""}
            </span>,
            ...row.map((v) => fmt1(v)),
          ])}
        />
      )}
    </Panel>
  );
}

/* --- 3. Rule performance scatter --------------------------------------------- */

const TARGET = 25; // precision floor, % of alerts confirmed as fraud

export function RulesPanel({
  perf,
  sliceKey,
  windowLabel,
  reduced,
  height,
  empty,
  className,
  style,
}: PanelBox & {
  perf: RulePerf[];
  /** Channel × scheme × window key; a new slice replaces the series. */
  sliceKey: string;
  windowLabel: string;
  reduced: boolean;
  height: number;
  empty: boolean;
}) {
  const [view, setView] = useState<View>("chart");
  const active = useMemo(() => perf.filter((r) => r.alerts > 0), [perf]);

  const worst = useMemo(() => {
    const fp = (r: RulePerf) => r.alerts * (1 - r.precision);
    const below = active.filter((r) => r.precision * 100 < TARGET).sort((a, b) => fp(b) - fp(a));
    const rest = active.filter((r) => !below.includes(r)).sort((a, b) => a.precision - b.precision);
    return [...below, ...rest].slice(0, 2).map((r) => r.id);
  }, [active]);

  const liveTotals = useMemo(() => {
    const live = active.filter((r) => r.mode === "live");
    const alerts = live.reduce((s, r) => s + r.alerts, 0);
    const confirmed = live.reduce((s, r) => s + r.confirmed, 0);
    return { alerts, precision: alerts ? (confirmed / alerts) * 100 : 0 };
  }, [active]);

  const options = useMemo<Options>(() => {
    const xs = active.map((r) => r.alerts);
    const sorted = [...xs].sort((a, b) => a - b);
    const med = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 1;
    const xmin = Math.max(0.8, (sorted[0] ?? 1) / 1.8);
    const xmax = (sorted[sorted.length - 1] ?? 10) * 1.8;
    // The worst two often sit together: label the higher one above its
    // point and the lower one below, so the pair fans apart vertically.
    const worstPerf = active.filter((r) => worst.includes(r.id));
    const topWorst = worstPerf.reduce<RulePerf | null>(
      (a, r) => (!a || r.precision > a.precision ? r : a),
      null,
    );
    /* Highcharts rebuilds a data label whose options change and can orphan
     * the old one, so the series ids carry the slice and the label layout:
     * any change there replaces the series instead of merging into it. */
    const sig = `${sliceKey}|${worstPerf
      .map((r) => `${r.id}${r.id === topWorst?.id ? "a" : "b"}`)
      .join("|")}`;
    const toPoint = (r: RulePerf): PointOptionsObject => {
      const isWorst = worst.includes(r.id);
      const above = r.id === topWorst?.id;
      return {
        id: r.id,
        x: r.alerts,
        y: r.precision * 100,
        name: r.name,
        // Always explicit (see the trend chart): point updates merge.
        marker: { lineColor: isWorst ? C.bad : C.panel, lineWidth: 2 },
        custom: { id: r.id, mode: r.mode, confirmed: r.confirmed },
        dataLabels: isWorst
          ? {
              enabled: true,
              allowOverlap: true,
              crop: false,
              overflow: "allow",
              format: r.id,
              align: "center",
              x: 0,
              verticalAlign: above ? "bottom" : "top",
              y: above ? -5 : 5,
              // A halo in the panel colour keeps the label legible over markers.
              style: { color: C.t1, fontSize: "10px", fontWeight: "600", textOutline: `3px ${C.panel}` },
            }
          : { enabled: false },
      };
    };
    const quadrant = (text: string) => ({
      text,
      style: { color: C.t3, fontSize: "9px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.08em" },
    });
    return withDark(reduced, {
      chart: { type: "scatter", spacing: [6, 12, 4, 2] },
      legend: {
        enabled: true,
        align: "left",
        verticalAlign: "top",
        margin: 6,
        padding: 0,
        itemDistance: 14,
        symbolHeight: 9,
        symbolWidth: 9,
      },
      xAxis: {
        type: "logarithmic",
        crosshair: false,
        min: xmin,
        max: xmax,
        gridLineWidth: 1,
        title: { text: `Alerts in window (${windowLabel}, log)` },
        labels: { style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } },
        plotLines: [
          {
            value: med,
            color: "#4b5563",
            dashStyle: "Dash",
            width: 1,
            zIndex: 3,
            label: {
              text: `median ${fmtInt(med)}`,
              rotation: 0,
              verticalAlign: "top",
              align: "left",
              x: 4,
              y: 28,
              style: { color: C.t2, fontSize: "9px" },
            },
          },
        ],
        plotBands: [
          {
            from: xmin,
            to: med,
            color: "transparent",
            label: { ...quadrant("Precise · niche"), align: "left", verticalAlign: "top", x: 6, y: 12 },
          },
          {
            from: med,
            to: xmax,
            color: "transparent",
            label: {
              ...quadrant("Workhorses"),
              align: "right",
              textAlign: "right",
              verticalAlign: "top",
              x: -6,
              y: 12,
            },
          },
        ],
      },
      yAxis: {
        // −8 and 112 leave label gutters so no point ever sits on a corner label.
        min: -8,
        max: 112,
        startOnTick: false,
        endOnTick: false,
        tickPositions: [0, 20, 40, 60, 80, 100],
        title: { text: "Precision (% confirmed fraud)" },
        labels: { format: "{value}%" },
        plotLines: [
          {
            value: TARGET,
            color: "#4b5563",
            dashStyle: "Dash",
            width: 1,
            zIndex: 3,
            label: {
              text: `${TARGET}% target`,
              align: "right",
              textAlign: "right",
              x: -4,
              y: -4,
              style: { color: C.t2, fontSize: "9px" },
            },
          },
        ],
        plotBands: [
          {
            from: -8,
            to: TARGET,
            color: "rgba(244,63,94,0.035)",
            label: { ...quadrant("Quiet · low yield"), align: "left", verticalAlign: "bottom", x: 6, y: -4 },
          },
          {
            from: -8,
            to: TARGET,
            color: "transparent",
            label: {
              ...quadrant("Noisy · tune first"),
              align: "right",
              textAlign: "right",
              verticalAlign: "bottom",
              x: -6,
              y: -4,
            },
          },
        ],
      },
      tooltip: {
        formatter() {
          const p = this as unknown as {
            x: number;
            y: number;
            point: { name: string; custom: { id: string; mode: string; confirmed: number } };
          };
          const c = p.point.custom;
          return tip(
            `${c.id} · ${c.mode === "live" ? "Live" : "Shadow mode"}`,
            [
              { label: "Precision", value: `${fmt1(p.y)}%`, strong: true },
              { label: "Alerts", value: fmtInt(p.x) },
              { label: "Confirmed fraud", value: fmtInt(c.confirmed) },
              { label: "False positives", value: fmtInt(p.x - c.confirmed) },
            ],
            p.point.name,
          );
        },
      },
      plotOptions: {
        scatter: {
          marker: { radius: 5, lineWidth: 2, lineColor: C.panel },
          states: { hover: { halo: { size: 8, opacity: 0.2 } } },
        },
      },
      series: [
        {
          type: "scatter",
          id: `live|${sig}`,
          name: "Live rules",
          color: CAT[0],
          marker: { symbol: "square" },
          data: active.filter((r) => r.mode === "live").map(toPoint),
        },
        {
          type: "scatter",
          id: `shadow|${sig}`,
          name: "Shadow mode",
          color: CAT[1],
          marker: { symbol: "diamond", radius: 6 },
          data: active.filter((r) => r.mode === "shadow").map(toPoint),
        },
      ],
    });
  }, [active, worst, windowLabel, reduced, sliceKey]);

  return (
    <Panel
      className={className}
      style={style}
      title="Rule performance"
      meta={
        empty ? undefined : (
          <>
            live:{" "}
            <span className="font-mono tabular-nums" style={{ color: C.t1 }}>
              {fmt1(liveTotals.precision)}%
            </span>{" "}
            precision
          </>
        )
      }
      right={<ViewToggle name="Rule performance" view={view} onChange={setView} />}
    >
      {empty || active.length === 0 ? (
        <EmptyState>No rule alerts for this channel and scheme selection.</EmptyState>
      ) : view === "chart" ? (
        <HighchartsView options={options} height={height} />
      ) : (
        <TwinTable
          label={`Rule alert volume and precision, ${windowLabel} window`}
          height={height}
          head={[
            { label: "Rule" },
            { label: "Mode" },
            { label: "Alerts", align: "right" },
            { label: "Prec.", align: "right" },
            { label: "False +", align: "right" },
          ]}
          rows={[...active]
            .sort((a, b) => b.alerts - a.alerts)
            .map((r) => [
              <span key="r" title={r.name}>
                {r.id}
                {worst.includes(r.id) ? <span style={{ color: C.bad }}> ▼</span> : null}
              </span>,
              <span key="m" style={{ color: C.t2 }}>
                {r.mode === "live" ? "Live" : "Shadow"}
              </span>,
              fmtInt(r.alerts),
              `${fmt1(r.precision * 100)}%`,
              fmtInt(r.alerts - r.confirmed),
            ])}
        />
      )}
    </Panel>
  );
}
