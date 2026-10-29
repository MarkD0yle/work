import { useMemo, useState } from "react";
import type { Options, Point } from "highcharts";
import HighchartsView from "../highcharts/HighchartsView";
import { tipHtml } from "../highcharts/tooltip";
import { CAUSES, MTD_DAYS, PREV_MONTH_FROM, PREV_MONTH_TO, REGIME_LABEL, type DayAgg, type MarketRow } from "./model";
import { CAUSE_COLOR, INK, REGIME_SHORT, STATUS, dateLong, dateMid, dateShort, gbpC, gbpTick, num0, pct } from "./format";
import { CardHeader, EmptyState, LegendItem, MicroLabel, RegimeChip, ViewToggle, type View } from "./ui";

const TH = "px-3 py-1.5 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase";
const TD = "px-3 py-1.5 font-mono text-[11px] tabular-nums text-neutral-800";
const r2 = (v: number) => Math.round(v * 100) / 100;
const HOUR = 3_600_000;

/* ------------------------------------------------------------------ *
 * Daily timeline: failing instructions by root cause, with the fails rate
 * ------------------------------------------------------------------ */

export function TimelineCard({ days, revisionT }: { days: DayAgg[]; revisionT: number }) {
  const [mode, setMode] = useState<View>("chart");
  const last = days[days.length - 1];
  const total = days.reduce((s, d) => s + d.n, 0);

  const options = useMemo<Options>(() => {
    const byT = new Map(days.map((d) => [d.t, d]));
    const lbl = { fontSize: "10px", fontWeight: "600", color: INK };
    return {
      chart: { type: "column", spacing: [10, 8, 4, 4] },
      xAxis: {
        type: "datetime",
        // Half a day of slack each side keeps the first column and the "today" band inside the plot.
        min: days[0].t - 12 * HOUR,
        max: last.t + 12 * HOUR,
        crosshair: { color: "rgba(23,23,23,0.08)", width: 1 },
        labels: { format: "{value:%e %b}" },
        plotLines: [
          {
            value: revisionT,
            color: INK,
            width: 1,
            dashStyle: "Dash",
            zIndex: 4,
            label: { text: "CSDR penalty rate revision", rotation: 0, align: "left", x: 6, y: 12, style: lbl },
          },
        ],
        plotBands: [
          {
            from: last.t - 11 * HOUR,
            to: last.t + 11 * HOUR,
            color: "rgba(23,23,23,0.06)",
            zIndex: 0,
            // `inside: false`: the default clips a band label to the band, and a 20-hour band is far narrower than the word.
            label: { text: "Today", inside: false, rotation: 0, align: "right", textAlign: "right", x: -2, y: 12, style: { ...lbl, color: "#737373" } },
          },
        ],
      },
      /* Two measures of different scale: the count is the subject, the rate is
       * its context. The rate axis carries no gridlines so it never invents
       * an alignment with the count axis. */
      yAxis: [
        { title: { text: "Failing instructions" }, allowDecimals: false, min: 0 },
        {
          title: { text: "Fails rate, by value" },
          opposite: true,
          gridLineWidth: 0,
          min: 0,
          labels: { format: "{value}%" },
        },
      ],
      legend: { enabled: true, align: "left", verticalAlign: "bottom", itemDistance: 12, symbolHeight: 8, symbolWidth: 8 },
      tooltip: {
        shared: true,
        formatter(this: Point) {
          const d = byT.get(Number(this.x));
          if (!d) return false;
          return tipHtml(
            dateLong(d.t),
            [
              ...CAUSES.map((c, i) => ({ label: c, value: num0(d.byCause[i]), color: CAUSE_COLOR[c] })),
              { label: "Total failing", value: num0(d.n) },
              { label: "Fails rate", value: pct(d.rate, 2) },
            ],
            d.t === last.t ? "Intraday snapshot" : undefined,
          );
        },
      },
      plotOptions: {
        column: { stacking: "normal", pointPadding: 0.04, groupPadding: 0.06, borderWidth: 1, borderColor: "#ffffff", maxPointWidth: 14 },
        series: { animation: false, states: { inactive: { opacity: 1 } } },
      },
      series: [
        ...CAUSES.map((c, i) => ({
          type: "column" as const,
          name: c,
          color: CAUSE_COLOR[c],
          data: days.map((d) => [d.t, d.byCause[i]]),
        })),
        {
          type: "line" as const,
          name: "Fails rate, by value",
          yAxis: 1,
          color: INK,
          lineWidth: 2,
          marker: { enabled: false, symbol: "square" },
          states: { hover: { lineWidthPlus: 0 } },
          zIndex: 5,
          data: days.map((d) => [d.t, r2(d.rate)]),
        },
      ],
    };
  }, [days, revisionT, last.t]);

  const newestFirst = useMemo(() => [...days].reverse(), [days]);

  return (
    <section aria-labelledby="sf-timeline-title" className="flex h-full flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="sf-timeline-title"
        title="Daily fails by root cause"
        sub={`${days.length} business days to ${dateMid(last.t)} · today is the intraday snapshot at 10:40 · dashed line marks the 1 Sep penalty-rate revision`}
        right={<ViewToggle value={mode} onChange={setMode} name="Daily fails" />}
      />
      {total === 0 ? (
        <EmptyState title="No fails in this slice over the window" body="Widen the market, asset class or direction filters." />
      ) : mode === "chart" ? (
        <div className="min-w-0 px-1 pt-1 pb-1">
          <HighchartsView options={options} height={336} />
        </div>
      ) : (
        <div className="max-h-[352px] overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Failing instructions per business day by root cause, with the fails rate by value</caption>
            <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e5e5e5]">
              <tr>
                <th scope="col" className={TH}>Day</th>
                {CAUSES.map((c) => (
                  <th key={c} scope="col" className={`${TH} text-right`}>
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="inline-block h-2 w-2" style={{ background: CAUSE_COLOR[c] }} />
                      {c}
                    </span>
                  </th>
                ))}
                <th scope="col" className={`${TH} text-right`}>Total</th>
                <th scope="col" className={`${TH} text-right`}>Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {newestFirst.map((d) => (
                <tr key={d.t} className={d.t === last.t ? "bg-neutral-50" : undefined}>
                  <th scope="row" className="px-3 py-1.5 text-[11px] font-medium whitespace-nowrap text-neutral-800">
                    {dateShort(d.t)}
                    {d.t === last.t && <span className="ml-1 text-[10px] font-normal text-neutral-400">today</span>}
                  </th>
                  {d.byCause.map((n, i) => (
                    <td key={CAUSES[i]} className={`${TD} text-right ${n === 0 ? "text-neutral-300" : ""}`}>
                      {n}
                    </td>
                  ))}
                  <td className={`${TD} text-right font-semibold`}>{num0(d.n)}</td>
                  <td className={`${TD} text-right`}>{pct(d.rate, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Penalties by market: received against paid, net marked, MTD
 * ------------------------------------------------------------------ */

export function PenaltiesCard({ rows }: { rows: MarketRow[] }) {
  const [mode, setMode] = useState<View>("chart");
  const gross = rows.reduce((s, r) => s + r.paid + r.received, 0);
  const net = rows.reduce((s, r) => s + r.net, 0);
  const prev = rows.reduce((s, r) => s + r.prevNet, 0);

  const options = useMemo<Options>(() => {
    const maxAbs = Math.max(1, ...rows.map((r) => Math.max(r.paid, r.received)));
    return {
      chart: { type: "bar", spacing: [8, 8, 4, 4] },
      xAxis: {
        categories: rows.map((r) => r.market.label),
        lineWidth: 0,
        tickWidth: 0,
        labels: {
          useHTML: true,
          formatter() {
            const r = rows[this.pos];
            if (!r) return String(this.value);
            return `<div style="text-align:right;line-height:1.25"><div style="font-size:11px;color:#404040">${r.market.label}</div><div style="font-size:9px;color:#a3a3a3">${REGIME_SHORT[r.market.regime]}</div></div>`;
          },
        },
      },
      yAxis: {
        title: { text: undefined },
        min: -maxAbs * 1.35,
        max: maxAbs * 1.35,
        tickAmount: 7,
        labels: {
          formatter() {
            return gbpTick(Number(this.value));
          },
        },
        plotLines: [{ value: 0, color: INK, width: 1, zIndex: 4 }],
      },
      // The card carries its own legend, with the direction of each bar spelled out.
      legend: { enabled: false },
      tooltip: {
        shared: true,
        formatter(this: Point) {
          const r = rows[Number(this.x)];
          if (!r) return false;
          if (r.market.regime === "none")
            return tipHtml(r.market.label, [{ label: "No cash penalty regime", value: "—" }]);
          return tipHtml(
            r.market.label,
            [
              { label: "Received", value: gbpC(r.received), color: STATUS.good },
              { label: "Paid", value: gbpC(r.paid), color: STATUS.bad },
              { label: "Net MTD", value: gbpC(r.net, true) },
              { label: `Aug, same ${MTD_DAYS} days`, value: gbpC(r.prevNet, true) },
            ],
            REGIME_LABEL[r.market.regime],
          );
        },
      },
      plotOptions: {
        bar: { stacking: "normal", pointPadding: 0.08, groupPadding: 0.1, borderWidth: 0, maxPointWidth: 18 },
        series: { animation: false, states: { inactive: { opacity: 1 } } },
      },
      series: [
        {
          type: "bar",
          name: "Received (counterparty failed)",
          color: STATUS.good,
          data: rows.map((r) => r.received),
        },
        {
          type: "bar",
          name: "Paid (we failed)",
          color: STATUS.bad,
          data: rows.map((r) => -r.paid),
        },
        {
          type: "scatter",
          name: "Net MTD",
          color: INK,
          marker: { symbol: "square", radius: 4, fillColor: INK, lineWidth: 0 },
          zIndex: 6,
          dataLabels: {
            enabled: true,
            align: "left",
            verticalAlign: "middle",
            x: 8,
            y: 0,
            backgroundColor: "rgba(255,255,255,0.85)",
            padding: 2,
            style: { fontSize: "10px", fontWeight: "600", color: INK },
            formatter() {
              return gbpC(Number(this.y), true);
            },
          },
          data: rows.map((r) => (r.market.regime === "none" ? null : r.net)),
        },
      ],
    };
  }, [rows]);

  const height = Math.max(200, 40 * rows.length + 70);

  return (
    <section aria-labelledby="sf-pen-title" className="flex h-full flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="sf-pen-title"
        title="Penalties by market"
        sub={`Month to date, ${MTD_DAYS} business days · received is good, paid is bad · net ${gbpC(net, true)} on ${gbpC(gross)} gross`}
        right={<ViewToggle value={mode} onChange={setMode} name="Penalties by market" />}
      />
      {rows.length === 0 ? (
        <EmptyState title="No markets selected" body="Select at least one market in the header." />
      ) : mode === "chart" ? (
        <>
          <div className="min-w-0 px-1 pt-1">
            <HighchartsView options={options} height={height} />
          </div>
          <div className="px-4 pt-1 pb-3">
            <MicroLabel>Month on month, net · Sep MTD vs {dateShort(PREV_MONTH_FROM)}–{dateShort(PREV_MONTH_TO)}</MicroLabel>
            <ol
              className="mt-1.5 grid gap-px border border-neutral-100 bg-neutral-100"
              style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}
            >
              {rows.map((r) => {
                const none = r.market.regime === "none";
                const d = r.net - r.prevNet;
                const tone = none ? "text-neutral-300" : d > 0 ? "text-emerald-700" : d < 0 ? "text-rose-700" : "text-neutral-500";
                return (
                  <li key={r.market.id} className="flex min-w-0 flex-col bg-white px-2 py-1.5" title={none ? `${r.market.label}: no cash penalty regime` : `${r.market.label}: ${gbpC(r.prevNet, true)} → ${gbpC(r.net, true)}`}>
                    <span className="truncate text-[9px] leading-tight text-neutral-400">{r.market.label}</span>
                    <span className={`font-mono text-[11px] leading-tight font-semibold tabular-nums ${tone}`}>
                      {none ? "—" : `${d > 0 ? "▲" : d < 0 ? "▼" : ""} ${gbpC(d, true)}`}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Month-to-date penalties by market: received, paid, net and the prior month</caption>
            <thead className="bg-white shadow-[0_1px_0_#e5e5e5]">
              <tr>
                <th scope="col" className={TH}>Market</th>
                <th scope="col" className={TH}>Regime</th>
                <th scope="col" className={`${TH} text-right`}>Received</th>
                <th scope="col" className={`${TH} text-right`}>Paid</th>
                <th scope="col" className={`${TH} text-right`}>Net MTD</th>
                <th scope="col" className={`${TH} text-right`}>Aug, same days</th>
                <th scope="col" className={`${TH} text-right`}>Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => {
                const none = r.market.regime === "none";
                return (
                  <tr key={r.market.id}>
                    <th scope="row" className="px-3 py-1.5 text-[11px] font-medium text-neutral-800">{r.market.label}</th>
                    <td className="px-3 py-1.5"><RegimeChip regime={r.market.regime} /></td>
                    <td className={`${TD} text-right`}>{none ? "—" : gbpC(r.received)}</td>
                    <td className={`${TD} text-right`}>{none ? "—" : gbpC(r.paid)}</td>
                    <td className={`${TD} text-right font-semibold`}>{none ? "—" : gbpC(r.net, true)}</td>
                    <td className={`${TD} text-right`}>{none ? "—" : gbpC(r.prevNet, true)}</td>
                    <td className={`${TD} text-right`}>{none ? "—" : gbpC(r.net - r.prevNet, true)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-200 bg-neutral-50">
                <th scope="row" className="px-3 py-1.5 text-[11px] font-semibold text-neutral-900">All selected</th>
                <td />
                <td className={`${TD} text-right font-semibold`}>{gbpC(rows.reduce((s, r) => s + r.received, 0))}</td>
                <td className={`${TD} text-right font-semibold`}>{gbpC(rows.reduce((s, r) => s + r.paid, 0))}</td>
                <td className={`${TD} text-right font-semibold`}>{gbpC(net, true)}</td>
                <td className={`${TD} text-right font-semibold`}>{gbpC(prev, true)}</td>
                <td className={`${TD} text-right font-semibold`}>{gbpC(net - prev, true)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {mode === "chart" && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-auto border-t border-neutral-100 px-4 py-2">
          <LegendItem color={STATUS.good}>Received: the counterparty failed to us</LegendItem>
          <LegendItem color={STATUS.bad}>Paid: we failed to the counterparty</LegendItem>
          <LegendItem color={INK}>Net, month to date</LegendItem>
        </div>
      )}
    </section>
  );
}
