import { useMemo, useState } from "react";
import type { Options, Point, XAxisPlotBandsOptions } from "highcharts";
import HighchartsView from "../highcharts/HighchartsView";
import { QUARTERS, RISK_TYPES, type Bridge, type RatioDef, type RatioKey, type Snapshot } from "./model";
import { ACCENT, CAT, INK, STATUS, bn, num, pct, signed, signedBn } from "./format";
import { Figure, TwinTable, type View } from "./ui";

/* Highcharts figures for the report: the CET1 bridge (waterfall), RWAs by
 * risk type (stacked column) and the leverage/liquidity small multiples.
 * Every figure has a Chart | Table twin in its caption. */

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const LABEL_STYLE = { color: "#404040", fontSize: "10px", fontFamily: MONO, fontWeight: "600", textOutline: "none" };

function tip(value: string, label: string, extra?: string) {
  return (
    `<div style="min-width:120px">` +
    `<div style="font-family:${MONO};font-weight:700;font-size:12px">${value}</div>` +
    `<div style="color:#d4d4d4;font-size:11px">${label}</div>` +
    (extra ? `<div style="color:#a3a3a3;font-size:10px;margin-top:2px">${extra}</div>` : "") +
    `</div>`
  );
}

type Custom = { label?: string; tip?: string; sub?: string };
const customOf = (p: Point) => (p.options.custom ?? {}) as Custom;

/* --- 2.1 CET1 bridge ----------------------------------------------------- */

