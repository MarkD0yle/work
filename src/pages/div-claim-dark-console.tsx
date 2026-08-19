export const title = "Div Claim - Dark Console";
export const section = "processing";
export const fullWidth = true;

type EventStatus = "Announced" | "Confirmed" | "Paying" | "Paid";
type Market = "US" | "UK" | "DE" | "JP" | "KR";

interface DividendEvent {
  ticker: string;
  name: string;
  market: Market;
  grossRate: string;
  ccy: string;
  exDate: string;
  recordDate: string;
  payDate: string;
  status: EventStatus;
  exToday: boolean;
}

interface MetricTile {
  label: string;
  value: string;
  sub: string;
  points: string;
}

interface HorizonDay {
  label: string;
  count: number;
  isToday: boolean;
}

const EVENTS: DividendEvent[] = [
  { ticker: "MSFT", name: "Microsoft Corp", market: "US", grossRate: "0.7500", ccy: "USD", exDate: "2026-08-19", recordDate: "2026-08-20", payDate: "2026-09-10", status: "Confirmed", exToday: true },
  { ticker: "JNJ", name: "Johnson & Johnson", market: "US", grossRate: "1.2400", ccy: "USD", exDate: "2026-08-19", recordDate: "2026-08-20", payDate: "2026-09-08", status: "Confirmed", exToday: true },
  { ticker: "HSBA", name: "HSBC Holdings plc", market: "UK", grossRate: "0.1000", ccy: "GBP", exDate: "2026-08-19", recordDate: "2026-08-21", payDate: "2026-09-25", status: "Announced", exToday: true },
  { ticker: "SAP", name: "SAP SE", market: "DE", grossRate: "2.2000", ccy: "EUR", exDate: "2026-08-20", recordDate: "2026-08-21", payDate: "2026-08-27", status: "Confirmed", exToday: false },
  { ticker: "8306", name: "Mitsubishi UFJ Fin Grp", market: "JP", grossRate: "25.0000", ccy: "JPY", exDate: "2026-08-21", recordDate: "2026-08-24", payDate: "2026-09-30", status: "Announced", exToday: false },
  { ticker: "005930", name: "Samsung Electronics", market: "KR", grossRate: "361.0000", ccy: "KRW", exDate: "2026-08-21", recordDate: "2026-08-24", payDate: "2026-09-18", status: "Confirmed", exToday: false },
  { ticker: "XOM", name: "Exxon Mobil Corp", market: "US", grossRate: "0.9900", ccy: "USD", exDate: "2026-08-24", recordDate: "2026-08-25", payDate: "2026-09-11", status: "Announced", exToday: false },
  { ticker: "ULVR", name: "Unilever plc", market: "UK", grossRate: "0.4268", ccy: "GBP", exDate: "2026-08-24", recordDate: "2026-08-26", payDate: "2026-09-04", status: "Announced", exToday: false },
  { ticker: "SIE", name: "Siemens AG", market: "DE", grossRate: "4.7000", ccy: "EUR", exDate: "2026-08-25", recordDate: "2026-08-26", payDate: "2026-08-31", status: "Announced", exToday: false },
  { ticker: "7203", name: "Toyota Motor Corp", market: "JP", grossRate: "45.0000", ccy: "JPY", exDate: "2026-08-14", recordDate: "2026-08-17", payDate: "2026-09-02", status: "Paying", exToday: false },
  { ticker: "PG", name: "Procter & Gamble Co", market: "US", grossRate: "1.0065", ccy: "USD", exDate: "2026-08-13", recordDate: "2026-08-14", payDate: "2026-08-18", status: "Paid", exToday: false },
  { ticker: "000660", name: "SK hynix Inc", market: "KR", grossRate: "300.0000", ccy: "KRW", exDate: "2026-08-12", recordDate: "2026-08-13", payDate: "2026-08-28", status: "Paying", exToday: false },
  { ticker: "KO", name: "Coca-Cola Co", market: "US", grossRate: "0.4850", ccy: "USD", exDate: "2026-08-11", recordDate: "2026-08-12", payDate: "2026-08-17", status: "Paid", exToday: false },
];

