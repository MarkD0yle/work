import { useEffect, useMemo, useRef, useState } from "react";
import ContextPanel, {
  PanelMetaGrid,
  PanelSection,
} from "../components/patterns/ContextPanel";
import { ConfirmDialog } from "../components/patterns/Modal";
import type { Severity } from "../lib/severity-tokens";

export const title = "Trade Investigation";
export const fullWidth = true;

/* Trade Investigation Desk — pairs a dense row list with a docked context
 * panel for working a queue of trade breaks. Selecting a row opens the panel;
 * j / k walks through rows without leaving the keyboard. The panel itself has
 * tabbed depth (Allocations / Fees / Audit) so an analyst can ladder through
 * a dozen trades without losing place. */

type TradeStatus = "open" | "investigating" | "amended" | "cancelled";

type Allocation = {
  account: string;
  qty: number;
  fillPx: number;
  flag?: "mismatch" | "partial";
};

type Fee = {
  label: string;
  amount: number;
  ccy: string;
  source: "broker" | "venue" | "internal";
};

type AuditEntry = {
  ts: string;
  actor: string;
  message: string;
  kind: "system" | "user" | "external";
};

type Trade = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  ccy: string;
  notional: number;
  trader: string;
  counterparty: string;
  venue: string;
  status: TradeStatus;
  tradedAt: string;
  flagged: string | null;
  allocations: Allocation[];
  fees: Fee[];
  audit: AuditEntry[];
};

