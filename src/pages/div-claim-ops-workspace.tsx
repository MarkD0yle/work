export const title = "Div Claim - Ops Workspace";
export const section = "processing";
export const fullWidth = true;

type ClaimStatus = "break" | "pending" | "matched";

type Claim = {
  id: string;
  ticker: string;
  event: string;
  counterparty: string;
  payDate: string;
  expected: number;
  received: number;
  age: number;
  status: ClaimStatus;
};

type Kpi = {
  label: string;
  value: string;
  delta: string;
  dir: "up" | "down";
  tone: "pos" | "neg" | "neutral";
};

type AuditEntry = { time: string; actor: string; action: string };

const KPIS: Kpi[] = [
  { label: "Total Expected", value: "$12.4M", delta: "+2.1%", dir: "up", tone: "neutral" },
  { label: "Received", value: "$11.8M", delta: "+1.4%", dir: "up", tone: "neutral" },
  { label: "Open Breaks", value: "14", delta: "+3", dir: "up", tone: "neg" },
  { label: "Aged > 5d", value: "3", delta: "-1", dir: "down", tone: "pos" },
  { label: "Auto-Matched", value: "92%", delta: "+0.8%", dir: "up", tone: "pos" },
];

const CLAIMS: Claim[] = [
  { id: "CLM-24-0917", ticker: "NVDA", event: "NVIDIA Corp — Cash Div", counterparty: "GS Intl", payDate: "2026-08-12", expected: 482_500, received: 421_180, age: 7, status: "break" },
  { id: "CLM-24-0921", ticker: "AAPL", event: "Apple Inc — Cash Div", counterparty: "MS & Co", payDate: "2026-08-13", expected: 318_000, received: 286_200, age: 6, status: "break" },
  { id: "CLM-24-0934", ticker: "JNJ", event: "Johnson & Johnson — Cash Div", counterparty: "Citi GM", payDate: "2026-08-14", expected: 205_750, received: 174_887, age: 5, status: "break" },
  { id: "CLM-24-0940", ticker: "XOM", event: "Exxon Mobil — Cash Div", counterparty: "BofA Sec", payDate: "2026-08-15", expected: 156_400, received: 148_580, age: 4, status: "break" },
  { id: "CLM-24-0952", ticker: "KO", event: "Coca-Cola Co — Cash Div", counterparty: "UBS Sec", payDate: "2026-08-17", expected: 98_250, received: 93_337, age: 2, status: "break" },
  { id: "CLM-24-0958", ticker: "PG", event: "Procter & Gamble — Cash Div", counterparty: "GS Intl", payDate: "2026-08-18", expected: 84_600, received: 0, age: 1, status: "pending" },
  { id: "CLM-24-0961", ticker: "MSFT", event: "Microsoft Corp — Cash Div", counterparty: "JPMS", payDate: "2026-08-18", expected: 264_300, received: 0, age: 1, status: "pending" },
  { id: "CLM-24-0902", ticker: "HD", event: "Home Depot — Cash Div", counterparty: "MS & Co", payDate: "2026-08-11", expected: 142_800, received: 142_800, age: 8, status: "matched" },
  { id: "CLM-24-0905", ticker: "PEP", event: "PepsiCo Inc — Cash Div", counterparty: "Citi GM", payDate: "2026-08-11", expected: 76_500, received: 76_500, age: 8, status: "matched" },
  { id: "CLM-24-0911", ticker: "MRK", event: "Merck & Co — Cash Div", counterparty: "BofA Sec", payDate: "2026-08-12", expected: 118_240, received: 118_240, age: 7, status: "matched" },
  { id: "CLM-24-0928", ticker: "CVX", event: "Chevron Corp — Cash Div", counterparty: "UBS Sec", payDate: "2026-08-14", expected: 187_920, received: 187_920, age: 5, status: "matched" },
];

const AUDIT: AuditEntry[] = [
  { time: "08-19 09:42", actor: "SYS·RECON", action: "Break flagged — received vs expected variance 12.7%" },
  { time: "08-18 16:05", actor: "j.park", action: "Assigned to APAC income desk, priority HIGH" },
  { time: "08-18 14:31", actor: "SYS·FEED", action: "SWIFT MT566 received from GS Intl" },
];

const SELECTED = CLAIMS[0];

const usd = (n: number): string =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const RAIL: Record<ClaimStatus, string> = {
  break: "bg-red-600",
  pending: "bg-amber-500",
  matched: "bg-emerald-600",
};

