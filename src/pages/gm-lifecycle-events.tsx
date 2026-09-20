export const title = "Lifecycle Events";
export const section = "global-markets";

/* Global Markets lifecycle · Stage 9 — In-life events.
 *
 * Design: an audit timeline for a single long-dated trade. Every event
 * that reshaped it — amendments, partial novation, compression — with a
 * before → after delta, plus a summary card comparing the trade as struck
 * against the trade as it stands. */

type EventType = "inception" | "amendment" | "novation" | "compression" | "collateral";

type LifecycleEvent = {
  type: EventType;
  date: string;
  headline: string;
  actor: string;
  deltas?: { field: string; before: string; after: string }[];
  note?: string;
};

const TRADE = {
  ref: "IRS-2021-004417",
  desc: "EUR 20Y interest-rate swap · pay fixed",
  cpty: "Meridian Capital → (part) Bastion LP",
  struck: "12 Mar 2021",
};

const THEN_NOW: { field: string; then: string; now: string; changed: boolean }[] = [
  { field: "Notional", then: "€400M", now: "€185M", changed: true },
  { field: "Fixed rate", then: "0.482%", now: "0.482%", changed: false },
  { field: "Counterparty", then: "Meridian 100%", now: "Meridian 54% · Bastion 46%", changed: true },
  { field: "Maturity", then: "12 Mar 2041", now: "12 Mar 2041", changed: false },
  { field: "CSA", then: "2016 VM · EUR", now: "2016 VM+IM · EUR", changed: true },
  { field: "Clearing", then: "Bilateral", now: "LCH SwapClear", changed: true },
];

const EVENTS: LifecycleEvent[] = [
  {
    type: "compression",
    date: "02 Sep 2026",
    headline: "TriOptima compression cycle 26-09",
    actor: "triReduce auto-run · approved K. Ito",
    deltas: [{ field: "Notional", before: "€240M", after: "€185M" }],
    note: "Offsetting risk netted against 3 house trades. DV01 unchanged within €120/bp.",
  },
  {
    type: "collateral",
    date: "14 May 2026",
    headline: "CSA upgraded to include initial margin",
    actor: "Credit Risk · UMR phase-in",
    deltas: [{ field: "CSA", before: "2016 VM · EUR", after: "2016 VM+IM · EUR" }],
  },
  {
    type: "novation",
    date: "28 Jan 2025",
    headline: "Partial novation to Bastion LP",
    actor: "Sales — client restructuring request",
    deltas: [
      { field: "Notional split", before: "Meridian 100%", after: "Meridian 54% · Bastion 46%" },
      { field: "Notional", before: "€310M", after: "€240M" },
    ],
    note: "Bastion assumed €70M face with remainder terminated for a €2.1M fee.",
  },
  {
    type: "amendment",
    date: "09 Jun 2023",
    headline: "Backloaded to LCH SwapClear",
    actor: "Ops — clearing backload programme",
    deltas: [{ field: "Clearing", before: "Bilateral", after: "LCH SwapClear" }],
  },
  {
    type: "amendment",
    date: "17 Nov 2021",
    headline: "Notional step-down exercised",
    actor: "Contractual schedule",
    deltas: [{ field: "Notional", before: "€400M", after: "€310M" }],
  },
  {
    type: "inception",
    date: "12 Mar 2021",
    headline: "Trade struck",
    actor: "D. Okafor · Rates Flow — NY",
    note: "€400M 20Y payer at 0.482% vs EURIBOR 6M, bilateral under 2016 VM CSA.",
  },
];

const TYPE_META: Record<EventType, { label: string; dot: string; chip: string }> = {
  inception: { label: "Inception", dot: "bg-neutral-900", chip: "bg-neutral-900 text-white" },
  amendment: { label: "Amendment", dot: "bg-blue-500", chip: "bg-blue-100 text-blue-800" },
  novation: { label: "Novation", dot: "bg-violet-500", chip: "bg-violet-100 text-violet-800" },
  compression: { label: "Compression", dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800" },
  collateral: { label: "Collateral", dot: "bg-amber-500", chip: "bg-amber-100 text-amber-800" },
};

export default function GmLifecycleEvents() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
          Global markets · Lifecycle 09 — In-life events
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Lifecycle Events</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Five years of surgery on one swap. Every event that changed its shape, and
          what the trade looks like now versus the day it was struck.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Then vs now */}
        <div className="lg:col-span-2">
          <div className="border border-neutral-200 bg-white lg:sticky lg:top-6">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <p className="font-mono text-xs text-neutral-400">{TRADE.ref}</p>
              <h2 className="mt-0.5 text-sm font-semibold text-neutral-900">{TRADE.desc}</h2>
              <p className="text-xs text-neutral-500">{TRADE.cpty}</p>
            </div>
            <div className="grid grid-cols-[1fr_1fr] border-b border-neutral-100 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              <span className="px-4 py-2">As struck · {TRADE.struck}</span>
              <span className="border-l border-neutral-100 px-4 py-2">Today</span>
            </div>
            {THEN_NOW.map((r) => (
              <div key={r.field} className="border-b border-neutral-100 last:border-b-0">
                <p className="px-4 pt-2 text-[11px] font-medium text-neutral-400">{r.field}</p>
                <div className="grid grid-cols-[1fr_1fr]">
                  <span className="px-4 pb-2 pt-0.5 font-mono text-xs text-neutral-500">{r.then}</span>
                  <span
                    className={`border-l border-neutral-100 px-4 pb-2 pt-0.5 font-mono text-xs ${
                      r.changed ? "font-semibold text-blue-700" : "text-neutral-500"
                    }`}
                  >
                    {r.now}
                  </span>
                </div>
              </div>
            ))}
            <p className="px-4 py-3 text-[11px] text-neutral-400">
              Blue values differ from inception.
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-3">
          <ol className="relative space-y-4 pl-6">
            <span className="absolute bottom-2 left-[7px] top-2 w-px bg-neutral-200" aria-hidden />
            {EVENTS.map((e, i) => {
              const meta = TYPE_META[e.type];
              return (
                <li key={i} className="relative">
                  <span
                    className={`absolute -left-6 top-4 h-4 w-4 border-2 border-white shadow-sm ${meta.dot}`}
                    aria-hidden
                  />
                  <div className="border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase ${meta.chip}`}>
                          {meta.label}
                        </span>
                        <span className="text-sm font-semibold text-neutral-900">{e.headline}</span>
                      </div>
                      <span className="font-mono text-xs text-neutral-400">{e.date}</span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">{e.actor}</p>
                    {e.deltas && (
                      <div className="mt-2.5 space-y-1.5">
                        {e.deltas.map((d) => (
                          <div key={d.field} className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="w-28 shrink-0 text-neutral-400">{d.field}</span>
                            <span className="bg-neutral-100 px-2 py-0.5 font-mono text-neutral-500 line-through decoration-neutral-300">
                              {d.before}
                            </span>
                            <span className="text-neutral-300">→</span>
                            <span className="bg-blue-50 px-2 py-0.5 font-mono font-semibold text-blue-800">
                              {d.after}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {e.note && <p className="mt-2 text-xs text-neutral-500">{e.note}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
