export const title = "Trade Capture";
export const section = "dashboards";

/* Global Markets lifecycle · Stage 4 — Capture & booking.
 *
 * Design: a pipeline board. Executed trades flow left-to-right through
 * capture → enrichment → validation → booked, and anything that snags
 * drops into a repair strip at the bottom with the exact missing field. */

type Stage = "captured" | "enriching" | "validated" | "booked";

type Trade = {
  id: string;
  product: string;
  cpty: string;
  notional: string;
  age: string;
  auto?: boolean;
};

const COLUMNS: { id: Stage; label: string; hint: string; trades: Trade[] }[] = [
  {
    id: "captured",
    label: "Captured",
    hint: "Raw from venue / voice",
    trades: [
      { id: "T-90417", product: "EUR 5Y IRS", cpty: "Halcyon AM", notional: "€60M", age: "12s", auto: true },
      { id: "T-90416", product: "FX Fwd GBPUSD 3M", cpty: "Northgate", notional: "£45M", age: "31s", auto: true },
      { id: "T-90414", product: "CDX IG 5Y", cpty: "Vela Quant", notional: "$25M", age: "1m 02s" },
    ],
  },
  {
    id: "enriching",
    label: "Enriching",
    hint: "SSIs, books, SEF data",
    trades: [
      { id: "T-90411", product: "UST 10Y outright", cpty: "Meridian", notional: "$180M", age: "1m 40s", auto: true },
      { id: "T-90409", product: "BTP 7Y outright", cpty: "Arcus Ins.", notional: "€35M", age: "2m 12s", auto: true },
    ],
  },
  {
    id: "validated",
    label: "Validated",
    hint: "Econ + regs check out",
    trades: [
      { id: "T-90405", product: "EUR 10Y IRS payer", cpty: "Meridian", notional: "€250M", age: "3m 55s", auto: true },
    ],
  },
  {
    id: "booked",
    label: "Booked",
    hint: "In the risk system",
    trades: [
      { id: "T-90402", product: "JPY TRS TOPIX 6M", cpty: "Vela Quant", notional: "¥9.5B", age: "6m", auto: true },
      { id: "T-90399", product: "GBP 30Y RPI swap", cpty: "Northgate", notional: "£120M", age: "9m" },
      { id: "T-90395", product: "USD swaption 5Y5Y", cpty: "Arcus Ins.", notional: "$50M vega", age: "14m", auto: true },
    ],
  },
];

type ExceptionRow = {
  id: string;
  product: string;
  cpty: string;
  problem: string;
  field: string;
  stuckFor: string;
  severity: "high" | "med";
};

const EXCEPTIONS: ExceptionRow[] = [
  {
    id: "T-90408",
    product: "FX NDF USDKRW 1M",
    cpty: "Halcyon AM",
    problem: "No settlement instruction for KRW at this custodian",
    field: "SSI · KRW",
    stuckFor: "4m 20s",
    severity: "high",
  },
  {
    id: "T-90403",
    product: "EUR 2Y IRS",
    cpty: "New client — Bastion LP",
    problem: "Counterparty not yet mapped to a booking entity",
    field: "Legal entity",
    stuckFor: "8m 05s",
    severity: "high",
  },
  {
    id: "T-90397",
    product: "CDX HY 5Y",
    cpty: "Vela Quant",
    problem: "Trader book closed for the period — needs reroute",
    field: "Book",
    stuckFor: "16m",
    severity: "med",
  },
];

const COLUMN_TINT: Record<Stage, string> = {
  captured: "border-t-sky-400",
  enriching: "border-t-blue-500",
  validated: "border-t-violet-500",
  booked: "border-t-emerald-500",
};

export default function GmTradeCapture() {
  const total = COLUMNS.reduce((n, c) => n + c.trades.length, 0);
  const stp = Math.round(
    (COLUMNS.flatMap((c) => c.trades).filter((t) => t.auto).length / total) * 100,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
            Global markets · Lifecycle 04 — Capture &amp; booking
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Trade Capture</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Executions flowing into the books. Straight-through unless a field snags.
          </p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-2xl font-semibold text-neutral-900">{total}</p>
            <p className="text-[11px] uppercase tracking-wide text-neutral-400">In flight</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-emerald-600">{stp}%</p>
            <p className="text-[11px] uppercase tracking-wide text-neutral-400">STP rate</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-rose-600">{EXCEPTIONS.length}</p>
            <p className="text-[11px] uppercase tracking-wide text-neutral-400">In repair</p>
          </div>
        </div>
      </header>

      {/* Pipeline board */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col, i) => (
          <div key={col.id} className="relative">
            {i < COLUMNS.length - 1 && (
              <span
                className="absolute -right-2.5 top-6 z-10 hidden text-neutral-300 xl:block"
                aria-hidden
              >
                →
              </span>
            )}
            <div className={`border border-neutral-200 border-t-2 bg-white ${COLUMN_TINT[col.id]}`}>
              <div className="border-b border-neutral-100 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-900">{col.label}</span>
                  <span className="bg-neutral-100 px-1.5 py-0.5 text-xs font-semibold text-neutral-600">
                    {col.trades.length}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400">{col.hint}</p>
              </div>
              <ul className="space-y-2 p-2">
                {col.trades.map((t) => (
                  <li key={t.id} className="border border-neutral-200 bg-neutral-50/60 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-neutral-400">{t.id}</span>
                      <span className="font-mono text-[11px] text-neutral-400">{t.age}</span>
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-neutral-900">{t.product}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
                      <span>
                        {t.cpty} · {t.notional}
                      </span>
                      {t.auto && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                          STP
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Repair strip */}
      <div className="border border-rose-200 bg-white">
        <div className="flex items-center justify-between border-b border-rose-100 bg-rose-50/60 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-rose-700">
            Repair queue — snagged out of the pipeline
          </span>
          <span className="text-xs text-rose-500">oldest first is a lie; worst first</span>
        </div>
        <ul className="divide-y divide-neutral-100">
          {EXCEPTIONS.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <span
                className={`h-2 w-2 shrink-0 ${e.severity === "high" ? "bg-rose-500" : "bg-amber-400"}`}
                aria-hidden
              />
              <span className="w-20 font-mono text-xs text-neutral-400">{e.id}</span>
              <span className="w-44 text-sm font-medium text-neutral-900">{e.product}</span>
              <span className="flex-1 text-sm text-neutral-600">{e.problem}</span>
              <span className="border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-mono text-[11px] text-neutral-600">
                {e.field}
              </span>
              <span className="w-16 text-right font-mono text-xs text-neutral-400">{e.stuckFor}</span>
              <button
                type="button"
                className="bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700"
              >
                Repair
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
