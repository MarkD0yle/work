import { useEffect, useRef } from "react";
import type { Chart, Options } from "highcharts";
import Highcharts from "../../lib/highcharts";
import { useChartSlot } from "./chart-slot";

/* Thin React binding for Highcharts.
 *
 * Highcharts owns its own DOM and mutates in place, so the useful React
 * wrapper is the smallest one: mount into a div, `update()` when the options
 * object changes identity, destroy on unmount. Callers are expected to memo
 * their options — an unmemoised object would re-run the update on every render
 * and cancel the animation each time.
 *
 * `update(..., oneToOne: true)` is deliberate: series absent from the new
 * options are removed rather than left behind, which is what makes the series
 * toggles on the gallery page work.
 */

export type HighchartsViewProps = {
  options: Options;
  /** `stockChart` brings the navigator + range selector; used by the candlestick. */
  constructorType?: "chart" | "stockChart";
  /** Height in px. Highcharts reads the container, so this drives layout. */
  height?: number;
  className?: string;
  /** Runs once per chart instance, for wiring imperative behaviour. */
  onReady?: (chart: Chart) => void;
};

export function HighchartsView({
  options,
  constructorType = "chart",
  height = 300,
  className = "",
  onReady,
}: HighchartsViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const slot = useChartSlot();

  // Callers pass `onReady` as an inline arrow, so it changes identity every
  // render; holding it in a ref keeps it out of the mount effect's deps, where
  // it would tear the chart down and rebuild it on each parent render. The ref
  // is seeded at first render and synced after — never written during one.
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (chartRef.current) {
      chartRef.current.update(options, true, true, true);
      return;
    }
    const chart = Highcharts[constructorType](host, options);
    chartRef.current = chart;
    slot?.register(chart);
    readyRef.current?.(chart);
  }, [options, constructorType, slot]);

  // Destroy is its own effect so an options change never recreates the chart.
  useEffect(
    () => () => {
      slot?.register(null);
      chartRef.current?.destroy();
      chartRef.current = null;
    },
    [slot],
  );

  // Highcharts listens for window resize, but not for a container that changes
  // width on its own (grid reflow, panel open, print). ResizeObserver covers it.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => chartRef.current?.reflow());
    });
    ro.observe(host);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  return <div ref={hostRef} style={{ height }} className={className} />;
}

export default HighchartsView;
