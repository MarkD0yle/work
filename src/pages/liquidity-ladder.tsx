import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const title = "Liquidity Ladder";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * Treasury — Cash & Liquidity Ladder
 *
 * Projected cash position by settlement bucket, per currency. The job
 * is to spot a funding gap before the cutoff that funds it.
 *
 * Design rule (shared with the rest of this workspace):
 *   CALM IS THE DEFAULT. A funded ladder is neutral grey.
 *   Colour is reserved for the buckets that close below the buffer
 *   (amber = thin, red = breached). The cumulative curve is the
 *   single object the operator reads first — everything else supports it.
 * ------------------------------------------------------------------ */

/* ---------- Data model ---------- */

type Ccy = "USD" | "EUR" | "GBP" | "JPY";

type FlowKind =
  | "settlement"
  | "redemption"
  | "subscription"
  | "coupon"
  | "margin"
  | "fx_swap"
  | "fee";

type Flow = {
  id: string;
  kind: FlowKind;
  counterparty: string;
  /** signed: positive = inflow, negative = outflow */
  amount: number;
  confirmed: boolean;
};

type Bucket = {
  id: string;
  label: string;
  sub: string;
  /** minutes from scenario open; used for the cutoff countdown */
  cutoffOffsetMin: number | null;
  cutoffLabel: string;
  flows: Flow[];
};

type CcyBook = {
  ccy: Ccy;
  symbol: string;
  opening: number;
  /** minimum operating balance the desk must hold */
  buffer: number;
  buckets: Bucket[];
};

/* ---------- Mock data ---------- */

const f = (
  id: string,
  kind: FlowKind,
  counterparty: string,
  amount: number,
  confirmed = true,
): Flow => ({ id, kind, counterparty, amount, confirmed });

