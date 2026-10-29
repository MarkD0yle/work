import { useMemo, useState } from "react";
import {
  AS_OF,
  DESKS,
  SCALE_975,
  SCOPE_LABEL,
  SERIES,
  buildView,
  exceptionLog,
  tailP,
  type Basis,
  type Cause,
  type Confidence,
  type DeskId,
  type Scope,
  type ScopeView,
  type WindowLen,
} from "../components/var-backtesting/model";
import { FOCUS, dateLong, dateMid, gbpM } from "../components/var-backtesting/format";
import { MicroLabel, Seg } from "../components/var-backtesting/ui";
import { TrafficLight } from "../components/var-backtesting/TrafficLight";
import {
  DeskMultiples,
  DistributionCard,
  ExceptionCalendar,
  PnlTimelineCard,
} from "../components/var-backtesting/charts";
import { ExceptionLog } from "../components/var-backtesting/ExceptionLog";

export const title = "VaR Backtesting";
export const fullWidth = true;

/* VaR Backtesting — "Is our VaR model accurate, and are we still in the
 * regulatory green zone?"
 *
 * Timeline-centric: a Highcharts Stock P&L-vs-VaR timeline takes ~70% of the
 * top band, with the Basel traffic light as a side instrument panel. Below
 * sit six desk small multiples (clickable: they set the desk filter), the
 * P&L ÷ VaR distribution beside an exception calendar, and the exception
 * log. Every number comes from one `buildView` slice, so the lamp, the
 * flags, the calendar, the histogram tail and the log always agree.
 *
 * Data and statistics live in components/var-backtesting/model.ts. */

