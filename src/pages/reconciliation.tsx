import { useMemo, useState, type ReactNode } from "react";

export const title = "Trade Recon Workbench";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * Model — daily T+0/T+1 reconciliation between our books and the
 * custodian feed. The page is built around moving one break at a
 * time through to resolution before its value-date cut.
 * ------------------------------------------------------------------ */

type BreakKind = "missing" | "duplicate" | "field";
type FieldTag = "price" | "qty" | "settle" | "ssi" | "ccy" | "account";

type Side = "BUY" | "SELL";
type AgingBucket = "intraday" | "t1" | "t2" | "t3plus";

interface BookRecord {
  source: "INTERNAL" | "CUSTODIAN";
  tradeId: string;
  ticker: string;
  side: Side;
  qty: number;
  price: number;
  ccy: string;
  tradeDate: string;
  settleDate: string;
  account: string;
  ssi: string;
  counterparty: string;
  notional: number;
}

interface SuggestedMatch {
  candidateId: string;
  confidence: number;
  reason: string;
}

interface Break {
  id: string;
  kind: BreakKind;
  fieldTags: FieldTag[];
  ageMins: number;
  bucket: AgingBucket;
  internal?: BookRecord;
  custodian?: BookRecord;
  notionalAtRisk: number;
  ccyAtRisk: string;
  owner: string;
  team: "Middle Office" | "Settlements" | "Trade Support" | "Unassigned";
  status: "open" | "investigating" | "pending-cp" | "resolved";
  rootCauseHint: string;
  suggestions: SuggestedMatch[];
  notes: { who: string; at: string; text: string }[];
  escalated: boolean;
}

