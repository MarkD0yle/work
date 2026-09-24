import { useMemo, useState } from "react";
import {
  BASES,
  FAN,
  LATEST_MONTH,
  MONTHS,
  POLICY_MIN_BP,
  REPORT_MONTHS,
  SCHEME,
  buildView,
  monthIndex,
  type Basis,
  type MonthKey,
  type StressMode,
} from "../components/pension-funding/model";
import { bpSigned, dateMid, monthYear, num } from "../components/pension-funding/format";
import { GhostButton, MicroLabel, SectionHeading, Seg, SelectField } from "../components/pension-funding/ui";
import { FundingPosition } from "../components/pension-funding/FundingPosition";
import { AllocationCard, CashflowCard, HedgeCard, JourneyPlanCard } from "../components/pension-funding/charts";
import { StressPanel } from "../components/pension-funding/StressPanel";
import { ActionsRegister, CovenantRegister } from "../components/pension-funding/CovenantActions";

export const title = "Pension Scheme Funding";
export const fullWidth = true;

/* Pension Scheme Funding — "How well funded is the scheme, are we on the
 * journey plan, and can the hedge withstand a gilt shock?"
 *
 * For the trustee board and the scheme actuary of the fictional Northbridge
 * Group Pension Scheme, a UK defined-benefit scheme run with an LDI hedge.
 *
 * Laid out as a trustee report rather than a tile grid: the content sits
 * in a centred 1400px column with generous vertical rhythm and five
 * numbered sections, each a few large cards. 01 is the stat band and the
 * journey bar; 02 the hero chart of funding level against the journey
 * plan with a projection fan; 03 the hedge gauges and the collateral
 * stress table; 04 allocation and the liability cash-flow profile; 05 the
 * covenant register and the trustee actions. The header's basis Seg and
 * reporting-month select scope every number, and selecting a stress row
 * in 03 shows the post-shock position in 01. Data and every derived
 * statistic live in components/pension-funding/model.ts. */