const BADGE: Record<ClaimStatus, string> = {
  break: "bg-red-50 text-red-700 border-red-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  matched: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const STATUS_LABEL: Record<ClaimStatus, string> = { break: "BREAK", pending: "PENDING", matched: "MATCHED" };

function ArrowIcon({ dir }: { dir: "up" | "down" }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
      {dir === "up" ? (
        <path fillRule="evenodd" d="M10 4l5 6h-3v6H8v-6H5l5-6z" clipRule="evenodd" />
      ) : (
        <path fillRule="evenodd" d="M10 16l-5-6h3V4h4v6h3l-5 6z" clipRule="evenodd" />
      )}
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-slate-400">
      <path fillRule="evenodd" d="M8.5 3a5.5 5.5 0 013.916 9.362l3.61 3.61-1.06 1.06-3.61-3.609A5.5 5.5 0 118.5 3zm0 1.5a4 4 0 100 8 4 4 0 000-8z" clipRule="evenodd" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
      <path d="M5.28 4.22L10 8.94l4.72-4.72 1.06 1.06L11.06 10l4.72 4.72-1.06 1.06L10 11.06l-4.72 4.72-1.06-1.06L8.94 10 4.22 5.28l1.06-1.06z" />
    </svg>
  );
}

function ColumnsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M3 4h4v12H3V4zm5 0h4v12H8V4zm5 0h4v12h-4V4z" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M10 3l4 4h-3v6H9V7H6l4-4zM4 15h12v2H4v-2z" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="mt-px h-3.5 w-3.5 shrink-0 text-amber-600">
      <path fillRule="evenodd" d="M10 2a8 8 0 110 16 8 8 0 010-16zm-1 6h2v7H9V8zm0-3h2v2H9V5z" clipRule="evenodd" />
    </svg>
  );
}

function Callout({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-1.5 rounded-sm border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-4 text-amber-800">
      <NoteIcon />
      <span>{text}</span>
    </div>
  );
}

const deltaColor = (tone: Kpi["tone"]): string =>
  tone === "neg" ? "text-red-600" : tone === "pos" ? "text-emerald-600" : "text-slate-500";

