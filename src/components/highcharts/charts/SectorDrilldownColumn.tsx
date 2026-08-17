import { useMemo, useState } from "react";
import type { Options } from "highcharts";
import { ChartCard, Segmented } from "../ChartCard";
import { HighchartsView } from "../HighchartsView";
import { ccy, symbolFor, tipHtml } from "../tooltip";
import { TONE } from "../../../lib/highcharts";
import type { Dataset } from "../../../lib/highcharts-data";

/* 1 — Column with drilldown.
 *
 * Sector totals that open into their issuers. The drilldown module owns the
 * navigation (breadcrumb, animation, back button); what this component adds is
 * the metric switch, which is the interesting bit: exposure is a magnitude and
 * always positive, P&L is signed, so the same bars need a different colour rule
 * and a different axis. Switching metric returns to the top level — the two
 * hierarchies are the same shape, but a drill state carried across a metric
 * change reads as a glitch rather than a feature. */

type Metric = "exposure" | "pnl";
type Sort = "value" | "name";

export function SectorDrilldownColumn({ n, data }: { n: number; data: Dataset }) {
  const [metric, setMetric] = useState<Metric>("exposure");
  const [sort, setSort] = useState<Sort>("value");
  const [drilled, setDrilled] = useState<string | null>(null);

  const options = useMemo<Options>(() => {
    const isPnl = metric === "pnl";
    const order = <T extends { name: string; exposure: number; pnl: number }>(rows: T[]) =>
      [...rows].sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : (isPnl ? b.pnl - a.pnl : b.exposure - a.exposure),
      );

    const colorFor = (v: number) =>
      isPnl ? (v >= 0 ? TONE.pos : TONE.neg) : "#4f46e5";

    const sectors = order(data.sectors).map((s) => {
      const v = isPnl ? s.pnl : s.exposure;
      return {
        name: s.name,
        y: v,
        color: colorFor(v),
        drilldown: s.name,
        custom: { holdings: s.holdings.length },
      };
    });

    const drilldownSeries = data.sectors.map((s) => ({
      type: "column" as const,
      id: s.name,
      name: s.name,
      data: order(s.holdings).map((h) => {
        const v = isPnl ? h.pnl : h.exposure;
        return {
          name: h.name,
          y: v,
          color: colorFor(v),
          custom: { rating: h.rating },
        };
      }),
    }));

    return {
      chart: {
        type: "column",
        events: {
          drilldown(e) {
            setDrilled(e.point.name);
          },
          drillup() {
            setDrilled(null);
          },
        },
      },
      xAxis: { type: "category", labels: { rotation: 0, style: { fontSize: "9px" } } },
      yAxis: {
        title: { text: isPnl ? `Day P&L (${data.book.base}m)` : `Exposure (${data.book.base}m)` },
        plotLines: isPnl
          ? [{ value: 0, color: "#a3a3a3", width: 1, zIndex: 3 }]
          : undefined,
      },
      legend: { enabled: false },
      tooltip: {
        formatter() {
          const custom = this.options.custom as
            | { holdings?: number; rating?: string }
            | undefined;
          return tipHtml(
            String(this.name),
            [
              {
                label: isPnl ? "Day P&L" : "Exposure",
                value: ccy(Number(this.y), symbolFor(data.book.base), "m", isPnl ? 2 : 1, isPnl),
              },
            ],
            custom?.rating
              ? `Rating ${custom.rating}`
              : custom?.holdings
                ? `${custom.holdings} issuers · click to drill in`
                : undefined,
          );
        },
      },
      plotOptions: {
        column: {
          cursor: "pointer",
          maxPointWidth: 46,
          dataLabels: {
            enabled: true,
            format: isPnl ? "{y:.2f}" : "{y:.0f}",
            style: { color: "#525252" },
          },
        },
      },
      drilldown: {
        breadcrumbs: {
          position: { align: "left" },
          buttonTheme: { style: { color: "#4f46e5", fontSize: "11px" } },
        },
        activeAxisLabelStyle: { color: "#4f46e5", textDecoration: "none" },
        activeDataLabelStyle: { color: "#4f46e5", textDecoration: "none" },
        series: drilldownSeries,
      },
      series: [
        {
          type: "column",
          name: metric === "pnl" ? "Day P&L" : "Exposure",
          data: sectors,
        },
      ],
    };
  }, [data, metric, sort]);

  return (
    <ChartCard
      n={n}
      title="Exposure by sector"
      type="column · drilldown"
      blurb="Sector totals that open into their issuers, with a signed colour rule when the metric is P&L."
      controls={
        <>
          <Segmented<Metric>
            label="Metric"
            value={metric}
            onChange={setMetric}
            options={[
              { value: "exposure", label: "Exposure" },
              { value: "pnl", label: "Day P&L" },
            ]}
          />
          <Segmented<Sort>
            label="Sort"
            value={sort}
            onChange={setSort}
            options={[
              { value: "value", label: "By value" },
              { value: "name", label: "A–Z" },
            ]}
          />
        </>
      }
      footer={
        drilled
          ? `Issuers within ${drilled} — use the breadcrumb to go back up.`
          : "Click any column to drill into issuers. Changing metric returns to sector level."
      }
    >
      <HighchartsView options={options} height={300} />
    </ChartCard>
  );
}
