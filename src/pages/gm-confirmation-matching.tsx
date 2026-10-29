import { useState } from "react";

export const title = "Confirmation Matching";
export const section = "dashboards";

/* Global Markets lifecycle · Stage 5 — Confirmation & affirmation.
 *
 * Design: a mirrored ledger. Our booked record on the left, the
 * counterparty's confirmation on the right, matched field by field down a
 * centre spine. Clean rows fade back; breaks light up with a resolution. */

type FieldMatch = {
  field: string;
  ours: string;
  theirs: string;
  status: "match" | "break" | "tolerance";
  note?: string;
};

type Confirm = {
  id: string;
  cpty: string;
  product: string;
  method: string;
  received: string;
  fields: FieldMatch[];
};

const CONFIRMS: Confirm[] = [
  {
    id: "CNF-55231",
    cpty: "Meridian Capital",
    product: "EUR 10Y IRS payer · €250M",
    method: "MarkitWire",
    received: "14:02",
    fields: [
      { field: "Trade date", ours: "18 Sep 2026", theirs: "18 Sep 2026", status: "match" },
      { field: "Effective date", ours: "22 Sep 2026", theirs: "22 Sep 2026", status: "match" },
      { field: "Maturity", ours: "22 Sep 2036", theirs: "22 Sep 2036", status: "match" },
      { field: "Notional", ours: "EUR 250,000,000", theirs: "EUR 250,000,000", status: "match" },
      {
        field: "Fixed rate",
        ours: "2.8470%",
        theirs: "2.8475%",
        status: "break",
        note: "0.05bp apart — outside auto-match tolerance. Their voice log says 2.8470.",
      },
      { field: "Float index", ours: "EURIBOR 6M", theirs: "EURIBOR 6M", status: "match" },
      {
        field: "Day count (fixed)",
        ours: "30/360",
        theirs: "ACT/360",
        status: "break",
        note: "Convention mismatch — likely their template default. Worth ~€310k over life.",
      },
      { field: "Payment freq", ours: "Annual / Semi", theirs: "Annual / Semi", status: "match" },
      {
        field: "First fixing",
        ours: "2.1120%",
        theirs: "2.1121%",
        status: "tolerance",
        note: "Within rounding tolerance — auto-accepted.",
      },
      { field: "CSA", ours: "2016 VM CSA · EUR", theirs: "2016 VM CSA · EUR", status: "match" },
    ],
  },
  {
    id: "CNF-55228",
    cpty: "Arcus Insurance",
    product: "USD swaption 5Y5Y · $50M vega",
    method: "DTCC",
    received: "13:47",
    fields: [
      { field: "Trade date", ours: "18 Sep 2026", theirs: "18 Sep 2026", status: "match" },
      { field: "Expiry", ours: "18 Sep 2031", theirs: "18 Sep 2031", status: "match" },
      { field: "Strike", ours: "3.150%", theirs: "3.150%", status: "match" },
      { field: "Premium", ours: "USD 4,120,000", theirs: "USD 4,120,000", status: "match" },
      { field: "Settlement", ours: "Cash · CCP", theirs: "Cash · CCP", status: "match" },
    ],
  },
];

const STATUS_META = {
  match: { row: "", pill: "bg-emerald-100 text-emerald-700", label: "Match" },
  tolerance: { row: "bg-sky-50/50", pill: "bg-sky-100 text-sky-700", label: "Tolerance" },
  break: { row: "bg-rose-50/70", pill: "bg-rose-100 text-rose-700", label: "Break" },
} as const;

export default function GmConfirmationMatching() {
  const [activeId, setActiveId] = useState(CONFIRMS[0].id);
  const confirm = CONFIRMS.find((c) => c.id === activeId) ?? CONFIRMS[0];
  const breaks = confirm.fields.filter((f) => f.status === "break").length;
  const matchPct = Math.round(
    (confirm.fields.filter((f) => f.status !== "break").length / confirm.fields.length) * 100,
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
          Global markets · Lifecycle 05 — Confirmation
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Confirmation Matching</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Our booked record against the counterparty's confirmation, field by field.
          Clean rows stay quiet; breaks demand a decision.
        </p>
      </header>

      {/* Queue selector */}
      <div className="flex flex-wrap gap-2">
        {CONFIRMS.map((c) => {
          const active = c.id === activeId;
          const b = c.fields.filter((f) => f.status === "break").length;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              className={`border px-4 py-2.5 text-left transition ${
                active
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white hover:border-neutral-300"
              }`}
            >
              <span className="block text-sm font-semibold">{c.cpty}</span>
              <span className={`block text-xs ${active ? "text-neutral-300" : "text-neutral-500"}`}>
                {c.product}
              </span>
              <span
                className={`mt-1 inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                  b > 0
                    ? active
                      ? "bg-rose-500 text-white"
                      : "bg-rose-100 text-rose-700"
                    : active
                      ? "bg-emerald-500 text-white"
                      : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {b > 0 ? `${b} break${b > 1 ? "s" : ""}` : "Clean"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Match sheet */}
      <div className="border border-neutral-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3">
          <div className="text-sm text-neutral-500">
            <span className="font-mono text-xs text-neutral-400">{confirm.id}</span>
            <span className="mx-2 text-neutral-300">·</span>
            via {confirm.method}, received {confirm.received}
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 w-32 bg-neutral-100">
              <div
                className={`h-2 ${breaks > 0 ? "bg-amber-400" : "bg-emerald-500"}`}
                style={{ width: `${matchPct}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-neutral-900">{matchPct}% matched</span>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_140px_1fr] border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <div className="px-5 py-2 text-right">Our booking</div>
          <div className="border-x border-neutral-200 px-3 py-2 text-center">Field</div>
          <div className="px-5 py-2">Their confirm</div>
        </div>

        {confirm.fields.map((f) => {
          const meta = STATUS_META[f.status];
          return (
            <div key={f.field} className={`border-b border-neutral-100 last:border-b-0 ${meta.row}`}>
              <div className="grid grid-cols-[1fr_140px_1fr] items-center">
                <div
                  className={`px-5 py-2.5 text-right font-mono text-sm ${
                    f.status === "break" ? "font-semibold text-neutral-900" : "text-neutral-600"
                  }`}
                >
                  {f.ours}
                </div>
                <div className="border-x border-neutral-100 px-3 py-2.5 text-center">
                  <p className="text-xs font-medium text-neutral-500">{f.field}</p>
                  <span
                    className={`mt-0.5 inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase ${meta.pill}`}
                  >
                    {meta.label}
                  </span>
                </div>
                <div
                  className={`px-5 py-2.5 font-mono text-sm ${
                    f.status === "break" ? "font-semibold text-rose-700" : "text-neutral-600"
                  }`}
                >
                  {f.theirs}
                </div>
              </div>
              {f.note && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3">
                  <p className="text-xs text-neutral-500">{f.note}</p>
                  {f.status === "break" && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                      >
                        Accept theirs
                      </button>
                      <button
                        type="button"
                        className="bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                      >
                        Dispute
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-5 py-3">
          <p className="text-sm text-neutral-500">
            {breaks > 0
              ? `${breaks} break${breaks > 1 ? "s" : ""} outstanding — cannot affirm yet.`
              : "All fields agree."}
          </p>
          <button
            type="button"
            disabled={breaks > 0}
            className={`px-5 py-2 text-sm font-semibold ${
              breaks > 0
                ? "cursor-not-allowed bg-neutral-200 text-neutral-400"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            Affirm trade
          </button>
        </div>
      </div>
    </div>
  );
}
