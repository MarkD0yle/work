import { useState } from "react";

export const title = "RFQ Inbox";
export const section = "global-markets";

/* Global Markets lifecycle · Stage 1 — Sales & Origination.
 *
 * Design: a two-pane trading-sales inbox. Left, the queue of incoming
 * requests-for-quote ranked by time-to-expiry; right, a quote composer for
 * the selected enquiry with client context and pricing presets. */

type Tier = "Platinum" | "Gold" | "Standard";
type Direction = "Buy" | "Sell" | "Two-way";

type Rfq = {
  id: string;
  client: string;
  tier: Tier;
  product: string;
  direction: Direction;
  size: string;
  expiresIn: string; // countdown label
  urgency: "hot" | "warm" | "cool";
  hitRate: number; // % of past quotes this client dealt on
  lastTraded: string;
  salesNote: string;
};

const RFQS: Rfq[] = [
  {
    id: "RFQ-88412",
    client: "Meridian Capital",
    tier: "Platinum",
    product: "EUR 10Y IRS · payer",
    direction: "Buy",
    size: "€250M",
    expiresIn: "0:42",
    urgency: "hot",
    hitRate: 64,
    lastTraded: "2 days ago",
    salesNote: "Hedging a bond mandate win — expects tight. Cover was BNP last time.",
  },
  {
    id: "RFQ-88409",
    client: "Halcyon Asset Mgmt",
    tier: "Gold",
    product: "US CDX IG 5Y",
    direction: "Sell",
    size: "$75M",
    expiresIn: "2:15",
    urgency: "warm",
    hitRate: 41,
    lastTraded: "Yesterday",
    salesNote: "Unwinding protection after earnings run. Price to win — axe matches.",
  },
  {
    id: "RFQ-88405",
    client: "Northgate Pension",
    tier: "Platinum",
    product: "GBP 30Y inflation swap",
    direction: "Buy",
    size: "£120M",
    expiresIn: "4:50",
    urgency: "warm",
    hitRate: 58,
    lastTraded: "1 week ago",
    salesNote: "LDI rebalance tranche 3 of 5. Relationship trade — hold spread.",
  },
  {
    id: "RFQ-88398",
    client: "Vela Quant Fund",
    tier: "Standard",
    product: "TOPIX TRS 6M",
    direction: "Two-way",
    size: "¥9.5B",
    expiresIn: "8:03",
    urgency: "cool",
    hitRate: 22,
    lastTraded: "3 weeks ago",
    salesNote: "Likely shopping five dealers. Quote wide unless balance sheet is free.",
  },
  {
    id: "RFQ-88391",
    client: "Arcus Insurance",
    tier: "Gold",
    product: "USD 5Y5Y swaption straddle",
    direction: "Buy",
    size: "$50M vega",
    expiresIn: "11:27",
    urgency: "cool",
    hitRate: 47,
    lastTraded: "4 days ago",
    salesNote: "Annual convexity hedge. Structuring has the strike grid ready.",
  },
];

const TIER_STYLE: Record<Tier, string> = {
  Platinum: "bg-violet-100 text-violet-800",
  Gold: "bg-amber-100 text-amber-800",
  Standard: "bg-neutral-200 text-neutral-600",
};

const URGENCY_BAR: Record<Rfq["urgency"], string> = {
  hot: "bg-rose-500",
  warm: "bg-amber-400",
  cool: "bg-sky-400",
};

const SPREAD_PRESETS = [
  { label: "Win it", bps: "+1.25", note: "Inside cover, sub-mid margin" },
  { label: "House", bps: "+2.00", note: "Standard tier pricing" },
  { label: "Wide", bps: "+3.50", note: "Balance-sheet heavy / low intent" },
] as const;

