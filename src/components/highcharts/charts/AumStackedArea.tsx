import { useMemo, useState } from "react";
import type { Options } from "highcharts";
import { ChartCard, Segmented, Toggle } from "../ChartCard";
import { HighchartsView } from "../HighchartsView";
import { ccy, pct, symbolFor, tipHtml } from "../tooltip";
import { PALETTE } from "../../../lib/highcharts";
import type { Dataset } from "../../../lib/highcharts-data";

/* 2 — Stacked area.
 *
 * Assets under management by asset class over a rolling year. Two things make
 * a stack readable: a shared tooltip (comparing classes one hover at a time is
 * useless) and an explicit absolute/share switch, because a percent stack
 * answers "what is the mix" while a normal stack answers "is the book
 * growing" — and a chart that only offers one of those will be misread as
 * answering the other. The legend does the per-class filtering, so there are
 * no redundant checkboxes here. */

type Stack = "normal" | "percent";
type Window = "12M" | "6M" | "3M";

const WINDOW_MONTHS: Record<Window, number> = { "12M": 12, "6M": 6, "3M": 3 };

export function AumStackedArea({ n, data }: { n: number; data: Dataset }) {
  const [stack, setStack] = useState<Stack>("normal");
  const [window, setWindow] = useState<Window>("12M");
  const [smooth, setSmooth] = useState(true);

  const options = useMemo<Options>(() => {
    const take = WINDOW_MONTHS[window];
    const months = data.aum.months.slice(-take);
    const symbol = symbolFor(data.book.base);

    return {
      chart: { type: smooth ? "areaspline" : "area" },
      xAxis: { categories: months, tickmarkPlacement: "on", crosshair: true },
      yAxis: {
        title: { text: stack === "percent" ? "Share of AUM" : `AUM (${data.book.base}m)` },
        labels: { format: stack === "percent" ? "{value}%" : "{value}" },
        max: stack === "percent" ? 100 : undefined,
      },
      legend: { align: "left", verticalAlign: "top", margin: 12 },
      tooltip: {
        shared: true,
        formatter() {
          const rows = (this.points ?? []).map((p) => ({
            label: p.series.name,
            color: String(p.color),
            value:
              stack === "percent"
                ? pct(Number(p.percentage), 1)
                : ccy(Number(p.y), symbol, "m", 0),
          }));
          const total = (this.points ?? []).reduce((s, p) => s + Number(p.y), 0);
          return tipHtml(
            String(this.category),
            [...rows, { label: "Total", value: ccy(total, symbol, "m", 0) }],
            `${data.book.label} · month end`,
          );
        },
      },
      plotOptions: {
        area: { stacking: stack, lineWidth: 1, marker: { enabled: false } },
        areaspline: {
          stacking: stack,
          lineWidth: 1,
          marker: { enabled: false, symbol: "circle", radius: 3 },
        },
      },
      series: data.aum.series.map((s, i) => ({
        type: (smooth ? "areaspline" : "area") as "areaspline",
        name: s.name,
        data: s.data.slice(-take),
        color: PALETTE[i % PALETTE.length],
        fillOpacity: 0.55,
      })),
    };
  }, [data, stack, window, smooth]);

  return (
    <ChartCard
      n={n}
      title="AUM by asset class"
      type="area · stacked"
      blurb="Absolute or share-of-book, with a shared tooltip so the classes can be read against each other."
      controls={
        <>
          <Segmented<Stack>
            label="Stack"
            value={stack}
            onChange={setStack}
            options={[
              { value: "normal", label: "Absolute" },
              { value: "percent", label: "Share" },
            ]}
          />
          <Segmented<Window>
            label="Window"
            value={window}
            onChange={setWindow}
            options={[
              { value: "12M", label: "12M" },
              { value: "6M", label: "6M" },
              { value: "3M", label: "3M" },
            ]}
          />
          <Toggle checked={smooth} onChange={setSmooth}>
            Spline
          </Toggle>
        </>
      }
      footer="Click a legend entry to drop a class out of the stack — the remaining shares rebase."
    >
      <HighchartsView options={options} height={300} />
    </ChartCard>
  );
}