export function BridgeFigure({
  bridge,
  figLabel,
  basisLabel,
  sliceKey,
}: {
  bridge: Bridge;
  figLabel: string;
  basisLabel: string;
  /** Identifies the entity x basis x period slice the bridge was built from. */
  sliceKey: string;
}) {
  const [view, setView] = useState<View>("chart");
  const from = QUARTERS[bridge.from].label;
  const to = QUARTERS[bridge.to].label;

  const options = useMemo<Options>(() => {
    const open = bridge.opening * 100;
    let level = open;
    const levels = [open];
    for (const it of bridge.items) {
      level += it.bps;
      levels.push(level);
    }
    const lo = Math.min(...levels);
    const hi = Math.max(...levels);
    const span = Math.max(hi - lo, 40);
    const tick = span <= 90 ? 25 : span <= 220 ? 50 : 100;
    const min = Math.floor((lo - span * 0.35) / tick) * tick;
    const max = Math.ceil((hi + span * 0.3) / tick) * tick;

    const data = [
      {
        name: `${from} (opening)`,
        y: open,
        color: INK,
        custom: { label: pct(bridge.opening, 2), tip: pct(bridge.opening, 2), sub: `CET1 ${bn(bridge.c0)} · RWAs ${bn(bridge.r0)}` },
      },
      ...bridge.items.map((it) => ({
        name: it.label,
        y: it.bps,
        color: it.bps >= 0 ? STATUS.good : STATUS.bad,
        // Label at the bar's end: the top for increases, the bottom for decreases.
        ...(it.bps < 0 ? { dataLabels: { inside: true, verticalAlign: "bottom" as const, y: 17 } } : {}),
        custom: {
          label: signed(it.bps, 0),
          tip: signed(it.bps, 0, "bps"),
          sub: [
            it.capital ? `CET1 ${signedBn(it.capital, 2)}` : "",
            it.rwa ? `RWAs ${signedBn(it.rwa, 1)}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
        },
      })),
      {
        name: `${to} (closing)`,
        isSum: true,
        color: INK,
        custom: { label: pct(bridge.closing, 2), tip: pct(bridge.closing, 2), sub: `CET1 ${bn(bridge.c1)} · RWAs ${bn(bridge.r1)}` },
      },
    ];

    const opts: Options = {
      chart: { type: "waterfall", spacing: [16, 8, 4, 4] },
      xAxis: {
        type: "category",
        lineColor: "#d4d4d4",
        labels: { style: { color: "#525252", fontSize: "10px", textOverflow: "none" }, autoRotation: [0] },
      },
      yAxis: {
        title: { text: undefined },
        min,
        max,
        tickInterval: tick,
        startOnTick: false,
        endOnTick: false,
        labels: { formatter: (ctx) => pct(Number(ctx.value) / 100, 2) },
      },
      legend: { enabled: false },
      tooltip: {
        formatter: function () {
          const c = customOf(this);
          return tip(c.tip ?? "", String(this.name), c.sub);
        },
      },
      plotOptions: {
        waterfall: {
          lineWidth: 1,
          lineColor: "#a3a3a3",
          dashStyle: "Solid",
          borderWidth: 0,
          maxPointWidth: 24,
          pointPadding: 0.1,
          groupPadding: 0.1,
          dataLabels: {
            enabled: true,
            inside: false,
            crop: false,
            overflow: "allow",
            style: LABEL_STYLE,
            formatter: function () {
              return customOf(this as unknown as Point).label ?? "";
            },
          },
        },
      },
      // Keyed by slice: a new series per filter state, so per-point label
      // placement (top for increases, bottom for decreases) never goes stale.
      series: [{ type: "waterfall", id: `bridge-${sliceKey}`, name: "CET1 ratio bridge", data }],
    };
    return opts;
  }, [bridge, from, to, sliceKey]);

  const rows = [
    [`${from} CET1 ratio`, bn(bridge.c0, 2), bn(bridge.r0, 1), pct(bridge.opening, 2)],
    ...bridge.items.map((it) => [
      it.label,
      it.capital ? signedBn(it.capital, 2) : "–",
      it.rwa ? signedBn(it.rwa, 1) : "–",
      signed(it.bps, 0, "bps"),
    ]),
  ];

  return (
    <Figure
      label={figLabel}
      title={`CET1 ratio bridge, ${from} to ${to}`}
      meta={`${basisLabel} · basis points of RWAs · axis truncated`}
      view={view}
      onView={setView}
    >
      {view === "chart" ? (
        <HighchartsView options={options} height={320} />
      ) : (
        <TwinTable
          caption="CET1 ratio bridge"
          head={["Driver", "CET1 capital", "RWAs", "Ratio impact"]}
          rows={rows}
          foot={[`${to} CET1 ratio`, bn(bridge.c1, 2), bn(bridge.r1, 1), pct(bridge.closing, 2)]}
        />
      )}
    </Figure>
  );
}

/* --- 3.1 RWAs by risk type ----------------------------------------------- */

export function RwaStackFigure({
  history,
  reportQ,
  compareQ,
  figLabel,
}: {
  history: Snapshot[];
  reportQ: number;
  compareQ: number | null;
  figLabel: string;
}) {
  const [view, setView] = useState<View>("chart");

  const options = useMemo<Options>(() => {
    const cats = history.map((s) => QUARTERS[s.q].short);
    const bands: XAxisPlotBandsOptions[] = [
      {
        from: reportQ - 0.5,
        to: reportQ + 0.5,
        color: "rgba(30, 58, 138, 0.06)",
        label: { text: "Reporting", verticalAlign: "top", y: 12, style: { color: ACCENT, fontSize: "10px", fontWeight: "600" } },
      },
    ];
    if (compareQ !== null)
      bands.push({
        from: compareQ - 0.5,
        to: compareQ + 0.5,
        color: "rgba(115, 115, 115, 0.06)",
        label: { text: "Compare", verticalAlign: "top", y: 12, style: { color: "#737373", fontSize: "10px", fontWeight: "600" } },
      });
    const lastX = history.length - 1;
    return {
      chart: { type: "column", spacing: [8, 8, 4, 4] },
      xAxis: { categories: cats, plotBands: bands, lineColor: "#d4d4d4" },
      yAxis: {
        title: { text: "RWAs (£bn)" },
        reversedStacks: false,
        maxPadding: 0.08,
        stackLabels: {
          enabled: true,
          style: LABEL_STYLE,
          formatter: function () {
            return this.x === lastX ? `£${num(this.total ?? 0, 1)}bn` : "";
          },
        },
      },
      legend: { enabled: true, align: "left", verticalAlign: "top", margin: 12 },
      tooltip: {
        formatter: function () {
          const total = this.total ?? 0;
          return tip(
            `£${num(Number(this.y), 1)}bn`,
            `${this.series.name} · ${QUARTERS[history[this.index].q].label}`,
            `${pct((Number(this.y) / total) * 100, 1)} of £${num(total, 1)}bn`,
          );
        },
      },
      plotOptions: {
        column: {
          stacking: "normal",
          borderWidth: 1,
          borderColor: "#ffffff",
          maxPointWidth: 24,
          groupPadding: 0.15,
        },
      },
      series: RISK_TYPES.map((rt, i) => ({
        type: "column" as const,
        name: rt.label,
        color: CAT[i],
        data: history.map((s) => Math.round(s.rwaByRisk[rt.id] * 100) / 100),
      })),
    };
  }, [history, reportQ, compareQ]);

  const head = ["Quarter", ...RISK_TYPES.map((r) => r.short), "Total"];
  const rows = history.map((s) => [
    QUARTERS[s.q].label,
    ...RISK_TYPES.map((r) => num(s.rwaByRisk[r.id], 1)),
    num(s.rwa, 1),
  ]);

  return (
    <Figure
      label={figLabel}
      title="RWAs by risk type"
      meta={`£bn · ${QUARTERS[history[0].q].label} to ${QUARTERS[reportQ].label}`}
      view={view}
      onView={setView}
    >
      {view === "chart" ? (
        <HighchartsView options={options} height={300} />
      ) : (
        <TwinTable caption="RWAs by risk type, £bn" head={head} rows={rows} />
      )}
    </Figure>
  );
}

/* --- 4.x small multiples ------------------------------------------------- */

const NO_LINES: { value: number; label: string }[] = [];

export function TrendFigure({
  figLabel,
  title,
  def,
  history,
  compareQ,
  extraLines = NO_LINES,
}: {
  figLabel: string;
  title: string;
  def: RatioDef;
  history: Snapshot[];
  compareQ: number | null;
  extraLines?: { value: number; label: string }[];
}) {
  const [view, setView] = useState<View>("chart");
  const key: RatioKey = def.key;
  const dp = def.group === "liquidity" ? 1 : 2;
  const minLabel = def.key === "lev" ? "Minimum" : "Regulatory minimum";
  const minValue = def.stack[0].value;

  const options = useMemo<Options>(() => {
    const vals = history.map((s) => s.ratio[key]);
    const refs = [minValue, def.target, ...extraLines.map((l) => l.value)];
    const lo = Math.min(...vals, ...refs);
    const hi = Math.max(...vals, ...refs);
    const pad = (hi - lo) * 0.14;
    const lastX = history.length - 1;
    const opts: Options = {
      chart: { type: "line", spacing: [12, 12, 4, 4] },
      xAxis: {
        categories: history.map((s) => QUARTERS[s.q].short),
        lineColor: "#d4d4d4",
        labels: { autoRotation: [0], step: history.length > 5 ? 2 : 1 },
        crosshair: { color: "rgba(30,58,138,0.10)", width: 1 },
      },
      yAxis: {
        title: { text: undefined },
        min: lo - pad,
        max: hi + pad,
        startOnTick: false,
        endOnTick: false,
        labels: { formatter: (ctx) => `${num(Number(ctx.value), def.group === "liquidity" ? 0 : 1)}%` },
        plotLines: [
          {
            value: minValue,
            color: "#404040",
            width: 1.5,
            dashStyle: "Dash",
            zIndex: 3,
            label: {
              text: `${minLabel} ${pct(minValue, def.group === "liquidity" ? 0 : 2)}`,
              align: "right",
              x: -2,
              y: -5,
              style: { color: "#404040", fontSize: "10px" },
            },
          },
          ...extraLines.map((l) => ({
            value: l.value,
            color: "#737373",
            width: 1,
            dashStyle: "Dash" as const,
            zIndex: 3,
            label: {
              text: `${l.label} ${pct(l.value, 2)}`,
              align: "right" as const,
              x: -2,
              y: 12,
              style: { color: "#737373", fontSize: "10px" },
            },
          })),
          {
            value: def.target,
            color: "#a3a3a3",
            width: 1.5,
            dashStyle: "ShortDot",
            zIndex: 3,
            label: {
              text: `Target ${pct(def.target, def.group === "liquidity" ? 0 : 2)}`,
              align: "left",
              x: 2,
              y: -5,
              style: { color: "#737373", fontSize: "10px" },
            },
          },
        ],
      },
      legend: { enabled: false },
      tooltip: {
        shared: true,
        formatter: function () {
          const p = this.points?.[0] ?? this;
          const s = history[p.index];
          const sub =
            key === "lev"
              ? `Tier 1 ${bn(s.t1)} ÷ exposure ${bn(s.levExposure, 0)}`
              : key === "lcr"
                ? `HQLA ${bn(s.hqla)} ÷ outflows ${bn(s.nco)}`
                : `ASF ${bn(s.asf, 0)} ÷ RSF ${bn(s.rsf, 0)}`;
          return tip(pct(Number(p.y), dp), `${title} · ${QUARTERS[s.q].label}`, sub);
        },
      },
      plotOptions: {
        series: { states: { hover: { lineWidthPlus: 0 } } },
      },
      series: [
        {
          type: "line",
          name: title,
          color: ACCENT,
          lineWidth: 2,
          marker: { enabled: false, radius: 4, lineWidth: 2, lineColor: "#ffffff" },
          data: history.map((s, i) => {
            const y = s.ratio[key];
            if (i === lastX)
              return {
                y,
                marker: { enabled: true, fillColor: ACCENT, lineColor: "#ffffff", lineWidth: 2 },
                dataLabels: {
                  enabled: true,
                  align: "right" as const,
                  verticalAlign: "bottom" as const,
                  y: -6,
                  style: LABEL_STYLE,
                  format: pct(y, dp),
                },
              };
            if (compareQ !== null && s.q === compareQ)
              return {
                y,
                marker: { enabled: true, fillColor: "#ffffff", lineColor: ACCENT, lineWidth: 2 },
                dataLabels: { enabled: false },
              };
            // Point options merge on update, so every point states its marker
            // and label explicitly or a stale one survives a filter change.
            return {
              y,
              marker: { enabled: false, fillColor: ACCENT, lineColor: "#ffffff", lineWidth: 2 },
              dataLabels: { enabled: false },
            };
          }),
        },
      ],
    };
    return opts;
  }, [history, key, def, dp, title, minLabel, minValue, extraLines, compareQ]);

  const rows = history.map((s) => [QUARTERS[s.q].label, pct(s.ratio[key], dp)]);

  return (
    <Figure label={figLabel} title={title} view={view} onView={setView}>
      {view === "chart" ? (
        <HighchartsView options={options} height={230} />
      ) : (
        <TwinTable caption={title} head={["Quarter", "Ratio"]} rows={rows} />
      )}
    </Figure>
  );
}
