import { useMemo, useState } from "react";
import type { Options } from "highcharts";
import { ChartCard, Segmented, Toggle } from "../ChartCard";
import { HighchartsView } from "../HighchartsView";
import { PALETTE, TONE } from "../../../lib/highcharts";
import type { Dataset } from "../../../lib/highcharts-data";

/* 10 — Candlestick (Highcharts Stock).
 *
 * The benchmark instrument for the book, on the Stock constructor rather than
 * the plain one: the range selector, navigator and shared crosshair are the
 * reason to reach for Stock at all, and rebuilding them by hand on a normal
 * chart is how you end up with a worse version of them.
 *
 * The moving average is computed here rather than pulled from the indicators
 * module — a simple mean over a window is not worth another bundle, and doing
 * it in the component keeps the window a piece of React state the control can
 * drive. */

type Style = "candlestick" | "ohlc" | "line";

function sma(ohlc: [number, number, number, number, number][], window: number) {
  const out: [number, number][] = [];
  let sum = 0;
  for (let i = 0; i < ohlc.length; i += 1) {
    sum += ohlc[i][4];
    if (i >= window) sum -= ohlc[i - window][4];
    if (i >= window - 1) {
      out.push([ohlc[i][0], Math.round((sum / window) * 100) / 100]);
    }
  }
  return out;
}

export function PriceCandlestick({ n, data }: { n: number; data: Dataset }) {
  const [style, setStyle] = useState<Style>("candlestick");
  const [showVolume, setShowVolume] = useState(true);
  const [maWindow, setMaWindow] = useState("20");

  const options = useMemo<Options>(() => {
    const window = Number(maWindow);
    const priceSeries =
      style === "line"
        ? {
            type: "line" as const,
            name: `${data.book.label} index`,
            data: data.ohlc.map((r) => [r[0], r[4]] as [number, number]),
            color: PALETTE[0],
            lineWidth: 1.5,
            id: "price",
          }
        : {
            type: style,
            name: `${data.book.label} index`,
            data: data.ohlc,
            id: "price",
            color: TONE.neg,
            upColor: TONE.pos,
            lineColor: TONE.neg,
            upLineColor: TONE.pos,
          };

    return {
      chart: { marginTop: 24 },
      rangeSelector: {
        selected: 2,
        inputEnabled: false,
        buttonTheme: {
          fill: "none",
          r: 0,
          style: { color: "#525252", fontSize: "10px", fontWeight: "500" },
          states: {
            hover: { fill: "#f5f5f5" },
            select: { fill: "#171717", style: { color: "#ffffff" } },
          },
        },
        buttons: [
          { type: "month", count: 1, text: "1M" },
          { type: "month", count: 3, text: "3M" },
          { type: "month", count: 6, text: "6M" },
          { type: "ytd", text: "YTD" },
          { type: "all", text: "All" },
        ],
        labelStyle: { display: "none" },
      },
      navigator: {
        height: 28,
        maskFill: "rgba(79,70,229,0.10)",
        outlineColor: "#e5e5e5",
        handles: { backgroundColor: "#ffffff", borderColor: "#a3a3a3" },
        series: { color: PALETTE[0], lineWidth: 1 },
        xAxis: { labels: { style: { fontSize: "9px", color: "#a3a3a3" } } },
      },
      scrollbar: { enabled: false },
      xAxis: { crosshair: { dashStyle: "Dot", color: "#cbd5e1" } },
      yAxis: [
        {
          height: showVolume ? "72%" : "100%",
          labels: { align: "right", x: -4, style: { fontSize: "10px", color: "#737373" } },
          title: { text: undefined },
          resize: { enabled: true },
        },
        {
          top: "76%",
          height: "24%",
          offset: 0,
          labels: { enabled: false },
          title: { text: undefined },
          gridLineWidth: 0,
          visible: showVolume,
        },
      ],
      legend: { enabled: false },
      tooltip: {
        split: false,
        shared: true,
        valueDecimals: 2,
      },
      plotOptions: {
        candlestick: { lineWidth: 1, pointPadding: 0.15 },
        ohlc: { lineWidth: 1.4 },
        column: { borderWidth: 0 },
      },
      series: [
        priceSeries,
        {
          type: "line",
          name: `SMA ${window}`,
          data: sma(data.ohlc, window),
          color: PALETTE[3],
          lineWidth: 1.4,
          dashStyle: "ShortDash",
          tooltip: { valueDecimals: 2 },
        },
        {
          type: "column",
          name: "Volume",
          data: data.volume,
          yAxis: 1,
          visible: showVolume,
          color: "#d4d4d8",
          tooltip: { valueDecimals: 0 },
        },
      ],
    };
  }, [data, style, showVolume, maWindow]);

  return (
    <ChartCard
      n={n}
      title="Benchmark price history"
      type="candlestick · stock"
      blurb="The Stock constructor: range selector, navigator and a draggable axis split for volume."
      controls={
        <>
          <Segmented<Style>
            label="Style"
            value={style}
            onChange={setStyle}
            options={[
              { value: "candlestick", label: "Candles" },
              { value: "ohlc", label: "OHLC" },
              { value: "line", label: "Line" },
            ]}
          />
          <Segmented
            label="SMA"
            value={maWindow}
            onChange={setMaWindow}
            options={[
              { value: "10", label: "10d" },
              { value: "20", label: "20d" },
              { value: "50", label: "50d" },
            ]}
          />
          <Toggle checked={showVolume} onChange={setShowVolume}>
            Volume pane
          </Toggle>
        </>
      }
      footer="Drag inside the plot to zoom, drag the navigator handles to pan, or use the range buttons."
    >
      <HighchartsView options={options} constructorType="stockChart" height={340} />
    </ChartCard>
  );
}