const BREAKS: Break[] = [
  {
    id: "BRK-2041",
    kind: "field",
    fieldTags: ["price", "qty"],
    ageMins: 18,
    bucket: "intraday",
    notionalAtRisk: 4_810_000,
    ccyAtRisk: "USD",
    owner: "M. Doyle",
    team: "Middle Office",
    status: "investigating",
    rootCauseHint:
      "Allocation split on the desk — child fills not booked back into the parent.",
    escalated: false,
    suggestions: [
      {
        candidateId: "FILL-9921-A",
        confidence: 92,
        reason:
          "Two child fills on the same ticker net to the missing 18,000 shares at the broker average.",
      },
      {
        candidateId: "FILL-9921-B",
        confidence: 64,
        reason:
          "Standalone block at 184.72 — would close price but not quantity.",
      },
    ],
    notes: [
      {
        who: "M. Doyle",
        at: "09:42",
        text: "Desk says it was a worked order — chasing the allocation file from EMS.",
      },
    ],
    internal: {
      source: "INTERNAL",
      tradeId: "INT-77104",
      ticker: "MSFT US",
      side: "BUY",
      qty: 50_000,
      price: 184.70,
      ccy: "USD",
      tradeDate: "2026-05-19",
      settleDate: "2026-05-21",
      account: "FUND-A-EQTY",
      ssi: "DTC-2801",
      counterparty: "JPM Cash Equities",
      notional: 9_235_000,
    },
    custodian: {
      source: "CUSTODIAN",
      tradeId: "CUS-44912",
      ticker: "MSFT US",
      side: "BUY",
      qty: 68_000,
      price: 184.79,
      ccy: "USD",
      tradeDate: "2026-05-19",
      settleDate: "2026-05-21",
      account: "FUND-A-EQTY",
      ssi: "DTC-2801",
      counterparty: "JPM Cash Equities",
      notional: 12_565_720,
    },
  },
  {
    id: "BRK-2042",
    kind: "field",
    fieldTags: ["ssi", "settle"],
    ageMins: 95,
    bucket: "intraday",
    notionalAtRisk: 22_400_000,
    ccyAtRisk: "EUR",
    owner: "R. Shah",
    team: "Settlements",
    status: "pending-cp",
    rootCauseHint:
      "SSI was updated on Friday; the custodian feed still has the prior agent.",
    escalated: true,
    suggestions: [
      {
        candidateId: "SSI-DELTA-EU",
        confidence: 88,
        reason:
          "SSI repo shows EUR agent moved from BNP to SocGen effective 2026-05-16.",
      },
    ],
    notes: [
      {
        who: "R. Shah",
        at: "08:55",
        text: "Raised with custodian — they will refresh by 12:00. Need confirm before EUR cut.",
      },
      {
        who: "T. Bauer",
        at: "10:20",
        text: "Escalated to head of settlements — value-date risk if not refreshed.",
      },
    ],
    internal: {
      source: "INTERNAL",
      tradeId: "INT-77118",
      ticker: "DE BUND 2.4 05/34",
      side: "BUY",
      qty: 22_400_000,
      price: 100.00,
      ccy: "EUR",
      tradeDate: "2026-05-19",
      settleDate: "2026-05-20",
      account: "FUND-B-FI",
      ssi: "SOCGEN-EUR-AGENT",
      counterparty: "Société Générale",
      notional: 22_400_000,
    },
    custodian: {
      source: "CUSTODIAN",
      tradeId: "CUS-44920",
      ticker: "DE BUND 2.4 05/34",
      side: "BUY",
      qty: 22_400_000,
      price: 100.00,
      ccy: "EUR",
      tradeDate: "2026-05-19",
      settleDate: "2026-05-21",
      account: "FUND-B-FI",
      ssi: "BNP-EUR-AGENT",
      counterparty: "Société Générale",
      notional: 22_400_000,
    },
  },
  {
    id: "BRK-2043",
    kind: "missing",
    fieldTags: [],
    ageMins: 42,
    bucket: "intraday",
    notionalAtRisk: 1_180_000,
    ccyAtRisk: "GBP",
    owner: "Unassigned",
    team: "Unassigned",
    status: "open",
    rootCauseHint:
      "Custodian booking — likely a corporate action stock-loan recall not in our book.",
    escalated: false,
    suggestions: [
      {
        candidateId: "SL-RECALL-VOD",
        confidence: 78,
        reason:
          "Stock-loan recall raised on VOD this morning; recall qty matches the custodian leg.",
      },
    ],
    notes: [],
    custodian: {
      source: "CUSTODIAN",
      tradeId: "CUS-44931",
      ticker: "VOD LN",
      side: "SELL",
      qty: 1_500_000,
      price: 0.786,
      ccy: "GBP",
      tradeDate: "2026-05-19",
      settleDate: "2026-05-21",
      account: "FUND-A-EQTY",
      ssi: "CREST-A1",
      counterparty: "—",
      notional: 1_179_000,
    },
  },
  {
    id: "BRK-2044",
    kind: "duplicate",
    fieldTags: [],
    ageMins: 6,
    bucket: "intraday",
    notionalAtRisk: 8_900_000,
    ccyAtRisk: "USD",
    owner: "L. Romano",
    team: "Trade Support",
    status: "investigating",
    rootCauseHint:
      "Two near-identical bookings on our side — OMS resend after a venue acknowledgement timeout.",
    escalated: false,
    suggestions: [
      {
        candidateId: "DUP-CANCEL",
        confidence: 95,
        reason:
          "Second booking is 11 seconds after the first; same ticket, same fill — cancel candidate.",
      },
    ],
    notes: [
      {
        who: "L. Romano",
        at: "10:55",
        text: "OMS shows two acks. Sending cancel on the later booking.",
      },
    ],
    internal: {
      source: "INTERNAL",
      tradeId: "INT-77202 (dup of 77201)",
      ticker: "AAPL US",
      side: "BUY",
      qty: 50_000,
      price: 178.00,
      ccy: "USD",
      tradeDate: "2026-05-19",
      settleDate: "2026-05-21",
      account: "FUND-C-EQTY",
      ssi: "DTC-2801",
      counterparty: "GS Cash Equities",
      notional: 8_900_000,
    },
  },
  {
    id: "BRK-2039",
    kind: "field",
    fieldTags: ["account"],
    ageMins: 1_690,
    bucket: "t1",
    notionalAtRisk: 0,
    ccyAtRisk: "USD",
    owner: "K. Patel",
    team: "Trade Support",
    status: "resolved",
    rootCauseHint:
      "Wrong fund-code on a single allocation; reallocated yesterday EOD.",
    escalated: false,
    suggestions: [],
    notes: [
      {
        who: "K. Patel",
        at: "yest 17:48",
        text: "Reallocation booked; custodian acknowledged at 18:02. Closing.",
      },
    ],
    internal: {
      source: "INTERNAL",
      tradeId: "INT-77001",
      ticker: "TSLA US",
      side: "SELL",
      qty: 12_000,
      price: 197.30,
      ccy: "USD",
      tradeDate: "2026-05-18",
      settleDate: "2026-05-20",
      account: "FUND-A-EQTY",
      ssi: "DTC-2801",
      counterparty: "Citi Cash Equities",
      notional: 2_367_600,
    },
    custodian: {
      source: "CUSTODIAN",
      tradeId: "CUS-44801",
      ticker: "TSLA US",
      side: "SELL",
      qty: 12_000,
      price: 197.30,
      ccy: "USD",
      tradeDate: "2026-05-18",
      settleDate: "2026-05-20",
      account: "FUND-D-EQTY",
      ssi: "DTC-2801",
      counterparty: "Citi Cash Equities",
      notional: 2_367_600,
    },
  },
];