export default function PensionFundingPage() {
  const [basis, setBasis] = useState<Basis>("tp");
  const [month, setMonth] = useState<MonthKey>(LATEST_MONTH);
  const [stressMode, setStressMode] = useState<StressMode>("instant");
  const [shockBp, setShockBp] = useState<number | null>(null);

  const view = useMemo(() => buildView(basis, month, stressMode), [basis, month, stressMode]);
  const shock = shockBp === null ? null : (view.stress.rows.find((r) => r.bp === shockBp) ?? null);
  const asOf = view.month.t;

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      {/* pl-36 clears the app's fixed Home pill */}
      <header className="shrink-0 border-b border-neutral-200 bg-white py-4 pr-6 pl-36">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0" style={{ flex: "1 1 320px" }}>
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              Dashboards · Pensions · As of {dateMid(asOf)} (month-end)
            </div>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-neutral-950">Pension Scheme Funding</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-neutral-500">
              How well funded is the scheme, are we on the journey plan, and can the hedge withstand a gilt shock?{" "}
              {SCHEME.name}, monthly to {monthYear(asOf)}, £.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-end gap-x-4 gap-y-2" role="group" aria-label="Page filters">
            <Seg<Basis>
              label="Liability basis"
              value={basis}
              onChange={setBasis}
              options={BASES.map((b) => ({ value: b.id, label: b.label, title: `Discounted at ${b.discount}` }))}
            />
            <SelectField<MonthKey>
              id="pf-month"
              label="Reporting month"
              value={month}
              onChange={setMonth}
              options={[...REPORT_MONTHS].reverse().map((k) => ({ value: k, label: dateMid(MONTHS[monthIndex(k)].t) }))}
            />
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10 px-5 pt-8 pb-6 lg:px-8">
          {/* report title block */}
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
            <div>
              <MicroLabel>Trustee funding report</MicroLabel>
              <h2 className="mt-1 text-[26px] leading-tight font-semibold tracking-tight text-neutral-950">
                {SCHEME.name}
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Position at {dateMid(asOf)} on the {view.basis.label.toLowerCase()} basis, compared with {dateMid(view.prior.t)}.
                Sponsor: {SCHEME.sponsor}.
              </p>
            </div>
            <dl className="flex items-end gap-6 text-right">
              <div>
                <dt className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Liabilities</dt>
                <dd className="text-xs font-medium text-neutral-800">
                  {view.basis.short} = {num(view.basis.scale * 100, 0)}% of TP
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Prepared for</dt>
                <dd className="text-xs font-medium text-neutral-800">Trustee board · Scheme actuary</dd>
              </div>
            </dl>
          </div>

          {/* 01 ------------------------------------------------------------ */}
          <section aria-labelledby="pf-s1" className="flex flex-col gap-5">
            <SectionHeading
              n="01"
              id="pf-s1"
              title="Funding position"
              lead={`Assets, liabilities and the funding level on the ${view.basis.label.toLowerCase()} basis, with the change since the prior quarter-end, and where the scheme sits on its journey from 2020 to buyout.`}
            />
            <FundingPosition view={view} shock={shock} onClearShock={() => setShockBp(null)} />
          </section>

          {/* 02 ------------------------------------------------------------ */}
          <section aria-labelledby="pf-s2" className="flex flex-col gap-5">
            <SectionHeading
              n="02"
              id="pf-s2"
              title="Journey plan"
              lead="The monthly funding level against the trustees' target path, with the gilt crisis, the 2024 deficit contribution and the 2025 buy-in marked, and a projection fan to the buyout target date."
            />
            <JourneyPlanCard view={view} />
          </section>

          {/* 03 ------------------------------------------------------------ */}
          <section aria-labelledby="pf-s3" className="flex flex-col gap-5">
            <SectionHeading
              n="03"
              id="pf-s3"
              title="Hedging"
              lead={`Interest-rate and inflation hedge ratios against the ${view.hedge.band.lo}–${view.hedge.band.hi}% target band, and whether the collateral waterfall can meet the call from a rise in gilt yields.`}
              right={
                <>
                  {shock && <GhostButton onClick={() => setShockBp(null)}>Clear {bpSigned(shock.bp)} scenario</GhostButton>}
                  <Seg<StressMode>
                    label="Stress horizon"
                    value={stressMode}
                    onChange={setStressMode}
                    options={[
                      { value: "instant", label: "Instant" },
                      { value: "days5", label: "Over 5 days" },
                    ]}
                  />
                </>
              }
            />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
              <div className="min-w-0 xl:col-span-4">
                <HedgeCard view={view} />
              </div>
              <div className="min-w-0 xl:col-span-8">
                <StressPanel view={view} selected={shockBp} onSelect={setShockBp} />
              </div>
            </div>
          </section>

          {/* 04 ------------------------------------------------------------ */}
          <section aria-labelledby="pf-s4" className="flex flex-col gap-5">
            <SectionHeading
              n="04"
              id="pf-s4"
              title="Assets and cash flows"
              lead="Where the investable assets sit against the strategic allocation and its tolerance ranges, and how the projected benefit payments run off against the cash flows the CDI portfolio delivers."
            />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <AllocationCard view={view} />
              <CashflowCard />
            </div>
          </section>

          {/* 05 ------------------------------------------------------------ */}
          <section aria-labelledby="pf-s5" className="flex flex-col gap-5">
            <SectionHeading
              n="05"
              id="pf-s5"
              title="Covenant and actions"
              lead="The sponsor's ability to support the scheme, the schedule of contributions, and what the trustees have committed to do next."
            />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
              <div className="min-w-0 xl:col-span-5">
                <CovenantRegister asOf={asOf} />
              </div>
              <div className="min-w-0 xl:col-span-7">
                <ActionsRegister asOf={asOf} />
              </div>
            </div>
          </section>

          <footer className="border-t border-neutral-200 pt-3 pb-2 text-[11px] leading-relaxed text-neutral-500">
            <p>
              <span className="font-semibold text-neutral-700">Bases.</span> Technical provisions discount at gilts + 0.5%; low dependency
              (108% of TP) at gilts + 0.25% with a cash-flow-matched portfolio; buyout (118% of TP) approximates insurer pricing. The buy-in
              policy is valued at the insured liabilities on each basis, so it is worth more on stronger bases.{" "}
              <span className="font-semibold text-neutral-700">Hedge ratios</span> are the PV01 of the LDI gilts, repo and swaps over the PV01
              of the liabilities on the selected basis; the 85–95% target band is set on TP, so the same hedge reads lower on the longer,
              larger bases. <span className="font-semibold text-neutral-700">Collateral waterfall.</span> A rise in yields of n bp calls
              PV01 × n × (1 − 0.00045 n) from the LDI pool; instant calls are met from cash then gilts, and eligible investment-grade credit
              (after a 15% haircut) joins over five days. Resilience is the rise that exhausts the waterfall; policy requires at least{" "}
              {POLICY_MIN_BP}bp instantly. <span className="font-semibold text-neutral-700">Projection fan.</span> A lognormal walk on the funding
              level with {num(FAN.mu * 100, 1)}% a year expected outperformance of assets over liabilities and {num(FAN.sigma * 100, 1)}% volatility;
              the 25th–75th and 5th–95th bands and the probabilities of reaching the targets follow from it. Prior quarter is the month-end
              three months before the reporting month. Figures are illustrative; the scheme, sponsor, people and data are fictional.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
