import { useMemo, useState } from "react";
import type { Options, Point, SeriesOptionsType } from "highcharts";
import HighchartsView from "../highcharts/HighchartsView";
import {
  COLOR,
  LATEST_Q,
  LIQUIDITY_BUDGET,
  PEERS,
  STRATEGY_LABEL,
  gbp,
  mult,
  num,
  pct,
  qLabel,
  qShort,
  type Aggregate,
  type Fund,
  type Universe,
} from "./model";
import { Card, QuartileBadge, Readout, TD, TDL, TH, THL, ViewToggle, type View } from "./ui";

/* The three Highcharts cards. Each has a Chart | Table toggle whose table is
 * the same values the chart draws. */

const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Tooltip body: value first (bold), label second, swatch for identity. */
function tip(
  title: string,
  rows: { value: string; label: string; color?: string; dashed?: boolean }[],
  caption?: string,
) {
  const body = rows
    .map((r) => {
      const sw = r.color
        ? r.dashed
          ? `<span style="display:inline-block;width:10px;border-top:2px dashed ${r.color};margin-right:6px;vertical-align:middle"></span>`
          : `<span style="display:inline-block;width:8px;height:8px;background:${r.color};margin-right:6px"></span>`
        : "";
      return (
        `<div style="font-size:11px;line-height:1.55;white-space:nowrap">${sw}` +
        `<b style="font-variant-numeric:tabular-nums">${r.value}</b>` +
        ` <span style="color:#a3a3a3">${r.label}</span></div>`
      );
    })
    .join("");
  const cap = caption
    ? `<div style="color:#a3a3a3;font-size:10px;margin-top:3px">${caption}</div>`
    : "";
  return `<div style="font-weight:600;font-size:11px;margin-bottom:3px">${title}</div>${body}${cap}`;
}

/* --- 1. J-curve --------------------------------------------------------- */

