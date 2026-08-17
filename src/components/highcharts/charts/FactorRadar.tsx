import { useMemo, useState } from "react";
import type { Options } from "highcharts";
import { ChartCard, Segmented, Toggle } from "../ChartCard";
import { HighchartsView } from "../HighchartsView";
import { tipHtml } from "../tooltip";
import { PALETTE, TONE } from "../../../lib/highcharts";
import { FACTORS, type Dataset } from "../../../lib/highcharts-data";

/* 8 — Polar / spiderweb.
 *
 * Factor exposure against the mandate benchmark. A radar is the right shape
 * here for one narrow reason: the seven factors are a fixed, ordered set that
 * everyone on the desk reads in the same order, so the silhouette itself
 * becomes recognisable and a change of shape is the signal.
 *
 * The active-exposure view (portfolio − benchmark) is the honest version of
 * the same data — overlapping polygons flatter small differences, a signed bar
 * around the circle does not — so both are offered rather than picking one. */

type View = "overlay" | "active";

export function FactorRadar({ n, data }: { n: number; data: Dataset }) {
  const [view, setView] = useState<View>("overlay");
  const [filled, setFilled] = useState(true);

  const options = useMemo<Options>(() => {
    const active = data.factors.portfolio.map(
      (v, i) => Math.round((v - data.factors.benchmark[i]) * 100) / 100,
    );

    const shared: Options = {
      chart: { polar: true, marginTop: 16 },
      xAxis: {
        categories: FACTORS,
        tickmarkPlacement: "on",
        lineWidth: 0,
        gridLineWidth: 1,
        labels: { style: { fontSize: "10px", color: "#525252" } },
      },
      pane: { size: "82%" },
    };

    if (view === "active") {
      return {
        ...shared,
        yAxis: {
          gridLineInterpolation: "polygon",
          lineWidth: 0,
          min: -0.5,
          max: 0.5,
          tickInterval: 0.25,
          labels: { style: { fontSize: "9px" } },
          plotBands: [{ from: -0.005, to: 0.005, color: "#a3a3a3" }],
        },
        legend: { enabled: false },
        tooltip: {
          formatter() {
            return tipHtml(String(this.category), [
              {
                label: "Active exposure",
                value: `${Number(this.y) > 0 ? "+" : ""}${Number(this.y).toFixed(2)}`,
              },
            ]);
          },
        },
        series: [
          {
            type: "column",
            name: "Active exposure",
            pointPlacement: "on",
            colorByPoint: false,
            data: active.map((v) => ({ y: v, color: v >= 0 ? PALETTE[0] : TONE.neg })),
          },
        ],
      };
    }

    return {
      ...shared,
      yAxis: {
        gridLineInterpolation: "polygon",
        lineWidth: 0,
        min: 0,
        max: 1,
        tickInterval: 0.25,
        labels: { style: { fontSize: "9px" } },
      },
      legend: { align: "center", verticalAlign: "bottom", margin: 0 },
      tooltip: {
        shared: true,
        formatter() {
          const rows = (this.points ?? []).map((p) => ({
            label: p.series.name,
            color: String(p.color),
            value: Number(p.y).toFixed(2),
          }));
          const diff =
            (this.points?.[0]?.y ?? 0) - (this.points?.[1]?.y ?? 0);
          return tipHtml(String(this.category), [
            ...rows,
            { label: "Active", value: `${diff > 0 ? "+" : ""}${diff.toFixed(2)}` },
          ]);
        },
      },
      plotOptions: {
        series: { pointPlacement: "on", marker: { radius: 3 } },
      },
      series: [
        {
          type: filled ? "area" : "line",
          name: "Portfolio",
          data: data.factors.portfolio,
          color: PALETTE[0],
          fillOpacity: 0.28,
          lineWidth: 2,
        },
        {
          type: filled ? "area" : "line",
          name: "Benchmark",
          data: data.factors.benchmark,
          color: PALETTE[7],
          fillOpacity: 0.16,
          lineWidth: 2,
          dashStyle: "ShortDash",
        },
      ],
    };
  }, [data, view, filled]);

  return (
    <ChartCard
      n={n}
      title="Factor exposure"
      type="polar · spiderweb"
      blurb="Seven factors in a fixed order, so the silhouette is the signal — with a signed active view when the overlay hides too much."
      controls={
        <>
          <Segmented<View>
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "overlay", label: "Overlay" },
              { value: "active", label: "Active" },
            ]}
          />
          {view === "overlay" && (
            <Toggle checked={filled} onChange={setFilled}>
              Fill areas
            </Toggle>
          )}
        </>
      }
      footer={
        view === "overlay"
          ? "Portfolio versus mandate benchmark, both on a 0–1 exposure scale."
          : "Portfolio minus benchmark. Bars outside ±0.25 are the ones the mandate asks about."
      }
    >
      <HighchartsView options={options} height={320} />
    </ChartCard>
  );
}