export default function DivClaimOpsWorkspace() {
  const gap = SELECTED.expected - SELECTED.received;
  const gross = 567_650;
  const tax = gross - SELECTED.expected;

  return (
    <div className="min-h-screen bg-gray-50 text-xs text-slate-800">
      {/* Navy chrome header */}
      <header className="flex items-center justify-between bg-slate-800 px-4 py-2 text-white">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-wide">Asset Servicing Workspace</span>
          <span className="rounded-sm bg-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-300">Income · Dividend Claims</span>
        </div>
        <span className="text-[10px] text-slate-400">Institutional ops workspace layout · pattern study</span>
      </header>

      <div className="space-y-3 p-4">
        {/* KPI strip */}
        <div className="grid grid-cols-5 gap-2">
          {KPIS.map((k) => (
            <div key={k.label} className="border border-slate-200 bg-white px-3 py-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{k.label}</div>
              <div className="mt-0.5 flex items-baseline justify-between">
                <span className="text-lg font-semibold tabular-nums text-slate-900">{k.value}</span>
                <span className={`flex items-center gap-0.5 tabular-nums ${deltaColor(k.tone)}`}>
                  <ArrowIcon dir={k.dir} />
                  {k.delta}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Callout text="Takeaway: KPI strip → settlement status summary (Expected / Received / Breaks compressed into one line)" />
          <Callout text="Takeaway: dense 12px grid → information density tuned for operators handling bulk data" />
        </div>

        {/* Filter / command bar */}
        <div className="flex items-center gap-2 border border-slate-200 bg-white px-2 py-1.5">
          <div className="flex h-7 w-64 items-center gap-1.5 border border-slate-300 bg-white px-2">
            <SearchIcon />
            <span className="text-slate-400">Search claim ID, ticker, counterparty…</span>
          </div>
          <span className="flex h-7 items-center gap-1 border border-slate-300 bg-slate-100 px-2 font-medium">
            Market: US <XIcon />
          </span>
          <span className="flex h-7 items-center gap-1 border border-red-200 bg-red-50 px-2 font-medium text-red-700">
            Status: Break <XIcon />
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" className="flex h-7 items-center gap-1 border border-slate-300 bg-white px-2 font-medium hover:bg-slate-50">
              <ColumnsIcon /> Columns
            </button>
            <button type="button" className="flex h-7 items-center gap-1 border border-slate-300 bg-white px-2 font-medium hover:bg-slate-50">
              <ExportIcon /> Export
            </button>
          </div>
        </div>

        {/* Master-detail */}
        <div className="flex items-start gap-3">
          {/* Claims grid */}
          <div className="min-w-0 flex-1 border border-slate-200 bg-white">
            <table className="w-full border-collapse tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="w-1 p-0" />
                  <th className="px-2 py-1.5 font-medium">Claim ID</th>
                  <th className="px-2 py-1.5 font-medium">Event</th>
                  <th className="px-2 py-1.5 font-medium">Counterparty</th>
                  <th className="px-2 py-1.5 font-medium">Pay Date</th>
                  <th className="px-2 py-1.5 text-right font-medium">Expected</th>
                  <th className="px-2 py-1.5 text-right font-medium">Received</th>
                  <th className="px-2 py-1.5 text-right font-medium">Difference</th>
                  <th className="px-2 py-1.5 text-right font-medium">Age</th>
                  <th className="px-2 py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {CLAIMS.map((c) => {
                  const diff = c.expected - c.received;
                  const isSelected = c.id === SELECTED.id;
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-slate-100 ${isSelected ? "bg-blue-50/70" : "hover:bg-slate-50"}`}
                    >
                      <td className={`w-1 p-0 ${RAIL[c.status]}`} style={{ width: 3 }} />
                      <td className="px-2 py-1.5 font-medium text-slate-900">{c.id}</td>
                      <td className="px-2 py-1.5">
                        <span className="font-semibold text-slate-900">{c.ticker}</span>
                        <span className="ml-1.5 text-slate-500">{c.event}</span>
                      </td>
                      <td className="px-2 py-1.5">{c.counterparty}</td>
                      <td className="px-2 py-1.5 text-slate-600">{c.payDate}</td>
                      <td className="px-2 py-1.5 text-right">{usd(c.expected)}</td>
                      <td className="px-2 py-1.5 text-right">{c.received === 0 ? "—" : usd(c.received)}</td>
                      <td className={`px-2 py-1.5 text-right font-semibold ${diff !== 0 && c.status === "break" ? "bg-red-50 text-red-700" : "text-slate-400"}`}>
                        {diff === 0 ? "0" : `(${usd(diff)})`}
                      </td>
                      <td className={`px-2 py-1.5 text-right ${c.age > 5 ? "font-semibold text-amber-700" : ""}`}>{c.age}d</td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-block border px-1.5 py-px text-[10px] font-semibold tracking-wide ${BADGE[c.status]}`}>
                          {STATUS_LABEL[c.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
              11 of 214 claims · sorted: breaks first, then age desc
            </div>
          </div>

          {/* Detail panel */}
          <aside className="w-[340px] shrink-0 space-y-0 border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-800 px-3 py-2 text-white">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{SELECTED.id}</span>
                <span className="border border-red-400/40 bg-red-500/20 px-1.5 py-px text-[10px] font-semibold text-red-200">BREAK · 7d</span>
              </div>
              <div className="mt-0.5 text-[11px] text-slate-300">{SELECTED.ticker} · {SELECTED.event}</div>
            </div>

            <dl className="divide-y divide-slate-100 px-3 py-1">
              {[
                ["Counterparty", SELECTED.counterparty],
                ["Pay date", SELECTED.payDate],
                ["Position", "125,000 sh @ $5.05/sh"],
                ["Tax regime", "US NRA 15% treaty rate"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-medium text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>

            {/* Reconciliation block */}
            <div className="border-t border-slate-200 px-3 py-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Reconciliation</div>
              <div className="mt-1.5 space-y-1 tabular-nums">
                <div className="flex justify-between"><span className="text-slate-600">Gross entitlement</span><span>{usd(gross)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Tax withheld (15%)</span><span>({usd(tax)})</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold"><span>Net expected</span><span>{usd(SELECTED.expected)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Received (MT566)</span><span>{usd(SELECTED.received)}</span></div>
                <div className="mt-1 flex justify-between border border-red-200 bg-red-50 px-2 py-1.5 font-semibold text-red-700">
                  <span>Break amount</span><span>({usd(gap)})</span>
                </div>
                <div className="text-[10px] text-slate-500">Probable cause: withheld at 30% statutory vs 15% treaty rate</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-1.5 border-t border-slate-200 px-3 py-2">
              <button type="button" className="h-7 flex-1 bg-slate-800 px-2 font-medium text-white hover:bg-slate-700">Raise claim</button>
              <button type="button" className="h-7 flex-1 border border-slate-800 px-2 font-medium text-slate-800 hover:bg-slate-50">Write off</button>
              <button type="button" className="h-7 flex-1 border border-slate-300 px-2 font-medium text-slate-600 hover:bg-slate-50">Assign</button>
            </div>

            {/* Audit trail */}
            <div className="border-t border-slate-200 px-3 py-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Audit Trail</div>
              <ul className="mt-1.5 space-y-1.5">
                {AUDIT.map((a) => (
                  <li key={a.time} className="flex gap-2">
                    <span className="w-20 shrink-0 tabular-nums text-slate-400">{a.time}</span>
                    <span><span className="font-medium text-slate-700">{a.actor}</span> · {a.action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Callout text="Takeaway: exception-first sorting + 3px left color rail → surface Breaks at the top of the Dividend Claim screen" />
          <Callout text="Takeaway: master-detail + calculation breakdown (Gross → Tax → Net vs Received) → trace the cause of each break" />
        </div>
      </div>
    </div>
  );
}