export function JCurveCard({ agg, scope }: { agg: Aggregate; scope: string }) {
  const [view, setView] = useState<View>("chart");
  const { series, trough, breakeven } = agg;
  const last4 = series.slice(-4).reduce((s, p) => s + p.net, 0);

  const options = useMemo<Options>(() => {
    const byQ = new Map(series.map((s) => [s.q, s]));
    const short = series.length <= 12;
    const ticks = short
      ? series.map((s) => s.q)
      : series.filter((s) => s.q % 4 === 0).map((s) => s.q);
    const troughRight = trough.q - agg.firstQ > series.length * 0.62;
    const extent = Math.max(...series.map((s) => Math.max(s.dist, s.call, Math.abs(s.cum))));
    const axisDp = extent < 5 ? 1 : 0;

    return {
      chart: { height: 300, spacing: [12, 8, 4, 4] },
      xAxis: {
        min: agg.firstQ - 0.5,
        max: LATEST_Q + 0.5,
        tickPositions: ticks,
        labels: {
          formatter() {
            const q = Number(this.value);
            return short ? qShort(q) : String(Math.floor(q / 4));
          },
        },
        crosshair: { color: "rgba(162,28,175,0.08)" },
        plotLines: breakeven
          ? [
              {
                value: breakeven,
                color: "#525252",
                width: 1,
                dashStyle: "Dash",
                zIndex: 4,
                label: {
                  text: `Breakeven ${qLabel(breakeven)}`,
                  rotation: 0,
                  align: "right",
                  x: -6,
                  y: 14,
                  style: { color: COLOR.ink, fontSize: "10px", fontWeight: "600" },
                },
              },
            ]
          : [],
      },
      yAxis: {
        title: { text: undefined },
        labels: {
          formatter() {
            return gbp(Number(this.value), axisDp);
          },
        },
        plotLines: [{ value: 0, color: "#a3a3a3", width: 1, zIndex: 3 }],
        minPadding: 0.14,
      },
      legend: { align: "left", verticalAlign: "top", margin: 10, x: -6 },
      tooltip: {
        shared: true,
        formatter() {
          const s = byQ.get(Number(this.x));
          if (!s) return false;
          return tip(qLabel(s.q), [
            { value: gbp(-s.call, 1), label: "capital calls", color: COLOR.calls },
            { value: gbp(s.dist, 1), label: "distributions", color: COLOR.dists },
            { value: gbp(s.net, 1, true), label: "net cash flow" },
            { value: gbp(s.cum, 1), label: "cumulative net", color: COLOR.accent },
          ]);
        },
      },
      plotOptions: {
        column: {
          stacking: "normal",
          maxPointWidth: 24,
          pointPadding: 0.08,
          groupPadding: 0,
          borderWidth: 0,
        },
        series: { states: { inactive: { opacity: 0.35 } } },
      },
      series: [
        {
          type: "column",
          id: "dists",
          name: "Distributions",
          color: COLOR.dists,
          data: series.map((s) => [s.q, s.dist]),
        },
        {
          type: "column",
          id: "calls",
          name: "Capital calls",
          color: COLOR.calls,
          data: series.map((s) => [s.q, -s.call]),
        },
        {
          type: "line",
          id: "cum",
          name: "Cumulative net cash flow",
          color: COLOR.accent,
          lineWidth: 2,
          zIndex: 5,
          marker: { enabled: false, radius: 4, lineWidth: 2, lineColor: "#fff" },
          data: series.map((s) =>
            s.q === trough.q
              ? {
                  x: s.q,
                  y: s.cum,
                  marker: { enabled: true, radius: 5, fillColor: COLOR.accent },
                  dataLabels: {
                    enabled: true,
                    format: `Trough ${gbp(trough.value)}, ${qLabel(trough.q)}`,
                    // Below the minimum is the one place the line never goes.
                    align: troughRight ? "right" : "left",
                    verticalAlign: "top",
                    x: troughRight ? 8 : -8,
                    y: 6,
                    style: {
                      color: COLOR.ink,
                      fontFamily: SANS,
                      fontSize: "11px",
                      fontWeight: "600",
                      textOutline: "3px #ffffff",
                    },
                  },
                }
              : { x: s.q, y: s.cum },
          ),
        },
      ],
    };
  }, [series, trough, breakeven, agg.firstQ]);

  // Table twin: calendar-year totals (the quarterly detail is in the statement).
  const years = useMemo(() => {
    const m = new Map<number, { call: number; dist: number; cum: number; nav: number }>();
    for (const s of series) {
      const y = Math.floor(s.q / 4);
      const r = m.get(y) ?? { call: 0, dist: 0, cum: 0, nav: 0 };
      r.call += s.call;
      r.dist += s.dist;
      r.cum = s.cum;
      r.nav = s.nav;
      m.set(y, r);
    }
    return [...m.entries()].reverse();
  }, [series]);

  return (
    <Card
      title="J-curve and cash flows"
      subtitle={`${scope}: quarterly capital calls (below zero) and distributions (above), with cumulative net cash flow on the same £ axis`}
      actions={<ViewToggle view={view} onChange={setView} label="J-curve" />}
    >
      <Readout
        items={[
          {
            label: "Trough",
            value: gbp(trough.value),
            note: qLabel(trough.q),
          },
          {
            label: "Breakeven",
            value: breakeven ? qLabel(breakeven) : "Not yet",
            note: breakeven
              ? `${Math.round((breakeven - trough.q) / 4 * 10) / 10} yrs after trough`
              : `${gbp(-series[series.length - 1].cum)} still to recover`,
          },
          {
            label: "Net cash, last 4 qtrs",
            value: gbp(last4, 1, true),
            note: last4 >= 0 ? "self-funding" : "net contributor",
          },
        ]}
      />
      {view === "chart" ? (
        <div className="px-2 pt-1 pb-2">
          {/* Remount when the trough moves: Highcharts merges point-level
              options on update, so an old trough label would otherwise stay. */}
          <HighchartsView key={`${agg.firstQ}-${trough.q}`} options={options} height={300} />
        </div>
      ) : (
        <div className="px-1 pt-2 pb-2">
          <table className="w-full">
            <caption className="sr-only">Annual cash flows, £m</caption>
            <thead>
              <tr className="border-b border-neutral-200">
                <th scope="col" className={THL}>Year</th>
                <th scope="col" className={TH}>Calls £m</th>
                <th scope="col" className={TH}>Distributions £m</th>
                <th scope="col" className={TH}>Net £m</th>
                <th scope="col" className={TH}>Cumulative net £m</th>
                <th scope="col" className={TH}>Year-end NAV £m</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {years.map(([y, r]) => (
                <tr key={y}>
                  <th scope="row" className={`${TDL} font-medium`}>
                    {y}
                    {y === Math.floor(LATEST_Q / 4) && (
                      <span className="ml-1 font-sans text-[10px] text-neutral-400">H1</span>
                    )}
                  </th>
                  <td className={TD}>{num(-r.call)}</td>
                  <td className={TD}>{num(r.dist)}</td>
                  <td className={TD}>{num(r.dist - r.call)}</td>
                  <td className={TD}>{num(r.cum)}</td>
                  <td className={TD}>{num(r.nav)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* --- 2. Vintage quartile ranking ---------------------------------------- */

export function VintageCard({
  funds,
  selectedId,
  universe,
  vintages,
  onSelect,
}: {
  funds: Fund[];
  selectedId: string | null;
  universe: Universe;
  vintages: number[];
  onSelect: (id: string) => void;
}) {
  const [view, setView] = useState<View>("chart");
  const uniLabel =
    universe === "all" ? "all private capital" : STRATEGY_LABEL[universe].toLowerCase();

  const options = useMemo<Options>(() => {
    const bands = vintages.map((v) => PEERS[universe].get(v)!);
    // Spread funds that share a vintage so their dots don't sit on each other.
    const byVintage = new Map<number, Fund[]>();
    for (const f of funds) byVintage.set(f.vintage, [...(byVintage.get(f.vintage) ?? []), f]);
    const dot = (f: Fund) => {
      const peers = byVintage.get(f.vintage)!;
      const k = peers.indexOf(f);
      const off = peers.length === 1 ? 0 : -0.22 + (0.44 * k) / (peers.length - 1);
      return {
        x: vintages.indexOf(f.vintage) + off,
        y: (f.irr ?? 0) * 100,
        custom: { id: f.id },
      };
    };
    const fundById = new Map(funds.map((f) => [f.id, f]));
    const selected = selectedId ? funds.filter((f) => f.id === selectedId) : [];
    const others = selectedId ? funds.filter((f) => f.id !== selectedId) : funds;

    const click = {
      events: {
        click(this: Point) {
          const id = (this.options.custom as { id?: string } | undefined)?.id;
          if (id) onSelect(id);
        },
      },
    };

    const series: SeriesOptionsType[] = [
      {
        type: "columnrange",
        id: "band",
        name: "Peer interquartile range",
        color: COLOR.band,
        data: bands.map((b) => [b.lower * 100, b.upper * 100]),
      },
      {
        type: "errorbar",
        id: "median",
        name: "Peer median",
        color: COLOR.median,
        data: bands.map((b) => [b.median * 100, b.median * 100]),
        enableMouseTracking: false,
      },
      {
        type: "scatter",
        id: "funds",
        name: selectedId ? `Other ${uniLabel} funds` : "Programme funds",
        color: selectedId ? COLOR.other : COLOR.accent,
        marker: { symbol: "circle", radius: 5, lineWidth: 2, lineColor: "#fff" },
        data: others.map(dot),
        point: click,
        zIndex: 3,
      },
    ];
    if (selected.length) {
      series.push({
        type: "scatter",
        id: "selected",
        name: selected[0].name,
        color: COLOR.accent,
        marker: { symbol: "circle", radius: 7, lineWidth: 2, lineColor: "#fff" },
        data: selected.map(dot),
        point: click,
        zIndex: 4,
      });
    }

    return {
      chart: { height: 290, spacing: [12, 8, 4, 4] },
      xAxis: {
        categories: vintages.map(String),
        tickLength: 0,
      },
      yAxis: {
        title: { text: undefined },
        labels: { format: "{value}%" },
        plotLines: [{ value: 0, color: "#a3a3a3", width: 1, zIndex: 2 }],
      },
      legend: { align: "left", verticalAlign: "top", margin: 10, x: -6 },
      tooltip: {
        formatter() {
          if (this.series.type === "columnrange") {
            const b = bands[Math.round(Number(this.x))];
            return tip(
              `${b.vintage} vintage · ${uniLabel} peers`,
              [
                { value: pct(b.upper), label: "upper quartile (Q1 above)" },
                { value: pct(b.median), label: "median" },
                { value: pct(b.lower), label: "lower quartile (Q4 below)" },
              ],
              `${b.n} peer funds, net IRR to 30 Jun 2026`,
            );
          }
          const id = (this.options.custom as { id?: string } | undefined)?.id;
          const f = id ? fundById.get(id) : undefined;
          if (!f) return false;
          return tip(
            f.name,
            [
              { value: pct(f.irr), label: "net IRR", color: String(this.color) },
              { value: mult(f.tvpi), label: "TVPI" },
              {
                value: `Q${f.quartile}`,
                label: `vs ${f.vintage} ${STRATEGY_LABEL[f.strategy].toLowerCase()} peers`,
              },
            ],
            "Click to open the fund",
          );
        },
      },
      plotOptions: {
        columnrange: { grouping: false, pointWidth: 20, borderWidth: 0 },
        errorbar: {
          grouping: false,
          pointWidth: 20,
          whiskerLength: "100%",
          whiskerWidth: 2,
          stemWidth: 0,
        },
        scatter: {
          cursor: "pointer",
          stickyTracking: false,
          states: { hover: { halo: { size: 0 } } },
        },
      },
      series,
    };
  }, [funds, selectedId, universe, vintages, onSelect, uniLabel]);

  const fundsByVintage = useMemo(() => {
    const m = new Map<number, Fund[]>();
    for (const f of funds) m.set(f.vintage, [...(m.get(f.vintage) ?? []), f]);
    return m;
  }, [funds]);

  return (
    <Card
      title="Vintage quartile ranking"
      subtitle={`Net IRR against the ${uniLabel} peer universe: grey band = interquartile range, tick = median`}
      actions={<ViewToggle view={view} onChange={setView} label="Vintage ranking" />}
      footer={
        universe === "all"
          ? "Mixed strategies are shown against all private capital; the Q badges rank each fund against its own strategy."
          : `Dots are the programme's ${uniLabel} funds in the current filter. Click a dot to open it.`
      }
    >
      {view === "chart" ? (
        <div className="px-2 pt-2 pb-2">
          <HighchartsView options={options} height={290} />
        </div>
      ) : (
        <div className="px-1 pt-2 pb-2">
          <table className="w-full table-fixed">
            <caption className="sr-only">Peer net IRR quartiles by vintage and programme funds</caption>
            <colgroup>
              <col style={{ width: 64 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 70 }} />
              <col />
            </colgroup>
            <thead>
              <tr className="border-b border-neutral-200">
                <th scope="col" className={THL}>Vintage</th>
                <th scope="col" className={TH}>Lower q.</th>
                <th scope="col" className={TH}>Median</th>
                <th scope="col" className={TH}>Upper q.</th>
                <th scope="col" className={THL}>Programme funds · IRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {vintages.map((v) => {
                const b = PEERS[universe].get(v)!;
                const fs = fundsByVintage.get(v) ?? [];
                return (
                  <tr key={v} className="align-top">
                    <th scope="row" className={`${TDL} font-medium`}>{v}</th>
                    <td className={TD}>{pct(b.lower)}</td>
                    <td className={TD}>{pct(b.median)}</td>
                    <td className={TD}>{pct(b.upper)}</td>
                    <td className="px-3 py-1.5 text-[11px] text-neutral-700">
                      {fs.length === 0 ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        fs.map((f) => (
                          <div key={f.id} className="flex min-w-0 items-center gap-1.5 py-0.5">
                            <QuartileBadge q={f.quartile} />
                            <span className="min-w-0 truncate">{f.name}</span>
                            <span className="ml-auto shrink-0 font-mono tabular-nums">{pct(f.irr)}</span>
                          </div>
                        ))
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* --- 3. Projected capital calls --------------------------------------- */

export function ProjectionCard({
  agg,
  showBudget,
  budgetNote,
}: {
  agg: Aggregate;
  showBudget: boolean;
  budgetNote: string;
}) {
  const [view, setView] = useState<View>("chart");
  const { proj, projTotal } = agg;
  const breaches = showBudget ? proj.filter((p) => p.p75 > LIQUIDITY_BUDGET) : [];

  const options = useMemo<Options>(() => {
    const top = Math.max(...proj.map((p) => p.p75), showBudget ? LIQUIDITY_BUDGET : 0);
    const axisDp = top < 5 ? 1 : 0;
    const series: SeriesOptionsType[] = [
      {
        type: "column",
        id: "expected",
        name: "Expected calls",
        color: COLOR.calls,
        data: proj.map((p) => p.mean),
        zIndex: 1,
      },
      {
        type: "arearange",
        id: "band",
        name: "p25–p75 range",
        color: COLOR.calls,
        fillOpacity: 0.14,
        lineWidth: 0,
        marker: { enabled: false },
        data: proj.map((p) => [p.p25, p.p75]),
        zIndex: 2,
      },
    ];
    if (showBudget) {
      series.push({
        type: "line",
        id: "budget",
        name: "Liquidity budget",
        color: "#525252",
        dashStyle: "Dash",
        lineWidth: 2,
        marker: { enabled: false },
        enableMouseTracking: false,
        zIndex: 3,
        data: proj.map((_, i) =>
          i === proj.length - 1
            ? {
                y: LIQUIDITY_BUDGET,
                dataLabels: {
                  enabled: true,
                  format: `Budget ${gbp(LIQUIDITY_BUDGET, 0)}/qtr`,
                  align: "right",
                  verticalAlign: "bottom",
                  x: 0,
                  y: -4,
                  style: {
                    color: COLOR.ink,
                    fontFamily: SANS,
                    fontSize: "10px",
                    fontWeight: "600",
                    textOutline: "3px #ffffff",
                  },
                },
              }
            : LIQUIDITY_BUDGET,
        ),
      });
    }
    return {
      chart: { height: 262, spacing: [12, 8, 4, 4] },
      xAxis: { categories: proj.map((p) => qShort(p.q)), crosshair: { color: "rgba(162,28,175,0.08)" } },
      yAxis: {
        title: { text: undefined },
        min: 0,
        labels: {
          formatter() {
            return gbp(Number(this.value), axisDp);
          },
        },
      },
      legend: { align: "left", verticalAlign: "top", margin: 10, x: -6 },
      tooltip: {
        shared: true,
        formatter() {
          const i = this.points?.[0]?.index ?? Number(this.x);
          const p = proj[i];
          if (!p) return false;
          const rows = [
            { value: gbp(p.mean), label: "expected calls", color: COLOR.calls },
            { value: `${gbp(p.p25)}–${gbp(p.p75)}`, label: "p25–p75" },
          ];
          if (showBudget) {
            rows.push({
              value: gbp(LIQUIDITY_BUDGET, 0),
              label: p.p75 > LIQUIDITY_BUDGET ? "budget · p75 above it" : "budget",
            });
          }
          return tip(qLabel(p.q), rows);
        },
      },
      plotOptions: {
        column: { maxPointWidth: 24, borderWidth: 0 },
        series: { states: { inactive: { opacity: 0.35 } } },
      },
      series,
    };
  }, [proj, showBudget]);

  return (
    <Card
      title="Projected capital calls"
      subtitle="Next 8 quarters from the pacing model: expected calls with the p25–p75 band across 400 seeded paths"
      actions={<ViewToggle view={view} onChange={setView} label="Projected calls" />}
      footer={
        showBudget ? (
          breaches.length ? (
            <span className="text-neutral-700">
              <span aria-hidden className="mr-1 text-amber-600">▲</span>
              p75 calls exceed the {gbp(LIQUIDITY_BUDGET, 0)} quarterly budget in{" "}
              {breaches.map((b) => qLabel(b.q)).join(", ")}; recent distributions cover the gap.
            </span>
          ) : (
            <span>
              <span aria-hidden className="mr-1 text-emerald-600">●</span>
              Every quarter's p75 sits inside the {gbp(LIQUIDITY_BUDGET, 0)} quarterly budget.
            </span>
          )
        ) : (
          budgetNote
        )
      }
    >
      <Readout
        items={[
          {
            label: "Expected, 8 qtrs",
            value: gbp(projTotal.mean),
            note: `p25–p75 ${gbp(projTotal.p25)}–${gbp(projTotal.p75)}`,
          },
          {
            label: "Of unfunded",
            value: agg.unfunded > 0.05 ? pct(projTotal.mean / agg.unfunded, 0) : "—",
          },
        ]}
      />
      {view === "chart" ? (
        <div className="px-2 pt-1 pb-2">
          <HighchartsView options={options} height={262} />
        </div>
      ) : (
        <div className="px-1 pt-2 pb-2">
          <table className="w-full">
            <caption className="sr-only">Projected capital calls by quarter, £m</caption>
            <thead>
              <tr className="border-b border-neutral-200">
                <th scope="col" className={THL}>Quarter</th>
                <th scope="col" className={TH}>p25 £m</th>
                <th scope="col" className={TH}>Expected £m</th>
                <th scope="col" className={TH}>p75 £m</th>
                {showBudget && <th scope="col" className={TH}>vs budget</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {proj.map((p) => (
                <tr key={p.q}>
                  <th scope="row" className={`${TDL} font-medium`}>{qLabel(p.q)}</th>
                  <td className={TD}>{num(p.p25)}</td>
                  <td className={TD}>{num(p.mean)}</td>
                  <td className={TD}>{num(p.p75)}</td>
                  {showBudget && (
                    <td className={`${TD} font-sans`}>
                      {p.p75 > LIQUIDITY_BUDGET ? (
                        <span className="text-amber-700">▲ p75 above</span>
                      ) : (
                        <span className="text-neutral-500">within</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              <tr className="border-t border-neutral-200 bg-neutral-50">
                <th scope="row" className={`${TDL} font-semibold`}>8 quarters</th>
                <td className={TD}>{num(projTotal.p25)}</td>
                <td className={`${TD} font-semibold`}>{num(projTotal.mean)}</td>
                <td className={TD}>{num(projTotal.p75)}</td>
                {showBudget && <td className={TD} />}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