const METRICS: MetricTile[] = [
  { label: "EVENTS THIS WEEK", value: "23", sub: "+4 vs prior wk", points: "0,22 13,18 26,20 39,14 52,16 65,10 78,12 90,6" },
  { label: "EX-DATE TODAY", value: "6", sub: "3 pending confirm", points: "0,16 13,20 26,12 39,18 52,8 65,14 78,10 90,4" },
  { label: "CONFIRMED", value: "87%", sub: "20 of 23 events", points: "0,24 13,22 26,18 39,16 52,14 65,10 78,8 90,5" },
  { label: "EST. GROSS", value: "$8.2M", sub: "across 5 markets", points: "0,20 13,14 26,18 39,10 52,15 65,8 78,11 90,5" },
];

const HORIZON: HorizonDay[] = [
  { label: "WED 19", count: 6, isToday: true },
  { label: "THU 20", count: 3, isToday: false },
  { label: "FRI 21", count: 5, isToday: false },
  { label: "MON 24", count: 4, isToday: false },
  { label: "TUE 25", count: 2, isToday: false },
  { label: "WED 26", count: 1, isToday: false },
  { label: "THU 27", count: 2, isToday: false },
];

const CALLOUTS: { title: string; body: string }[] = [
  { title: "Takeaway 1", body: "Dark data console + monospace figures → a dense table treatment that maps directly onto the Dividend Events monitoring screen." },
  { title: "Takeaway 2", body: "Ex-date urgency highlight (cyan left edge + brighter row background) → urgency expressed through position and brightness, not hue alone." },
  { title: "Takeaway 3", body: "Sparkline metric tiles → event status summarized as number + trend in one line. A single SVG polyline per tile is enough." },
  { title: "Takeaway 4", body: "7-day horizon mini timeline → upcoming-schedule density shown as bar height, with only the today column accented in cyan." },
];

const RANGES = ["1W", "2W", "1M", "Custom"];

const MARKET_CHIP: Record<Market, string> = {
  US: "bg-sky-950/60 text-sky-300 border-sky-900",
  UK: "bg-indigo-950/60 text-indigo-300 border-indigo-900",
  DE: "bg-emerald-950/60 text-emerald-300 border-emerald-900",
  JP: "bg-rose-950/60 text-rose-300 border-rose-900",
  KR: "bg-violet-950/60 text-violet-300 border-violet-900",
};

const STATUS_BADGE: Record<EventStatus, string> = {
  Announced: "bg-neutral-800/80 text-neutral-300 border-neutral-700",
  Confirmed: "bg-cyan-950/40 text-cyan-300 border-cyan-900",
  Paying: "bg-teal-950/40 text-teal-300 border-teal-900",
  Paid: "bg-neutral-900 text-neutral-500 border-neutral-800",
};

function Sparkline({ points }: { points: string }) {
  return (
    <svg viewBox="0 0 90 28" className="h-7 w-[90px] text-cyan-400" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M11.3 1.05a.75.75 0 0 1 .43.83L10.9 7h4.35a.75.75 0 0 1 .57 1.24l-7 8.25a.75.75 0 0 1-1.31-.62l.84-5.12H4a.75.75 0 0 1-.57-1.24l7-8.25a.75.75 0 0 1 .87-.21Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M6 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h.5A2.5 2.5 0 0 1 18 6.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 2 15.5v-9A2.5 2.5 0 0 1 4.5 4H5V3a1 1 0 0 1 1-1Zm10 7H4v6.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V9Z" />
    </svg>
  );
}