const BOOKS: CcyBook[] = [
  {
    ccy: "USD",
    symbol: "$",
    opening: 482_000_000,
    buffer: 75_000_000,
    buckets: [
      {
        id: "usd-t0am",
        label: "T+0 AM",
        sub: "Settling now",
        cutoffOffsetMin: 38,
        cutoffLabel: "Fedwire 11:00",
        flows: [
          f("u1", "subscription", "Cohen & Steers", 64_000_000),
          f("u2", "coupon", "UST 4.25% 02/29", 18_400_000),
          f("u3", "redemption", "iShares Core", -128_000_000),
          f("u4", "settlement", "JP Morgan DvP", -41_500_000),
        ],
      },
      {
        id: "usd-t0pm",
        label: "T+0 PM",
        sub: "Afternoon cycle",
        cutoffOffsetMin: 218,
        cutoffLabel: "CHIPS 16:30",
        flows: [
          f("u5", "fx_swap", "Citi FX near leg", 92_000_000),
          f("u6", "margin", "CME variation", -57_300_000),
          f("u7", "settlement", "State Street DvP", -36_800_000),
          f("u8", "fee", "Custody charge", -2_100_000),
        ],
      },
      {
        id: "usd-t1",
        label: "T+1",
        sub: "Tomorrow",
        cutoffOffsetMin: null,
        cutoffLabel: "Standard",
        flows: [
          f("u9", "redemption", "PIMCO Income", -214_000_000),
          f("u10", "subscription", "Vanguard Instl", 88_000_000),
          f("u11", "coupon", "UST 3.875% 05/31", 9_200_000),
        ],
      },
      {
        id: "usd-t2",
        label: "T+2",
        sub: "Spot",
        cutoffOffsetMin: null,
        cutoffLabel: "Standard",
        flows: [
          f("u12", "fx_swap", "Goldman FX far leg", -92_000_000),
          f("u13", "settlement", "BlackRock equity", 147_000_000),
          f("u14", "subscription", "Fidelity Bond", 31_000_000),
        ],
      },
      {
        id: "usd-t3",
        label: "T+3",
        sub: "Forward",
        cutoffOffsetMin: null,
        cutoffLabel: "Standard",
        flows: [
          f("u15", "redemption", "Schroders MMF", -46_000_000),
          f("u16", "coupon", "Corp basket", 22_500_000),
        ],
      },
      {
        id: "usd-1w",
        label: "T+1W",
        sub: "Next week",
        cutoffOffsetMin: null,
        cutoffLabel: "Forecast",
        flows: [
          f("u17", "subscription", "Pipeline est.", 120_000_000, false),
          f("u18", "redemption", "Pipeline est.", -86_000_000, false),
        ],
      },
    ],
  },
  {
    ccy: "EUR",
    symbol: "€",
    opening: 96_000_000,
    buffer: 60_000_000,
    buckets: [
      {
        id: "eur-t0am",
        label: "T+0 AM",
        sub: "Settling now",
        cutoffOffsetMin: 12,
        cutoffLabel: "TARGET2 10:00",
        flows: [
          f("e1", "redemption", "Amundi SICAV", -158_000_000),
          f("e2", "subscription", "DWS Xtrackers", 44_000_000),
          f("e3", "coupon", "Bund 0% 08/30", 12_300_000),
        ],
      },
      {
        id: "eur-t0pm",
        label: "T+0 PM",
        sub: "Afternoon cycle",
        cutoffOffsetMin: 196,
        cutoffLabel: "TARGET2 17:00",
        flows: [
          f("e4", "fx_swap", "BNP FX near leg", 73_000_000),
          f("e5", "margin", "Eurex variation", -29_400_000),
          f("e6", "settlement", "Clearstream DvP", -22_700_000),
        ],
      },
      {
        id: "eur-t1",
        label: "T+1",
        sub: "Tomorrow",
        cutoffOffsetMin: null,
        cutoffLabel: "Standard",
        flows: [
          f("e7", "subscription", "Schroders Euro", 58_000_000),
          f("e8", "redemption", "Aviva MMF", -34_000_000),
        ],
      },
      {
        id: "eur-t2",
        label: "T+2",
        sub: "Spot",
        cutoffOffsetMin: null,
        cutoffLabel: "Standard",
        flows: [
          f("e9", "fx_swap", "BNP FX far leg", -73_000_000),
          f("e10", "settlement", "Euroclear bond", 51_000_000),
        ],
      },
      {
        id: "eur-t3",
        label: "T+3",
        sub: "Forward",
        cutoffOffsetMin: null,
        cutoffLabel: "Standard",
        flows: [f("e11", "coupon", "OAT 1.25% 05/34", 16_800_000)],
      },
      {
        id: "eur-1w",
        label: "T+1W",
        sub: "Next week",
        cutoffOffsetMin: null,
        cutoffLabel: "Forecast",
        flows: [
          f("e12", "subscription", "Pipeline est.", 40_000_000, false),
          f("e13", "redemption", "Pipeline est.", -62_000_000, false),
        ],
      },
    ],
  },
  {
    ccy: "GBP",
    symbol: "£",
    opening: 88_000_000,
    buffer: 30_000_000,
    buckets: [
      {
        id: "gbp-t0am",
        label: "T+0 AM",
        sub: "Settling now",
        cutoffOffsetMin: 64,
        cutoffLabel: "CHAPS 11:30",
        flows: [
          f("g1", "redemption", "Legal & General", -54_000_000),
          f("g2", "subscription", "Baillie Gifford", 21_000_000),
          f("g3", "coupon", "Gilt 0.5% 07/29", 6_400_000),
        ],
      },
      {
        id: "gbp-t0pm",
        label: "T+0 PM",
        sub: "Afternoon cycle",
        cutoffOffsetMin: 252,
        cutoffLabel: "CHAPS 16:00",
        flows: [
          f("g4", "settlement", "CREST DvP", -18_200_000),
          f("g5", "fx_swap", "HSBC FX near leg", 33_000_000),
        ],
      },
      {
        id: "gbp-t1",
        label: "T+1",
        sub: "Tomorrow",
        cutoffOffsetMin: null,
        cutoffLabel: "Standard",
        flows: [
          f("g6", "subscription", "M&G Investments", 27_000_000),
          f("g7", "margin", "ICE variation", -11_500_000),
        ],
      },
      {
        id: "gbp-t2",
        label: "T+2",
        sub: "Spot",
        cutoffOffsetMin: null,
        cutoffLabel: "Standard",
        flows: [
          f("g8", "fx_swap", "HSBC FX far leg", -33_000_000),
          f("g9", "settlement", "Equity basket", 24_000_000),
        ],
      },
      {
        id: "gbp-t3",
        label: "T+3",
        sub: "Forward",
        cutoffOffsetMin: null,
        cutoffLabel: "Standard",
        flows: [f("g10", "coupon", "Gilt 4.25% 06/32", 9_800_000)],
      },
      {
        id: "gbp-1w",
        label: "T+1W",
        sub: "Next week",
        cutoffOffsetMin: null,
        cutoffLabel: "Forecast",
        flows: [f("g11", "redemption", "Pipeline est.", -19_000_000, false)],
      },
    ],
  },
  {
    ccy: "JPY",
    symbol: "¥",
    opening: 12_400_000_000,
    buffer: 4_000_000_000,
    buckets: [
      {
        id: "jpy-t0am",
        label: "T+0 AM",
        sub: "Settling now",
        cutoffOffsetMin: -8,
        cutoffLabel: "BOJ-NET 15:00 JST",
        flows: [
          f("j1", "redemption", "Nomura AM", -8_200_000_000),
          f("j2", "subscription", "Nikko AM", 2_100_000_000),
          f("j3", "coupon", "JGB 0.1% 09/33", 640_000_000),
        ],
      },
      {
        id: "jpy-t0pm",
        label: "T+0 PM",
        sub: "Afternoon cycle",
        cutoffOffsetMin: null,
        cutoffLabel: "Closed",
        flows: [f("j4", "settlement", "JSCC DvP", -1_400_000_000)],
      },
      {
        id: "jpy-t1",
        label: "T+1",
        sub: "Tomorrow",
        cutoffOffsetMin: null,
        cutoffLabel: "Standard",
        flows: [
          f("j5", "fx_swap", "MUFG FX near leg", 5_600_000_000),
          f("j6", "redemption", "Daiwa MMF", -2_900_000_000),
        ],
      },
      {
        id: "jpy-t2",
        label: "T+2",
        sub: "Spot",
        cutoffOffsetMin: null,
        cutoffLabel: "Standard",
        flows: [f("j7", "fx_swap", "MUFG FX far leg", -5_600_000_000)],
      },
      {
        id: "jpy-t3",
        label: "T+3",
        sub: "Forward",
        cutoffOffsetMin: null,
        cutoffLabel: "Standard",
        flows: [f("j8", "coupon", "JGB 0.4% 12/40", 880_000_000)],
      },
      {
        id: "jpy-1w",
        label: "T+1W",
        sub: "Next week",
        cutoffOffsetMin: null,
        cutoffLabel: "Forecast",
        flows: [f("j9", "subscription", "Pipeline est.", 1_200_000_000, false)],
      },
    ],
  },
];

