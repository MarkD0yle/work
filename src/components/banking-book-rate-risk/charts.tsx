import { useMemo, useState, type ReactNode } from "react";
import type { AxisLabelsFormatterContextObject, Options, Point, XAxisPlotBandsOptions } from "highcharts";
import HighchartsView from "../highcharts/HighchartsView";
import { tipHtml } from "../highcharts/tooltip";
import { BUCKETS, COARSE, LIMITS, TIER1, type BucketId, type ScenarioResult, type View as RiskView } from "./model";
import {
  CAT,
  FOCUS,
  INK,
  LADDER,
  MUTED_SERIES,
  STATUS,
  bp,
  gbpBn,
  gbpM,
  gbpMSigned,
  monthLong,
  monthShort,
  pct,
  pctSigned,
} from "./format";
import { CardHeader, LegendItem, MicroLabel, ViewToggle, type View } from "./ui";

/* The three Highcharts cards on the main canvas. Each takes the memoised
 * view (or the selected scenario out of it) and renders the same numbers
 * as a chart or an accessible table. */

const r1 = (v: number) => Math.round(v * 10) / 10;
const TH = "px-3 py-1.5 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase whitespace-nowrap";
const TD = "px-3 py-1.5 font-mono text-[11px] tabular-nums text-neutral-800";
const AXIS_TITLE = { color: "#a3a3a3", fontSize: "10px" };

/* ------------------------------------------------------------------ *
 * Repricing gap ladder
 * ------------------------------------------------------------------ */

