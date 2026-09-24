import { useState } from "react";

export const title = "Settlement Fails";
export const section = "dashboards";

/* Global Markets lifecycle · Stage 7 — Settlement.
 *
 * Design: a fails workbench. Ageing buckets across the top act as
 * filters — each shows the money stuck in it — and the table below carries
 * the daily CSDR penalty each fail is bleeding, with the fix per row. */

type Bucket = "1" | "2-4" | "5-9" | "10+";

type Fail = {
  id: string;
  security: string;
  cpty: string;
  direction: "Deliver" | "Receive";
  value: string;
  csd: string;
  days: number;
  penaltyPerDay: string;
  accrued: string;
  cause: string;
  action: string;
};

const FAILS: Fail[] = [
  {
    id: "SF-3319",
    security: "DBR 2.6% 2036 · DE0001102614",
    cpty: "Meridian Capital",
    direction: "Deliver",
    value: "€48.2M",
    csd: "Clearstream",
    days: 1,
    penaltyPerDay: "€4,820",
    accrued: "€4,820",
    cause: "Inventory short — lending recall in flight",
    action: "Chase recall",
  },
  {
    id: "SF-3315",
    security: "UST 4.25% 2034 · 91282CJZ5",
    cpty: "Halcyon AM",
    direction: "Receive",
    value: "$31.5M",
    csd: "Fedwire",
    days: 2,
    penaltyPerDay: "$0",
    accrued: "$0",
    cause: "Counterparty short — they are being penalised, not us",
    action: "Issue buy-in notice",
  },
  {
    id: "SF-3308",
    security: "BTP 3.85% 2033 · IT0005518128",
    cpty: "Vela Quant Fund",
    direction: "Deliver",
    value: "€12.7M",
    csd: "Euroclear",
    days: 3,
    penaltyPerDay: "€1,270",
    accrued: "€3,810",
    cause: "SSI mismatch — their custodian changed accounts on the 12th",
    action: "Reinstruct with new SSI",
  },
  {
    id: "SF-3297",
    security: "OAT 3.0% 2035 · FR001400M4L2",
    cpty: "Northgate Pension",
    direction: "Deliver",
    value: "€8.9M",
    csd: "Euroclear",
    days: 6,
    penaltyPerDay: "€890",
    accrued: "€5,340",
    cause: "Partial settlement declined by counterparty",
    action: "Offer partial again",
  },
  {
    id: "SF-3241",
    security: "Gilt 4.5% 2042 · GB00BLBDX619",
    cpty: "Bastion LP",
    direction: "Receive",
    value: "£6.1M",
    csd: "CREST",
    days: 12,
    penaltyPerDay: "£0",
    accrued: "£0",
    cause: "Mandatory buy-in window open since day 10",
    action: "Execute buy-in",
  },
];

function bucketOf(days: number): Bucket {
  if (days <= 1) return "1";
  if (days <= 4) return "2-4";
  if (days <= 9) return "5-9";
  return "10+";
}

const BUCKETS: { id: Bucket; label: string; tone: string; bar: string }[] = [
  { id: "1", label: "Day 1", tone: "text-sky-700", bar: "bg-sky-400" },
  { id: "2-4", label: "Days 2–4", tone: "text-amber-700", bar: "bg-amber-400" },
  { id: "5-9", label: "Days 5–9", tone: "text-orange-700", bar: "bg-orange-500" },
  { id: "10+", label: "Day 10+ · buy-in", tone: "text-rose-700", bar: "bg-rose-500" },
];

export default function GmSettlementFails() {
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const rows = bucket ? FAILS.filter((f) => bucketOf(f.days) === bucket) : FAILS;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
          Global markets · Lifecycle 07 — Settlement
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Settlement Fails</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Everything that didn't settle on value date, aged left to right. Each day a
          deliver-side fail stands, CSDR penalties accrue against us.
        </p>
      </header>

      {/* Ageing buckets */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {BUCKETS.map((b) => {
          const inBucket = FAILS.filter((f) => bucketOf(f.days) === b.id);
          const active = bucket === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setBucket(active ? null : b.id)}
              className={`border bg-white px-4 py-3 text-left transition ${
                active ? "border-neutral-900 shadow-sm" : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <div className={`h-1 w-8 ${b.bar}`} aria-hidden />
              <p className={`mt-2 text-xs font-semibold uppercase tracking-wide ${b.tone}`}>
                {b.label}
              </p>
              <p className="mt-1 text-xl font-semibold text-neutral-900">{inBucket.length}</p>
              <p className="text-xs text-neutral-400">
                {inBucket.length === 1 ? "fail" : "fails"} in bucket
              </p>
            </button>
          );
        })}
      </div>

      {/* Fails table */}
      <div className="overflow-x-auto border border-neutral-200 bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2.5">Security</th>
              <th className="px-3 py-2.5">Counterparty</th>
              <th className="px-3 py-2.5">Dir</th>
              <th className="px-3 py-2.5 text-right">Value</th>
              <th className="px-3 py-2.5 text-center">Age</th>
              <th className="px-3 py-2.5 text-right">Penalty accrued</th>
              <th className="px-3 py-2.5">Root cause</th>
              <th className="px-4 py-2.5 text-right">Next step</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((f) => {
              const b = BUCKETS.find((x) => x.id === bucketOf(f.days))!;
              const bleeding = f.accrued !== "€0" && f.accrued !== "$0" && f.accrued !== "£0";
              return (
                <tr key={f.id} className="align-top hover:bg-neutral-50/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900">{f.security.split(" · ")[0]}</p>
                    <p className="font-mono text-[11px] text-neutral-400">
                      {f.security.split(" · ")[1]} · {f.csd} · {f.id}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-neutral-600">{f.cpty}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        f.direction === "Deliver"
                          ? "bg-violet-100 text-violet-700"
                          : "bg-sky-100 text-sky-700"
                      }`}
                    >
                      {f.direction}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-neutral-900">{f.value}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${b.tone}`}>
                      <span className={`h-2 w-2 ${b.bar}`} aria-hidden />
                      {f.days}d
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <p className={`font-mono ${bleeding ? "font-semibold text-rose-600" : "text-neutral-400"}`}>
                      {f.accrued}
                    </p>
                    <p className="text-[11px] text-neutral-400">{f.penaltyPerDay}/day</p>
                  </td>
                  <td className="max-w-[220px] px-3 py-3 text-xs text-neutral-500">{f.cause}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className={`px-3 py-1.5 text-xs font-semibold ${
                        f.days >= 10
                          ? "bg-rose-600 text-white hover:bg-rose-700"
                          : "bg-neutral-900 text-white hover:bg-neutral-700"
                      }`}
                    >
                      {f.action}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-400">
        Receive-side fails accrue penalties to the counterparty, not us — shown as zero.
        Buy-in becomes mandatory under CSDR at day 10 for liquid sovereigns.
      </p>
    </div>
  );
}
