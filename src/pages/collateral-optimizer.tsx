import { useMemo, useState } from "react";

export const title = "Collateral Optimisation";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * Treasury / Collateral — Cheapest-to-Deliver Optimiser
 *
 * Margin calls land across CCPs and bilateral CSAs. We hold a finite
 * inventory of eligible collateral, each piece with a haircut and a
 * funding cost (the opportunity cost of pledging it). The job is to
 * meet every call while spending the least funding — posting the
 * cheapest eligible asset first, holding the expensive cash back.
 *
 * Design rule (shared with the workspace):
 *   CALM IS THE DEFAULT. A fully-covered book is neutral grey.
 *   Colour is reserved for calls that cannot be met from eligible
 *   inventory (red) or that breach their cut-off soon (amber).
 * ------------------------------------------------------------------ */

/* ---------- Data model ---------- */

type AssetClass = "cash" | "govvy" | "supra" | "corp" | "equity";

type Asset = {
  id: string;
  name: string;
  cls: AssetClass;
  /** clean market value, base ccy */
  mv: number;
  /** regulatory/CSA haircut as a fraction (0.02 = 2%) */
  haircut: number;
  /** annualised funding/opportunity cost in bp of pledging this asset */
  fundingBp: number;
  /** asset classes a venue must accept for this to be eligible */
};

type Venue = {
  id: string;
  name: string;
  kind: "CCP" | "Bilateral";
  callType: "IM" | "VM";
  /** amount of post-haircut collateral required */
  required: number;
  cutoffLabel: string;
  cutoffMinutes: number;
  /** which asset classes this venue accepts as collateral */
  accepts: AssetClass[];
};

/* ---------- Mock inventory & calls ---------- */

const ASSETS: Asset[] = [
  { id: "a1", name: "USD cash", cls: "cash", mv: 240_000_000, haircut: 0.0, fundingBp: 38 },
  { id: "a2", name: "EUR cash", cls: "cash", mv: 90_000_000, haircut: 0.0, fundingBp: 34 },
  { id: "a3", name: "UST 2Y", cls: "govvy", mv: 320_000_000, haircut: 0.005, fundingBp: 9 },
  { id: "a4", name: "UST 10Y", cls: "govvy", mv: 410_000_000, haircut: 0.02, fundingBp: 12 },
  { id: "a5", name: "Bund 5Y", cls: "govvy", mv: 180_000_000, haircut: 0.01, fundingBp: 7 },
  { id: "a6", name: "UK Gilt 10Y", cls: "govvy", mv: 140_000_000, haircut: 0.025, fundingBp: 14 },
  { id: "a7", name: "EIB 2028", cls: "supra", mv: 95_000_000, haircut: 0.03, fundingBp: 19 },
  { id: "a8", name: "IG corp basket", cls: "corp", mv: 130_000_000, haircut: 0.08, fundingBp: 31 },
  { id: "a9", name: "S&P 500 basket", cls: "equity", mv: 160_000_000, haircut: 0.15, fundingBp: 26 },
  { id: "a10", name: "EuroStoxx basket", cls: "equity", mv: 70_000_000, haircut: 0.18, fundingBp: 24 },
];

const VENUES: Venue[] = [
  {
    id: "lch",
    name: "LCH SwapClear",
    kind: "CCP",
    callType: "IM",
    required: 286_000_000,
    cutoffLabel: "09:00 CET",
    cutoffMinutes: 42,
    accepts: ["cash", "govvy", "supra"],
  },
  {
    id: "cme",
    name: "CME Clearing",
    kind: "CCP",
    callType: "IM",
    required: 198_000_000,
    cutoffLabel: "08:00 CT",
    cutoffMinutes: 96,
    accepts: ["cash", "govvy"],
  },
  {
    id: "eurex",
    name: "Eurex Clearing",
    kind: "CCP",
    callType: "VM",
    required: 142_000_000,
    cutoffLabel: "10:00 CET",
    cutoffMinutes: 210,
    accepts: ["cash", "govvy", "supra", "corp"],
  },
  {
    id: "jpm",
    name: "JP Morgan CSA",
    kind: "Bilateral",
    callType: "IM",
    required: 88_000_000,
    cutoffLabel: "T+1",
    cutoffMinutes: 540,
    accepts: ["cash", "govvy", "supra", "corp", "equity"],
  },
  {
    id: "gs",
    name: "Goldman CSA",
    kind: "Bilateral",
    callType: "VM",
    required: 64_000_000,
    cutoffLabel: "16:00 GMT",
    cutoffMinutes: 320,
    accepts: ["cash", "govvy"],
  },
];

/* ---------- Helpers ---------- */

