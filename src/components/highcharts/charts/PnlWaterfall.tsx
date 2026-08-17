import { useMemo, useState } from "react";
import type { Options } from "highcharts";
import { ChartCard, Readout, Segmented, Toggle } from "../ChartCard";
import { HighchartsView } from "../HighchartsView";
import { ccy, symbolFor, tipHtml } from "../tooltip";
import { PALETTE, TONE } from "../../../lib/highcharts";
import type { Dataset, WaterfallStep } from "../../../lib/highcharts-data";

/* 9 — Waterfall.
 *
 * Daily P&L from carry to net. The chart type exists to answer "what got us
 * from here to there", and the two controls are about not lying while doing
 * it: sorting by contribution makes the biggest movers obvious but destroys
 * the causal order, so it is off by default and labelled; the subtotal can be
 * hidden when the funding split isn't the point.
 *
 * Clicking a step pins its note — attribution buckets are house definitions
 * and the definition is usually the actual question. */

type Order = "sequence" | "contribution";

export function PnlWaterfall({ n, data }: { n: number; data: Dataset }) {
  const [order, setOrder] = useState<Order>("sequence");
  const [showSubtotal, setShowSubtotal] = useState(true);
  const [picked, setPicked] = useState<WaterfallStep | null>(null);

  const options = useMemo<Options>(() => {
    const symbol = symbolFor(data.book.base);
    const steps = data.waterfall.filter(
      (s) => s.kind === "step" || (s.kind === "subtotal" && showSubtotal),
    );
    const ordered =
      order === "contribution"
        ? [
            ...steps
              .filter((s) => s.kind === "step")
              .sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
          ]
        : steps;

    const total = data.waterfall.find((s) => s.kind === "total")!;

    const points = [
      ...ordered.map((s) => ({
        name: s.name,
        y: s.kind === "subtotal" ? undefined : s.value,
        isIntermediateSum: s.kind === "subtotal" || undefined,
        color:
          s.kind === "subtotal"
            ? PALETTE[7]
            : s.value >= 0
              ? TONE.pos
              : TONE.neg,
        custom: { note: s.note, kind: s.kind },
      })),
      {
        name: total.name,
        isSum: true,
        color: PALETTE[0],
        custom: { note: total.note, kind: total.kind },
      },
    ];

    return {
      chart: { type: "waterfall" },
      xAxis: { type: "category", labels: { style: { fontSize: "10px" } } },
      yAxis: {
        title: { text: `P&L (${data.book.base}m)` },
        plotLines: [{ value: 0, color: "#a3a3a3", width: 1, zIndex: 3 }],
      },
      legend: { enabled: false },
      tooltip: {
        formatter() {
          const custom = this.options.custom as { note: string; kind: string };
          return tipHtml(
            String(this.name),
            [
              {
                label: custom.kind === "step" ? "Contribution" : "Running total",
                value: ccy(Number(this.y), symbol, "m", 2, custom.kind === "step"),
              },
            ],
            custom.note,
          );
        },
      },
      plotOptions: {
        waterfall: {
          cursor: "pointer",
          lineWidth: 1,
          borderWidth: 0,
          maxPointWidth: 44,
          upColor: TONE.pos,
          color: TONE.neg,
          dataLabels: {
            enabled: true,
            format: "{y:.2f}",
            style: { color: "#525252" },
          },
          point: {
            events: {
              click() {
                const custom = this.options.custom as { note: string; kind: string };
                const name = String(this.name);
                setPicked((prev) =>
                  prev?.name === name
                    ? null
                    : {
                        name,
                        value: Number(this.y ?? 0),
                        kind: custom.kind as WaterfallStep["kind"],
                        note: custom.note,
                      },
                );
              },
            },
          },
        },
      },
      series: [{ type: "waterfall", name: "Daily P&L", data: points }],
    };
  }, [data, order, showSubtotal]);

  const net = data.headline.dayPnl;

  return (
    <ChartCard
      n={n}
      title="P&L attribution"
      type="waterfall"
      blurb="Carry to net, with subtotals as computed columns rather than hardcoded numbers."
      controls={
        <>
          <Segmented<Order>
            label="Order"
            value={order}
            onChange={setOrder}
            options={[
              { value: "sequence", label: "Attribution order" },
              { value: "contribution", label: "By size" },
            ]}
          />
          <Toggle checked={showSubtotal} onChange={setShowSubtotal}>
            Gross subtotal
          </Toggle>
        </>
      }
      footer={
        picked ? (
          <Readout
            items={[
              { label: "Bucket", value: picked.name },
              {
                label: picked.kind === "step" ? "Contribution" : "Total",
                value: ccy(picked.value, symbolFor(data.book.base), "m", 2, true),
                tone: picked.value >= 0 ? "pos" : "neg",
              },
              { label: "Definition", value: picked.note },
            ]}
          />
        ) : (
          `Net ${ccy(net, symbolFor(data.book.base), "m", 2, true)} on the day — click a bucket for its definition.`
        )
      }
    >
      <HighchartsView options={options} height={300} />
    </ChartCard>
  );
}