export function LadderCard({
  view,
  focus,
  onFocus,
}: {
  view: RiskView;
  focus: BucketId | null;
  onFocus: (b: BucketId | null) => void;
}) {
  const [mode, setMode] = useState<View>("chart");
  const rows = view.ladder;
  const focusIdx = focus ? BUCKETS.findIndex((b) => b.id === focus) : -1;
  const { totals, assumptions } = view;

  const options = useMemo<Options>(() => {
    const yLabel = {
      formatter(this: AxisLabelsFormatterContextObject) {
        return gbpBn(Number(this.value), 0);
      },
    };
    return {
      chart: { type: "column", spacing: [8, 8, 4, 4] },
      xAxis: {
        categories: rows.map((r) => r.label),
        labels: { style: { fontSize: "10px" } },
        plotBands:
          focusIdx >= 0
            ? [{ from: focusIdx - 0.5, to: focusIdx + 0.5, color: "rgba(23,23,23,0.07)", zIndex: 0 }]
            : [],
      },
      /* The cumulative line shares the £ scale: a second, linked axis on
       * the right names it but never rescales it against the bars. */
      yAxis: [
        {
          title: { text: "Repricing gap by bucket", style: AXIS_TITLE },
          labels: yLabel,
          plotLines: [{ value: 0, color: "#a3a3a3", width: 1, zIndex: 4 }],
        },
        {
          linkedTo: 0,
          opposite: true,
          title: { text: "Cumulative gap", style: AXIS_TITLE },
          labels: yLabel,
          gridLineWidth: 0,
        },
      ],
      legend: { enabled: false },
      tooltip: {
        shared: true,
        formatter(this: Point) {
          const r = rows[Number(this.x)];
          if (!r) return false;
          return tipHtml(
            r.label === "NMD core" ? "Core NMD (behaviouralised)" : `Reprices in ${r.label}`,
            [
              { label: "Assets", value: gbpM(r.assets), color: LADDER.assets },
              { label: "Liabilities", value: gbpM(-r.liabilities), color: LADDER.liabilities },
              { label: "Swap legs, net", value: gbpMSigned(r.swapNet), color: LADDER.swaps },
              { label: "Gap", value: gbpMSigned(r.gap) },
              { label: "Cumulative", value: `${gbpMSigned(r.cum)} · ${pct(r.cumPct)}`, color: INK },
            ],
            focus === r.bucket ? "Click to clear the focus" : "Click to focus the hedge table on this bucket",
          );
        },
      },
      plotOptions: {
        column: { stacking: "normal", borderWidth: 0, maxPointWidth: 36, groupPadding: 0.08, pointPadding: 0.02 },
        series: {
          animation: false,
          cursor: "pointer",
          states: { inactive: { opacity: 1 } },
          point: {
            events: {
              click(this: Point) {
                const b = BUCKETS[Number(this.x)];
                if (b) onFocus(b.id === focus ? null : b.id);
              },
            },
          },
        },
      },
      series: [
        { type: "column", name: "Rate-sensitive assets", color: LADDER.assets, data: rows.map((r) => r1(r.assets)) },
        { type: "column", name: "Rate-sensitive liabilities", color: LADDER.liabilities, data: rows.map((r) => r1(-r.liabilities)) },
        { type: "column", name: "Swap legs, net", color: LADDER.swaps, data: rows.map((r) => r1(r.swapNet)) },
        {
          type: "line",
          name: "Cumulative gap",
          color: INK,
          lineWidth: 2,
          zIndex: 5,
          marker: { enabled: true, symbol: "square", radius: 3 },
          states: { hover: { lineWidthPlus: 0 } },
          data: rows.map((r) => r1(r.cum)),
        },
      ],
    };
  }, [rows, focusIdx, focus, onFocus]);

  const focusLabel = focus ? BUCKETS.find((b) => b.id === focus)?.label : null;

  return (
    <section aria-labelledby="bb-ladder-title" className="flex flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="bb-ladder-title"
        title="Repricing gap ladder"
        sub={`${gbpBn(totals.assets)} rate-sensitive assets against ${gbpBn(totals.liabilities)} liabilities, swap legs shown net · core NMD ${gbpBn(totals.coreNmd)} (${pct(assumptions.core * 100, 0)}) held as one behaviouralised block · 1y cumulative gap ${gbpBn(totals.gap1y)}, ${pct(totals.gap1yPct)} of RSA`}
        right={<ViewToggle value={mode} onChange={setMode} name="Gap ladder" />}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2.5">
        <LegendItem color={LADDER.assets}>Assets (incl. pipeline)</LegendItem>
        <LegendItem color={LADDER.liabilities}>Liabilities</LegendItem>
        <LegendItem color={LADDER.swaps}>Swap legs, net</LegendItem>
        <LegendItem color={INK} line>
          Cumulative gap
        </LegendItem>
        {focusLabel && (
          <button
            type="button"
            onClick={() => onFocus(null)}
            className={`ml-auto inline-flex items-center gap-1.5 border border-neutral-900 bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase ${FOCUS}`}
          >
            Focus {focusLabel} · clear ×
          </button>
        )}
      </div>
      {mode === "chart" ? (
        <div className="min-w-0 px-1 pt-1 pb-2">
          <HighchartsView options={options} height={316} />
        </div>
      ) : (
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Repricing gap by bucket, £m</caption>
            <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e5e5e5]">
              <tr>
                <th scope="col" className={TH}>Bucket</th>
                <th scope="col" className={`${TH} text-right`}>Assets</th>
                <th scope="col" className={`${TH} text-right`}>Liabilities</th>
                <th scope="col" className={`${TH} text-right`}>Swaps net</th>
                <th scope="col" className={`${TH} text-right`}>Gap</th>
                <th scope="col" className={`${TH} text-right`}>Cumulative</th>
                <th scope="col" className={`${TH} text-right`}>Cum ÷ RSA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => {
                const on = r.bucket === focus;
                return (
                  <tr key={r.bucket} className={on ? "bg-neutral-50" : ""}>
                    <th scope="row" className="px-3 py-1 text-left text-[11px] font-medium text-neutral-800">
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => onFocus(on ? null : r.bucket)}
                        className={`inline-flex items-center gap-1.5 hover:text-neutral-950 ${FOCUS}`}
                      >
                        {r.label}
                        {r.bucket === "nmd" && <span className="text-[10px] font-normal text-neutral-500">behaviouralised</span>}
                      </button>
                    </th>
                    <td className={`${TD} text-right`}>{gbpM(r.assets)}</td>
                    <td className={`${TD} text-right`}>{gbpM(-r.liabilities)}</td>
                    <td className={`${TD} text-right`}>{gbpMSigned(r.swapNet)}</td>
                    <td className={`${TD} text-right font-semibold`}>{gbpMSigned(r.gap)}</td>
                    <td className={`${TD} text-right`}>{gbpMSigned(r.cum)}</td>
                    <td className={`${TD} text-right`}>{pctSigned(r.cumPct)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-neutral-200 bg-neutral-50/70">
              <tr>
                <th scope="row" className="px-3 py-1.5 text-left text-[11px] font-semibold text-neutral-900">Total</th>
                <td className={`${TD} text-right font-semibold`}>{gbpM(totals.assets)}</td>
                <td className={`${TD} text-right font-semibold`}>{gbpM(-totals.liabilities)}</td>
                <td className={`${TD} text-right`}>{gbpMSigned(rows.reduce((s, r) => s + r.swapNet, 0))}</td>
                <td className={`${TD} text-right font-semibold`}>{gbpMSigned(rows[rows.length - 1].cum)}</td>
                <td className={`${TD} text-right`} />
                <td className={`${TD} text-right`}>{pctSigned(rows[rows.length - 1].cumPct)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * NII sensitivity: base against shocked, month by month
 * ------------------------------------------------------------------ */

export function NiiCard({ view, scenario }: { view: RiskView; scenario: ScenarioResult }) {
  const [mode, setMode] = useState<View>("chart");
  const months = scenario.nii;

  const cumulative = useMemo(() => {
    let c = 0;
    return months.map((m) => (c += m.delta));
  }, [months]);

  const options = useMemo<Options>(() => {
    const byT = new Map(months.map((m, i) => [m.t, { m, cum: cumulative[i] }]));
    const shockedName = `NII under ${scenario.label.toLowerCase()}`;
    return {
      chart: { spacing: [8, 8, 4, 4] },
      xAxis: {
        type: "datetime",
        tickPixelInterval: 72,
        dateTimeLabelFormats: { month: "%b %y", year: "%b %y" },
        crosshair: { color: "rgba(23,23,23,0.12)", width: 1 },
      },
      yAxis: {
        title: { text: "NII per month", style: AXIS_TITLE },
        labels: { formatter() { return gbpM(Number(this.value)); } },
        startOnTick: false,
        endOnTick: false,
      },
      legend: { enabled: false },
      tooltip: {
        shared: true,
        formatter(this: Point) {
          const hit = byT.get(Number(this.x));
          if (!hit) return false;
          const { m, cum } = hit;
          return tipHtml(monthLong(m.t), [
            { label: "Base NII", value: gbpM(m.base, 1), color: MUTED_SERIES },
            { label: shockedName, value: gbpM(m.shocked, 1), color: CAT[0] },
            { label: "Δ this month", value: gbpMSigned(m.delta, 1) },
            { label: "Δ cumulative", value: gbpMSigned(cum, 1) },
          ]);
        },
      },
      plotOptions: {
        series: {
          animation: false,
          marker: { enabled: false },
          states: { inactive: { opacity: 1 }, hover: { lineWidthPlus: 0 } },
        },
      },
      series: [
        {
          type: "arearange",
          name: "Base to shocked",
          color: CAT[0],
          fillOpacity: 0.12,
          lineWidth: 0,
          enableMouseTracking: false,
          zIndex: 1,
          data: months.map((m) => [m.t, r1(Math.min(m.base, m.shocked)), r1(Math.max(m.base, m.shocked))]),
        },
        {
          type: "line",
          name: "Base NII",
          color: MUTED_SERIES,
          lineWidth: 2,
          zIndex: 2,
          data: months.map((m) => [m.t, r1(m.base)]),
        },
        {
          type: "line",
          name: shockedName,
          color: CAT[0],
          lineWidth: 2,
          zIndex: 3,
          data: months.map((m) => [m.t, r1(m.shocked)]),
        },
      ],
    };
  }, [months, cumulative, scenario.label]);

  const first = months[0];
  const last = months[months.length - 1];
  const dirClass = scenario.dNii < 0 ? "text-rose-700" : "text-emerald-700";

  return (
    <section aria-labelledby="bb-nii-title" className="flex flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="bb-nii-title"
        title={`NII sensitivity · ${scenario.label}`}
        sub={`${view.months}-month constant balance sheet, ${monthShort(first.t)} to ${monthShort(last.t)} · deposits pass through at beta ${pct(view.assumptions.beta * 100, 0)} on core savings, in full on non-core · base NII ${gbpM(view.baseNiiHorizon)} over the horizon`}
        right={<ViewToggle value={mode} onChange={setMode} name="NII sensitivity" />}
      />
      <dl className="grid grid-cols-3 gap-px border-b border-neutral-100 bg-neutral-100">
        <div className="bg-white px-4 py-2">
          <dt><MicroLabel>Cumulative ΔNII · {view.months}m</MicroLabel></dt>
          <dd className={`mt-0.5 text-xl leading-none font-semibold tracking-tight ${dirClass}`}>{gbpMSigned(scenario.dNii)}</dd>
        </div>
        <div className="bg-white px-4 py-2">
          <dt><MicroLabel>Of group NII</MicroLabel></dt>
          <dd className="mt-0.5 text-xl leading-none font-semibold tracking-tight text-neutral-950">{pctSigned(scenario.dNiiPct)}</dd>
        </div>
        <div className="bg-white px-4 py-2">
          <dt><MicroLabel>Worst month</MicroLabel></dt>
          <dd className="mt-0.5 text-xl leading-none font-semibold tracking-tight text-neutral-950">{gbpMSigned(scenario.dNiiWorstMonth, 1)}</dd>
        </div>
      </dl>
      {mode === "chart" ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2.5">
            <LegendItem color={MUTED_SERIES} line>
              Base NII (rates unchanged)
            </LegendItem>
            <LegendItem color={CAT[0]} line>
              {scenario.label} ({bp(scenario.bpOn)} O/N · {bp(scenario.bp5y)} 5y)
            </LegendItem>
            <LegendItem color="rgba(79,70,229,0.18)">Gap between the two</LegendItem>
          </div>
          <div className="min-w-0 px-1 pt-1 pb-2">
            <HighchartsView options={options} height={236} />
          </div>
        </>
      ) : (
        <div className="max-h-[330px] overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Monthly NII, base against {scenario.label}, £m</caption>
            <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e5e5e5]">
              <tr>
                <th scope="col" className={TH}>Month</th>
                <th scope="col" className={`${TH} text-right`}>Base NII</th>
                <th scope="col" className={`${TH} text-right`}>Shocked NII</th>
                <th scope="col" className={`${TH} text-right`}>Δ month</th>
                <th scope="col" className={`${TH} text-right`}>Δ cumulative</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {months.map((m, i) => (
                <tr key={m.m}>
                  <th scope="row" className="px-3 py-1 text-left text-[11px] font-medium text-neutral-800">
                    {monthLong(m.t)}
                  </th>
                  <td className={`${TD} text-right`}>{gbpM(m.base, 1)}</td>
                  <td className={`${TD} text-right`}>{gbpM(m.shocked, 1)}</td>
                  <td className={`${TD} text-right ${m.delta < 0 ? "text-rose-700" : "text-neutral-800"}`}>{gbpMSigned(m.delta, 1)}</td>
                  <td className={`${TD} text-right`}>{gbpMSigned(cumulative[i], 1)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-neutral-200 bg-neutral-50/70">
              <tr>
                <th scope="row" className="px-3 py-1.5 text-left text-[11px] font-semibold text-neutral-900">Horizon</th>
                <td className={`${TD} text-right font-semibold`}>{gbpM(view.baseNiiHorizon, 1)}</td>
                <td className={`${TD} text-right font-semibold`}>{gbpM(view.baseNiiHorizon + scenario.dNii, 1)}</td>
                <td className={`${TD} text-right font-semibold`}>{gbpMSigned(scenario.dNii, 1)}</td>
                <td className={`${TD} text-right`}>{pctSigned(scenario.dNiiPct)} of group NII</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * ΔEVE waterfall by bucket
 * ------------------------------------------------------------------ */

const KIND_LABEL = { asset: "Asset contribution", liability: "Liability contribution", nmd: "Liability contribution", hedge: "Swap contribution", subtotal: "Subtotal", total: "Net ΔEVE" } as const;

/** Legend entry for a dashed threshold line. */
function ThresholdLegend({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-600">
      <span aria-hidden className="inline-block h-0 w-4 border-t border-dashed" style={{ borderColor: color }} />
      {children}
    </span>
  );
}

export function WaterfallCard({ scenario, focus }: { scenario: ScenarioResult; focus: BucketId | null }) {
  const [mode, setMode] = useState<View>("chart");
  const steps = scenario.waterfall;
  const focusCoarse = focus ? (COARSE.find((c) => c.buckets.includes(focus))?.id ?? null) : null;
  const focusNmd = focus === "nmd";

  const options = useMemo<Options>(() => {
    const idxAssets = steps.findIndex((s) => s.id === "assets");
    const idxLiabs = steps.findIndex((s) => s.id === "liabilities");
    const bandLabel = { style: { color: "#a3a3a3", fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.08em" }, y: 12 };
    const plotBands: XAxisPlotBandsOptions[] = [
      { from: -0.5, to: idxAssets - 0.5, color: "rgba(23,23,23,0.025)", label: { text: "Assets", ...bandLabel } },
      { from: idxAssets + 0.5, to: idxLiabs - 0.5, color: "rgba(23,23,23,0.025)", label: { text: "Liabilities", ...bandLabel } },
    ];
    steps.forEach((s, i) => {
      const hit = focusNmd ? s.id === "nmd" : focusCoarse !== null && (s.id === `a-${focusCoarse}` || s.id === `l-${focusCoarse}`);
      if (hit) plotBands.push({ from: i - 0.5, to: i + 0.5, color: "rgba(23,23,23,0.09)", zIndex: 1 });
    });
    /* Running totals are labelled outside their ink bars (below for a loss). */
    const sumLabel = {
      enabled: true,
      inside: false,
      crop: false,
      overflow: "allow" as const,
      formatter(this: Point) {
        return gbpM(Number(this.y));
      },
      style: { color: INK, fontSize: "10px", fontWeight: "600" },
    };
    return {
      chart: { type: "waterfall", spacing: [8, 8, 4, 4] },
      xAxis: {
        categories: steps.map((s) => (s.kind === "asset" || s.kind === "liability" ? s.label.replace(/^(Assets|Liabilities) /, "") : s.label)),
        labels: { style: { fontSize: "10px" } },
        plotBands,
      },
      yAxis: {
        title: { text: "ΔEVE, cumulative left to right", style: AXIS_TITLE },
        labels: { formatter() { return gbpM(Number(this.value)); } },
        plotLines: [
          { value: 0, color: "#a3a3a3", width: 1, zIndex: 4 },
          /* Thresholds are named in the legend row: a label here collides
           * with the Net ΔEVE bar whenever the net lands near a limit. */
          { value: -LIMITS.outlier * 0.01 * TIER1, color: STATUS.bad, dashStyle: "Dash", width: 1, zIndex: 4 },
          { value: -LIMITS.internal * 0.01 * TIER1, color: STATUS.warn, dashStyle: "Dash", width: 1, zIndex: 4 },
        ],
      },
      legend: { enabled: false },
      tooltip: {
        formatter(this: Point) {
          const s = steps[Number(this.x)];
          if (!s) return false;
          const running = s.kind === "subtotal" || s.kind === "total";
          return tipHtml(
            s.label,
            [
              { label: running ? "Running ΔEVE" : "Contribution", value: gbpMSigned(s.value, 1) },
              { label: "Of Tier 1", value: pctSigned((100 * s.value) / TIER1) },
            ],
            s.id === "nmd" ? "Core NMD spread evenly to its behavioural life" : KIND_LABEL[s.kind],
          );
        },
      },
      plotOptions: {
        waterfall: { borderWidth: 0, maxPointWidth: 40, lineWidth: 1, lineColor: "#d4d4d4", dataLabels: { enabled: false } },
        series: { animation: false, states: { inactive: { opacity: 1 } } },
      },
      series: [
        {
          type: "waterfall",
          name: "ΔEVE",
          data: steps.map((s) =>
            s.kind === "subtotal"
              ? { name: s.label, isIntermediateSum: true, color: INK, dataLabels: sumLabel }
              : s.kind === "total"
                ? { name: s.label, isSum: true, color: INK, dataLabels: sumLabel }
                : { name: s.label, y: r1(s.value), color: s.value < 0 ? STATUS.bad : STATUS.good },
          ),
        },
      ],
    };
  }, [steps, focusCoarse, focusNmd]);

  return (
    <section aria-labelledby="bb-eve-title" className="flex flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="bb-eve-title"
        title={`ΔEVE by bucket · ${scenario.label}`}
        sub={`${bp(scenario.bpOn)} O/N · ${bp(scenario.bp5y)} 5y · ${bp(scenario.bp20y)} 20y · run-off balance sheet · net ${gbpMSigned(scenario.dEve)}, ${pctSigned(scenario.dEvePct)} of Tier 1 ${gbpBn(TIER1)}`}
        right={<ViewToggle value={mode} onChange={setMode} name="EVE waterfall" />}
      />
      {mode === "chart" ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2.5">
            <LegendItem color={STATUS.bad}>Loses value</LegendItem>
            <LegendItem color={STATUS.good}>Gains value</LegendItem>
            <LegendItem color={INK}>Running total</LegendItem>
            <ThresholdLegend color={STATUS.bad}>
              Outlier −{LIMITS.outlier}% ({gbpM(-LIMITS.outlier * 0.01 * TIER1)})
            </ThresholdLegend>
            <ThresholdLegend color={STATUS.warn}>
              Internal −{LIMITS.internal}% ({gbpM(-LIMITS.internal * 0.01 * TIER1)})
            </ThresholdLegend>
            {(focusCoarse || focusNmd) && (
              <span className="text-[11px] text-neutral-500">Highlighted: the group holding the focused bucket</span>
            )}
          </div>
          <div className="min-w-0 px-1 pt-1 pb-2">
            <HighchartsView options={options} height={300} />
          </div>
        </>
      ) : (
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">ΔEVE contributions by bucket for {scenario.label}, £m</caption>
            <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e5e5e5]">
              <tr>
                <th scope="col" className={TH}>Step</th>
                <th scope="col" className={TH}>Kind</th>
                <th scope="col" className={`${TH} text-right`}>ΔEVE</th>
                <th scope="col" className={`${TH} text-right`}>Of Tier 1</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {steps.map((s) => {
                const running = s.kind === "subtotal" || s.kind === "total";
                return (
                  <tr key={s.id} className={running ? "bg-neutral-50/70" : ""}>
                    <th scope="row" className={`px-3 py-1 text-left text-[11px] text-neutral-800 ${running ? "font-semibold" : "font-medium"}`}>
                      {s.label}
                    </th>
                    <td className="px-3 py-1 text-[11px] text-neutral-500">{KIND_LABEL[s.kind]}</td>
                    <td className={`${TD} text-right ${running ? "font-semibold" : ""} ${s.value < 0 ? "text-rose-700" : ""}`}>{gbpMSigned(s.value, 1)}</td>
                    <td className={`${TD} text-right`}>{pctSigned((100 * s.value) / TIER1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
