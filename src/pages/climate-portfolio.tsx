import { useMemo, useState } from "react";
import {
  BENCHMARKS,
  PORTFOLIOS,
  computeSlice,
  type AssetClassFilter,
  type BenchmarkId,
  type PortfolioId,
  type Scope,
} from "../components/climate-portfolio/model";
import { SCOPE_LABEL, money, nf, verdictFor } from "../components/climate-portfolio/format";
import { FilterGroup, MicroLabel, Segmented, SelectField } from "../components/climate-portfolio/ui";
import { Scorecards } from "../components/climate-portfolio/Scorecards";
import { ContributionCard, PathwayCard, TreemapCard } from "../components/climate-portfolio/Charts";
import { EngagementTable } from "../components/climate-portfolio/EngagementTable";

export const title = "Climate & Transition";
export const fullWidth = true;

/* Climate & Transition — a stewardship team's net-zero scorecard.
 *
 * The question: is the portfolio on a credible net-zero path, and which
 * holdings are holding it back? The layout answers it top-down: four
 * instruments (temperature, intensity, target coverage, absolute emissions),
 * the pathway against the NZAM-style 2030 target, where the emissions sit and
 * why the portfolio beats or trails its benchmark, then the named issuers and
 * what stewardship is doing about each.
 *
 * All four filters live in the one bar under the header and recompute every
 * number from the same slice (see components/climate-portfolio/model.ts).
 * The engagement-status chips on the table are a table view filter only. */

const ASSET_OPTIONS: { value: AssetClassFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "equity", label: "Listed equity" },
  { value: "bond", label: "Corporate bonds" },
];
const AC_NOUN: Record<Exclude<AssetClassFilter, "all">, string> = {
  equity: "listed equity",
  bond: "corporate bonds",
};