export default function GmRfqInbox() {
  const [selectedId, setSelectedId] = useState(RFQS[0].id);
  const [preset, setPreset] = useState<(typeof SPREAD_PRESETS)[number]["label"]>("House");
  const rfq = RFQS.find((r) => r.id === selectedId) ?? RFQS[0];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
          Global markets · Lifecycle 01 — Sales &amp; origination
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">RFQ Inbox</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Incoming requests-for-quote ranked by time left on the clock. Pick one to
          price it with full client context alongside.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Queue */}
        <div className="lg:col-span-2">
          <div className="border border-neutral-200 bg-white">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Live enquiries
              </span>
              <span className="bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                {RFQS.length}
              </span>
            </div>
            <ul>
              {RFQS.map((r) => {
                const active = r.id === selectedId;
                return (
                  <li key={r.id} className="border-b border-neutral-100 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={`flex w-full items-stretch gap-3 px-0 text-left transition ${
                        active ? "bg-blue-50" : "hover:bg-neutral-50"
                      }`}
                    >
                      <span className={`w-1 shrink-0 ${URGENCY_BAR[r.urgency]}`} aria-hidden />
                      <span className="flex-1 py-3 pr-4">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold text-neutral-900">
                            {r.client}
                          </span>
                          <span
                            className={`font-mono text-xs font-semibold ${
                              r.urgency === "hot" ? "text-rose-600" : "text-neutral-500"
                            }`}
                          >
                            {r.expiresIn}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-neutral-500">
                          {r.product} · {r.direction} {r.size}
                        </span>
                        <span className="mt-1.5 inline-flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TIER_STYLE[r.tier]}`}
                          >
                            {r.tier}
                          </span>
                          <span className="text-[10px] text-neutral-400">{r.id}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Composer */}
        <div className="lg:col-span-3">
          <div className="border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-neutral-400">{rfq.id}</p>
                  <h2 className="mt-0.5 text-lg font-semibold text-neutral-900">
                    {rfq.product}
                  </h2>
                  <p className="text-sm text-neutral-500">
                    {rfq.client} wants to <span className="font-medium text-neutral-800">{rfq.direction.toLowerCase()}</span>{" "}
                    {rfq.size}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-neutral-400">Expires</p>
                  <p
                    className={`font-mono text-2xl font-semibold ${
                      rfq.urgency === "hot" ? "text-rose-600" : "text-neutral-900"
                    }`}
                  >
                    {rfq.expiresIn}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-neutral-100 border-b border-neutral-100 text-center">
              <div className="px-3 py-3">
                <p className="text-lg font-semibold text-neutral-900">{rfq.hitRate}%</p>
                <p className="text-[11px] uppercase tracking-wide text-neutral-400">Hit rate</p>
              </div>
              <div className="px-3 py-3">
                <p className="text-lg font-semibold text-neutral-900">{rfq.lastTraded}</p>
                <p className="text-[11px] uppercase tracking-wide text-neutral-400">Last traded</p>
              </div>
              <div className="px-3 py-3">
                <p className="text-lg font-semibold text-neutral-900">{rfq.tier}</p>
                <p className="text-[11px] uppercase tracking-wide text-neutral-400">Client tier</p>
              </div>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="border-l-2 border-blue-500 bg-blue-50/60 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                  Sales colour
                </p>
                <p className="mt-0.5 text-sm text-neutral-700">{rfq.salesNote}</p>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Spread preset
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {SPREAD_PRESETS.map((p) => {
                    const active = preset === p.label;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setPreset(p.label)}
                        className={`border px-3 py-2.5 text-left transition ${
                          active
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                        }`}
                      >
                        <span className="block text-sm font-semibold">{p.label}</span>
                        <span
                          className={`block font-mono text-xs ${active ? "text-blue-100" : "text-neutral-500"}`}
                        >
                          mid {p.bps} bps
                        </span>
                        <span
                          className={`mt-1 block text-[11px] leading-tight ${
                            active ? "text-blue-100" : "text-neutral-400"
                          }`}
                        >
                          {p.note}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
                <div className="text-sm text-neutral-500">
                  Quote as <span className="font-mono font-semibold text-neutral-900">2.847%</span>{" "}
                  vs mid <span className="font-mono">2.834%</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
                  >
                    Pass
                  </button>
                  <button
                    type="button"
                    className="bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Send quote
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