/* ---------- Helpers ---------- */

const MOUNT = Date.now();

const KIND_LABEL: Record<FlowKind, string> = {
  settlement: "Settlement",
  redemption: "Redemption",
  subscription: "Subscription",
  coupon: "Coupon / income",
  margin: "Margin call",
  fx_swap: "FX swap leg",
  fee: "Fee",
};

function compact(symbol: string, n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sign}${symbol}${(abs / 1e9).toFixed(2)}bn`;
  if (abs >= 1e6) return `${sign}${symbol}${(abs / 1e6).toFixed(1)}m`;
  if (abs >= 1e3) return `${sign}${symbol}${(abs / 1e3).toFixed(0)}k`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

function signed(symbol: string, n: number): string {
  return `${n >= 0 ? "+" : ""}${compact(symbol, n)}`;
}

function fmtCountdown(offMin: number | null): string {
  if (offMin == null) return "—";
  const ts = MOUNT + offMin * 60_000;
  const ms = ts - Date.now();
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const core = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return ms < 0 ? `${core} ago` : core;
}

type Health = "funded" | "thin" | "breached";

function bucketHealth(close: number, buffer: number): Health {
  if (close < 0) return "breached";
  if (close < buffer) return "thin";
  return "funded";
}

/* ---------- Derived ladder rows ---------- */

type LadderRow = {
  bucket: Bucket;
  inflow: number;
  outflow: number;
  net: number;
  open: number;
  close: number;
  health: Health;
};

function buildLadder(book: CcyBook): LadderRow[] {
  const rows: LadderRow[] = [];
  let running = book.opening;
  for (const bucket of book.buckets) {
    const inflow = bucket.flows
      .filter((x) => x.amount > 0)
      .reduce((s, x) => s + x.amount, 0);
    const outflow = bucket.flows
      .filter((x) => x.amount < 0)
      .reduce((s, x) => s + x.amount, 0);
    const net = inflow + outflow;
    const open = running;
    const close = running + net;
    running = close;
    rows.push({
      bucket,
      inflow,
      outflow,
      net,
      open,
      close,
      health: bucketHealth(close, book.buffer),
    });
  }
  return rows;
}

/* ---------- Atoms ---------- */

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "muted" | "info" | "warning" | "error" | "ok";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-neutral-100 text-neutral-700 ring-neutral-200",
    muted: "bg-neutral-50 text-neutral-500 ring-neutral-200",
    info: "bg-sky-50 text-sky-700 ring-sky-200",
    warning: "bg-amber-50 text-amber-800 ring-amber-200",
    error: "bg-red-50 text-red-700 ring-red-200",
    ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

const HEALTH_META: Record<
  Health,
  { label: string; bar: string; text: string; dot: string }
> = {
  funded: {
    label: "Funded",
    bar: "bg-neutral-300",
    text: "text-neutral-700",
    dot: "bg-neutral-400",
  },
  thin: {
    label: "Thin",
    bar: "bg-amber-400",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  breached: {
    label: "Short",
    bar: "bg-red-500",
    text: "text-red-700",
    dot: "bg-red-500",
  },
};

/* ================================================================== *
 * Page
 * ================================================================== */

export default function LiquidityLadder() {
  const [ccy, setCcy] = useState<Ccy>("USD");
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [, setNow] = useState(() => Date.now());

  // Live tick keeps the cutoff countdowns moving.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const book = BOOKS.find((b) => b.ccy === ccy)!;
  const rows = useMemo(() => buildLadder(book), [book]);

  const closing = rows[rows.length - 1]?.close ?? book.opening;
  const lowest = rows.reduce(
    (min, r) => (r.close < min.close ? r : min),
    rows[0],
  );
  const largestGap = rows.reduce(
    (worst, r) => (r.close - book.buffer < worst ? r.close - book.buffer : worst),
    Infinity,
  );
  const coverage = book.buffer > 0 ? lowest.close / book.buffer : 0;
  const breaches = rows.filter((r) => r.health !== "funded").length;

  const overall: Health =
    rows.some((r) => r.health === "breached")
      ? "breached"
      : rows.some((r) => r.health === "thin")
        ? "thin"
        : "funded";

  const drawerRow = rows.find((r) => r.bucket.id === selectedBucket) ?? null;

  // Diverging-bar scale: widest single inflow or outflow across buckets.
  const maxFlow = Math.max(
    ...rows.map((r) => Math.max(r.inflow, Math.abs(r.outflow))),
    1,
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50 text-neutral-900">
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-neutral-200 bg-white px-8">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-neutral-900">
            Liquidity Ladder
          </span>
          <span className="text-xs text-neutral-400">Treasury · projected cash</span>
        </div>

        {/* Currency tabs — switch the whole dataset */}
        <div className="ml-2 flex items-center gap-1 rounded-lg bg-neutral-100 p-0.5">
          {BOOKS.map((b) => (
            <button
              key={b.ccy}
              type="button"
              onClick={() => {
                setCcy(b.ccy);
                setSelectedBucket(null);
              }}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                ccy === b.ccy
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {b.ccy}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          {overall === "funded" ? (
            <Badge tone="ok">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Fully funded across the ladder
            </Badge>
          ) : overall === "thin" ? (
            <Badge tone="warning">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {breaches} bucket{breaches > 1 ? "s" : ""} below buffer
            </Badge>
          ) : (
            <Badge tone="error">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Funding short — action required
            </Badge>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-8 py-6">
          {/* ---------- KPI strip ---------- */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi
              label="Opening balance"
              value={compact(book.symbol, book.opening)}
              hint="Start of day, cleared"
            />
            <Kpi
              label="Projected close"
              value={compact(book.symbol, closing)}
              hint={`After ${rows.length} settlement buckets`}
              tone={closing < book.buffer ? "warning" : "neutral"}
            />
            <Kpi
              label="Lowest point"
              value={compact(book.symbol, lowest.close)}
              hint={`at ${lowest.bucket.label}`}
              tone={lowest.health === "breached" ? "error" : lowest.health === "thin" ? "warning" : "neutral"}
            />
            <Kpi
              label="Buffer headroom"
              value={signed(book.symbol, largestGap === Infinity ? 0 : largestGap)}
              hint={`Buffer ${compact(book.symbol, book.buffer)} · cover ${coverage.toFixed(2)}×`}
              tone={largestGap < 0 ? "error" : "neutral"}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_460px]">
            {/* ---------- The ladder (diverging bars) ---------- */}
            <section
              aria-label="Settlement ladder"
              className="rounded-2xl border border-neutral-200 bg-white"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
                <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                  Settlement ladder · {book.ccy}
                </h2>
                <div className="flex items-center gap-3 text-[10px] font-medium tracking-wide text-neutral-400 uppercase">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-sky-300" /> Inflow
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-neutral-400" /> Outflow
                  </span>
                </div>
              </div>

              {/* Column header */}
              <div className="grid grid-cols-[120px_1fr_120px] items-center gap-3 px-5 py-2 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                <span>Bucket</span>
                <span className="text-center">Flow (out ◀ · ▶ in)</span>
                <span className="text-right">Close</span>
              </div>

              <ul>
                {rows.map((r) => {
                  const inPct = (r.inflow / maxFlow) * 50;
                  const outPct = (Math.abs(r.outflow) / maxFlow) * 50;
                  const active = selectedBucket === r.bucket.id;
                  const meta = HEALTH_META[r.health];
                  return (
                    <li key={r.bucket.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedBucket(r.bucket.id)}
                        className={`grid w-full grid-cols-[120px_1fr_120px] items-center gap-3 border-t border-neutral-100 px-5 py-3 text-left transition ${
                          active ? "bg-sky-50/60" : "hover:bg-neutral-50"
                        }`}
                      >
                        {/* Bucket label */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                            <span className="text-sm font-semibold text-neutral-800">
                              {r.bucket.label}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-neutral-400">
                            {r.bucket.sub}
                          </div>
                        </div>

                        {/* Diverging bar around the centre axis */}
                        <div className="relative h-9">
                          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-neutral-200" />
                          {/* outflow grows left from centre */}
                          <div
                            className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center justify-start rounded-l-sm bg-neutral-400"
                            style={{
                              right: "50%",
                              width: `${outPct}%`,
                            }}
                          >
                            {outPct > 8 && (
                              <span className="pl-1.5 font-mono text-[10px] font-medium text-white">
                                {compact(book.symbol, r.outflow)}
                              </span>
                            )}
                          </div>
                          {/* inflow grows right from centre */}
                          <div
                            className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center justify-end rounded-r-sm bg-sky-300"
                            style={{
                              left: "50%",
                              width: `${inPct}%`,
                            }}
                          >
                            {inPct > 8 && (
                              <span className="pr-1.5 font-mono text-[10px] font-medium text-sky-900">
                                +{compact(book.symbol, r.inflow)}
                              </span>
                            )}
                          </div>
                          {/* net chip */}
                          <span
                            className={`absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-3 font-mono text-[10px] ${
                              r.net >= 0 ? "text-sky-700" : "text-neutral-500"
                            }`}
                          >
                            net {signed(book.symbol, r.net)}
                          </span>
                        </div>

                        {/* Close balance */}
                        <div className="text-right">
                          <div
                            className={`font-mono text-sm font-semibold tabular-nums ${meta.text}`}
                          >
                            {compact(book.symbol, r.close)}
                          </div>
                          <div className="mt-0.5 flex items-center justify-end gap-1">
                            <span className="font-mono text-[10px] text-neutral-400">
                              {fmtCountdown(r.bucket.cutoffOffsetMin)}
                            </span>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* ---------- Cumulative curve + read ---------- */}
            <div className="flex flex-col gap-6">
              <CumulativeCurve book={book} rows={rows} />

              {/* The read — plain language */}
              <section className="rounded-2xl border border-neutral-200 bg-white p-5">
                <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                  The read
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-neutral-700">
                  {overall === "funded" ? (
                    <>
                      {book.ccy} stays above the{" "}
                      {compact(book.symbol, book.buffer)} buffer across every
                      bucket. Lowest point is{" "}
                      <span className="font-medium text-neutral-900">
                        {compact(book.symbol, lowest.close)}
                      </span>{" "}
                      at {lowest.bucket.label}. No funding action needed.
                    </>
                  ) : (
                    <>
                      {book.ccy} dips to{" "}
                      <span className="font-semibold text-red-700">
                        {compact(book.symbol, lowest.close)}
                      </span>{" "}
                      at {lowest.bucket.label} —{" "}
                      {lowest.health === "breached"
                        ? "below zero. "
                        : `under the ${compact(book.symbol, book.buffer)} buffer. `}
                      Fund{" "}
                      <span className="font-medium text-neutral-900">
                        {compact(book.symbol, Math.max(0, book.buffer - lowest.close))}
                      </span>{" "}
                      before the {lowest.bucket.cutoffLabel} cutoff.
                    </>
                  )}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700">
                    Raise FX swap
                  </button>
                  <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
                    Draw on facility
                  </button>
                  <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
                    Export ladder
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Drawer ---------- */}
      {drawerRow && (
        <BucketDrawer
          book={book}
          row={drawerRow}
          onClose={() => setSelectedBucket(null)}
        />
      )}
    </div>
  );
}

/* ================================================================== *
 * KPI tile
 * ================================================================== */

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "warning" | "error";
}) {
  const accent = {
    neutral: "border-l-neutral-300",
    warning: "border-l-amber-500",
    error: "border-l-red-500",
  }[tone];
  const valueColor = {
    neutral: "text-neutral-900",
    warning: "text-amber-700",
    error: "text-red-700",
  }[tone];
  return (
    <div
      className={`rounded-xl border border-l-4 border-neutral-200 bg-white p-4 ${accent}`}
    >
      <div className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
        {label}
      </div>
      <div className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${valueColor}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-neutral-400">{hint}</div>}
    </div>
  );
}

/* ================================================================== *
 * Cumulative liquidity curve (SVG)
 * ================================================================== */

function CumulativeCurve({
  book,
  rows,
}: {
  book: CcyBook;
  rows: LadderRow[];
}) {
  const W = 480;
  const H = 200;
  const PAD = { t: 16, r: 16, b: 28, l: 16 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  // y-domain across opening, every close, zero and buffer.
  const points = [book.opening, ...rows.map((r) => r.close)];
  const lo = Math.min(0, ...points);
  const hi = Math.max(book.buffer, ...points);
  const span = hi - lo || 1;

  const x = (i: number) => PAD.l + (i / rows.length) * plotW;
  const y = (v: number) => PAD.t + (1 - (v - lo) / span) * plotH;

  const series = [
    { v: book.opening },
    ...rows.map((r) => ({ v: r.close })),
  ];

  const linePath = series
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`)
    .join(" ");
  const areaPath =
    `${linePath} L ${x(series.length - 1).toFixed(1)} ${y(lo).toFixed(1)} ` +
    `L ${x(0).toFixed(1)} ${y(lo).toFixed(1)} Z`;

  const bufferY = y(book.buffer);
  const zeroY = y(0);
  const breached = rows.some((r) => r.health !== "funded");

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
          Cumulative position
        </h2>
        <span className="font-mono text-[10px] text-neutral-400">
          buffer {compact(book.symbol, book.buffer)}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label="Cumulative cash position across settlement buckets"
      >
        <defs>
          <linearGradient id="ladderFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={breached ? "rgb(245 158 11)" : "rgb(148 163 184)"}
              stopOpacity="0.22"
            />
            <stop
              offset="100%"
              stopColor={breached ? "rgb(245 158 11)" : "rgb(148 163 184)"}
              stopOpacity="0.02"
            />
          </linearGradient>
        </defs>

        {/* buffer band (below buffer = thin zone) */}
        <rect
          x={PAD.l}
          y={bufferY}
          width={plotW}
          height={Math.max(0, y(lo) - bufferY)}
          fill="rgb(251 191 36)"
          opacity={0.06}
        />
        {/* below-zero band */}
        {zeroY < y(lo) && (
          <rect
            x={PAD.l}
            y={zeroY}
            width={plotW}
            height={Math.max(0, y(lo) - zeroY)}
            fill="rgb(239 68 68)"
            opacity={0.06}
          />
        )}

        {/* buffer threshold line */}
        <line
          x1={PAD.l}
          y1={bufferY}
          x2={W - PAD.r}
          y2={bufferY}
          stroke="rgb(245 158 11)"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <text
          x={W - PAD.r}
          y={bufferY - 4}
          textAnchor="end"
          className="fill-amber-600 font-mono"
          fontSize={9}
        >
          buffer
        </text>

        {/* zero line if visible */}
        {lo < 0 && (
          <line
            x1={PAD.l}
            y1={zeroY}
            x2={W - PAD.r}
            y2={zeroY}
            stroke="rgb(239 68 68)"
            strokeWidth={1}
          />
        )}

        {/* area + line */}
        <path d={areaPath} fill="url(#ladderFill)" />
        <path
          d={linePath}
          fill="none"
          stroke={breached ? "rgb(217 119 6)" : "rgb(100 116 139)"}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* node dots */}
        {series.map((p, i) => {
          const isOpen = i === 0;
          const r = isOpen ? null : rows[i - 1];
          const color =
            r?.health === "breached"
              ? "rgb(239 68 68)"
              : r?.health === "thin"
                ? "rgb(245 158 11)"
                : "rgb(100 116 139)";
          return (
            <circle
              key={i}
              cx={x(i)}
              cy={y(p.v)}
              r={3}
              fill="white"
              stroke={color}
              strokeWidth={2}
            />
          );
        })}

        {/* x labels */}
        {rows.map((r, i) => (
          <text
            key={r.bucket.id}
            x={x(i + 1)}
            y={H - 8}
            textAnchor="middle"
            className="fill-neutral-400 font-mono"
            fontSize={8}
          >
            {r.bucket.label}
          </text>
        ))}
        <text
          x={x(0)}
          y={H - 8}
          textAnchor="middle"
          className="fill-neutral-400 font-mono"
          fontSize={8}
        >
          Open
        </text>
      </svg>
    </section>
  );
}