const TRADES: Trade[] = [
  {
    id: "TRD-10293841",
    symbol: "VOD.L",
    side: "BUY",
    qty: 250_000,
    price: 78.42,
    ccy: "GBP",
    notional: 19_605_000,
    trader: "C. Yates",
    counterparty: "GS-LDN",
    venue: "LSE",
    status: "investigating",
    tradedAt: "2026-05-29T09:14:22Z",
    flagged: "Allocation total off by 1,500 vs fill",
    allocations: [
      { account: "FUND-EQ-A", qty: 120_000, fillPx: 78.42 },
      { account: "FUND-EQ-B", qty: 80_000, fillPx: 78.42 },
      { account: "FUND-EQ-C", qty: 48_500, fillPx: 78.42, flag: "mismatch" },
    ],
    fees: [
      { label: "Broker commission", amount: 980.25, ccy: "GBP", source: "broker" },
      { label: "Stamp duty", amount: 98_025.0, ccy: "GBP", source: "venue" },
      { label: "Soft commission rebate", amount: -210.0, ccy: "GBP", source: "internal" },
    ],
    audit: [
      { ts: "09:14:22", actor: "OMS", message: "Order acknowledged by GS-LDN", kind: "system" },
      { ts: "09:14:24", actor: "OMS", message: "Filled 250,000 @ 78.42", kind: "system" },
      { ts: "09:31:08", actor: "C. Yates", message: "Allocated to three funds", kind: "user" },
      { ts: "09:32:12", actor: "Recon", message: "Allocation total ≠ fill qty", kind: "system" },
    ],
  },
  {
    id: "TRD-10293842",
    symbol: "AAPL",
    side: "SELL",
    qty: 18_500,
    price: 184.21,
    ccy: "USD",
    notional: 3_407_885,
    trader: "M. Doyle",
    counterparty: "MS-NYC",
    venue: "NASDAQ",
    status: "open",
    tradedAt: "2026-05-29T13:02:11Z",
    flagged: null,
    allocations: [{ account: "FUND-US-A", qty: 18_500, fillPx: 184.21 }],
    fees: [
      { label: "Broker commission", amount: 92.5, ccy: "USD", source: "broker" },
      { label: "SEC fee", amount: 0.85, ccy: "USD", source: "venue" },
    ],
    audit: [
      { ts: "13:02:11", actor: "OMS", message: "Order acknowledged by MS-NYC", kind: "system" },
      { ts: "13:02:13", actor: "OMS", message: "Filled 18,500 @ 184.21", kind: "system" },
    ],
  },
  {
    id: "TRD-10293843",
    symbol: "BUND 02/35",
    side: "BUY",
    qty: 50_000_000,
    price: 99.21,
    ccy: "EUR",
    notional: 49_605_000,
    trader: "K. Hansen",
    counterparty: "DB-FRA",
    venue: "OTC",
    status: "investigating",
    tradedAt: "2026-05-29T08:48:01Z",
    flagged: "Broker price differs from venue print by 0.04",
    allocations: [
      { account: "FUND-FI-EUR", qty: 30_000_000, fillPx: 99.21 },
      { account: "FUND-FI-GLB", qty: 20_000_000, fillPx: 99.21 },
    ],
    fees: [
      { label: "Counterparty markup", amount: 12_400, ccy: "EUR", source: "broker" },
    ],
    audit: [
      { ts: "08:48:01", actor: "Voice", message: "RFQ filled via DB-FRA", kind: "external" },
      { ts: "08:51:33", actor: "OMS", message: "Trade captured", kind: "system" },
      { ts: "09:02:09", actor: "Pricing", message: "Mid price 99.17 — variance flagged", kind: "system" },
    ],
  },
  {
    id: "TRD-10293844",
    symbol: "BP.L",
    side: "BUY",
    qty: 410_000,
    price: 461.5,
    ccy: "GBp",
    notional: 1_892_150,
    trader: "C. Yates",
    counterparty: "JPM-LDN",
    venue: "LSE",
    status: "amended",
    tradedAt: "2026-05-29T10:18:55Z",
    flagged: null,
    allocations: [
      { account: "FUND-EQ-A", qty: 250_000, fillPx: 461.5 },
      { account: "FUND-EQ-B", qty: 160_000, fillPx: 461.5 },
    ],
    fees: [
      { label: "Broker commission", amount: 75.69, ccy: "GBP", source: "broker" },
      { label: "Stamp duty", amount: 9_460.75, ccy: "GBP", source: "venue" },
    ],
    audit: [
      { ts: "10:18:55", actor: "OMS", message: "Filled 410,000 @ 461.50", kind: "system" },
      { ts: "10:42:11", actor: "C. Yates", message: "Amended counterparty (was BARC-LDN)", kind: "user" },
    ],
  },
  {
    id: "TRD-10293845",
    symbol: "EURUSD",
    side: "SELL",
    qty: 25_000_000,
    price: 1.0824,
    ccy: "USD",
    notional: 27_060_000,
    trader: "L. Park",
    counterparty: "CITI-LDN",
    venue: "FXALL",
    status: "open",
    tradedAt: "2026-05-29T11:05:09Z",
    flagged: null,
    allocations: [{ account: "FUND-FX-OV", qty: 25_000_000, fillPx: 1.0824 }],
    fees: [],
    audit: [
      { ts: "11:05:09", actor: "FXALL", message: "Fill confirmed @ 1.0824", kind: "external" },
    ],
  },
  {
    id: "TRD-10293846",
    symbol: "TSLA",
    side: "SELL",
    qty: 8_200,
    price: 217.45,
    ccy: "USD",
    notional: 1_783_090,
    trader: "M. Doyle",
    counterparty: "GS-NYC",
    venue: "NASDAQ",
    status: "investigating",
    tradedAt: "2026-05-29T14:38:44Z",
    flagged: "Counterparty hasn't confirmed",
    allocations: [{ account: "FUND-US-B", qty: 8_200, fillPx: 217.45 }],
    fees: [
      { label: "Broker commission", amount: 41.0, ccy: "USD", source: "broker" },
    ],
    audit: [
      { ts: "14:38:44", actor: "OMS", message: "Order sent to GS-NYC", kind: "system" },
      { ts: "14:38:45", actor: "OMS", message: "Filled 8,200 @ 217.45", kind: "system" },
      { ts: "14:55:00", actor: "Affirm", message: "No counterparty affirmation after 15m", kind: "system" },
    ],
  },
  {
    id: "TRD-10293847",
    symbol: "GILT 25/40",
    side: "BUY",
    qty: 12_000_000,
    price: 92.05,
    ccy: "GBP",
    notional: 11_046_000,
    trader: "K. Hansen",
    counterparty: "BARC-LDN",
    venue: "OTC",
    status: "open",
    tradedAt: "2026-05-29T07:55:12Z",
    flagged: null,
    allocations: [{ account: "FUND-FI-GBP", qty: 12_000_000, fillPx: 92.05 }],
    fees: [],
    audit: [
      { ts: "07:55:12", actor: "Voice", message: "Trade booked manually", kind: "user" },
    ],
  },
  {
    id: "TRD-10293848",
    symbol: "HSBA.L",
    side: "SELL",
    qty: 320_000,
    price: 642.1,
    ccy: "GBp",
    notional: 2_054_720,
    trader: "C. Yates",
    counterparty: "UBS-LDN",
    venue: "LSE",
    status: "cancelled",
    tradedAt: "2026-05-29T12:11:30Z",
    flagged: "Cancelled — trader error",
    allocations: [],
    fees: [],
    audit: [
      { ts: "12:11:30", actor: "OMS", message: "Order acknowledged", kind: "system" },
      { ts: "12:11:38", actor: "C. Yates", message: "Cancelled — wrong side", kind: "user" },
    ],
  },
];