export default function ClimatePortfolioPage() {
  const [portfolio, setPortfolio] = useState<PortfolioId>("gef");
  const [benchmark, setBenchmark] = useState<BenchmarkId>("acwi");
  const [scope, setScope] = useState<Scope>("s12");
  const [assetClass, setAssetClass] = useState<AssetClassFilter>("all");

  const slice = useMemo(
    () => computeSlice({ portfolio, benchmark, scope, assetClass }),
    [portfolio, benchmark, scope, assetClass],
  );

  const fund = PORTFOLIOS.find((p) => p.id === portfolio)!;
  const scopeLabel = SCOPE_LABEL[scope];
  const isDefault =
    portfolio === "gef" && benchmark === "acwi" && scope === "s12" && assetClass === "all";

  // Switching fund snaps the benchmark to that fund's policy benchmark; the
  // user can still override it afterwards.
  function pickPortfolio(p: PortfolioId) {
    setPortfolio(p);
    setBenchmark(PORTFOLIOS.find((f) => f.id === p)!.policyBenchmark);
  }
  function reset() {
    setPortfolio("gef");
    setBenchmark("acwi");
    setScope("s12");
    setAssetClass("all");
  }

  const pw = slice.pathway;
  const proj2030 = slice.empty ? 0 : pw.projection[pw.projection.length - 1][1];
  const verdict = verdictFor(proj2030, pw.targetAt2030);

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      {/* pl-36 clears the app's fixed Home pill. */}
      <header className="flex-none border-b border-neutral-200 bg-white py-4 pr-6 pl-36">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              Dashboards · Stewardship &amp; sustainability reporting
            </div>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-neutral-950">
              Climate &amp; Transition
            </h1>
            <p className="mt-0.5 max-w-xl text-xs text-neutral-500">
              Is the portfolio on a credible net-zero path, and which holdings are holding it back?
              TCFD / ISSB S2 metrics against the 2030 interim target (−50% intensity vs 2019).
            </p>
          </div>

          <div className="flex shrink-0 items-stretch gap-3">
            <dl className="hidden flex-col justify-center gap-0.5 text-right text-[11px] text-neutral-500 lg:flex">
              <div>
                <dt className="inline">Data as of </dt>
                <dd className="inline font-medium text-neutral-800">30 Jun 2026</dd>
              </div>
              <div>
                <dt className="inline">Reporting year </dt>
                <dd className="inline font-medium text-neutral-800">2026</dd>
                <span aria-hidden> · </span>
                <dt className="inline">Baseline </dt>
                <dd className="inline font-medium text-neutral-800">2019</dd>
              </div>
              {!slice.empty && (
                <div>
                  <dt className="sr-only">In scope</dt>
                  <dd className="inline">
                    <span className="font-medium text-neutral-800">{money(slice.aum)}</span> ·{" "}
                    <span className="font-medium text-neutral-800">{slice.holdings.length}</span> issuers in scope
                  </dd>
                </div>
              )}
            </dl>
            {!slice.empty && (
              <div
                className="flex items-center gap-3 border border-neutral-200 bg-white px-3 py-2"
                aria-label={`2030 interim target: ${verdict.label}`}
              >
                <VerdictIcon verdict={verdict.key} color={verdict.color} />
                <div>
                  <MicroLabel className="text-neutral-400">2030 interim target</MicroLabel>
                  <div className="text-sm leading-tight font-semibold text-neutral-900">{verdict.label}</div>
                  <div className="text-[11px] text-neutral-500">
                    Projected <span className="font-mono text-neutral-800 tabular-nums">{nf(proj2030, 0)}</span> vs
                    target <span className="font-mono text-neutral-800 tabular-nums">{nf(pw.targetAt2030, 0)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* One filter bar scopes everything below it. */}
      <div
        className="flex flex-none flex-wrap items-end gap-x-6 gap-y-2 border-b border-neutral-200 bg-white px-6 pt-2.5 pb-3"
        role="region"
        aria-label="Filters"
      >
        <SelectField<PortfolioId>
          id="cp-portfolio"
          label="Portfolio"
          value={portfolio}
          onChange={pickPortfolio}
          width={196}
          options={PORTFOLIOS.map((p) => ({ value: p.id, label: p.label }))}
        />
        <SelectField<BenchmarkId>
          id="cp-benchmark"
          label="Benchmark"
          value={benchmark}
          onChange={setBenchmark}
          width={262}
          options={BENCHMARKS.map((b) => ({
            value: b.id,
            label: b.id === fund.policyBenchmark ? `${b.label} (policy)` : b.label,
          }))}
        />
        <FilterGroup label="Scope">
          <Segmented<Scope>
            label="Emissions scope"
            value={scope}
            onChange={setScope}
            options={[
              { value: "s12", label: "Scope 1+2" },
              { value: "s123", label: "Scope 1+2+3" },
            ]}
          />
        </FilterGroup>
        <FilterGroup label="Asset class">
          <Segmented<AssetClassFilter>
            label="Asset class"
            value={assetClass}
            onChange={setAssetClass}
            options={ASSET_OPTIONS}
          />
        </FilterGroup>
        <div className="ml-auto flex items-end self-stretch">
          <button
            type="button"
            onClick={reset}
            disabled={isDefault}
            className="h-8 border border-neutral-200 px-2.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:outline-none disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Reset
          </button>
        </div>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {slice.empty ? (
          <div className="p-6">
            <div className="flex flex-col items-center border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
              <div className="flex h-10 w-10 items-center justify-center border border-neutral-200 text-neutral-400">
                <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden>
                  <rect x="2.5" y="2.5" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M5 8h6" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </div>
              <h2 className="mt-3 text-sm font-semibold text-neutral-900">
                No {assetClass !== "all" ? AC_NOUN[assetClass] : "holdings"} in {fund.label}
              </h2>
              <p className="mt-1 max-w-md text-xs text-neutral-500">
                {fund.label} holds{" "}
                {fund.assetClasses.map((a) => AC_NOUN[a]).join(" and ")} only, so there is nothing to
                measure for this asset class. Every metric on the page reads from this slice.
              </p>
              <button
                type="button"
                onClick={() => setAssetClass("all")}
                className="mt-4 h-8 bg-lime-800 px-3 text-xs font-medium text-white transition hover:bg-lime-900 focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Show all asset classes
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-6">
            <Scorecards slice={slice} scopeLabel={scopeLabel} />
            <PathwayCard slice={slice} scopeLabel={scopeLabel} />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              <TreemapCard
                slice={slice}
                scopeLabel={scopeLabel}
                filterKey={`${portfolio}-${scope}-${assetClass}`}
                className="xl:col-span-7"
              />
              <ContributionCard slice={slice} scopeLabel={scopeLabel} className="xl:col-span-5" />
            </div>
            <EngagementTable holdings={slice.holdings} scopeLabel={scopeLabel} portfolioLabel={fund.label} />
          </div>
        )}

        <footer className="border-t border-neutral-200 bg-white px-6 py-4 text-[11px] leading-relaxed text-neutral-500">
          <p>
            <b className="font-semibold text-neutral-700">Method.</b> Financed emissions follow PCAF Part A
            for listed equity and corporate bonds: attribution factor = holding value ÷ EVIC. WACI = Σ
            weight × emissions ÷ revenue (tCO₂e / $m). Implied temperature rise is the weight-averaged
            issuer temperature score; issuers without targets carry a default near 3.2°C. The pathway
            indexes the carbon footprint (tCO₂e per £m invested) so fund growth doesn&rsquo;t flatter it;
            the target path is −50% by 2030 and net zero by 2050. Sector attribution splits the WACI gap
            into allocation and selection effects.
          </p>
          <p className="mt-1.5">
            Issuers, funds and engagement records are fictional and generated from a seeded PRNG; index
            names are used for realism only.
          </p>
        </footer>
      </main>
    </div>
  );
}

function VerdictIcon({ verdict, color }: { verdict: "on" | "risk" | "off"; color: string }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center text-white"
      style={{ background: color }}
      aria-hidden
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4">
        {verdict === "on" ? (
          <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2" />
        ) : verdict === "risk" ? (
          <path d="M8 3v6m0 2.5v2" fill="none" stroke="currentColor" strokeWidth="2" />
        ) : (
          <path d="M4 4l8 8m0-8-8 8" fill="none" stroke="currentColor" strokeWidth="2" />
        )}
      </svg>
    </span>
  );
}
