import { useMemo, useState } from "react";
import { BOOKS, buildDataset, type BookId } from "../lib/highcharts-data";
import { ccy, pct, symbolFor } from "../components/highcharts/tooltip";
import { SectorDrilldownColumn } from "../components/highcharts/charts/SectorDrilldownColumn";
import { AumStackedArea } from "../components/highcharts/charts/AumStackedArea";
import { RiskReturnBubble } from "../components/highcharts/charts/RiskReturnBubble";
import { CorrelationHeatmap } from "../components/highcharts/charts/CorrelationHeatmap";
import { ExposureTreemap } from "../components/highcharts/charts/ExposureTreemap";
import { SettlementSankey } from "../components/highcharts/charts/SettlementSankey";
import { LimitSolidGauge } from "../components/highcharts/charts/LimitSolidGauge";
import { FactorRadar } from "../components/highcharts/charts/FactorRadar";
import { PnlWaterfall } from "../components/highcharts/charts/PnlWaterfall";
import { PriceCandlestick } from "../components/highcharts/charts/PriceCandlestick";

export const title = "Highcharts Gallery";
export const section = "portfolio-analytics";
export const fullWidth = true;

/* Highcharts Gallery — ten chart types over one desk.
 *
 * Every card reads from the same generated book, so the page is a comparison
 * of chart types rather than ten unrelated demos: the same exposure appears as
 * columns, as tiles and as bubbles, and the differences you notice are
 * differences the encoding makes. Switching book re-seeds all ten at once.
 *
 * Highcharts setup (module registration + the shared theme) lives in
 * src/lib/highcharts.ts; the React binding is src/components/highcharts.
 */

const CHARTS = [
  SectorDrilldownColumn,
  AumStackedArea,
  RiskReturnBubble,
  CorrelationHeatmap,
  ExposureTreemap,
  SettlementSankey,
  LimitSolidGauge,
  FactorRadar,
  PnlWaterfall,
  PriceCandlestick,
];

export default function HighchartsGalleryPage() {
  const [bookId, setBookId] = useState<BookId>("rates");
  const data = useMemo(() => buildDataset(bookId), [bookId]);
  const symbol = symbolFor(data.book.base);

  const stats = [
    { label: "Gross exposure", value: ccy(data.headline.aum, symbol, "m", 0) },
    {
      label: "Day P&L",
      value: ccy(data.headline.dayPnl, symbol, "m", 2, true),
      tone: data.headline.dayPnl >= 0 ? "pos" : "neg",
    },
    {
      label: "MTD P&L",
      value: ccy(data.headline.mtdPnl, symbol, "m", 1, true),
      tone: data.headline.mtdPnl >= 0 ? "pos" : "neg",
    },
    { label: "VaR 95% 1d", value: ccy(data.headline.var95, symbol, "m", 2) },
    {
      label: "Limit use",
      value: pct(data.headline.utilisation, 1),
      tone: data.headline.utilisation > 90 ? "neg" : undefined,
    },
    {
      label: "Settled",
      value: pct(data.headline.settledPct, 1),
      tone: data.headline.settledPct < 95 ? "neg" : "pos",
    },
  ] as const;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* pl-36 clears the app's fixed "Home" pill, which floats over the
          top-left corner of every full-width page. */}
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 py-4 pr-6 pl-36 backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              Highcharts · {data.book.desk}
            </div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
              Ten chart types, one book
            </h1>
            <p className="mt-0.5 max-w-2xl text-xs text-neutral-500">
              Drilldown columns, a stacked area, bubbles, a correlation heatmap,
              a treemap, a settlement sankey, a limit gauge, a factor radar, a
              P&amp;L waterfall and a candlestick — each wired to its own
              controls and reading from the same desk.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              Book
            </span>
            <div className="flex border border-neutral-200 bg-white">
              {BOOKS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={b.id === bookId}
                  onClick={() => setBookId(b.id)}
                  className={`px-3 py-1.5 text-xs font-medium transition ${
                    b.id === bookId
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-white px-3 py-2">
              <dt className="text-[10px] font-medium tracking-wide text-neutral-400 uppercase">
                {s.label}
              </dt>
              <dd
                className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${
                  "tone" in s && s.tone === "pos"
                    ? "text-emerald-600"
                    : "tone" in s && s.tone === "neg"
                      ? "text-rose-600"
                      : "text-neutral-900"
                }`}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <main className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2">
        {CHARTS.map((Chart, i) => (
          <Chart key={Chart.name} n={i + 1} data={data} />
        ))}
      </main>

      <footer className="border-t border-neutral-200 bg-white px-6 py-4 text-[11px] leading-relaxed text-neutral-500">
        <p>
          Charts render through a shared React binding
          (<code className="text-neutral-700">components/highcharts/HighchartsView</code>)
          that mounts once and calls <code className="text-neutral-700">chart.update()</code> on
          option changes, so switching a control animates rather than remounting.
          Export is client-side via the offline-exporting module — nothing is
          posted to an export server.
        </p>
        <p className="mt-1.5">
          Data is generated from a seeded PRNG anchored to a fixed date, so the
          numbers are stable across reloads. Highcharts itself is commercially
          licensed; this prototype uses the standard npm distribution under the
          terms that ship with it.
        </p>
      </footer>
    </div>
  );
}