/* ================================================================== *
 * Bucket drawer — line items
 * ================================================================== */

function BucketDrawer({
  book,
  row,
  onClose,
}: {
  book: CcyBook;
  row: LadderRow;
  onClose: () => void;
}) {
  const meta = HEALTH_META[row.health];
  const sorted = [...row.bucket.flows].sort((a, b) => a.amount - b.amount);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-neutral-900/20"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed top-0 right-0 z-50 flex h-screen w-[440px] flex-col border-l border-neutral-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-neutral-900">
                {row.bucket.label}
              </h2>
              <Badge
                tone={
                  row.health === "breached"
                    ? "error"
                    : row.health === "thin"
                      ? "warning"
                      : "muted"
                }
              >
                {meta.label}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-neutral-500">
              {row.bucket.sub} · cutoff {row.bucket.cutoffLabel} ·{" "}
              {fmtCountdown(row.bucket.cutoffOffsetMin)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Balance summary */}
        <div className="grid grid-cols-3 gap-px border-b border-neutral-200 bg-neutral-100">
          {[
            { label: "Open", value: compact(book.symbol, row.open) },
            { label: "Net", value: signed(book.symbol, row.net) },
            { label: "Close", value: compact(book.symbol, row.close) },
          ].map((s) => (
            <div key={s.label} className="bg-white px-4 py-3">
              <div className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                {s.label}
              </div>
              <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-neutral-800">
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Flow list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-2 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
            {row.bucket.flows.length} cash flows
          </div>
          <ul className="flex flex-col gap-1.5">
            {sorted.map((flow) => (
              <li
                key={flow.id}
                className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2"
              >
                <span
                  className={`h-7 w-1 shrink-0 rounded-full ${
                    flow.amount >= 0 ? "bg-sky-300" : "bg-neutral-300"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-neutral-800">
                    {flow.counterparty}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                    <span>{KIND_LABEL[flow.kind]}</span>
                    {!flow.confirmed && (
                      <span className="rounded bg-amber-50 px-1 text-amber-700 ring-1 ring-amber-200 ring-inset">
                        estimate
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`font-mono text-sm font-semibold tabular-nums ${
                    flow.amount >= 0 ? "text-sky-700" : "text-neutral-700"
                  }`}
                >
                  {signed(book.symbol, flow.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </>
  );
}