const GRID_COLS = "110px 70px 50px 90px 110px minmax(220px, 1fr) 100px";
const GRID_MIN = 720;

const STATUS_TONE: Record<TradeStatus, string> = {
  open: "bg-blue-100 text-blue-700",
  investigating: "bg-amber-100 text-amber-800",
  amended: "bg-violet-100 text-violet-700",
  cancelled: "bg-neutral-200 text-neutral-600",
};

function severityForTrade(t: Trade): Severity | undefined {
  if (t.status === "investigating") return "required";
  if (t.status === "cancelled") return "expected_absence";
  return undefined;
}

function fmtNum(n: number, d = 0) {
  return n.toLocaleString("en-GB", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

function fmtMoney(n: number, ccy: string) {
  const sign = n < 0 ? "-" : "";
  return `${sign}${ccy} ${fmtNum(Math.abs(n), 2)}`;
}

type Tab = "alloc" | "fees" | "audit";

export default function TradeInvestigationPage() {
  const [selectedId, setSelectedId] = useState<string | null>(TRADES[0].id);
  const [tab, setTab] = useState<Tab>("alloc");
  const [filter, setFilter] = useState<"all" | "investigating" | "open">("all");
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [trades, setTrades] = useState(TRADES);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return trades;
    return trades.filter((t) => t.status === filter);
  }, [trades, filter]);

  const selected = useMemo(
    () => trades.find((t) => t.id === selectedId) ?? null,
    [trades, selectedId],
  );

  // j/k navigation through the visible list
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.key !== "j" && e.key !== "k") return;
      const idx = filtered.findIndex((t) => t.id === selectedId);
      if (idx === -1) {
        if (filtered[0]) setSelectedId(filtered[0].id);
        return;
      }
      const next = e.key === "j" ? idx + 1 : idx - 1;
      const target = filtered[Math.max(0, Math.min(filtered.length - 1, next))];
      if (target) setSelectedId(target.id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selectedId]);

  function resolveSelected() {
    if (!selected) return;
    setTrades((prev) =>
      prev.map((t) =>
        t.id === selected.id
          ? {
              ...t,
              status: "open",
              flagged: null,
              audit: [
                ...t.audit,
                {
                  ts: new Date().toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  actor: "You",
                  message: "Marked break resolved",
                  kind: "user",
                },
              ],
            }
          : t,
      ),
    );
    setCloseConfirm(false);
  }

  const counts = useMemo(() => {
    return {
      all: trades.length,
      investigating: trades.filter((t) => t.status === "investigating").length,
      open: trades.filter((t) => t.status === "open").length,
    };
  }, [trades]);

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="flex items-end justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div>
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            Middle office
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
            Trade Investigation Desk
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            Walk the queue with{" "}
            <kbd className="rounded border border-neutral-300 bg-neutral-50 px-1 font-mono text-[10px]">
              j
            </kbd>{" "}
            /{" "}
            <kbd className="rounded border border-neutral-300 bg-neutral-50 px-1 font-mono text-[10px]">
              k
            </kbd>
            . Panel stays pinned so you don't lose place between breaks.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white p-0.5">
          {(
            [
              ["all", "All"],
              ["investigating", "Investigating"],
              ["open", "Open"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                filter === k
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {label}{" "}
              <span
                className={`ml-1 ${filter === k ? "text-neutral-300" : "text-neutral-400"}`}
              >
                {counts[k]}
              </span>
            </button>
          ))}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Trade list */}
        <div className="min-w-0 flex-1 overflow-hidden p-4">
          <div className="flex h-full flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <div className="min-h-0 flex-1 overflow-auto">
            <div
              className="grid sticky top-0 z-10 gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase"
              style={{ gridTemplateColumns: GRID_COLS, minWidth: GRID_MIN }}
            >
              <div>Trade ID</div>
              <div>Symbol</div>
              <div>Side</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Notional</div>
              <div>Counterparty · Trader</div>
              <div className="text-right">Status</div>
            </div>
            <div ref={listRef}>
              {filtered.map((t) => {
                const active = t.id === selectedId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    style={{ gridTemplateColumns: GRID_COLS, minWidth: GRID_MIN }}
                    className={`grid w-full gap-3 border-b border-neutral-100 px-4 py-2.5 text-left text-sm transition-colors ${
                      active
                        ? "bg-blue-50/60"
                        : "bg-white hover:bg-neutral-50"
                    } ${active ? "border-l-2 border-l-blue-500" : "border-l-2 border-l-transparent"}`}
                  >
                    <div className="truncate font-mono text-xs text-neutral-700">
                      {t.id}
                    </div>
                    <div className="truncate font-semibold tracking-tight text-neutral-900">
                      {t.symbol}
                    </div>
                    <div
                      className={`text-xs font-semibold ${t.side === "BUY" ? "text-emerald-700" : "text-rose-700"}`}
                    >
                      {t.side}
                    </div>
                    <div className="text-right font-mono tabular-nums text-neutral-700">
                      {fmtNum(t.qty)}
                    </div>
                    <div className="text-right font-mono tabular-nums text-neutral-700">
                      {t.ccy} {fmtNum(t.notional)}
                    </div>
                    <div className="min-w-0 truncate text-neutral-700">
                      <span className="font-medium">{t.counterparty}</span>{" "}
                      <span className="text-neutral-400">·</span>{" "}
                      <span className="text-neutral-500">{t.trader}</span>
                      {t.flagged && (
                        <span className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          {t.flagged}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_TONE[t.status]}`}
                      >
                        {t.status}
                      </span>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-6 py-10 text-center text-sm text-neutral-500">
                  No trades match this filter.
                </div>
              )}
            </div>
            </div>
          </div>
        </div>

        {/* Context panel */}
        {selected && (
          <div className="shrink-0" style={{ width: 380 }}>
            <ContextPanel
              title={`${selected.symbol} · ${selected.side}`}
              eyebrow={selected.id}
              severity={severityForTrade(selected)}
              onClose={() => setSelectedId(null)}
              actions={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCloseConfirm(true)}
                    disabled={selected.status !== "investigating"}
                    className="flex-1 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-300"
                  >
                    Resolve break
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    Hand off
                  </button>
                </div>
              }
            >
              <PanelMetaGrid
                items={[
                  {
                    label: "Notional",
                    value: `${selected.ccy} ${fmtNum(selected.notional)}`,
                  },
                  { label: "Price", value: fmtNum(selected.price, 4) },
                  { label: "Venue", value: selected.venue },
                  { label: "Counterparty", value: selected.counterparty },
                ]}
              />

              {selected.flagged && (
                <PanelSection>
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <div className="text-[10px] font-semibold tracking-widest uppercase">
                      Flagged
                    </div>
                    <div className="mt-0.5">{selected.flagged}</div>
                  </div>
                </PanelSection>
              )}

              {/* Tab strip */}
              <PanelSection>
                <div className="flex gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
                  {(
                    [
                      ["alloc", "Allocations", selected.allocations.length],
                      ["fees", "Fees", selected.fees.length],
                      ["audit", "Audit", selected.audit.length],
                    ] as const
                  ).map(([k, label, n]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTab(k)}
                      className={`flex-1 rounded px-2 py-1 text-xs font-medium ${
                        tab === k
                          ? "bg-white text-neutral-900 shadow-sm"
                          : "text-neutral-600 hover:text-neutral-900"
                      }`}
                    >
                      {label}
                      <span className="ml-1 text-neutral-400">{n}</span>
                    </button>
                  ))}
                </div>
              </PanelSection>

              {tab === "alloc" && (
                <PanelSection title="Allocations" last>
                  {selected.allocations.length === 0 ? (
                    <div className="text-sm text-neutral-500">
                      No allocations recorded.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-neutral-200">
                      <div
                        className="grid gap-2 bg-neutral-50 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase"
                        style={{ gridTemplateColumns: "1fr 90px 70px" }}
                      >
                        <div>Account</div>
                        <div className="text-right">Qty</div>
                        <div className="text-right">Fill</div>
                      </div>
                      {selected.allocations.map((a) => (
                        <div
                          key={a.account}
                          style={{ gridTemplateColumns: "1fr 90px 70px" }}
                          className={`grid gap-2 border-t border-neutral-100 px-3 py-1.5 text-xs ${
                            a.flag === "mismatch" ? "bg-red-50" : ""
                          }`}
                        >
                          <div className="font-medium text-neutral-900">
                            {a.account}
                            {a.flag && (
                              <span className="ml-1.5 inline-flex rounded bg-red-100 px-1 py-px text-[10px] font-semibold text-red-700">
                                {a.flag}
                              </span>
                            )}
                          </div>
                          <div className="text-right font-mono tabular-nums text-neutral-700">
                            {fmtNum(a.qty)}
                          </div>
                          <div className="text-right font-mono tabular-nums text-neutral-700">
                            {fmtNum(a.fillPx, 2)}
                          </div>
                        </div>
                      ))}
                      <div
                        className="grid gap-2 border-t border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold"
                        style={{ gridTemplateColumns: "1fr 90px 70px" }}
                      >
                        <div className="text-neutral-500 uppercase tracking-widest text-[10px]">
                          Total
                        </div>
                        <div className="text-right font-mono tabular-nums text-neutral-900">
                          {fmtNum(
                            selected.allocations.reduce((s, a) => s + a.qty, 0),
                          )}
                        </div>
                        <div />
                      </div>
                    </div>
                  )}
                </PanelSection>
              )}

              {tab === "fees" && (
                <PanelSection title="Fees & charges" last>
                  {selected.fees.length === 0 ? (
                    <div className="text-sm text-neutral-500">No fees on this trade.</div>
                  ) : (
                    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
                      {selected.fees.map((f) => (
                        <li
                          key={f.label}
                          className="flex items-center justify-between px-3 py-2 text-sm"
                        >
                          <div>
                            <div className="font-medium text-neutral-900">{f.label}</div>
                            <div className="text-[10px] tracking-widest text-neutral-400 uppercase">
                              {f.source}
                            </div>
                          </div>
                          <div
                            className={`font-mono tabular-nums ${f.amount < 0 ? "text-emerald-700" : "text-neutral-900"}`}
                          >
                            {fmtMoney(f.amount, f.ccy)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </PanelSection>
              )}

              {tab === "audit" && (
                <PanelSection title="Audit trail" last>
                  <ol className="space-y-2.5">
                    {selected.audit.map((e, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="w-12 shrink-0 pt-0.5 font-mono text-xs text-neutral-400">
                          {e.ts}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-neutral-800">{e.message}</div>
                          <div className="text-[10px] tracking-widest text-neutral-400 uppercase">
                            {e.actor} · {e.kind}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </PanelSection>
              )}
            </ContextPanel>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={closeConfirm}
        onClose={() => setCloseConfirm(false)}
        onConfirm={resolveSelected}
        title={`Resolve break on ${selected?.id ?? ""}?`}
        description="This clears the investigation flag and writes an audit entry. The trade itself is unchanged."
        confirmLabel="Resolve"
      />
    </div>
  );
}
