import { useMemo, useState } from "react";
import type { Options } from "highcharts";
import { ChartCard, Readout, Segmented, Toggle } from "../ChartCard";
import { HighchartsView } from "../HighchartsView";
import { tipHtml } from "../tooltip";
import {
  CORR_ASSETS,
  CORR_WINDOWS,
  type CorrWindow,
  type Dataset,
} from "../../../lib/highcharts-data";

/* 4 — Heatmap.
 *
 * A correlation matrix, which is the one case where the colour scale has to be
 * diverging and centred on zero: −0.4 and +0.4 are opposite facts, and a
 * sequential ramp would render them as "similar amounts of blue". The lookback
 * switch matters for the same reason — correlations that look structural over
 * a year often turn out to be a month of crowding. */

type Selection = { x: number; y: number; value: number } | null;

export function CorrelationHeatmap({ n, data }: { n: number; data: Dataset }) {
  const [window, setWindow] = useState<CorrWindow>("3M");
  const [labels, setLabels] = useState(false);
  const [selected, setSelected] = useState<Selection>(null);

  const options = useMemo<Options>(() => {
    const matrix = data.correlation[window];
    const points: { x: number; y: number; value: number }[] = [];
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix.length; x += 1) {
        points.push({ x, y, value: matrix[y][x] });
      }
    }

    return {
      chart: { type: "heatmap", marginTop: 8, marginBottom: 92, plotBorderWidth: 0 },
      xAxis: {
        categories: CORR_ASSETS,
        labels: { rotation: -45, style: { fontSize: "9px" } },
        lineWidth: 0,
        tickWidth: 0,
      },
      yAxis: {
        categories: CORR_ASSETS,
        title: { text: undefined },
        reversed: true,
        labels: { style: { fontSize: "9px" } },
        gridLineWidth: 0,
      },
      colorAxis: {
        min: -1,
        max: 1,
        stops: [
          [0, "#1d4ed8"],
          [0.5, "#f8fafc"],
          [1, "#be123c"],
        ],
        labels: { style: { fontSize: "9px", color: "#737373" } },
      },
      legend: {
        align: "center",
        layout: "horizontal",
        verticalAlign: "bottom",
        margin: 10,
        y: 8,
        symbolHeight: 8,
        symbolWidth: 180,
      },
      tooltip: {
        formatter() {
          const p = this as unknown as { x: number; y: number; value: number };
          return tipHtml(
            `${CORR_ASSETS[p.y]} · ${CORR_ASSETS[p.x]}`,
            [{ label: `Correlation (${window})`, value: p.value.toFixed(2) }],
            p.x === p.y ? "Self-correlation" : undefined,
          );
        },
      },
      plotOptions: {
        heatmap: {
          borderWidth: 1,
          borderColor: "#ffffff",
          cursor: "pointer",
          dataLabels: {
            enabled: labels,
            format: "{point.value:.2f}",
            style: { fontSize: "8px", color: "#404040" },
          },
          point: {
            events: {
              click() {
                const p = this as unknown as { x: number; y: number; value: number };
                setSelected((prev) =>
                  prev && prev.x === p.x && prev.y === p.y
                    ? null
                    : { x: p.x, y: p.y, value: p.value },
                );
              },
            },
          },
        },
      },
      series: [{ type: "heatmap", name: "Correlation", data: points }],
    };
  }, [data, window, labels]);

  return (
    <ChartCard
      n={n}
      title="Cross-asset correlation"
      type="heatmap"
      blurb="Diverging scale centred on zero, so a negative correlation never reads as a weak positive one."
      controls={
        <>
          <Segmented<CorrWindow>
            label="Lookback"
            value={window}
            onChange={setWindow}
            options={CORR_WINDOWS.map((w) => ({ value: w, label: w }))}
          />
          <Toggle checked={labels} onChange={setLabels}>
            Show values
          </Toggle>
        </>
      }
      footer={
        selected ? (
          <Readout
            items={[
              { label: "Pair", value: `${CORR_ASSETS[selected.y]} / ${CORR_ASSETS[selected.x]}` },
              {
                label: window,
                value: selected.value.toFixed(2),
                tone: selected.value >= 0 ? "neg" : "pos",
              },
              {
                label: "Reads as",
                value:
                  Math.abs(selected.value) > 0.7
                    ? "tightly coupled"
                    : Math.abs(selected.value) > 0.35
                      ? "related"
                      : "largely independent",
              },
            ]}
          />
        ) : (
          "Click a cell to pin the pair. Switching lookback keeps the same asset order for comparison."
        )
      }
    >
      <HighchartsView options={options} height={330} />
    </ChartCard>
  );
}