export default function VarBacktestingPage() {
  const [scope, setScope] = useState<Scope>("firm");
  const [basis, setBasis] = useState<Basis>("hypo");
  const [conf, setConf] = useState<Confidence>("99");
  const [win, setWin] = useState<WindowLen>("250");
  const [cause, setCause] = useState<Cause | "all">("all");

  const view = useMemo(() => buildView(scope, basis, conf, win), [scope, basis, conf, win]);
  const deskViews = useMemo(
    () =>
      Object.fromEntries(DESKS.map((d) => [d.id, buildView(d.id, basis, conf, win)])) as Record<
        DeskId,
        ScopeView
      >,
    [basis, conf, win],
  );
  const rows = useMemo(() => exceptionLog(view, basis, conf), [view, basis, conf]);

  const firstDay = view.days[0].t;
  const lastIdx = SERIES.firm.length - 1;
  const deskSum = DESKS.reduce((s, d) => s + deskViews[d.id].days[deskViews[d.id].days.length - 1].var, 0);
  const firmVar = SERIES.firm[lastIdx].var99 * (conf === "99" ? 1 : SCALE_975);

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      {/* pl-36 clears the app's fixed Home pill */}
      <header className="shrink-0 border-b border-neutral-200 bg-white py-4 pr-6 pl-36">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0" style={{ flex: "1 1 320px" }}>
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              Market risk · Model validation · As of {dateLong(AS_OF)} close
            </div>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-neutral-950">VaR Backtesting</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-neutral-500">
              Is the VaR model accurate, and are we still in the regulatory green zone? Daily P&amp;L
              against prior-day 1-day VaR, {dateMid(firstDay)} to {dateMid(AS_OF)}.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-end gap-x-4 gap-y-2" role="group" aria-label="Page filters">
            <div className="flex flex-col gap-1">
              <label htmlFor="vb-desk">
                <MicroLabel>Desk</MicroLabel>
              </label>
              <div className="relative">
                <select
                  id="vb-desk"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as Scope)}
                  className={`h-[26px] w-36 appearance-none border border-neutral-200 bg-white pr-7 pl-2.5 text-xs font-medium text-neutral-900 hover:border-neutral-400 ${FOCUS}`}
                >
                  {(["firm", ...DESKS.map((d) => d.id)] as Scope[]).map((s) => (
                    <option key={s} value={s}>
                      {SCOPE_LABEL[s]}
                    </option>
                  ))}
                </select>
                <svg
                  aria-hidden
                  viewBox="0 0 10 10"
                  className="pointer-events-none absolute top-1/2 right-2 h-2.5 w-2.5 -translate-y-1/2 text-neutral-500"
                >
                  <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
            </div>
            <Seg<Basis>
              label="P&L basis"
              value={basis}
              onChange={setBasis}
              options={[
                { value: "hypo", label: "Hypothetical" },
                { value: "actual", label: "Actual" },
              ]}
            />
            <Seg<Confidence>
              label="Confidence"
              value={conf}
              onChange={setConf}
              options={[
                { value: "99", label: "99%" },
                { value: "97.5", label: "97.5%" },
              ]}
            />
            <Seg<WindowLen>
              label="Window"
              value={win}
              onChange={setWin}
              options={[
                { value: "250", label: "250d" },
                { value: "500", label: "500d" },
              ]}
            />
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-5 p-4 lg:p-5">
          {/* top band: timeline (70%) + traffic-light instrument panel (30%) */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-10">
            <div className="min-w-0 xl:col-span-7">
              <PnlTimelineCard view={view} basis={basis} conf={conf} scopeLabel={SCOPE_LABEL[scope]} />
            </div>
            <div className="min-w-0 xl:col-span-3">
              <TrafficLight view={view} basis={basis} conf={conf} win={win} />
            </div>
          </div>

          {/* desk small multiples: also the desk filter */}
          <section aria-labelledby="vb-desks-title">
            <div className="mb-2.5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div>
                <h2 id="vb-desks-title" className="text-sm font-semibold text-neutral-900">
                  Desk backtests
                </h2>
                <p className="mt-0.5 max-w-4xl text-[11px] text-neutral-500">
                  Click a desk to focus the page on it. Each panel is scaled to its own VaR (−1.75× to
                  +1.25× the desk&rsquo;s peak VaR), so shapes compare across desks but bar heights in £ do
                  not. Sum of desk VaR {gbpM(deskSum)}; firm-wide {gbpM(firmVar)} after diversification.
                </p>
              </div>
              {scope !== "firm" && (
                <button
                  type="button"
                  onClick={() => setScope("firm")}
                  className={`border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-800 hover:border-neutral-900 ${FOCUS}`}
                >
                  ← Back to firm-wide
                </button>
              )}
            </div>
            <DeskMultiples
              views={deskViews}
              selected={scope === "firm" ? null : scope}
              onSelect={(d) => setScope((s) => (s === d ? "firm" : d))}
            />
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <DistributionCard view={view} basis={basis} conf={conf} tailP={tailP(conf)} />
            <ExceptionCalendar view={view} conf={conf} />
          </div>

          <ExceptionLog
            rows={rows}
            scope={scope}
            basis={basis}
            conf={conf}
            win={win}
            cause={cause}
            onCause={setCause}
          />

          <footer className="border-t border-neutral-200 pt-3 pb-2 text-[11px] leading-relaxed text-neutral-500">
            <p>
              An exception is a day whose loss exceeds the prior day&rsquo;s 1-day VaR. Hypothetical P&amp;L
              revalues the prior close positions; actual P&amp;L adds intraday trading, fees and reserves.
              97.5% VaR is scaled from 99% by z(0.975)/z(0.99) ≈ 0.84. Zones use the Basel cumulative-binomial
              cut-offs (green below 95%, red from 99.99%) for the chosen confidence and window, which gives
              0–4 / 5–9 / 10+ at 99% over 250 days. The capital multiplier always uses the 99%, 250-day
              count. Kupiec POF and Christoffersen independence are likelihood-ratio tests against χ²(1) at
              5%. Figures are illustrative; desks and data are fictional.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
