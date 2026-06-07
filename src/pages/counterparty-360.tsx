import { useMemo, useState } from "react";
import ContextPanel, {
  PanelMetaGrid,
  PanelSection,
} from "../components/patterns/ContextPanel";
import type { Severity } from "../lib/severity-tokens";

export const title = "Counterparty 360";
export const fullWidth = true;

/* Counterparty 360 — directory + docked panel that fans out into tabs.
 * The panel is the page's depth dimension: from one row you can see credit
 * health, live exposure, recent fails, KYC status, and the comms thread —
 * without leaving the list. Tabs inside the panel beat deep-linked subpages
 * when the user needs to compare across counterparties quickly. */

type Rating = "AAA" | "AA+" | "AA" | "AA-" | "A+" | "A" | "A-" | "BBB+" | "BBB" | "BB+";

type LimitLine = {
  product: string;
  limit: number;
  used: number;
};

type ExposureBucket = {
  bucket: string;
  amount: number;
};

type FailRecord = {
  id: string;
  date: string;
  amount: number;
  ccy: string;
  reason: string;
  status: "resolved" | "open";
};

type KycDoc = {
  name: string;
  status: "valid" | "expiring" | "expired" | "missing";
  expires: string | null;
};

type CommsEntry = {
  ts: string;
  channel: "email" | "phone" | "swift" | "note";
  from: string;
  subject: string;
};

type Counterparty = {
  id: string;
  lei: string;
  shortName: string;
  legalName: string;
  domicile: string;
  category: "bank" | "broker" | "fund" | "corporate";
  rating: Rating;
  outlook: "stable" | "negative" | "positive" | "watch";
  totalLimit: number;
  totalUsed: number;
  openExposure: number;
  failsLast30d: number;
  lastTradeAt: string;
  rm: string;
  ccy: string;
  limits: LimitLine[];
  exposure: ExposureBucket[];
  fails: FailRecord[];
  kyc: KycDoc[];
  comms: CommsEntry[];
};