/* ------------------------------------------------------------------ *
 * Visual taxonomy — kept small and quiet so colour is meaningful
 * when it appears.
 * ------------------------------------------------------------------ */

const AGING: { key: AgingBucket; label: string }[] = [
  { key: "intraday", label: "Intraday" },
  { key: "t1", label: "T+1" },
  { key: "t2", label: "T+2" },
  { key: "t3plus", label: "T+3 and older" },
];

const KIND_META: Record<BreakKind, { label: string; dot: string; text: string }> = {
  missing: { label: "Missing", dot: "bg-rose-500", text: "text-rose-700" },
  duplicate: { label: "Duplicate", dot: "bg-amber-500", text: "text-amber-700" },
  field: { label: "Field diff", dot: "bg-indigo-500", text: "text-indigo-700" },
};

const STATUS_META: Record<
  Break["status"],
  { label: string; bg: string; text: string; border: string }
> = {
  open: {
    label: "Open",
    bg: "bg-neutral-100",
    text: "text-neutral-700",
    border: "border-neutral-200",
  },
  investigating: {
    label: "Investigating",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  "pending-cp": {
    label: "Pending counterparty",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  resolved: {
    label: "Resolved",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
};

/* ------------------------------------------------------------------ *
 * Formatters
 * ------------------------------------------------------------------ */

const ccyFmt = (n: number, ccy: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: ccy,
    maximumFractionDigits: 0,
    notation: Math.abs(n) >= 1_000_000 ? "compact" : "standard",
    compactDisplay: "short",
  }).format(n);

const numFmt = (n: number) => new Intl.NumberFormat("en-GB").format(n);

const fmtAge = (m: number) => {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h < 24) return mm ? `${h}h ${mm}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
};

/* ------------------------------------------------------------------ *
 * Side-by-side compare — two real cards, with diff rows marked by
 * a left rule and a pill on the disagreeing value.
 * ------------------------------------------------------------------ */

type Row = {
  key: keyof BookRecord;
  label: string;
  format?: (v: BookRecord[keyof BookRecord], r: BookRecord) => ReactNode;
  group: "ids" | "trade" | "settle" | "cpty";
};

const ROWS: Row[] = [
  { key: "tradeId", label: "Trade ID", group: "ids" },
  { key: "ticker", label: "Instrument", group: "trade" },
  { key: "side", label: "Side", group: "trade" },
  {
    key: "qty",
    label: "Quantity",
    group: "trade",
    format: (v) => numFmt(Number(v)),
  },
  {
    key: "price",
    label: "Price",
    group: "trade",
    format: (v, r) =>
      new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: r.ccy,
        maximumFractionDigits: 4,
      }).format(Number(v)),
  },
  {
    key: "notional",
    label: "Notional",
    group: "trade",
    format: (v, r) =>
      new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: r.ccy,
        maximumFractionDigits: 0,
      }).format(Number(v)),
  },
  { key: "ccy", label: "Currency", group: "trade" },
  { key: "tradeDate", label: "Trade date", group: "settle" },
  { key: "settleDate", label: "Settle date", group: "settle" },
  { key: "account", label: "Account", group: "cpty" },
  { key: "ssi", label: "SSI", group: "cpty" },
  { key: "counterparty", label: "Counterparty", group: "cpty" },
];

const GROUP_LABELS: Record<Row["group"], string> = {
  ids: "Identifier",
  trade: "Trade economics",
  settle: "Settlement",
  cpty: "Counterparty & routing",
};

function rowDiffers(row: Row, brk: Break): boolean {
  const a = brk.internal?.[row.key];
  const b = brk.custodian?.[row.key];
  if (a === undefined || b === undefined) return false;
  return String(a) !== String(b);
}

function CompareCard({
  rec,
  brk,
  side,
}: {
  rec?: BookRecord;
  brk: Break;
  side: "INTERNAL" | "CUSTODIAN";
}) {
  if (!rec) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 p-8 text-center">
        <div className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-rose-700">
          No record
        </div>
        <div className="mt-2 text-sm font-medium text-neutral-700">
          No {side === "INTERNAL" ? "internal" : "custodian"} side for this
          break.
        </div>
        <div className="mt-1 max-w-[20ch] text-xs text-neutral-500">
          Likely a one-sided booking — investigate the source feed.
        </div>
      </div>
    );
  }

  // Pre-group rows for cleaner visual rhythm
  const groups = (["ids", "trade", "settle", "cpty"] as Row["group"][]).map(
    (g) => ({ group: g, rows: ROWS.filter((r) => r.group === g) }),
  );

  const headerTone =
    side === "INTERNAL"
      ? "bg-neutral-900 text-white"
      : "bg-neutral-100 text-neutral-700";

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <div className={`flex items-center justify-between px-4 py-2.5 ${headerTone}`}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold tracking-wider uppercase opacity-70">
            {side === "INTERNAL" ? "Internal book" : "Custodian feed"}
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {rec.tradeId}
          </span>
        </div>
        <span className="text-[10px] font-medium tracking-wide uppercase opacity-60">
          {rec.source}
        </span>
      </div>

      <dl className="divide-y divide-neutral-100">
        {groups.map(({ group, rows }) => (
          <div key={group}>
            <dt className="bg-neutral-50/60 px-4 pt-3 pb-1 text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
              {GROUP_LABELS[group]}
            </dt>
            {rows.map((row) => {
              const diff = rowDiffers(row, brk);
              const value = row.format
                ? row.format(rec[row.key], rec)
                : String(rec[row.key]);
              return (
                <div
                  key={row.key}
                  className={`grid grid-cols-[140px_1fr] items-center px-4 py-2 text-sm ${
                    diff ? "border-l-2 border-rose-500" : ""
                  }`}
                >
                  <dd className="text-xs text-neutral-500">{row.label}</dd>
                  <dd
                    className={`text-right font-medium tabular-nums ${
                      diff ? "text-rose-700" : "text-neutral-800"
                    }`}
                  >
                    {value}
                  </dd>
                </div>
              );
            })}
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Confidence ring — replaces the bar; reads instantly at small size.
 * ------------------------------------------------------------------ */

function ConfidenceRing({ value }: { value: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  const tone =
    value >= 85
      ? "stroke-emerald-500"
      : value >= 65
        ? "stroke-amber-500"
        : "stroke-neutral-400";
  const text =
    value >= 85
      ? "text-emerald-700"
      : value >= 65
        ? "text-amber-700"
        : "text-neutral-600";
  return (
    <div className="relative h-10 w-10 shrink-0">
      <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-neutral-100"
        />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className={tone}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums ${text}`}
      >
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Suggested-match card
 * ------------------------------------------------------------------ */

function SuggestionCard({
  s,
  accepted,
  onAccept,
}: {
  s: SuggestedMatch;
  accepted: boolean;
  onAccept: () => void;
}) {
  return (
    <li
      className={`flex items-start gap-3 rounded-xl border p-3 transition ${
        accepted
          ? "border-emerald-300 bg-emerald-50/50"
          : "border-neutral-200 bg-white hover:border-neutral-300"
      }`}
    >
      <ConfidenceRing value={s.confidence} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-semibold text-neutral-800">
            {s.candidateId}
          </span>
          <span className="text-[10px] font-medium tracking-wide uppercase text-neutral-400">
            {s.confidence >= 85
              ? "High confidence"
              : s.confidence >= 65
                ? "Likely match"
                : "Weak match"}
          </span>
        </div>
        <p className="mt-1 text-xs leading-snug text-neutral-600">
          {s.reason}
        </p>
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <button
            type="button"
            className="rounded-md px-2 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Inspect
          </button>
          <button
            type="button"
            onClick={onAccept}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
              accepted
                ? "bg-emerald-600 text-white"
                : "bg-neutral-900 text-white hover:bg-neutral-800"
            }`}
          >
            {accepted ? "Paired ✓" : "Pair & resolve"}
          </button>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * Break list row — left rule encodes age severity at a glance.
 * ------------------------------------------------------------------ */

function BreakRow({
  brk,
  selected,
  onSelect,
}: {
  brk: Break;
  selected: boolean;
  onSelect: () => void;
}) {
  const kind = KIND_META[brk.kind];
  const status = STATUS_META[brk.status];
  const ticker = brk.internal?.ticker ?? brk.custodian?.ticker ?? "—";
  // Severity from age: ≥24h red, ≥4h amber, else neutral
  const ageTone =
    brk.ageMins >= 1440
      ? "bg-rose-500"
      : brk.ageMins >= 240
        ? "bg-amber-500"
        : "bg-neutral-300";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative flex w-full items-stretch border-b border-neutral-100 text-left transition ${
        selected ? "bg-neutral-50" : "hover:bg-neutral-50/60"
      }`}
    >
      <span
        aria-hidden
        className={`block w-1 shrink-0 ${
          selected ? "bg-neutral-900" : ageTone
        }`}
      />
      <div className="flex-1 px-3 py-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] font-semibold text-neutral-500 tabular-nums">
            {brk.id}
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${kind.dot}`} />
            <span className={`text-[10px] font-medium ${kind.text}`}>
              {kind.label}
            </span>
          </span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold text-neutral-900">
            {ticker}
          </span>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-neutral-800">
            {brk.notionalAtRisk
              ? ccyFmt(brk.notionalAtRisk, brk.ccyAtRisk)
              : "—"}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span className="truncate text-neutral-500">
            {brk.owner === "Unassigned" ? (
              <span className="font-medium text-rose-600">Unassigned</span>
            ) : (
              brk.owner
            )}
          </span>
          <span className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${status.bg} ${status.text}`}
            >
              {status.label}
            </span>
            <span className="font-mono tabular-nums text-neutral-600">
              {fmtAge(brk.ageMins)}
            </span>
          </span>
        </div>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * KPI card — minimal, with a small delta line for trend.
 * ------------------------------------------------------------------ */

