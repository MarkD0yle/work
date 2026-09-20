import { useState } from "react";

export const title = "Maturity & Roll";
export const section = "global-markets";

/* Global Markets lifecycle · Stage 10 — Termination & maturity.
 *
 * Design: an expiry horizon board. Positions rolling off are banded by
 * how soon they mature; each carries its decision — roll, exercise, or
 * let it expire — taken right on the card. The meter tracks how much of
 * the near horizon is still undecided. */

type Decision = "roll" | "exercise" | "expire" | undefined;

type Position = {
  id: string;
  name: string;
  detail: string;
  matures: string;
  daysLeft: number;
  notional: string;
  pnlIfExpire: string;
  pnlTone: "up" | "down" | "flat";
  canExercise?: boolean;
  suggestion: string;
};

type Horizon = { id: string; label: string; positions: Position[] };

const HORIZONS: Horizon[] = [
  {
    id: "week",
    label: "This week",
    positions: [
      {
        id: "MAT-101",
        name: "ZN Oct26 futures",
        detail: "Long 340 lots · Rates Flow",
        matures: "Wed 23 Sep",
        daysLeft: 3,
        notional: "$38.5M",
        pnlIfExpire: "+$412k",
        pnlTone: "up",
        suggestion: "Roll to Dec26 — carry positive, liquidity deep",
      },
      {
        id: "MAT-102",
        name: "USD call spread on 10Y",
        detail: "Bought $25M · Options desk",
        matures: "Fri 25 Sep",
        daysLeft: 5,
        notional: "$25M",
        pnlIfExpire: "-$180k",
        pnlTone: "down",
        canExercise: true,
        suggestion: "Lower strike 4bp in the money — exercise the near leg",
      },
    ],
  },
  {
    id: "next-week",
    label: "Next week",
    positions: [
      {
        id: "MAT-103",
        name: "FX Fwd GBPUSD",
        detail: "Sell £45M fwd · Northgate hedge",
        matures: "Tue 29 Sep",
        daysLeft: 9,
        notional: "£45M",
        pnlIfExpire: "+$96k",
        pnlTone: "up",
        suggestion: "Client rolls quarterly — expect a 3M extension request",
      },
      {
        id: "MAT-104",
        name: "TOPIX TRS 6M",
        detail: "Receiver · Vela Quant",
        matures: "Thu 01 Oct",
        daysLeft: 11,
        notional: "¥9.5B",
        pnlIfExpire: "flat",
        pnlTone: "flat",
        suggestion: "Vela renegotiating spread — price the roll at +2bps",
      },
    ],
  },
  {
    id: "month",
    label: "Within a month",
    positions: [
      {
        id: "MAT-105",
        name: "Repo — DBR basket",
        detail: "€120M term repo · Financing",
        matures: "09 Oct",
        daysLeft: 19,
        notional: "€120M",
        pnlIfExpire: "flat",
        pnlTone: "flat",
        suggestion: "Funding still needed — roll 1M, GC rates softening",
      },
      {
        id: "MAT-106",
        name: "CDX IG 5Y Sep roll",
        detail: "Protection $75M · Credit",
        matures: "20 Oct",
        daysLeft: 30,
        notional: "$75M",
        pnlIfExpire: "-$44k",
        pnlTone: "down",
        suggestion: "Index rolls to series 47 — standard roll, watch skew",
      },
    ],
  },
];

const DECISION_META: Record<NonNullable<Decision>, { label: string; on: string }> = {
  roll: { label: "Roll", on: "bg-blue-600 text-white" },
  exercise: { label: "Exercise", on: "bg-violet-600 text-white" },
  expire: { label: "Expire", on: "bg-neutral-700 text-white" },
};

const PNL_TONE = {
  up: "text-emerald-600",
  down: "text-rose-600",
  flat: "text-neutral-400",
} as const;

export default function GmMaturityRoll() {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({
    "MAT-101": "roll",
  });

  const all = HORIZONS.flatMap((h) => h.positions);
  const decided = all.filter((p) => decisions[p.id]).length;
  const pct = Math.round((decided / all.length) * 100);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
            Global markets · Lifecycle 10 — Maturity
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Maturity &amp; Roll</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Everything rolling off the book in the next month, and the call on each:
            roll it, exercise it, or let it go.
          </p>
        </div>
        <div className="w-56">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-500">Decisions taken</span>
            <span className="font-semibold text-neutral-900">
              {decided}/{all.length}
            </span>
          </div>
          <div className="mt-1.5 h-2 bg-neutral-100">
            <div className="h-2 bg-blue-600" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      {HORIZONS.map((h) => (
        <section key={h.id}>
          <div className="mb-2 flex items-center gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              {h.label}
            </h2>
            <span className="h-px flex-1 bg-neutral-200" aria-hidden />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {h.positions.map((p) => {
              const decision = decisions[p.id];
              const urgent = p.daysLeft <= 5 && !decision;
              return (
                <div
                  key={p.id}
                  className={`border bg-white ${urgent ? "border-rose-300" : "border-neutral-200"}`}
                >
                  <div className="flex items-start justify-between gap-3 px-4 pt-3">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{p.name}</p>
                      <p className="text-xs text-neutral-400">{p.detail}</p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-bold ${
                          p.daysLeft <= 5 ? "text-rose-600" : "text-neutral-900"
                        }`}
                      >
                        {p.daysLeft}d
                      </p>
                      <p className="text-[11px] text-neutral-400">{p.matures}</p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between px-4 text-xs">
                    <span className="font-mono text-neutral-600">{p.notional}</span>
                    <span className="text-neutral-400">
                      if expired:{" "}
                      <span className={`font-mono font-semibold ${PNL_TONE[p.pnlTone]}`}>
                        {p.pnlIfExpire}
                      </span>
                    </span>
                  </div>

                  <p className="mt-2 border-l-2 border-blue-400 bg-blue-50/50 px-4 py-1.5 text-xs text-neutral-600">
                    {p.suggestion}
                  </p>

                  <div className="mt-3 grid grid-cols-3 border-t border-neutral-100">
                    {(["roll", "exercise", "expire"] as const).map((d) => {
                      const enabled = d !== "exercise" || p.canExercise;
                      const active = decision === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          disabled={!enabled}
                          onClick={() =>
                            setDecisions((prev) => ({
                              ...prev,
                              [p.id]: active ? undefined : d,
                            }))
                          }
                          className={`py-2 text-xs font-semibold uppercase tracking-wide transition ${
                            active
                              ? DECISION_META[d].on
                              : enabled
                                ? "bg-white text-neutral-500 hover:bg-neutral-50"
                                : "cursor-not-allowed bg-white text-neutral-200"
                          } ${d !== "expire" ? "border-r border-neutral-100" : ""}`}
                        >
                          {DECISION_META[d].label}
                        </button>
                      );
                    })}
                  </div>

                  {urgent && (
                    <p className="bg-rose-50 px-4 py-1.5 text-[11px] font-medium text-rose-700">
                      Undecided inside 5 days — defaults to expire at close on{" "}
                      {p.matures}.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
