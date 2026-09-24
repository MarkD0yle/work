import { useMemo, useState } from "react";
import {
  AS_OF,
  CCC_LIMIT,
  DEALS,
  NEXT_PAYMENT,
  RAIL_VIEWS,
  RATES,
  dealView,
  type CompositionFocus,
  type DealId,
  type RateScenario,
} from "../components/clo-surveillance/model";
import { FOCUS, dateLong, dateMid } from "../components/clo-surveillance/format";
import { ChevronIcon, MicroLabel, Seg } from "../components/clo-surveillance/ui";
import { DealRail } from "../components/clo-surveillance/DealRail";
import { DealHeader } from "../components/clo-surveillance/DealHeader";
import { QualityTable } from "../components/clo-surveillance/QualityTable";
import {
  CccTrendCard,
  CompositionCard,
  CoverageCard,
  EquityHistoryCard,
  WaterfallCard,
} from "../components/clo-surveillance/charts";

export const title = "CLO Deal Monitor";
export const fullWidth = true;

/* CLO Deal Monitor — "Is the deal passing its coverage and collateral-quality
 * tests, and what will the equity receive on the next payment date?"
 *
 * For a CLO portfolio manager and an investor surveillance analyst, off the
 * latest trustee reports (21 Sep 2026) ahead of the 15 Oct 2026 payment date.
 *
 * A deal monitor rather than a grid of cards: a fixed left rail lists six
 * European CLOs and selecting one drives the whole main area. The main area
 * opens with the deal's facts and a proportional SVG capital stack, then the
 * coverage tests as bullet tiles, a dense collateral-quality table whose rows
 * highlight the industry treemap beneath, the CCC-bucket trend, and finally
 * the interest waterfall for the next payment date with a "Class E OC fails"
 * diversion scenario beside the equity's distribution history. Every number
 * comes from one `dealView` slice built from the deal's obligor pool and
 * tranche stack, so the stack, the tests, the treemap and the waterfall
 * always agree. Model and seeded data: components/clo-surveillance/model.ts. */

export default function CloSurveillancePage() {
  const [selected, setSelected] = useState<DealId>("aldgate2");
  const [rate, setRate] = useState<RateScenario>("fixing");
  const [focus, setFocus] = useState<CompositionFocus | null>(null);
  const [industry, setIndustry] = useState<string | null>(null);

  const view = useMemo(() => dealView(selected, rate), [selected, rate]);

  // A new deal starts with a clean canvas: highlights refer to the old pool.
  const selectDeal = (id: DealId) => {
    if (id === selected) return;
    setSelected(id);
    setFocus(null);
    setIndustry(null);
  };

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      {/* pl-36 clears the app's fixed Home pill */}
      <header className="shrink-0 border-b border-neutral-200 bg-white py-4 pr-6 pl-36">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0" style={{ flex: "1 1 320px" }}>
            <MicroLabel>Dashboards · Structured credit · As of {dateLong(AS_OF)} (trustee report)</MicroLabel>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-neutral-950">CLO Deal Monitor</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-neutral-500">
              Is the deal passing its coverage and collateral-quality tests, and what will the equity receive
              on the {dateMid(NEXT_PAYMENT)} payment date? Six European CLOs, € figures.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-end gap-x-4 gap-y-2" role="group" aria-label="Page filters">
            <div className="flex flex-col gap-1">
              <label htmlFor="clo-deal">
                <MicroLabel>Deal</MicroLabel>
              </label>
              <div className="relative">
                <select
                  id="clo-deal"
                  value={selected}
                  onChange={(e) => selectDeal(e.target.value as DealId)}
                  className={`h-[26px] w-56 appearance-none border border-neutral-200 bg-white pr-7 pl-2.5 text-xs font-medium text-neutral-900 hover:border-neutral-400 ${FOCUS}`}
                >
                  {DEALS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <ChevronIcon />
              </div>
            </div>
            <Seg<RateScenario>
              label="3M Euribor for the projection"
              value={rate}
              onChange={setRate}
              options={(Object.keys(RATES) as RateScenario[]).map((k) => ({
                value: k,
                label: RATES[k].label,
                title: RATES[k].note,
              }))}
            />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <DealRail views={RAIL_VIEWS} selected={selected} onSelect={selectDeal} />

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-5 p-4 lg:p-5">
            <DealHeader view={view} />

            <CoverageCard view={view} />

            <section aria-labelledby="clo-cq-heading" className="flex flex-col gap-3">
              <div>
                <h2 id="clo-cq-heading" className="text-sm font-semibold text-neutral-900">
                  Collateral quality and composition
                </h2>
                <p className="mt-0.5 max-w-4xl text-[11px] text-neutral-500">
                  The portfolio-profile tests behind the OC haircuts. Click a test row to light up the obligors it
                  counts in the treemap; click an industry in the treemap to list its obligors.
                </p>
              </div>
              <QualityTable view={view} focus={focus} onFocus={setFocus} />
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <CompositionCard
                  view={view}
                  focus={focus}
                  onClearFocus={() => setFocus(null)}
                  industry={industry}
                  onIndustry={setIndustry}
                />
                <CccTrendCard view={view} />
              </div>
            </section>

            <section aria-labelledby="clo-pd-heading" className="flex flex-col gap-3">
              <div>
                <h2 id="clo-pd-heading" className="text-sm font-semibold text-neutral-900">
                  Next payment date · {dateMid(NEXT_PAYMENT)}
                </h2>
                <p className="mt-0.5 max-w-4xl text-[11px] text-neutral-500">
                  Interest proceeds for the 15 Jul to 15 Oct period run down the priority of payments at{" "}
                  {RATES[rate].label.toLowerCase()} 3M Euribor. Switch to the failing scenario to see the equity
                  lose its residual to a Class A paydown.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                <div className="min-w-0 xl:col-span-3">
                  <WaterfallCard view={view} />
                </div>
                <div className="min-w-0 xl:col-span-2">
                  <EquityHistoryCard view={view} />
                </div>
              </div>
            </section>

            <footer className="border-t border-neutral-200 pt-3 pb-2 text-[11px] leading-relaxed text-neutral-500">
              <p>
                OC ratio = adjusted collateral principal balance ÷ the balance of the tested class and every class
                senior to it. Adjusted par carries CCC assets over the {CCC_LIMIT}% limit at market value (the
                excess is taken from the lowest-priced names), defaulted assets at the lower of market value and
                the Moody&rsquo;s recovery rate, and discount obligations (bought under 80) at purchase price. IC
                ratio = scheduled interest on performing assets ÷ interest and senior fees due at and above the
                class. A coverage test fails when the ratio is under its trigger; interest proceeds are then
                diverted to redeem Class A until it is cured, ahead of junior interest, the subordinated fee and
                the equity. Quality tests report WARF (Moody&rsquo;s idealised factors, performing assets),
                weighted average spread over Euribor on floating assets, weighted average life to maturity,
                Moody&rsquo;s industry diversity score, weighted average recovery rate, and the portfolio-profile
                buckets. Cushions are in basis points of the ratio, or in the test&rsquo;s own units. History
                before the current report is a seeded path anchored on today&rsquo;s pool. Figures are
                illustrative; deals, managers, trustees and obligors are fictional.
              </p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
