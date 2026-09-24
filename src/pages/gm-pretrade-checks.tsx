import { useState } from "react";

export const title = "Pre-Trade Checks";
export const section = "dashboards";

/* Global Markets lifecycle · Stage 2 — Pre-trade risk & compliance.
 *
 * Design: a vertical "gate rail". The order can only release once every
 * control gate clears — passed gates collapse to a quiet green line, the
 * blocking gate expands with headroom detail and a waiver path. */

type GateState = "pass" | "blocked" | "waiver" | "pending";

type Gate = {
  id: string;
  name: string;
  owner: string;
  state: GateState;
  detail: string;
  headroom?: { label: string; used: number; limit: number; unit: string };
};

const ORDER = {
  ref: "ORD-2026-33871",
  desc: "Sell $180M USD 10Y Treasury vs. receive fixed IRS overlay",
  book: "Rates Flow — NY",
  trader: "D. Okafor",
  client: "Meridian Capital (Platinum)",
};

const GATES: Gate[] = [
  {
    id: "kyc",
    name: "Client docs & KYC",
    owner: "Client Lifecycle",
    state: "pass",
    detail: "ISDA + CSA in force. KYC refresh valid until Mar 2027.",
  },
  {
    id: "restricted",
    name: "Restricted & watch lists",
    owner: "Compliance",
    state: "pass",
    detail: "No instrument or issuer matches across 4 lists.",
  },
  {
    id: "credit",
    name: "Counterparty credit line",
    owner: "Credit Risk",
    state: "blocked",
    detail:
      "PFE add-on of $14.2M takes Meridian to 103% of its $220M line. Needs a temporary uplift or a compressing trade first.",
    headroom: { label: "Credit line usage", used: 226.6, limit: 220, unit: "$M" },
  },
  {
    id: "market",
    name: "Desk market-risk limit",
    owner: "Market Risk",
    state: "waiver",
    detail:
      "DV01 breaches the desk's overnight band by 4%. Intraday waiver W-5521 approved by K. Ito until 17:00.",
    headroom: { label: "DV01 vs. band", used: 312, limit: 300, unit: "k$/bp" },
  },
  {
    id: "bestex",
    name: "Best execution venue",
    owner: "Trading Controls",
    state: "pending",
    detail: "Awaiting venue ranking — evaluates after credit clears.",
  },
];

const STATE_META: Record<
  GateState,
  { label: string; dot: string; text: string; ring: string }
> = {
  pass: { label: "Cleared", dot: "bg-emerald-500", text: "text-emerald-700", ring: "border-emerald-200" },
  blocked: { label: "Blocked", dot: "bg-rose-500", text: "text-rose-700", ring: "border-rose-300" },
  waiver: { label: "Waiver", dot: "bg-amber-400", text: "text-amber-700", ring: "border-amber-300" },
  pending: { label: "Queued", dot: "bg-neutral-300", text: "text-neutral-500", ring: "border-neutral-200" },
};

function HeadroomBar({ headroom }: { headroom: NonNullable<Gate["headroom"]> }) {
  const pct = Math.min((headroom.used / headroom.limit) * 100, 130);
  const over = headroom.used > headroom.limit;
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-neutral-500">{headroom.label}</span>
        <span className={`font-mono font-semibold ${over ? "text-rose-600" : "text-neutral-700"}`}>
          {headroom.used} / {headroom.limit} {headroom.unit}
        </span>
      </div>
      <div className="relative mt-1.5 h-2 w-full bg-neutral-100">
        <div
          className={`h-2 ${over ? "bg-rose-500" : "bg-emerald-500"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
        {over && (
          <div
            className="absolute top-0 h-2 bg-rose-500/40"
            style={{ left: "100%", width: `${pct - 100}%`, transform: "translateX(-100%)" }}
          />
        )}
      </div>
    </div>
  );
}

export default function GmPretradeChecks() {
  const [expanded, setExpanded] = useState<string | null>("credit");
  const blockedCount = GATES.filter((g) => g.state === "blocked").length;
  const canRelease = blockedCount === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
          Global markets · Lifecycle 02 — Pre-trade controls
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Pre-Trade Checks</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every gate must clear before the order releases to the desk.
        </p>
      </header>

      {/* Order under review */}
      <div className="border border-neutral-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-neutral-400">{ORDER.ref}</p>
            <p className="mt-0.5 text-sm font-semibold text-neutral-900">{ORDER.desc}</p>
            <p className="mt-1 text-xs text-neutral-500">
              {ORDER.book} · {ORDER.trader} · {ORDER.client}
            </p>
          </div>
          <span
            className={`px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
              canRelease ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"
            }`}
          >
            {canRelease ? "Ready to release" : `${blockedCount} gate blocking`}
          </span>
        </div>
      </div>

      {/* Gate rail */}
      <ol className="relative space-y-3">
        {GATES.map((gate, i) => {
          const meta = STATE_META[gate.state];
          const open = expanded === gate.id;
          return (
            <li key={gate.id} className="relative pl-8">
              {/* rail */}
              {i < GATES.length - 1 && (
                <span
                  className="absolute left-[7px] top-6 h-full w-px bg-neutral-200"
                  aria-hidden
                />
              )}
              <span
                className={`absolute left-0 top-2.5 h-4 w-4 border-2 border-white shadow-sm ${meta.dot}`}
                aria-hidden
              />
              <div className={`border bg-white ${meta.ring}`}>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : gate.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{gate.name}</p>
                    <p className="text-xs text-neutral-400">{gate.owner}</p>
                  </div>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${meta.text}`}>
                    {meta.label}
                  </span>
                </button>
                {open && (
                  <div className="border-t border-neutral-100 px-4 py-3">
                    <p className="text-sm text-neutral-600">{gate.detail}</p>
                    {gate.headroom && <HeadroomBar headroom={gate.headroom} />}
                    {gate.state === "blocked" && (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700"
                        >
                          Request line uplift
                        </button>
                        <button
                          type="button"
                          className="border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                        >
                          Split the order
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Release footer */}
      <div className="flex items-center justify-between border border-neutral-200 bg-neutral-50 px-5 py-4">
        <p className="text-sm text-neutral-500">
          {canRelease
            ? "All gates clear — the order can go to the desk."
            : "Release stays locked while any gate is blocked."}
        </p>
        <button
          type="button"
          disabled={!canRelease}
          className={`px-5 py-2 text-sm font-semibold ${
            canRelease
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "cursor-not-allowed bg-neutral-200 text-neutral-400"
          }`}
        >
          Release order
        </button>
      </div>
    </div>
  );
}
