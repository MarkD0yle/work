import { useMemo, useState } from "react";
import type { Options } from "highcharts";
import { ChartCard, Readout, Segmented } from "../ChartCard";
import { HighchartsView } from "../HighchartsView";
import { tipHtml } from "../tooltip";
import { PALETTE, TONE } from "../../../lib/highcharts";
import type { Dataset } from "../../../lib/highcharts-data";

/* 6 — Sankey.
 *
 * The settlement pipeline: everything booked this morning, and where it ended
 * up. A stage-count bar chart would show the same seven numbers, but the
 * question operations actually asks is "what happened to the fails" — that is
 * a question about paths, and paths are what a sankey draws. The repair loop
 * (Failed → Repaired → Settled) is the point of the diagram.
 *
 * Node colours are semantic rather than categorical: terminal-bad states are
 * red wherever they sit in the flow. */

type Unit = "count" | "share";

const NODE_TONE: Record<string, string> = {
  Booked: PALETTE[7],
  Matched: PALETTE[0],
  Unmatched: PALETTE[3],
  Affirmed: PALETTE[1],
  Settled: TONE.pos,
  Failed: TONE.neg,
  Repaired: PALETTE[6],
  Escalated: "#9f1239",
};

export function SettlementSankey({ n, data }: { n: number; data: Dataset }) {
  const [unit, setUnit] = useState<Unit>("count");
  const [picked, setPicked] = useState<string | null>(null);

  const totals = useMemo(() => {
    const booked = data.flows
      .filter((f) => f.from === "Booked")
      .reduce((s, f) => s + f.weight, 0);
    const inbound = new Map<string, number>();
    data.flows.forEach((f) => {
      inbound.set(f.to, (inbound.get(f.to) ?? 0) + f.weight);
    });
    return { booked, inbound };
  }, [data]);

  const options = useMemo<Options>(() => {
    const fmt = (w: number) =>
      unit === "count"
        ? `${w.toLocaleString("en-GB")} trades`
        : `${((w / totals.booked) * 100).toFixed(1)}% of booked`;

    return {
      chart: { type: "sankey", marginTop: 12 },
      tooltip: {
        formatter() {
          const p = this as unknown as {
            isNode?: boolean;
            id?: string;
            name?: string;
            sum?: number;
            from?: string;
            to?: string;
            weight?: number;
          };
          if (p.isNode) {
            const through = totals.inbound.get(p.id ?? "") ?? totals.booked;
            return tipHtml(
              String(p.name ?? p.id),
              [{ label: "Through this stage", value: fmt(through) }],
              "Click to pin",
            );
          }
          return tipHtml(`${p.from} → ${p.to}`, [
            { label: "Volume", value: fmt(Number(p.weight)) },
          ]);
        },
      },
      plotOptions: {
        sankey: {
          cursor: "pointer",
          nodeWidth: 14,
          nodePadding: 20,
          linkOpacity: 0.42,
          states: { hover: { linkOpacity: 0.85 } },
          dataLabels: {
            enabled: true,
            nodeFormat: "{point.name}",
            style: {
              fontSize: "10px",
              fontWeight: "600",
              color: "#262626",
              textOutline: "3px #ffffff",
            },
          },
          point: {
            events: {
              click() {
                const p = this as unknown as { isNode?: boolean; id?: string };
                if (!p.isNode) return;
                setPicked((prev) => (prev === p.id ? null : (p.id ?? null)));
              },
            },
          },
        },
      },
      series: [
        {
          type: "sankey",
          name: "Settlement flow",
          keys: ["from", "to", "weight"],
          nodes: Object.entries(NODE_TONE).map(([id, color]) => ({
            id,
            color,
            offsetVertical: 0,
          })),
          data: data.flows.map((f) => [f.from, f.to, f.weight] as [string, string, number]),
        },
      ],
    };
  }, [data, unit, totals]);

  const pickedThrough = picked ? (totals.inbound.get(picked) ?? totals.booked) : 0;

  return (
    <ChartCard
      n={n}
      title="Settlement pipeline"
      type="sankey"
      blurb="Where the morning's bookings ended up, including the fail-and-repair loop back into settled."
      controls={
        <>
          <Segmented<Unit>
            label="Units"
            value={unit}
            onChange={setUnit}
            options={[
              { value: "count", label: "Trades" },
              { value: "share", label: "% of booked" },
            ]}
          />
        </>
      }
      footer={
        picked ? (
          <Readout
            items={[
              { label: "Stage", value: picked },
              { label: "Volume", value: pickedThrough.toLocaleString("en-GB") },
              {
                label: "Of booked",
                value: `${((pickedThrough / totals.booked) * 100).toFixed(1)}%`,
                tone: picked === "Escalated" || picked === "Failed" ? "neg" : undefined,
              },
            ]}
          />
        ) : (
          `${totals.booked.toLocaleString("en-GB")} trades booked · hover a link to trace a path, click a node to pin it.`
        )
      }
    >
      <HighchartsView options={options} height={340} />
    </ChartCard>
  );
}
