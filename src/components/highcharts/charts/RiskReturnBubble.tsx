import { useMemo, useState } from "react";
import type { Options } from "highcharts";
import { ChartCard, Readout, Segmented, Toggle } from "../ChartCard";
import { HighchartsView } from "../HighchartsView";
import { ccy, pct, symbolFor, tipHtml } from "../tooltip";
import { TONE } from "../../../lib/highcharts";
import type { Dataset, RiskReturnPoint } from "../../../lib/highcharts-data";

/* 3 — Bubble.
 *
 * Realised vol against return, sized by capital. The third dimension is the
 * whole reason to use a bubble rather than a scatter, so it is switchable:
 * size-by capital asks "where is the money", size-by Sharpe asks "where is the
 * efficiency", and the same eight sectors reorder completely between the two.
 *
 * Clicking a bubble selects it and pins the numbers into the footer, because a
 * tooltip you have to keep hovering to read is no good for comparison. */

type SizeBy = "aum" | "sharpe";

export function RiskReturnBubble({ n, data }: { n: number; data: Dataset }) {
  const [sizeBy, setSizeBy] = useState<SizeBy>("aum");
  const [quadrants, setQuadrants] = useState(true);
  const [selected, setSelected] = useState<RiskReturnPoint | null>(null);

  const medians = useMemo(() => {
    const vols = data.riskReturn.map((p) => p.vol).sort((a, b) => a - b);
    const rets = data.riskReturn.map((p) => p.ret).sort((a, b) => a - b);
    const mid = (xs: number[]) => xs[Math.floor(xs.length / 2)];
    return { vol: mid(vols), ret: mid(rets) };
  }, [data]);

  const options = useMemo<Options>(() => {
    const symbol = symbolFor(data.book.base);
    return {
      chart: { type: "bubble", plotBorderWidth: 0, zooming: { type: "xy" } },
      xAxis: {
        title: { text: "Realised volatility (annualised %)" },
        gridLineWidth: 1,
        plotLines: quadrants
          ? [
              {
                value: medians.vol,
                color: "#cbd5e1",
                dashStyle: "Dash",
                width: 1,
                label: { text: "median vol", style: { color: "#a3a3a3", fontSize: "9px" } },
              },
            ]
          : undefined,
      },
      yAxis: {
        title: { text: "Return, YTD (%)" },
        plotLines: [
          { value: 0, color: "#a3a3a3", width: 1, zIndex: 3 },
          ...(quadrants
            ? [
                {
                  value: medians.ret,
                  color: "#cbd5e1",
                  dashStyle: "Dash" as const,
                  width: 1,
                  label: { text: "median return", style: { color: "#a3a3a3", fontSize: "9px" } },
                },
              ]
            : []),
        ],
      },
      legend: { enabled: false },
      tooltip: {
        formatter() {
          const p = this.options.custom as RiskReturnPoint;
          return tipHtml(p.name, [
            { label: "Return", value: pct(p.ret, 1, true) },
            { label: "Volatility", value: pct(p.vol, 1) },
            { label: "Sharpe", value: p.sharpe.toFixed(2) },
            { label: "Capital", value: ccy(p.aum, symbol, "m", 0) },
          ]);
        },
      },
      plotOptions: {
        bubble: {
          minSize: 12,
          maxSize: 62,
          cursor: "pointer",
          sizeBy: "area",
          allowPointSelect: true,
          states: { select: { color: undefined, borderColor: TONE.ink, borderWidth: 2 } },
          dataLabels: {
            enabled: true,
            format: "{point.custom.short}",
            style: { color: "#404040", fontSize: "9px", fontWeight: "500" },
          },
          point: {
            events: {
              click() {
                const custom = this.options.custom as RiskReturnPoint;
                setSelected((prev) => (prev?.name === custom.name ? null : custom));
              },
            },
          },
        },
      },
      series: [
        {
          type: "bubble",
          name: "Sectors",
          data: data.riskReturn.map((p, i) => ({
            x: p.vol,
            y: p.ret,
            // Sharpe can go negative; bubbles cannot, so shift the scale
            // rather than dropping the loss-making sectors off the chart.
            z: sizeBy === "aum" ? p.aum : Math.max(0.05, p.sharpe + 1.2),
            color: p.ret >= 0 ? undefined : TONE.neg,
            custom: { ...p, short: p.name.slice(0, 4) },
            colorIndex: i,
          })),
        },
      ],
    };
  }, [data, sizeBy, quadrants, medians]);

  return (
    <ChartCard
      n={n}
      title="Risk versus return"
      type="bubble"
      blurb="Vol on x, return on y, capital or Sharpe on the bubble area — the third dimension is a control, not a fixed choice."
      controls={
        <>
          <Segmented<SizeBy>
            label="Size by"
            value={sizeBy}
            onChange={setSizeBy}
            options={[
              { value: "aum", label: "Capital" },
              { value: "sharpe", label: "Sharpe" },
            ]}
          />
          <Toggle checked={quadrants} onChange={setQuadrants}>
            Median guides
          </Toggle>
        </>
      }
      footer={
        selected ? (
          <Readout
            items={[
              { label: "Sector", value: selected.name },
              { label: "Return", value: pct(selected.ret, 1, true), tone: selected.ret >= 0 ? "pos" : "neg" },
              { label: "Vol", value: pct(selected.vol, 1) },
              { label: "Sharpe", value: selected.sharpe.toFixed(2), tone: selected.sharpe >= 0 ? "pos" : "neg" },
              { label: "Capital", value: ccy(selected.aum, symbolFor(data.book.base), "m", 0) },
            ]}
          />
        ) : (
          "Click a bubble to pin its numbers here; drag to zoom into a cluster."
        )
      }
    >
      <HighchartsView options={options} height={300} />
    </ChartCard>
  );
}