function Kpi({
  label,
  value,
  delta,
  tone,
}: {
  label: string;
  value: string;
  delta?: { text: string; dir: "up" | "down" | "flat" };
  tone?: "neutral" | "amber" | "rose" | "emerald";
}) {
  const valueTone =
    tone === "amber"
      ? "text-amber-700"
      : tone === "rose"
        ? "text-rose-700"
        : tone === "emerald"
          ? "text-emerald-700"
          : "text-neutral-950";
  const deltaTone =
    delta?.dir === "up"
      ? "text-rose-600"
      : delta?.dir === "down"
        ? "text-emerald-600"
        : "text-neutral-400";
  return (
    <div className="flex flex-col rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <span className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
        {label}
      </span>
      <span
        className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-tight ${valueTone}`}
      >
        {value}
      </span>
      {delta && (
        <span
          className={`mt-1 inline-flex items-center gap-1 text-[11px] font-medium ${deltaTone}`}
        >
          <span aria-hidden>
            {delta.dir === "up" ? "▲" : delta.dir === "down" ? "▼" : "–"}
          </span>
          {delta.text}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Filter chips
 * ------------------------------------------------------------------ */

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
        active
          ? "bg-neutral-900 text-white"
          : "text-neutral-700 hover:bg-neutral-100"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function Reconciliation() {
  const [bucket, setBucket] = useState<AgingBucket | "all">("all");
  const [kindFilter, setKindFilter] = useState<BreakKind | "all">("all");
  const [selectedId, setSelectedId] = useState<string>(BREAKS[0].id);
  const [acceptedSuggestion, setAcceptedSuggestion] = useState<string | null>(
    null,
  );

  const filtered = useMemo(
    () =>
      BREAKS.filter(
        (b) =>
          (bucket === "all" || b.bucket === bucket) &&
          (kindFilter === "all" || b.kind === kindFilter),
      ).sort((a, b) => b.ageMins - a.ageMins),
    [bucket, kindFilter],
  );

  const selected = useMemo(
    () => BREAKS.find((b) => b.id === selectedId) ?? BREAKS[0],
    [selectedId],
  );

  const counts = useMemo(() => {
    const open = BREAKS.filter((b) => b.status !== "resolved");
    const valueAtRisk = open.reduce((acc, b) => acc + b.notionalAtRisk, 0);
    const oldest = open.reduce(
      (acc, b) => (b.ageMins > acc ? b.ageMins : acc),
      0,
    );
    const matchRate =
      ((BREAKS.length - open.length) / Math.max(BREAKS.length, 1)) * 100;
    return {
      open: open.length,
      valueAtRisk,
      oldest,
      matchRate: matchRate.toFixed(0),
    };
  }, []);

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      {/* ── Page header ─────────────────────────────────────── */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="px-8 pt-6 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <nav className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-neutral-500">
                <span>Operations</span>
                <span aria-hidden className="text-neutral-300">/</span>
                <span className="text-neutral-700">Trade Reconciliation</span>
              </nav>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-950">
                Today's breaks
              </h1>
              <p className="mt-1 max-w-prose text-sm text-neutral-600">
                Investigate and resolve mismatches between our books and the
                custodian feed before the value-date cut.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Re-run match engine
              </button>
              <button
                type="button"
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
              >
                Export breaks
              </button>
            </div>
          </div>

          {/* KPI strip */}
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Open breaks"
              value={String(counts.open)}
              delta={{ text: "2 since 09:00", dir: "up" }}
              tone={counts.open > 3 ? "rose" : "neutral"}
            />
            <Kpi
              label="Value at risk"
              value={ccyFmt(counts.valueAtRisk, "USD")}
              delta={{ text: "$4.1m vs yesterday", dir: "up" }}
              tone="amber"
            />
            <Kpi
              label="Oldest open"
              value={fmtAge(counts.oldest)}
              delta={{ text: "SLA cut at T+1 16:00", dir: "flat" }}
              tone={counts.oldest > 60 ? "amber" : "neutral"}
            />
            <Kpi
              label="Auto-match rate"
              value={`${counts.matchRate}%`}
              delta={{ text: "94% rolling 24h", dir: "flat" }}
              tone="emerald"
            />
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 bg-neutral-50/60 px-8 py-2.5">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
            Aging
          </span>
          <div className="flex items-center gap-0.5 rounded-full bg-white p-0.5 ring-1 ring-inset ring-neutral-200">
            <Chip active={bucket === "all"} onClick={() => setBucket("all")}>
              All
              <span className="rounded bg-neutral-100 px-1 text-[10px] font-semibold tabular-nums text-neutral-600">
                {BREAKS.length}
              </span>
            </Chip>
            {AGING.map((a) => {
              const n = BREAKS.filter((b) => b.bucket === a.key).length;
              return (
                <Chip
                  key={a.key}
                  active={bucket === a.key}
                  onClick={() => setBucket(a.key)}
                >
                  {a.label}
                  <span className="rounded bg-neutral-100 px-1 text-[10px] font-semibold tabular-nums text-neutral-600">
                    {n}
                  </span>
                </Chip>
              );
            })}
          </div>

          <div className="ml-2 h-4 w-px bg-neutral-200" />

          <span className="text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
            Kind
          </span>
          <div className="flex items-center gap-0.5 rounded-full bg-white p-0.5 ring-1 ring-inset ring-neutral-200">
            <Chip
              active={kindFilter === "all"}
              onClick={() => setKindFilter("all")}
            >
              All
            </Chip>
            {(Object.keys(KIND_META) as BreakKind[]).map((k) => (
              <Chip
                key={k}
                active={kindFilter === k}
                onClick={() => setKindFilter(k)}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${KIND_META[k].dot}`} />
                {KIND_META[k].label}
              </Chip>
            ))}
          </div>
        </div>
      </header>

      {/* ── Workbench body ────────────────────────────────── */}
      <div className="grid flex-1 grid-cols-[300px_1fr] overflow-hidden">
        {/* Break list */}
        <aside className="flex h-full flex-col border-r border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50/60 px-3 py-2">
            <span className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
              {filtered.length} breaks
            </span>
            <span className="text-[10px] text-neutral-400">
              Sorted by age ▾
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.map((b) => (
              <BreakRow
                key={b.id}
                brk={b}
                selected={b.id === selectedId}
                onSelect={() => {
                  setSelectedId(b.id);
                  setAcceptedSuggestion(null);
                }}
              />
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-16 text-center">
                <div className="text-2xl">🟢</div>
                <div className="mt-2 text-sm font-medium text-neutral-700">
                  No breaks in this view
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  Everything in this bucket has cleared.
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Detail */}
        <section className="relative flex h-full min-h-0 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-8 py-6 pb-24">
            {/* Break header */}
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-neutral-500 tabular-nums">
                    {selected.id}
                  </span>
                  <span className="text-neutral-300">·</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${KIND_META[selected.kind].dot}`}
                    />
                    <span className={KIND_META[selected.kind].text}>
                      {KIND_META[selected.kind].label}
                    </span>
                  </span>
                  <span className="text-neutral-300">·</span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_META[selected.status].bg} ${STATUS_META[selected.status].text} ${STATUS_META[selected.status].border}`}
                  >
                    {STATUS_META[selected.status].label}
                  </span>
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
                  {selected.internal?.ticker ?? selected.custodian?.ticker}
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  {selected.internal?.counterparty ??
                    selected.custodian?.counterparty}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-x-8 gap-y-2 text-xs">
                <Meta
                  label="Value at risk"
                  value={
                    selected.notionalAtRisk
                      ? ccyFmt(selected.notionalAtRisk, selected.ccyAtRisk)
                      : "—"
                  }
                  emphasis
                />
                <Meta label="Age" value={fmtAge(selected.ageMins)} />
                <Meta label="Owner" value={selected.owner} />
                <Meta label="Team" value={selected.team} />
                <Meta label="Bucket" value={selected.bucket.toUpperCase()} />
                <Meta
                  label="Suggestions"
                  value={String(selected.suggestions.length)}
                />
              </div>
            </div>

            {/* Escalation banner */}
            {(selected.escalated || selected.status === "pending-cp") && (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
                <span className="mt-0.5 text-amber-600">⚠</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-amber-900">
                    {selected.escalated
                      ? "Escalated — settlement risk if not cleared by cut"
                      : "Waiting on the counterparty"}
                  </div>
                  <div className="mt-0.5 text-xs text-amber-800">
                    {selected.rootCauseHint}
                  </div>
                </div>
              </div>
            )}

            {/* Side-by-side compare */}
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-900">
                  Compare
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="block h-2 w-0.5 rounded-full bg-rose-500" />
                    Row disagrees
                  </span>
                  <span className="text-neutral-300">·</span>
                  <span>{selected.fieldTags.length} field(s) flagged</span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <CompareCard rec={selected.internal} brk={selected} side="INTERNAL" />
                <CompareCard
                  rec={selected.custodian}
                  brk={selected}
                  side="CUSTODIAN"
                />
              </div>
            </div>

            {/* Suggested matches + Activity */}
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Suggested resolution
                  </h3>
                  <span className="text-[11px] text-neutral-500">
                    From the match engine
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {selected.suggestions.length === 0 ? (
                    <li className="rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-center text-xs text-neutral-500">
                      No automatic suggestions — investigate manually using
                      the compare view.
                    </li>
                  ) : (
                    selected.suggestions.map((s) => (
                      <SuggestionCard
                        key={s.candidateId}
                        s={s}
                        accepted={acceptedSuggestion === s.candidateId}
                        onAccept={() => setAcceptedSuggestion(s.candidateId)}
                      />
                    ))
                  )}
                </ul>
              </div>

              <div className="lg:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Activity
                  </h3>
                  <span className="text-[11px] text-neutral-500">
                    {selected.notes.length} note
                    {selected.notes.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white">
                  <ul className="divide-y divide-neutral-100">
                    {selected.notes.length === 0 && (
                      <li className="px-4 py-8 text-center text-xs text-neutral-400">
                        No activity yet — leave a note below.
                      </li>
                    )}
                    {selected.notes.map((n, i) => (
                      <li key={i} className="flex gap-3 px-4 py-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white">
                          {n.who
                            .split(" ")
                            .map((s) => s[0])
                            .join("")}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-semibold text-neutral-800">
                              {n.who}
                            </span>
                            <span className="text-[10px] tabular-nums text-neutral-400">
                              {n.at}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs leading-snug text-neutral-600">
                            {n.text}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-neutral-100 p-3">
                    <textarea
                      placeholder="Leave a note for the team…"
                      rows={2}
                      className="w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700 placeholder-neutral-400 focus:border-neutral-400 focus:outline-none"
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <button
                        type="button"
                        className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800"
                      >
                        Tag a teammate…
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-neutral-800"
                      >
                        Post note
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Root cause */}
            <div className="mt-6 rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
                Root-cause hint
              </div>
              <p className="mt-1 text-sm text-neutral-700">
                {selected.rootCauseHint}
              </p>
            </div>
          </div>

          {/* ── Sticky action bar (dominant CTA) ───────────────────── */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-4">
            <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white/95 px-4 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.08)] backdrop-blur">
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-neutral-500">Routing</span>
                <div className="flex items-center gap-1">
                  {(
                    ["Middle Office", "Settlements", "Trade Support", "Unassigned"] as const
                  ).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
                        t === selected.team
                          ? "bg-neutral-900 text-white"
                          : "text-neutral-600 hover:bg-neutral-100"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                >
                  Send to counterparty
                </button>
                <button
                  type="button"
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                >
                  Book correction
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    selected.escalated
                      ? "bg-rose-50 text-rose-700"
                      : "text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  {selected.escalated ? "Escalated" : "Escalate"}
                </button>
                <div className="mx-1 h-5 w-px bg-neutral-200" />
                <button
                  type="button"
                  className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  Mark resolved
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
        {label}
      </div>
      <div
        className={`tabular-nums ${
          emphasis
            ? "text-sm font-semibold text-neutral-950"
            : "text-xs font-medium text-neutral-800"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
