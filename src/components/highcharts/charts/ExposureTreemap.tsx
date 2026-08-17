import { useMemo, useState } from "react";
import type { Options } from "highcharts";
import { ChartCard, Segmented, Toggle } from "../ChartCard";
import { HighchartsView } from "../HighchartsView";
import { ccy, pct, symbolFor, tipHtml } from "../tooltip";
import type { Dataset } from "../../../lib/highcharts-data";

/* 5 — Treemap.
 *
 * Same sector/issuer hierarchy as chart 1, shown as area instead of height.
 * The trade-off is deliberate: a treemap loses the precise comparison a column
 * chart gives you and buys back the ability to show ~45 positions at once with
 * a second variable in the fill. Colour-by is switchable because "biggest" and
 * "worst" are different questions and the layout only answers the first.
 *
 * Traversal is Highcharts' own (`allowTraversingTree`), so a click zooms into
 * a sector and the header breadcrumb walks back out. */

type ColorBy = "pnl" | "exposure";

export function ExposureTreemap({ n, data }: { n: number; data: Dataset }) {
  const [colorBy, setColorBy] = useState<ColorBy>("pnl");
  const [dense, setDense] = useState(true);

  const options = useMemo<Options>(() => {
    const symbol = symbolFor(data.book.base);
    const gross = data.sectors.reduce((s, x) => s + x.exposure, 0);

    const parents = data.sectors.map((s) => ({
      id: s.name,
      name: s.name,
      colorValue: colorBy === "pnl" ? s.pnl : s.exposure,
      custom: { pnl: s.pnl, exposure: s.exposure, share: (s.exposure / gross) * 100 },
    }));

    const children = data.sectors.flatMap((s) =>
      s.holdings.map((h) => ({
        name: h.name,
        parent: s.name,
        value: h.exposure,
        colorValue: colorBy === "pnl" ? h.pnl : h.exposure,
        custom: {
          pnl: h.pnl,
          exposure: h.exposure,
          share: (h.exposure / gross) * 100,
          rating: h.rating,
        },
      })),
    );

    return {
      chart: { type: "treemap", marginTop: 22, marginBottom: 58 },
      colorAxis:
        colorBy === "pnl"
          ? {
              min: -4,
              max: 4,
              stops: [
                [0, "#be123c"],
                [0.5, "#f5f5f4"],
                [1, "#047857"],
              ],
              labels: { format: "{value}", style: { fontSize: "9px", color: "#737373" } },
            }
          : {
              min: 0,
              minColor: "#e0e7ff",
              maxColor: "#3730a3",
              labels: { style: { fontSize: "9px", color: "#737373" } },
            },
      legend: {
        enabled: true,
        align: "center",
        verticalAlign: "bottom",
        symbolHeight: 8,
        symbolWidth: 180,
        margin: 10,
        y: 6,
      },
      tooltip: {
        formatter() {
          const custom = this.options.custom as {
            pnl: number;
            exposure: number;
            share: number;
            rating?: string;
          };
          return tipHtml(
            String(this.name),
            [
              { label: "Exposure", value: ccy(custom.exposure, symbol, "m", 1) },
              { label: "Share of book", value: pct(custom.share, 1) },
              { label: "Day P&L", value: ccy(custom.pnl, symbol, "m", 2, true) },
            ],
            custom.rating
              ? `Rating ${custom.rating} · click to zoom into the sector`
              : undefined,
          );
        },
      },
      series: [
        {
          type: "treemap",
          name: "Exposure",
          layoutAlgorithm: "squarified",
          allowTraversingTree: true,
          animationLimit: 1000,
          // Parent tiles are entirely covered by their children, so a click can
          // only ever land on a leaf: `interactByLeaf` is what gives the leaves
          // a drill target (their sector) instead of leaving them inert.
          interactByLeaf: true,
          cursor: "pointer",
          breadcrumbs: {
            position: { align: "left" },
            buttonTheme: { style: { color: "#4f46e5", fontSize: "11px" } },
          },
          borderColor: "#ffffff",
          borderWidth: 1,
          levelIsConstant: false,
          levels: [
            {
              level: 1,
              borderWidth: 2,
              borderColor: "#ffffff",
              dataLabels: {
                enabled: true,
                align: "left",
                verticalAlign: "top",
                style: {
                  fontSize: "10px",
                  fontWeight: "600",
                  color: "#ffffff",
                  textOutline: "2px rgba(0,0,0,0.55)",
                  pointerEvents: "none",
                },
              },
            },
            {
              level: 2,
              borderWidth: 1,
              dataLabels: {
                enabled: dense,
                style: {
                  fontSize: "8px",
                  fontWeight: "400",
                  color: "#1c1917",
                  pointerEvents: "none",
                },
              },
            },
          ],
          data: [...parents, ...children],
        },
      ],
    };
  }, [data, colorBy, dense]);

  return (
    <ChartCard
      n={n}
      title="Exposure treemap"
      type="treemap"
      blurb="Area is size, fill is the second variable — swap the fill and the same layout answers a different question."
      controls={
        <>
          <Segmented<ColorBy>
            label="Colour by"
            value={colorBy}
            onChange={setColorBy}
            options={[
              { value: "pnl", label: "Day P&L" },
              { value: "exposure", label: "Exposure" },
            ]}
          />
          <Toggle checked={dense} onChange={setDense}>
            Issuer labels
          </Toggle>
        </>
      }
      footer="Click any issuer tile to zoom into its sector; the breadcrumb above the plot walks back out."
    >
      <HighchartsView options={options} height={330} />
    </ChartCard>
  );
}