export default function DivClaimDarkConsole() {
  const maxCount = Math.max(...HORIZON.map((d) => d.count));

  return (
    <div className="min-h-screen bg-neutral-950 p-6 font-sans text-xs text-neutral-300">
      <p className="mb-4 text-[11px] uppercase tracking-widest text-neutral-600">
        Pattern study — Dark terminal-style console layout · pattern study
      </p>

      {/* Console header */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4 border border-neutral-800 bg-neutral-900 px-4 py-3">
        <h1 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-100">
          Dividend Events — Global
        </h1>
        <div className="flex items-center gap-px border border-neutral-800 bg-neutral-950 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              className={`px-3 py-1 text-[11px] font-medium tracking-wide ${
                r === "2W" ? "bg-cyan-950/60 text-cyan-300" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-neutral-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
          </span>
          LIVE 09:42:11 EST
        </div>
      </header>

      {/* Metric tiles */}
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {METRICS.map((m) => (
          <div key={m.label} className="flex items-end justify-between border border-neutral-800 bg-neutral-900 p-4">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-widest text-neutral-500">{m.label}</p>
              <p className="font-mono text-2xl tabular-nums text-neutral-100">{m.value}</p>
              <p className="mt-1 flex items-center gap-1 text-[10px] text-teal-400">
                <BoltIcon />
                {m.sub}
              </p>
            </div>
            <Sparkline points={m.points} />
          </div>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
        {/* Events table */}
        <section className="overflow-x-auto border border-neutral-800 bg-neutral-900">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-neutral-800 text-[10px] uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2 font-medium">Ticker</th>
                <th className="px-3 py-2 font-medium">Security</th>
                <th className="px-3 py-2 font-medium">Mkt</th>
                <th className="px-3 py-2 text-right font-medium">Gross Rate</th>
                <th className="px-3 py-2 font-medium">Ccy</th>
                <th className="px-3 py-2 font-medium">Ex-Date</th>
                <th className="px-3 py-2 font-medium">Record Date</th>
                <th className="px-3 py-2 font-medium">Pay Date</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {EVENTS.map((e) => (
                <tr
                  key={e.ticker}
                  className={`border-b border-neutral-800/70 last:border-b-0 ${
                    e.exToday
                      ? "border-l-2 border-l-cyan-400 bg-neutral-800/40 text-neutral-100"
                      : "border-l-2 border-l-transparent hover:bg-neutral-800/20"
                  }`}
                >
                  <td className="px-3 py-2 font-mono font-semibold text-cyan-300">{e.ticker}</td>
                  <td className="px-3 py-2 text-neutral-400">{e.name}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block border px-1.5 py-0.5 text-[10px] font-medium ${MARKET_CHIP[e.market]}`}>
                      {e.market}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{e.grossRate}</td>
                  <td className="px-3 py-2 font-mono text-neutral-400">{e.ccy}</td>
                  <td className={`px-3 py-2 font-mono tabular-nums ${e.exToday ? "text-cyan-300" : ""}`}>{e.exDate}</td>
                  <td className="px-3 py-2 font-mono tabular-nums text-neutral-400">{e.recordDate}</td>
                  <td className="px-3 py-2 font-mono tabular-nums text-neutral-400">{e.payDate}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[e.status]}`}>
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Upcoming ex-dates horizon */}
        <aside className="border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-neutral-500">
            <CalendarIcon />
            Upcoming Ex-Dates · 7D
          </h2>
          <div className="flex h-28 items-end gap-2">
            {HORIZON.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                <span className={`font-mono text-[10px] tabular-nums ${d.isToday ? "text-cyan-300" : "text-neutral-500"}`}>
                  {d.count}
                </span>
                <div
                  className={`w-full ${d.isToday ? "bg-cyan-400" : "bg-neutral-700"}`}
                  style={{ height: `${(d.count / maxCount) * 72 + 6}px` }}
                />
                <span className={`text-[9px] tracking-wide ${d.isToday ? "text-cyan-300" : "text-neutral-600"}`}>
                  {d.label}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-neutral-800 pt-2 font-mono text-[10px] text-neutral-500">
            TODAY = WED 19 AUG · 6 EVENTS
          </p>
        </aside>
      </div>

      {/* Korean annotation callouts */}
      <section className="mt-4 grid gap-3 md:grid-cols-2">
        {CALLOUTS.map((c) => (
          <div key={c.title} className="border border-neutral-800 border-l-2 border-l-amber-400 bg-neutral-900 p-4">
            <p className="mb-1 text-[11px] font-semibold text-amber-300">{c.title}</p>
            <p className="leading-relaxed text-neutral-400">{c.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
