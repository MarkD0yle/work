import { useState } from "react";

export const title = "Asset Servicing";
export const section = "dashboards";

/* Global Markets lifecycle · Stage 8 — Asset servicing.
 *
 * Design: a fortnight strip. Ten business days across the top, each
 * stacked with the cashflow events it carries — coupons, dividends, rate
 * resets, redemptions — and a detail ledger for the selected day below. */

type EventKind = "coupon" | "dividend" | "reset" | "redemption";

type ServiceEvent = {
  kind: EventKind;
  security: string;
  detail: string;
  amount: string;
  status: "projected" | "confirmed" | "action";
  note?: string;
};

type Day = {
  date: string; // "Mon 21"
  iso: string;
  events: ServiceEvent[];
};

const KIND_META: Record<EventKind, { label: string; chip: string; dot: string }> = {
  coupon: { label: "Coupon", chip: "bg-blue-100 text-blue-800", dot: "bg-blue-500" },
  dividend: { label: "Dividend", chip: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  reset: { label: "Rate reset", chip: "bg-violet-100 text-violet-800", dot: "bg-violet-500" },
  redemption: { label: "Redemption", chip: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
};

const DAYS: Day[] = [
  {
    date: "Mon 21",
    iso: "2026-09-21",
    events: [
      {
        kind: "reset",
        security: "EUR 10Y IRS · Meridian",
        detail: "EURIBOR 6M fixing applies to €250M leg",
        amount: "2.112%",
        status: "confirmed",
      },
      {
        kind: "coupon",
        security: "DBR 2.6% 2036",
        detail: "Semi-annual coupon on €48.2M face",
        amount: "€626,600",
        status: "projected",
      },
    ],
  },
  {
    date: "Tue 22",
    iso: "2026-09-22",
    events: [
      {
        kind: "dividend",
        security: "TOPIX TRS basket",
        detail: "17 constituents ex-date — swap leg accrues to Vela",
        amount: "¥41.8M",
        status: "projected",
        note: "3 constituents still awaiting board confirmation of amount.",
      },
    ],
  },
  {
    date: "Wed 23",
    iso: "2026-09-23",
    events: [
      {
        kind: "coupon",
        security: "BTP 3.85% 2033",
        detail: "Annual coupon on €12.7M face",
        amount: "€488,950",
        status: "confirmed",
      },
      {
        kind: "reset",
        security: "GBP 30Y RPI swap · Northgate",
        detail: "RPI index publication feeds the inflation leg",
        amount: "RPI 412.4",
        status: "action",
        note: "ONS publishes 07:00 — ops must verify the print before the 09:00 accrual run.",
      },
      {
        kind: "dividend",
        security: "Shell plc ADR",
        detail: "Withholding at 15% treaty rate, reclaim eligible",
        amount: "$102,300",
        status: "projected",
      },
    ],
  },
  { date: "Thu 24", iso: "2026-09-24", events: [] },
  {
    date: "Fri 25",
    iso: "2026-09-25",
    events: [
      {
        kind: "redemption",
        security: "OAT 0.5% 2026",
        detail: "Final redemption of €22M face at par",
        amount: "€22,000,000",
        status: "action",
        note: "Position must be off repo by Thursday close or the return breaks.",
      },
    ],
  },
  {
    date: "Mon 28",
    iso: "2026-09-28",
    events: [
      {
        kind: "coupon",
        security: "UST 4.25% 2034",
        detail: "Semi-annual coupon on $31.5M face",
        amount: "$669,375",
        status: "projected",
      },
    ],
  },
  {
    date: "Tue 29",
    iso: "2026-09-29",
    events: [
      {
        kind: "reset",
        security: "USD 5Y IRS · Halcyon",
        detail: "SOFR compounding period ends, payment T+2",
        amount: "4.318%",
        status: "confirmed",
      },
    ],
  },
  { date: "Wed 30", iso: "2026-09-30", events: [] },
  {
    date: "Thu 01",
    iso: "2026-10-01",
    events: [
      {
        kind: "dividend",
        security: "Nestlé SA",
        detail: "CHF dividend, 35% withholding — reclaim via DTT",
        amount: "CHF 84,150",
        status: "projected",
      },
    ],
  },
  {
    date: "Fri 02",
    iso: "2026-10-02",
    events: [
      {
        kind: "coupon",
        security: "Gilt 4.5% 2042",
        detail: "Semi-annual coupon on £6.1M face",
        amount: "£137,250",
        status: "projected",
      },
    ],
  },
];

const STATUS_META = {
  projected: { label: "Projected", cls: "bg-neutral-100 text-neutral-500" },
  confirmed: { label: "Confirmed", cls: "bg-emerald-100 text-emerald-700" },
  action: { label: "Action needed", cls: "bg-rose-100 text-rose-700" },
} as const;

export default function GmAssetServicing() {
  const [selected, setSelected] = useState("2026-09-23");
  const day = DAYS.find((d) => d.iso === selected) ?? DAYS[0];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
          Global markets · Lifecycle 08 — Asset servicing
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Asset Servicing</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          The next two weeks of cashflow events across the book — coupons, dividends,
          resets and redemptions. Pick a day for the ledger.
        </p>
      </header>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {(Object.keys(KIND_META) as EventKind[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
            <span className={`h-2 w-2 ${KIND_META[k].dot}`} aria-hidden />
            {KIND_META[k].label}
          </span>
        ))}
      </div>

      {/* Fortnight strip */}
      <div className="grid grid-cols-5 gap-1.5 lg:grid-cols-10">
        {DAYS.map((d) => {
          const active = d.iso === selected;
          const hasAction = d.events.some((e) => e.status === "action");
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => setSelected(d.iso)}
              className={`flex min-h-[92px] flex-col border px-2 py-2 text-left transition ${
                active
                  ? "border-neutral-900 bg-neutral-900"
                  : "border-neutral-200 bg-white hover:border-neutral-400"
              }`}
            >
              <span
                className={`text-[11px] font-semibold ${
                  active ? "text-white" : "text-neutral-700"
                }`}
              >
                {d.date}
              </span>
              <span className="mt-2 flex flex-wrap gap-1">
                {d.events.map((e, i) => (
                  <span key={i} className={`h-2 w-2 ${KIND_META[e.kind].dot}`} aria-hidden />
                ))}
                {d.events.length === 0 && (
                  <span className={`text-[10px] ${active ? "text-neutral-500" : "text-neutral-300"}`}>
                    —
                  </span>
                )}
              </span>
              {hasAction && (
                <span
                  className={`mt-auto pt-1 text-[10px] font-semibold uppercase ${
                    active ? "text-rose-300" : "text-rose-600"
                  }`}
                >
                  Action
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Day ledger */}
      <div className="border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">
            {day.date} — {day.events.length} event{day.events.length === 1 ? "" : "s"}
          </h2>
        </div>
        {day.events.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-400">
            Nothing services on this day.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {day.events.map((e, i) => {
              const km = KIND_META[e.kind];
              const sm = STATUS_META[e.status];
              return (
                <li key={i} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className={`mt-1 px-2 py-0.5 text-[10px] font-semibold uppercase ${km.chip}`}>
                        {km.label}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{e.security}</p>
                        <p className="text-sm text-neutral-500">{e.detail}</p>
                        {e.note && (
                          <p className="mt-1.5 border-l-2 border-amber-400 bg-amber-50/60 py-1 pl-2.5 text-xs text-amber-800">
                            {e.note}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold text-neutral-900">{e.amount}</p>
                      <span className={`mt-1 inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase ${sm.cls}`}>
                        {sm.label}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