const PARTIES: Counterparty[] = [
  {
    id: "CP-001",
    lei: "7LTWFZYICNSX8D621K86",
    shortName: "GS-LDN",
    legalName: "Goldman Sachs International",
    domicile: "United Kingdom",
    category: "bank",
    rating: "A+",
    outlook: "stable",
    totalLimit: 850_000_000,
    totalUsed: 612_300_000,
    openExposure: 410_220_000,
    failsLast30d: 2,
    lastTradeAt: "2026-05-29T15:01:00Z",
    rm: "A. Tremblay",
    ccy: "USD",
    limits: [
      { product: "Cash equities", limit: 250_000_000, used: 198_400_000 },
      { product: "FX spot", limit: 300_000_000, used: 212_100_000 },
      { product: "Rates", limit: 200_000_000, used: 150_300_000 },
      { product: "Repo", limit: 100_000_000, used: 51_500_000 },
    ],
    exposure: [
      { bucket: "0–1d", amount: 218_400_000 },
      { bucket: "1–7d", amount: 102_900_000 },
      { bucket: "7–30d", amount: 64_100_000 },
      { bucket: "30d+", amount: 24_820_000 },
    ],
    fails: [
      {
        id: "FAIL-22013",
        date: "2026-05-12",
        amount: 2_400_000,
        ccy: "USD",
        reason: "SSI mismatch — wrong custodian",
        status: "resolved",
      },
      {
        id: "FAIL-22087",
        date: "2026-05-27",
        amount: 850_000,
        ccy: "EUR",
        reason: "Late confirmation",
        status: "open",
      },
    ],
    kyc: [
      { name: "ISDA Master", status: "valid", expires: null },
      { name: "AML refresh", status: "valid", expires: "2027-02-14" },
      { name: "W-8BEN-E", status: "expiring", expires: "2026-07-30" },
      { name: "Wolfsberg CBDDQ", status: "valid", expires: "2026-12-01" },
    ],
    comms: [
      { ts: "2026-05-28T16:22:00Z", channel: "email", from: "ops@gs.com", subject: "Re: FAIL-22087 — investigating" },
      { ts: "2026-05-25T09:15:00Z", channel: "phone", from: "Sales coverage", subject: "Q2 flows recap" },
      { ts: "2026-05-19T14:01:00Z", channel: "swift", from: "GS-LDN", subject: "MT535 statement received" },
    ],
  },
  {
    id: "CP-002",
    lei: "RCNB6OTYUAMMP879YW96",
    shortName: "JPM-LDN",
    legalName: "J.P. Morgan Securities plc",
    domicile: "United Kingdom",
    category: "bank",
    rating: "AA-",
    outlook: "stable",
    totalLimit: 1_200_000_000,
    totalUsed: 940_500_000,
    openExposure: 612_800_000,
    failsLast30d: 0,
    lastTradeAt: "2026-05-29T14:42:00Z",
    rm: "A. Tremblay",
    ccy: "USD",
    limits: [
      { product: "Cash equities", limit: 400_000_000, used: 322_000_000 },
      { product: "FX spot", limit: 500_000_000, used: 388_500_000 },
      { product: "Rates", limit: 300_000_000, used: 230_000_000 },
    ],
    exposure: [
      { bucket: "0–1d", amount: 411_000_000 },
      { bucket: "1–7d", amount: 142_200_000 },
      { bucket: "7–30d", amount: 41_600_000 },
      { bucket: "30d+", amount: 18_000_000 },
    ],
    fails: [],
    kyc: [
      { name: "ISDA Master", status: "valid", expires: null },
      { name: "AML refresh", status: "valid", expires: "2027-08-04" },
      { name: "Wolfsberg CBDDQ", status: "valid", expires: "2027-01-10" },
    ],
    comms: [
      { ts: "2026-05-28T11:00:00Z", channel: "note", from: "A. Tremblay", subject: "Q2 review prep — 3 Jun" },
    ],
  },
  {
    id: "CP-003",
    lei: "WUUUUXKQQDZG7CKAPB23",
    shortName: "DB-FRA",
    legalName: "Deutsche Bank AG, Frankfurt",
    domicile: "Germany",
    category: "bank",
    rating: "BBB+",
    outlook: "negative",
    totalLimit: 350_000_000,
    totalUsed: 318_900_000,
    openExposure: 244_100_000,
    failsLast30d: 4,
    lastTradeAt: "2026-05-29T13:18:00Z",
    rm: "K. Hansen",
    ccy: "EUR",
    limits: [
      { product: "Rates", limit: 200_000_000, used: 198_500_000 },
      { product: "Repo", limit: 100_000_000, used: 92_000_000 },
      { product: "FX spot", limit: 50_000_000, used: 28_400_000 },
    ],
    exposure: [
      { bucket: "0–1d", amount: 161_200_000 },
      { bucket: "1–7d", amount: 52_900_000 },
      { bucket: "7–30d", amount: 24_500_000 },
      { bucket: "30d+", amount: 5_500_000 },
    ],
    fails: [
      { id: "FAIL-21788", date: "2026-05-08", amount: 12_000_000, ccy: "EUR", reason: "Stock not delivered", status: "resolved" },
      { id: "FAIL-21923", date: "2026-05-14", amount: 4_400_000, ccy: "EUR", reason: "Price tolerance breach", status: "resolved" },
      { id: "FAIL-22102", date: "2026-05-28", amount: 1_800_000, ccy: "EUR", reason: "Late confirmation", status: "open" },
      { id: "FAIL-22118", date: "2026-05-29", amount: 980_000, ccy: "EUR", reason: "Stock not delivered", status: "open" },
    ],
    kyc: [
      { name: "ISDA Master", status: "valid", expires: null },
      { name: "AML refresh", status: "expiring", expires: "2026-06-15" },
      { name: "Wolfsberg CBDDQ", status: "expired", expires: "2026-04-30" },
    ],
    comms: [
      { ts: "2026-05-28T17:30:00Z", channel: "email", from: "credit@buyside.com", subject: "Rating action — please review" },
      { ts: "2026-05-26T10:11:00Z", channel: "phone", from: "K. Hansen", subject: "Discussed limit reduction" },
    ],
  },
  {
    id: "CP-004",
    lei: "I07HQUE5ZQHMV4JS5612",
    shortName: "CITI-LDN",
    legalName: "Citigroup Global Markets Limited",
    domicile: "United Kingdom",
    category: "bank",
    rating: "A",
    outlook: "stable",
    totalLimit: 600_000_000,
    totalUsed: 312_400_000,
    openExposure: 188_900_000,
    failsLast30d: 1,
    lastTradeAt: "2026-05-29T11:05:00Z",
    rm: "L. Park",
    ccy: "USD",
    limits: [
      { product: "FX spot", limit: 400_000_000, used: 198_200_000 },
      { product: "FX options", limit: 200_000_000, used: 114_200_000 },
    ],
    exposure: [
      { bucket: "0–1d", amount: 121_000_000 },
      { bucket: "1–7d", amount: 41_900_000 },
      { bucket: "7–30d", amount: 18_700_000 },
      { bucket: "30d+", amount: 7_300_000 },
    ],
    fails: [
      { id: "FAIL-22054", date: "2026-05-22", amount: 700_000, ccy: "USD", reason: "Settlement reversal", status: "resolved" },
    ],
    kyc: [
      { name: "ISDA Master", status: "valid", expires: null },
      { name: "AML refresh", status: "valid", expires: "2027-04-18" },
    ],
    comms: [],
  },
  {
    id: "CP-005",
    lei: "8I5DZWZKVSZI1NUHU748",
    shortName: "BARC-LDN",
    legalName: "Barclays Bank PLC",
    domicile: "United Kingdom",
    category: "bank",
    rating: "A",
    outlook: "stable",
    totalLimit: 500_000_000,
    totalUsed: 240_100_000,
    openExposure: 145_200_000,
    failsLast30d: 0,
    lastTradeAt: "2026-05-29T07:55:00Z",
    rm: "K. Hansen",
    ccy: "GBP",
    limits: [
      { product: "Rates", limit: 300_000_000, used: 142_000_000 },
      { product: "Repo", limit: 200_000_000, used: 98_100_000 },
    ],
    exposure: [
      { bucket: "0–1d", amount: 92_800_000 },
      { bucket: "1–7d", amount: 32_400_000 },
      { bucket: "7–30d", amount: 14_400_000 },
      { bucket: "30d+", amount: 5_600_000 },
    ],
    fails: [],
    kyc: [
      { name: "ISDA Master", status: "valid", expires: null },
      { name: "AML refresh", status: "valid", expires: "2027-09-30" },
    ],
    comms: [
      { ts: "2026-05-29T08:01:00Z", channel: "swift", from: "BARC-LDN", subject: "MT536 received" },
    ],
  },
  {
    id: "CP-006",
    lei: "549300KFLPSXFTBNK319",
    shortName: "BFG-USA",
    legalName: "Bridge Forge Capital LP",
    domicile: "United States",
    category: "fund",
    rating: "BB+",
    outlook: "watch",
    totalLimit: 75_000_000,
    totalUsed: 71_400_000,
    openExposure: 58_900_000,
    failsLast30d: 3,
    lastTradeAt: "2026-05-28T19:44:00Z",
    rm: "L. Park",
    ccy: "USD",
    limits: [
      { product: "Cash equities", limit: 50_000_000, used: 49_100_000 },
      { product: "FX spot", limit: 25_000_000, used: 22_300_000 },
    ],
    exposure: [
      { bucket: "0–1d", amount: 41_400_000 },
      { bucket: "1–7d", amount: 11_200_000 },
      { bucket: "7–30d", amount: 4_100_000 },
      { bucket: "30d+", amount: 2_200_000 },
    ],
    fails: [
      { id: "FAIL-22041", date: "2026-05-18", amount: 1_200_000, ccy: "USD", reason: "Insufficient funds", status: "resolved" },
      { id: "FAIL-22090", date: "2026-05-26", amount: 410_000, ccy: "USD", reason: "Insufficient funds", status: "open" },
      { id: "FAIL-22115", date: "2026-05-28", amount: 980_000, ccy: "USD", reason: "Late settlement", status: "open" },
    ],
    kyc: [
      { name: "Form ADV", status: "valid", expires: "2026-11-04" },
      { name: "AML refresh", status: "expiring", expires: "2026-07-12" },
      { name: "Wolfsberg CBDDQ", status: "missing", expires: null },
    ],
    comms: [
      { ts: "2026-05-29T08:45:00Z", channel: "email", from: "credit@buyside.com", subject: "Limit utilisation 95% — please confirm intent" },
    ],
  },
];