const CLASS_LABEL: Record<AssetClass, string> = {
  cash: "Cash",
  govvy: "Govt bond",
  supra: "Supra / agency",
  corp: "IG corporate",
  equity: "Equity basket",
};

const CLASS_DOT: Record<AssetClass, string> = {
  cash: "bg-neutral-400",
  govvy: "bg-sky-400",
  supra: "bg-teal-400",
  corp: "bg-violet-400",
  equity: "bg-amber-400",
};

function compact(n: number): string {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}bn`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}m`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}k`;
  return `${sign}$${a.toFixed(0)}`;
}

function fmtMins(m: number): string {
  if (m >= 1440) return `${Math.round(m / 1440)}d`;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

/** post-haircut deliverable value of an asset */
const postHaircut = (a: Asset) => a.mv * (1 - a.haircut);

/* ---------- Optimiser ---------- *
 * Greedy cheapest-to-deliver. Calls are met in cut-off order. For each
 * call we rank eligible, still-available assets by funding cost and
 * draw post-haircut value until the requirement is satisfied. Two
 * strategies are compared: the optimiser, and a naive "cash first"
 * desk that simply burns cash then the nearest bond.
 * ----------------------------------------------------------------- */

type Allocation = {
  venueId: string;
  assetId: string;
  /** market value pledged (pre-haircut) */
  mvUsed: number;
  /** post-haircut value contributed to the call */
  cover: number;
};

type Strategy = "optimised" | "cash-first";

type Plan = {
  allocations: Allocation[];
  /** annualised funding cost of the whole plan, in base ccy */
  fundingCost: number;
  /** venueId -> covered post-haircut value */
  covered: Record<string, number>;
};

function buildPlan(strategy: Strategy): Plan {
  // remaining pre-haircut MV available per asset
  const remaining: Record<string, number> = {};
  for (const a of ASSETS) remaining[a.id] = a.mv;

  const allocations: Allocation[] = [];
  const covered: Record<string, number> = {};
  let fundingCost = 0;

  const callOrder = [...VENUES].sort((a, b) => a.cutoffMinutes - b.cutoffMinutes);

  for (const v of callOrder) {
    let need = v.required;
    covered[v.id] = 0;

    const eligible = ASSETS.filter((a) => v.accepts.includes(a.cls));
    const ranked =
      strategy === "optimised"
        ? // cheapest funding per unit of post-haircut value first
          [...eligible].sort(
            (a, b) =>
              a.fundingBp / (1 - a.haircut) - b.fundingBp / (1 - b.haircut),
          )
        : // naive: cash first, then whatever, ignoring cost efficiency
          [...eligible].sort((a, b) => {
            if (a.cls === "cash" && b.cls !== "cash") return -1;
            if (b.cls === "cash" && a.cls !== "cash") return 1;
            return b.mv - a.mv;
          });

    for (const a of ranked) {
      if (need <= 0.5) break;
      const availCover = remaining[a.id] * (1 - a.haircut);
      if (availCover <= 0) continue;
      const coverTaken = Math.min(availCover, need);
      const mvUsed = coverTaken / (1 - a.haircut);
      remaining[a.id] -= mvUsed;
      need -= coverTaken;
      covered[v.id] += coverTaken;
      fundingCost += (mvUsed * a.fundingBp) / 10_000;
      allocations.push({ venueId: v.id, assetId: a.id, mvUsed, cover: coverTaken });
    }
  }

  return { allocations, fundingCost, covered };
}

/* ---------- Atoms ---------- */

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "ok" | "warning" | "error";
}) {
  const accent = {
    neutral: "border-l-neutral-300",
    ok: "border-l-emerald-500",
    warning: "border-l-amber-500",
    error: "border-l-red-500",
  }[tone];
  const valueColor = {
    neutral: "text-neutral-900",
    ok: "text-emerald-700",
    warning: "text-amber-700",
    error: "text-red-700",
  }[tone];
  return (
    <div className={`rounded-xl border border-l-4 border-neutral-200 bg-white p-4 ${accent}`}>
      <div className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
        {label}
      </div>
      <div className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${valueColor}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-neutral-400">{hint}</div>}
    </div>
  );
}

/* ================================================================== *
 * Page
 * ================================================================== */

export default function CollateralOptimizer() {
  const [strategy, setStrategy] = useState<Strategy>("optimised");
  const [selectedVenue, setSelectedVenue] = useState<string>(VENUES[0].id);

  const optimised = useMemo(() => buildPlan("optimised"), []);
  const cashFirst = useMemo(() => buildPlan("cash-first"), []);
  const plan = strategy === "optimised" ? optimised : cashFirst;

  const totalRequired = VENUES.reduce((s, v) => s + v.required, 0);
  const totalCovered = Object.values(plan.covered).reduce((s, c) => s + c, 0);
  const shortfall = Math.max(0, totalRequired - totalCovered);
  const inventoryDeliverable = ASSETS.reduce((s, a) => s + postHaircut(a), 0);

  const saving = cashFirst.fundingCost - optimised.fundingCost;
  const savingPct = cashFirst.fundingCost
    ? (saving / cashFirst.fundingCost) * 100
    : 0;

  const venue = VENUES.find((v) => v.id === selectedVenue)!;
  const venueAllocs = plan.allocations.filter((a) => a.venueId === venue.id);
  const venueCovered = plan.covered[venue.id] ?? 0;
  const venueShort = Math.max(0, venue.required - venueCovered);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50 text-neutral-900">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-neutral-200 bg-white px-8">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-neutral-900">
            Collateral Optimisation
          </span>
          <span className="text-xs text-neutral-400">
            Treasury · cheapest-to-deliver
          </span>
        </div>

        {/* Strategy toggle */}
        <div className="ml-2 flex items-center gap-1 rounded-lg bg-neutral-100 p-0.5">
          {([
            ["optimised", "Optimised"],
            ["cash-first", "Cash-first"],
          ] as [Strategy, string][]).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setStrategy(k)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                strategy === k
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {shortfall > 0.5 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-200">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {compact(shortfall)} uncovered
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              All calls covered
            </span>
          )}
          <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700">
            Commit allocation
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-8 py-6">
          {/* KPI strip */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Total margin due"
              value={compact(totalRequired)}
              hint={`${VENUES.length} venues · post-haircut required`}
            />
            <Kpi
              label="Eligible inventory"
              value={compact(inventoryDeliverable)}
              hint={`${compact(inventoryDeliverable - totalRequired)} deliverable headroom`}
              tone={inventoryDeliverable >= totalRequired ? "ok" : "error"}
            />
            <Kpi
              label="Funding cost / yr"
              value={compact(plan.fundingCost)}
              hint={
                strategy === "optimised"
                  ? "Optimised — cheapest eligible first"
                  : "Naive — cash burned first"
              }
              tone={strategy === "optimised" ? "ok" : "warning"}
            />
            <Kpi
              label="Optimiser saving"
              value={compact(saving)}
              hint={`${savingPct.toFixed(1)}% vs cash-first · ${compact(optimised.fundingCost)} optimal`}
              tone={saving > 0 ? "ok" : "neutral"}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
            {/* Calls list */}
            <section className="rounded-2xl border border-neutral-200 bg-white">
              <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
                <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                  Margin calls
                </h2>
                <span className="text-[10px] text-neutral-400">by cut-off</span>
              </div>
              <ul>
                {[...VENUES]
                  .sort((a, b) => a.cutoffMinutes - b.cutoffMinutes)
                  .map((v) => {
                    const cov = plan.covered[v.id] ?? 0;
                    const short = Math.max(0, v.required - cov);
                    const pct = Math.min(100, (cov / v.required) * 100);
                    const active = v.id === selectedVenue;
                    const urgent = v.cutoffMinutes <= 60;
                    return (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedVenue(v.id)}
                          className={`w-full border-t border-neutral-100 px-5 py-3 text-left transition first:border-t-0 ${
                            active ? "bg-sky-50/60" : "hover:bg-neutral-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-neutral-800">
                                {v.name}
                              </span>
                              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-neutral-600 uppercase">
                                {v.kind} · {v.callType}
                              </span>
                            </div>
                            <span
                              className={`font-mono text-[10px] tabular-nums ${
                                urgent ? "text-amber-600" : "text-neutral-400"
                              }`}
                            >
                              {fmtMins(v.cutoffMinutes)}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                              <div
                                className={`h-full ${short > 0.5 ? "bg-red-400" : "bg-neutral-400"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] font-semibold tabular-nums text-neutral-700">
                              {compact(v.required)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px]">
                            <span className="text-neutral-400">
                              accepts {v.accepts.map((c) => CLASS_LABEL[c].split(" ")[0]).join(", ")}
                            </span>
                            {short > 0.5 ? (
                              <span className="font-semibold text-red-600">
                                {compact(short)} short
                              </span>
                            ) : (
                              <span className="text-emerald-600">covered</span>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </section>

            {/* Right column */}
            <div className="flex flex-col gap-6">
              {/* Allocation for selected venue */}
              <section className="rounded-2xl border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-900">
                      {venue.name} — allocation
                    </h2>
                    <p className="text-[11px] text-neutral-400">
                      {venue.callType} · requires {compact(venue.required)} post-haircut · cut-off {venue.cutoffLabel}
                    </p>
                  </div>
                  {venueShort > 0.5 ? (
                    <span className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-200">
                      {compact(venueShort)} unmet
                    </span>
                  ) : (
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      Fully met
                    </span>
                  )}
                </div>

                {/* Coverage waterfall */}
                <div className="px-5 pt-4">
                  <div className="flex h-7 w-full overflow-hidden rounded-md bg-neutral-100 ring-1 ring-neutral-200 ring-inset">
                    {venueAllocs.map((al) => {
                      const a = ASSETS.find((x) => x.id === al.assetId)!;
                      const w = (al.cover / venue.required) * 100;
                      return (
                        <div
                          key={al.assetId}
                          className={`flex items-center justify-center ${CLASS_DOT[a.cls]} border-r border-white/60`}
                          style={{ width: `${w}%` }}
                          title={`${a.name}: ${compact(al.cover)}`}
                        >
                          {w > 9 && (
                            <span className="px-1 font-mono text-[9px] font-semibold text-neutral-900/80">
                              {a.name}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {venueShort > 0.5 && (
                      <div
                        className="flex items-center justify-center bg-red-100"
                        style={{ width: `${(venueShort / venue.required) * 100}%` }}
                      >
                        <span className="px-1 font-mono text-[9px] font-semibold text-red-700">
                          gap
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Line items */}
                <div className="px-5 py-4">
                  <div className="grid grid-cols-[1fr_90px_70px_90px_90px] gap-2 px-1 pb-2 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                    <span>Asset pledged</span>
                    <span className="text-right">MV used</span>
                    <span className="text-right">Haircut</span>
                    <span className="text-right">Cover</span>
                    <span className="text-right">Funding/yr</span>
                  </div>
                  <ul className="flex flex-col gap-1">
                    {venueAllocs.length === 0 && (
                      <li className="px-1 py-6 text-center text-xs text-neutral-400">
                        No eligible collateral allocated.
                      </li>
                    )}
                    {venueAllocs.map((al) => {
                      const a = ASSETS.find((x) => x.id === al.assetId)!;
                      return (
                        <li
                          key={al.assetId}
                          className="grid grid-cols-[1fr_90px_70px_90px_90px] items-center gap-2 rounded-lg border border-neutral-100 px-2 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${CLASS_DOT[a.cls]}`} />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-neutral-800">
                                {a.name}
                              </div>
                              <div className="text-[10px] text-neutral-400">
                                {CLASS_LABEL[a.cls]} · {a.fundingBp}bp
                              </div>
                            </div>
                          </div>
                          <span className="text-right font-mono text-xs tabular-nums text-neutral-700">
                            {compact(al.mvUsed)}
                          </span>
                          <span className="text-right font-mono text-xs tabular-nums text-neutral-500">
                            {(a.haircut * 100).toFixed(1)}%
                          </span>
                          <span className="text-right font-mono text-xs font-semibold tabular-nums text-neutral-900">
                            {compact(al.cover)}
                          </span>
                          <span className="text-right font-mono text-xs tabular-nums text-neutral-600">
                            {compact((al.mvUsed * a.fundingBp) / 10_000)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>

              {/* Inventory utilisation */}
              <section className="rounded-2xl border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
                  <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                    Inventory utilisation
                  </h2>
                  <span className="text-[10px] text-neutral-400">
                    pledged vs free · whole book under {strategy}
                  </span>
                </div>
                <div className="px-5 py-4">
                  <ul className="flex flex-col gap-2.5">
                    {ASSETS.map((a) => {
                      const used = plan.allocations
                        .filter((x) => x.assetId === a.id)
                        .reduce((s, x) => s + x.mvUsed, 0);
                      const pct = (used / a.mv) * 100;
                      return (
                        <li key={a.id} className="flex items-center gap-3">
                          <div className="flex w-44 shrink-0 items-center gap-2">
                            <span className={`h-2 w-2 rounded-sm ${CLASS_DOT[a.cls]}`} />
                            <span className="truncate text-xs font-medium text-neutral-700">
                              {a.name}
                            </span>
                          </div>
                          <div className="relative h-4 flex-1 overflow-hidden rounded-md bg-neutral-100">
                            <div
                              className="absolute inset-y-0 left-0 bg-neutral-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-28 text-right font-mono text-[11px] tabular-nums text-neutral-500">
                            {compact(used)} / {compact(a.mv)}
                          </span>
                          <span className="w-12 text-right font-mono text-[11px] font-semibold tabular-nums text-neutral-700">
                            {pct.toFixed(0)}%
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
