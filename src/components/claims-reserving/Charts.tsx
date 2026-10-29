import { useMemo, useState } from "react";
import type { Options, Point } from "highcharts";
import HighchartsView from "../highcharts/HighchartsView";
import {
  CAT,
  MONO,
  STATUS,
  fmtPct,
  fmtSigned,
  type QuarterRow,
  type TabView,
} from "./model";
import { ChartPanel, IconDown, IconUp, type CardView } from "./ui";

const th = "px-2 py-1.5 text-[10px] font-semibold tracking-wide text-neutral-500 uppercase";
const td = "px-2 py-1.5 text-right font-mono text-[11px] tabular-nums text-neutral-800";

/* ------------------------------------------------------------------ */
/* Combined ratio by quarter                                           */
/* ------------------------------------------------------------------ */

export function CombinedRatioCard({ rows, scope, filterKey }: { rows: QuarterRow[]; scope: string; filterKey: string }) {
  const [view, setView] = useState<CardView>("chart");
  const over = rows.filter((r) => r.cr >= 100).length;
  const peak = rows.reduce((a, r) => (r.cr > a.cr ? r : a), rows[0]);
  const options = useMemo<Options>(() => {
    // 100 is labelled by the break-even line itself, so it is left off the ticks.
    const top = Math.max(...rows.map((r) => r.cr));
    const ticks = top > 112 ? [0, 20, 40, 60, 80, 120, 140] : [0, 20, 40, 60, 80, 120];
    return {
      chart: { type: "column", spacing: [12, 8, 4, 4] },
      xAxis: { categories: rows.map((r) => r.q), lineColor: "#d4d4d4" },
      yAxis: {
        tickPositions: ticks,
        title: { text: undefined },
        labels: { format: "{value}%" },
        reversedStacks: false,
        stackLabels: {
          enabled: true,
          formatter: function () {
            return fmtPct(this.total ?? 0, 1);
          },
          // A surface-coloured plate lets the total sit over the dashed line.
          backgroundColor: "#ffffff",
          borderRadius: 0,
          y: -4,
          style: { color: "#262626", fontFamily: MONO, fontSize: "10px", fontWeight: "600", textOutline: "none" },
        },
        plotLines: [
          {
            value: 100,
            color: "#525252",
            width: 1,
            dashStyle: "Dash",
            zIndex: 5,
            label: {
              text: "100%",
              align: "left",
              textAlign: "right",
              x: -8,
              y: 3,
              style: { color: "#171717", fontFamily: MONO, fontSize: "10px", fontWeight: "700" },
            },
          },
        ],
      },
      legend: { enabled: false },
      plotOptions: {
        column: {
          stacking: "normal",
          maxPointWidth: 24,
          borderWidth: 1,
          borderColor: "#ffffff",
        },
      },
      tooltip: {
        formatter: function () {
          const p = this as unknown as Point & { total?: number };
          const r = rows[p.index];
          return `<b>${fmtPct(p.y ?? 0, 1)}</b> ${p.series.name.toLowerCase()}<br/><span style="color:#a3a3a3">${r.label} · combined ${fmtPct(r.cr, 1)}</span>`;
        },
      },
      series: [
        { type: "column", id: "lr", name: "Loss ratio", color: CAT[0], data: rows.map((r) => Math.round(r.lr * 10) / 10) },
        { type: "column", id: "er", name: "Expense ratio", color: CAT[1], data: rows.map((r) => Math.round(r.er * 10) / 10) },
      ],
    };
  }, [rows]);

  return (
    <ChartPanel
      title="Combined ratio by quarter"
      subtitle={`${scope} · calendar quarters Q3 2024–Q2 2026, all accident years, incurred basis`}
      view={view}
      onView={setView}
      legend={
        <>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5" style={{ background: CAT[0] }} /> Loss ratio
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5" style={{ background: CAT[1] }} /> Expense ratio
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t border-dashed border-neutral-600" /> 100% break-even
          </span>
          <span className="text-neutral-400">Label on each column is the combined ratio</span>
        </>
      }
      footer={
        <span>
          {over === 0 ? (
            <>All eight quarters under 100%: the book is writing at an underwriting profit.</>
          ) : (
            <>
              <span className="font-semibold text-neutral-800">{over} of 8 quarters</span> at or above 100%; peak{" "}
              <span className="font-mono text-neutral-800">{fmtPct(peak.cr, 1)}</span> in {peak.label}.
            </>
          )}
        </span>
      }
    >
      {view === "chart" ? (
        // Keyed on the filter: chart.update() leaves hidden stale stack labels
        // behind when the axis re-inits, so each slice gets a fresh chart.
        <HighchartsView key={filterKey} options={options} height={292} />
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200">
              <th scope="col" className={`${th} text-left`}>Quarter</th>
              <th scope="col" className={`${th} text-right`}>Loss ratio</th>
              <th scope="col" className={`${th} text-right`}>Expense ratio</th>
              <th scope="col" className={`${th} text-right`}>Combined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((r) => (
              <tr key={r.q}>
                <th scope="row" className="px-2 py-1.5 text-left text-[11px] font-medium text-neutral-700">{r.label}</th>
                <td className={td}>{fmtPct(r.lr, 1)}</td>
                <td className={td}>{fmtPct(r.er, 1)}</td>
                <td className={`${td} font-semibold`}>
                  {fmtPct(r.cr, 1)}
                  {r.cr >= 100 && <span className="ml-1 font-sans text-[10px] font-medium text-rose-600">loss</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ChartPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Ultimate loss ratio: initial pick vs current (dumbbell)             */
/* ------------------------------------------------------------------ */

type Dir = "bad" | "good" | "flat";
const DIR_COLOR: Record<Dir, string> = { bad: STATUS.bad, good: STATUS.good, flat: STATUS.neutral };
const PICK_COLOR = "#a3a3a3";
const FLAT = 0.5;

export function ReserveDevelopmentCard({ view, scope }: { view: TabView; scope: string }) {
  const [mode, setMode] = useState<CardView>("chart");
  const rows = useMemo(
    () =>
      view.inRange.map((r) => {
        const delta = r.ulr - r.pick;
        const dir: Dir = Math.abs(delta) < FLAT ? "flat" : delta > 0 ? "bad" : "good";
        return { ay: r.ay, pick: r.pick, cur: r.ulr, delta, dir };
      }),
    [view],
  );
  const worst = rows.reduce<(typeof rows)[number] | null>((a, r) => (r.delta > (a?.delta ?? 0) ? r : a), null);
  const best = rows.reduce<(typeof rows)[number] | null>((a, r) => (r.delta < (a?.delta ?? 0) ? r : a), null);
  const nBad = rows.filter((r) => r.dir === "bad").length;
  const nGood = rows.filter((r) => r.dir === "good").length;

  const options = useMemo<Options>(() => {
    const lo = Math.min(...rows.map((r) => Math.min(r.pick, r.cur)));
    const hi = Math.max(...rows.map((r) => Math.max(r.pick, r.cur)));
    return {
      chart: { type: "dumbbell", inverted: true, spacing: [8, 12, 4, 4] },
      legend: { enabled: false },
      xAxis: {
        categories: rows.map((r) => `AY ${r.ay}`),
        lineWidth: 0,
        tickLength: 0,
        gridLineWidth: 1,
        gridLineColor: "#f5f5f5",
        labels: { style: { fontFamily: MONO, color: "#525252" } },
      },
      yAxis: {
        title: { text: undefined },
        min: Math.floor((lo - 2) / 5) * 5,
        max: Math.ceil((hi + 2) / 5) * 5,
        tickInterval: 5,
        labels: { format: "{value}%" },
      },
      tooltip: {
        formatter: function () {
          const r = rows[(this as unknown as Point).index];
          const word = r.dir === "bad" ? "deterioration" : r.dir === "good" ? "release" : "stable";
          return `<b>${fmtPct(r.cur, 1)}</b> current · AY ${r.ay}<br/><span style="color:#a3a3a3">initial pick ${fmtPct(r.pick, 1)} · ${fmtSigned(r.delta, 1, "pp")} ${word}</span>`;
        },
      },
      plotOptions: {
        dumbbell: {
          connectorWidth: 3,
          groupPadding: 0,
          pointPadding: 0,
          marker: { symbol: "square", radius: 5, lineWidth: 2, lineColor: "#ffffff" },
          lowMarker: { symbol: "square" },
          dataLabels: { enabled: false },
          states: { hover: { halo: { size: 0 } } },
        },
      },
      series: [
        {
          type: "dumbbell",
          id: "ulr",
          name: "Ultimate loss ratio",
          data: rows.map((r) => {
            const c = DIR_COLOR[r.dir];
            // Current is always the coloured end; initial pick is the gray one.
            return r.cur >= r.pick
              ? { low: r.pick, high: r.cur, lowColor: PICK_COLOR, color: c, connectorColor: c }
              : { low: r.cur, high: r.pick, lowColor: c, color: PICK_COLOR, connectorColor: c };
          }),
        },
      ],
    };
  }, [rows]);

  const swatch = (color: string) => <span className="inline-block h-2.5 w-2.5" style={{ background: color }} />;
  const line = (color: string) => <span className="inline-block h-[3px] w-4" style={{ background: color }} />;

  return (
    <ChartPanel
      title="Ultimate loss ratio by accident year: initial pick vs current"
      subtitle={`${scope} · initial pick at each AY's first year-end against today's chain-ladder estimate`}
      view={mode}
      onView={setMode}
      legend={
        <>
          <span className="flex items-center gap-1.5">{swatch(PICK_COLOR)} Initial pick</span>
          <span className="flex items-center gap-1.5">
            {line(STATUS.bad)}
            <IconUp className="h-2.5 w-2.5 text-rose-600" /> Deteriorated
          </span>
          <span className="flex items-center gap-1.5">
            {line(STATUS.good)}
            <IconDown className="h-2.5 w-2.5 text-emerald-600" /> Released
          </span>
          <span className="flex items-center gap-1.5">{line(STATUS.neutral)} Stable (±{FLAT}pp)</span>
        </>
      }
      footer={
        <span>
          <span className="font-semibold text-neutral-800">{nBad}</span> of {rows.length} accident years deteriorated,{" "}
          <span className="font-semibold text-neutral-800">{nGood}</span> released.
          {worst && (
            <>
              {" "}Largest deterioration AY {worst.ay} <span className="font-mono text-neutral-800">{fmtSigned(worst.delta, 1, "pp")}</span>
            </>
          )}
          {best && (
            <>
              {worst ? "; largest" : " Largest"} release AY {best.ay} <span className="font-mono text-neutral-800">{fmtSigned(best.delta, 1, "pp")}</span>
            </>
          )}
          .
        </span>
      }
    >
      {mode === "chart" ? (
        // Keyed on the slice so per-point colours can never merge across states.
        <HighchartsView
          key={`${view.tab}-${view.basis}-${rows[0]?.ay}-${rows[rows.length - 1]?.ay}`}
          options={options}
          height={Math.max(250, 44 + rows.length * 25)}
        />
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200">
              <th scope="col" className={`${th} text-left`}>Accident year</th>
              <th scope="col" className={`${th} text-right`}>Initial pick</th>
              <th scope="col" className={`${th} text-right`}>Current</th>
              <th scope="col" className={`${th} text-right`}>Change</th>
              <th scope="col" className={`${th} text-left`}>Direction</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((r) => (
              <tr key={r.ay}>
                <th scope="row" className="px-2 py-1.5 text-left font-mono text-[11px] font-medium text-neutral-700">{r.ay}</th>
                <td className={td}>{fmtPct(r.pick, 1)}</td>
                <td className={`${td} font-semibold`}>{fmtPct(r.cur, 1)}</td>
                <td className={td}>{fmtSigned(r.delta, 1, "pp")}</td>
                <td className="px-2 py-1.5 text-[11px]">
                  <span
                    className={`inline-flex items-center gap-1 ${
                      r.dir === "bad" ? "text-rose-700" : r.dir === "good" ? "text-emerald-700" : "text-neutral-500"
                    }`}
                  >
                    {r.dir === "bad" ? <IconUp className="h-2.5 w-2.5" /> : r.dir === "good" ? <IconDown className="h-2.5 w-2.5" /> : null}
                    {r.dir === "bad" ? "Deteriorated" : r.dir === "good" ? "Released" : "Stable"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ChartPanel>
  );
}