const CATEGORY_TONE: Record<Counterparty["category"], string> = {
  bank: "bg-blue-100 text-blue-700",
  broker: "bg-violet-100 text-violet-700",
  fund: "bg-emerald-100 text-emerald-700",
  corporate: "bg-amber-100 text-amber-800",
};

const OUTLOOK_TONE: Record<Counterparty["outlook"], string> = {
  stable: "text-neutral-500",
  positive: "text-emerald-700",
  negative: "text-rose-700",
  watch: "text-amber-700",
};

type Tab = "credit" | "exposure" | "fails" | "kyc" | "comms";

function severityFor(cp: Counterparty): Severity | undefined {
  const usage = cp.totalUsed / cp.totalLimit;
  if (usage > 0.92 || cp.failsLast30d >= 3) return "benchmark";
  if (usage > 0.8 || cp.failsLast30d > 0) return "required";
  if (cp.outlook === "negative" || cp.outlook === "watch") return "typical";
  return undefined;
}

function fmtNum(n: number, d = 0) {
  return n.toLocaleString("en-GB", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

function fmtCompact(n: number) {
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}b`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return `${n}`;
}

function UsageBar({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  const tone =
    pct > 92 ? "bg-red-500" : pct > 80 ? "bg-amber-400" : "bg-blue-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right font-mono text-[10px] tabular-nums text-neutral-500">
        {pct}%
      </span>
    </div>
  );
}

export default function Counterparty360Page() {
  const [selectedId, setSelectedId] = useState<string | null>(PARTIES[0].id);
  const [tab, setTab] = useState<Tab>("credit");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | Counterparty["category"]>("all");

  const filtered = useMemo(() => {
    return PARTIES.filter((cp) => {
      if (category !== "all" && cp.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          cp.shortName.toLowerCase().includes(q) ||
          cp.legalName.toLowerCase().includes(q) ||
          cp.lei.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [search, category]);

  const selected = useMemo(
    () => PARTIES.find((p) => p.id === selectedId) ?? null,
    [selectedId],
  );

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="flex items-end justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div>
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            Credit & coverage
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
            Counterparty 360
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            Directory left, full context right. Tabs collapse five subpages
            into one panel so you can compare across counterparties without
            losing place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or LEI…"
            className="w-56 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
          />
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as "all" | Counterparty["category"])
            }
            className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-700"
          >
            <option value="all">All categories</option>
            <option value="bank">Banks</option>
            <option value="broker">Brokers</option>
            <option value="fund">Funds</option>
            <option value="corporate">Corporates</option>
          </select>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Directory */}
        <div className="w-[380px] shrink-0 overflow-y-auto border-r border-neutral-200 bg-white">
          {filtered.length === 0 && (
            <div className="px-6 py-10 text-center text-sm text-neutral-500">
              No counterparties match.
            </div>
          )}
          {filtered.map((cp) => {
            const active = cp.id === selectedId;
            const sev = severityFor(cp);
            const dot =
              sev === "benchmark"
                ? "bg-red-500"
                : sev === "required"
                  ? "bg-amber-500"
                  : sev === "typical"
                    ? "bg-yellow-400"
                    : "bg-emerald-500";
            return (
              <button
                key={cp.id}
                type="button"
                onClick={() => setSelectedId(cp.id)}
                className={`block w-full border-b border-neutral-100 px-4 py-3 text-left transition-colors ${
                  active
                    ? "border-l-2 border-l-blue-500 bg-blue-50/60"
                    : "border-l-2 border-l-transparent hover:bg-neutral-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />
                  <span className="truncate text-sm font-semibold text-neutral-900">
                    {cp.shortName}
                  </span>
                  <span
                    className={`ml-auto inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize ${CATEGORY_TONE[cp.category]}`}
                  >
                    {cp.category}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-xs text-neutral-500">
                  {cp.legalName}
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-neutral-600">
                  <span className="font-mono text-neutral-800">{cp.rating}</span>
                  <span className={OUTLOOK_TONE[cp.outlook]}>{cp.outlook}</span>
                  <span className="ml-auto font-mono tabular-nums text-neutral-500">
                    {cp.ccy} {fmtCompact(cp.totalUsed)} / {fmtCompact(cp.totalLimit)}
                  </span>
                </div>
                <div className="mt-1.5">
                  <UsageBar used={cp.totalUsed} total={cp.totalLimit} />
                </div>
                {cp.failsLast30d > 0 && (
                  <div className="mt-2 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                    {cp.failsLast30d} fail{cp.failsLast30d === 1 ? "" : "s"} in 30d
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Panel area */}
        <div className="min-w-0 flex-1">
          {selected ? (
            <ContextPanel
              title={selected.shortName}
              eyebrow={selected.legalName}
              severity={severityFor(selected)}
              actions={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                  >
                    Request limit change
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    Add note
                  </button>
                </div>
              }
            >
              <PanelMetaGrid
                items={[
                  { label: "LEI", value: <span className="font-mono text-xs">{selected.lei}</span> },
                  { label: "Domicile", value: selected.domicile },
                  { label: "Rating", value: `${selected.rating} · ${selected.outlook}` },
                  { label: "Coverage", value: selected.rm },
                ]}
              />

              {/* Tabs */}
              <PanelSection>
                <div className="flex gap-1 overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
                  {(
                    [
                      ["credit", "Credit"],
                      ["exposure", "Exposure"],
                      ["fails", `Fails`, selected.fails.length],
                      ["kyc", "KYC"],
                      ["comms", "Comms", selected.comms.length],
                    ] as const
                  ).map(([k, label, n]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTab(k)}
                      className={`flex-1 rounded px-2 py-1 text-xs font-medium whitespace-nowrap ${
                        tab === k
                          ? "bg-white text-neutral-900 shadow-sm"
                          : "text-neutral-600 hover:text-neutral-900"
                      }`}
                    >
                      {label}
                      {typeof n === "number" && (
                        <span className="ml-1 text-neutral-400">{n}</span>
                      )}
                    </button>
                  ))}
                </div>
              </PanelSection>

              {tab === "credit" && (
                <PanelSection title="Limits by product" last>
                  <ul className="space-y-3">
                    {selected.limits.map((l) => (
                      <li key={l.product}>
                        <div className="mb-1 flex items-baseline justify-between text-xs">
                          <span className="font-medium text-neutral-900">{l.product}</span>
                          <span className="font-mono tabular-nums text-neutral-500">
                            {selected.ccy} {fmtNum(l.used)} / {fmtNum(l.limit)}
                          </span>
                        </div>
                        <UsageBar used={l.used} total={l.limit} />
                      </li>
                    ))}
                  </ul>
                </PanelSection>
              )}

              {tab === "exposure" && (
                <PanelSection title="Open exposure by tenor" last>
                  <div className="space-y-2">
                    {selected.exposure.map((b) => {
                      const max = Math.max(...selected.exposure.map((x) => x.amount));
                      const pct = (b.amount / max) * 100;
                      return (
                        <div key={b.bucket} className="flex items-center gap-3">
                          <span className="w-14 text-xs font-medium text-neutral-700">
                            {b.bucket}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                            <div
                              className="h-full bg-blue-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-20 text-right font-mono text-xs tabular-nums text-neutral-700">
                            {selected.ccy} {fmtCompact(b.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                    Total open exposure{" "}
                    <span className="font-mono font-semibold tabular-nums text-neutral-900">
                      {selected.ccy} {fmtNum(selected.openExposure)}
                    </span>
                  </div>
                </PanelSection>
              )}

              {tab === "fails" && (
                <PanelSection title="Settlement fails — last 30 days" last>
                  {selected.fails.length === 0 ? (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                      Clean. No fails recorded in the last 30 days.
                    </div>
                  ) : (
                    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
                      {selected.fails.map((f) => (
                        <li key={f.id} className="px-3 py-2.5 text-sm">
                          <div className="flex items-baseline justify-between">
                            <span className="font-mono text-xs text-neutral-500">
                              {f.id} · {f.date}
                            </span>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                f.status === "open"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-neutral-100 text-neutral-600"
                              }`}
                            >
                              {f.status}
                            </span>
                          </div>
                          <div className="mt-0.5 text-neutral-800">{f.reason}</div>
                          <div className="mt-0.5 font-mono text-xs tabular-nums text-neutral-600">
                            {f.ccy} {fmtNum(f.amount)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </PanelSection>
              )}

              {tab === "kyc" && (
                <PanelSection title="KYC & onboarding docs" last>
                  <ul className="divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
                    {selected.kyc.map((d) => {
                      const tone =
                        d.status === "valid"
                          ? "bg-emerald-100 text-emerald-700"
                          : d.status === "expiring"
                            ? "bg-amber-100 text-amber-800"
                            : d.status === "expired"
                              ? "bg-red-100 text-red-700"
                              : "bg-neutral-200 text-neutral-600";
                      return (
                        <li
                          key={d.name}
                          className="flex items-center justify-between px-3 py-2 text-sm"
                        >
                          <div>
                            <div className="font-medium text-neutral-900">{d.name}</div>
                            <div className="text-[11px] text-neutral-500">
                              {d.expires ? `Expires ${d.expires}` : "No expiry"}
                            </div>
                          </div>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${tone}`}
                          >
                            {d.status}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </PanelSection>
              )}

              {tab === "comms" && (
                <PanelSection title="Recent communications" last>
                  {selected.comms.length === 0 ? (
                    <div className="text-sm text-neutral-500">
                      No comms logged in the last 30 days.
                    </div>
                  ) : (
                    <ol className="space-y-3">
                      {selected.comms.map((c, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="mt-0.5 inline-flex h-6 w-12 shrink-0 items-center justify-center rounded bg-neutral-100 text-[10px] font-semibold tracking-widest text-neutral-600 uppercase">
                            {c.channel}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-neutral-900">{c.subject}</div>
                            <div className="text-[11px] text-neutral-500">
                              {new Date(c.ts).toLocaleString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              · {c.from}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </PanelSection>
              )}
            </ContextPanel>
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-sm text-neutral-500">
              Select a counterparty to see the full profile.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
