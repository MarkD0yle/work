import { useEffect, useMemo, useRef, useState } from "react";
import type { Chart, Options } from "highcharts";
import { ChartCard, Readout, Segmented, Slider, Toggle } from "../ChartCard";
import { HighchartsView } from "../HighchartsView";
import { TONE } from "../../../lib/highcharts";
import type { Dataset } from "../../../lib/highcharts-data";

/* 7 — Solid gauge.
 *
 * Limit utilisation. A gauge is a poor way to compare things and a good way to
 * show one number against one threshold, which is exactly the risk-limit case:
 * nobody needs to rank four limits against each other, they need to know
 * whether this one is about to break.
 *
 * Two interactions carry it. The shock slider re-prices utilisation under a
 * stress, so you can see how much headroom is real; the live toggle pushes
 * intraday jitter through `point.update()` rather than re-rendering the chart,
 * which is how a Highcharts gauge is meant to animate. */

const BANDS = [
  { from: 0, to: 70, color: "#10b981" },
  { from: 70, to: 90, color: "#f59e0b" },
  { from: 90, to: 100, color: "#f43f5e" },
];

export function LimitSolidGauge({ n, data }: { n: number; data: Dataset }) {
  const [limitIdx, setLimitIdx] = useState("0");
  const [shock, setShock] = useState(0);
  const [live, setLive] = useState(false);
  const chartRef = useRef<Chart | null>(null);
  // Intraday drift is applied on top of the shock so the two are separable.
  const [jitter, setJitter] = useState(0);

  const limit = data.limits[Number(limitIdx)];
  const used = limit.used * (1 + shock / 100) * (1 + jitter / 100);
  const utilisation = Math.min(140, (used / limit.limit) * 100);

  // Changing limit or shock clears the drift with the same event that caused
  // it, so a stale wobble is never read as part of the new scenario.
  function pickLimit(next: string) {
    setLimitIdx(next);
    setJitter(0);
  }
  function applyShock(next: number) {
    setShock(next);
    setJitter(0);
  }

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => {
      setJitter((j) => Math.max(-8, Math.min(8, j + (Math.random() - 0.48) * 1.6)));
    }, 1200);
    return () => window.clearInterval(id);
  }, [live]);

  // Push the value through the point API: no re-render, no re-layout, and the
  // gauge's own animation does the work.
  useEffect(() => {
    const point = chartRef.current?.series?.[0]?.points?.[0];
    point?.update(Math.round(utilisation * 10) / 10, true, { duration: 700 });
  }, [utilisation]);

  const options = useMemo<Options>(() => {
    return {
      chart: { type: "solidgauge", marginTop: 22 },
      pane: {
        center: ["50%", "78%"],
        size: "160%",
        startAngle: -90,
        endAngle: 90,
        background: [
          {
            backgroundColor: "#f5f5f5",
            innerRadius: "62%",
            outerRadius: "100%",
            shape: "arc",
            borderWidth: 0,
          },
        ],
      },
      yAxis: {
        min: 0,
        max: 100,
        lineWidth: 0,
        tickWidth: 0,
        minorTickInterval: undefined,
        tickAmount: 3,
        labels: { y: 16, distance: 12, style: { fontSize: "9px" } },
        plotBands: BANDS.map((b) => ({
          from: b.from,
          to: b.to,
          color: b.color,
          thickness: 3,
          outerRadius: "106%",
          innerRadius: "103%",
        })),
        stops: [
          [0.0, TONE.pos],
          [0.7, "#f59e0b"],
          [0.9, TONE.neg],
        ],
      },
      tooltip: { enabled: false },
      plotOptions: {
        solidgauge: {
          innerRadius: "62%",
          rounded: false,
          dataLabels: {
            y: -22,
            borderWidth: 0,
            useHTML: true,
            format:
              '<div style="text-align:center">' +
              '<div style="font-size:26px;font-weight:600;font-variant-numeric:tabular-nums;color:#171717">{y:.1f}%</div>' +
              '<div style="font-size:10px;color:#a3a3a3;letter-spacing:.08em;text-transform:uppercase">of limit</div>' +
              "</div>",
          },
        },
      },
      series: [
        {
          type: "solidgauge",
          name: "Utilisation",
          data: [Math.round(utilisation * 10) / 10],
        },
      ],
    };
    // The value is driven imperatively (see above); rebuilding options on every
    // tick would restart the animation and defeat the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limitIdx]);

  const headroom = limit.limit - used;
  const breached = utilisation >= 100;

  return (
    <ChartCard
      n={n}
      title="Limit utilisation"
      type="solid gauge"
      blurb="One number against one threshold, with a stress slider that shows how much of the headroom survives a shock."
      controls={
        <>
          <Segmented
            label="Limit"
            value={limitIdx}
            onChange={pickLimit}
            options={data.limits.map((l, i) => ({
              value: String(i),
              label: l.name.split(" ")[0],
            }))}
          />
          <Slider
            label="Shock"
            value={shock}
            min={-20}
            max={60}
            step={5}
            onChange={applyShock}
            format={(v) => `${v > 0 ? "+" : ""}${v}%`}
          />
          <Toggle checked={live} onChange={setLive}>
            Live ticks
          </Toggle>
        </>
      }
      footer={
        <Readout
          items={[
            { label: "Limit", value: limit.name },
            {
              label: "Used",
              value: `${used.toFixed(limit.unit === "%" ? 2 : 1)}${limit.unit}`,
            },
            {
              label: "Headroom",
              value: `${headroom.toFixed(limit.unit === "%" ? 2 : 1)}${limit.unit}`,
              tone: breached ? "neg" : headroom / limit.limit < 0.1 ? "neg" : "pos",
            },
            { label: "Basis", value: limit.headroomNote },
          ]}
        />
      }
    >
      <HighchartsView
        options={options}
        height={236}
        onReady={(chart) => {
          chartRef.current = chart;
        }}
      />
    </ChartCard>
  );
}
