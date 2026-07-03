import { useMemo, useState } from "react";

export const title = "Client Overview";
export const fullWidth = true;

/* Client Overview — the advisor's book on one screen.
 *
 * The top strip rolls the whole book into four headline figures; the body is a
 * responsive board of household cards. Each card is a mini-profile: AUM, YTD
 * performance, risk mandate, cash drag and the next scheduled review. A segment
 * filter and sort let an advisor triage — who's drifted, who's overdue, who's
 * grown. Cards beat a dense grid here because the advisor scans people, not
 * rows. */

type Segment = "private" | "premier" | "family-office" | "emerging";
type Trend = "up" | "down" | "flat";

type Household = {
  id: string;
  name: string;
  lead: string;
  segment: Segment;
  aum: number;
  netNewYtd: number;
  ytdReturn: number;
  benchmarkYtd: number;
  cashPct: number;
  riskProfile: "Conservative" | "Balanced" | "Growth" | "Aggressive";
  nextReview: string;
  reviewDueDays: number;
  trend: Trend;
  spark: number[];
  flags: string[];
};

const HOUSEHOLDS: Household[] = [
  {
    id: "HH-1042",
    name: "The Harrington Trust",
    lead: "R. Okafor",
    segment: "family-office",
    aum: 128_400_000,
    netNewYtd: 6_200_000,
    ytdReturn: 9.4,
    benchmarkYtd: 8.1,
    cashPct: 3.2,
    riskProfile: "Growth",
    nextReview: "2026-07-14",
    reviewDueDays: 12,
    trend: "up",
    spark: [100, 102, 101, 104, 106, 105, 108, 109],
    flags: [],
  },
  {
    id: "HH-2210",
    name: "Nakamura Family",
    lead: "R. Okafor",
    segment: "private",
    aum: 42_900_000,
    netNewYtd: -1_800_000,
    ytdReturn: 5.1,
    benchmarkYtd: 8.1,
    cashPct: 14.6,
    riskProfile: "Balanced",
    nextReview: "2026-07-03",
    reviewDueDays: 1,
    trend: "flat",
    spark: [100, 101, 100, 99, 101, 100, 102, 101],
    flags: ["Cash drag", "Review due"],
  },
  {
    id: "HH-3381",
    name: "Villarreal Holdings",
    lead: "S. Bianchi",
    segment: "premier",
    aum: 18_600_000,
    netNewYtd: 2_450_000,
    ytdReturn: 11.8,
    benchmarkYtd: 8.1,
    cashPct: 2.1,
    riskProfile: "Aggressive",
    nextReview: "2026-08-22",
    reviewDueDays: 51,
    trend: "up",
    spark: [100, 103, 105, 104, 108, 110, 112, 115],
    flags: [],
  },
  {
    id: "HH-1195",
    name: "Eleanor & James Pryce",
    lead: "S. Bianchi",
    segment: "private",
    aum: 9_250_000,
    netNewYtd: 340_000,
    ytdReturn: 4.2,
    benchmarkYtd: 8.1,
    cashPct: 8.9,
    riskProfile: "Conservative",
    nextReview: "2026-06-28",
    reviewDueDays: -4,
    trend: "down",
    spark: [100, 100, 99, 98, 99, 98, 97, 98],
    flags: ["Review overdue", "Underperforming"],
  },
  {
    id: "HH-4407",
    name: "Adeyemi Foundation",
    lead: "R. Okafor",
    segment: "family-office",
    aum: 76_100_000,
    netNewYtd: 12_900_000,
    ytdReturn: 8.7,
    benchmarkYtd: 8.1,
    cashPct: 5.4,
    riskProfile: "Balanced",
    nextReview: "2026-07-30",
    reviewDueDays: 28,
    trend: "up",
    spark: [100, 101, 103, 102, 104, 106, 107, 108],
    flags: [],
  },
  {
    id: "HH-5560",
    name: "Costa Del Rio SL",
    lead: "M. Fischer",
    segment: "premier",
    aum: 23_800_000,
    netNewYtd: 0,
    ytdReturn: 7.9,
    benchmarkYtd: 8.1,
    cashPct: 6.1,
    riskProfile: "Growth",
    nextReview: "2026-07-09",
    reviewDueDays: 7,
    trend: "flat",
    spark: [100, 102, 101, 103, 102, 104, 103, 104],
    flags: [],
  },
  {
    id: "HH-6621",
    name: "Whitfield Partners",
    lead: "M. Fischer",
    segment: "emerging",
    aum: 3_400_000,
    netNewYtd: 900_000,
    ytdReturn: 6.6,
    benchmarkYtd: 8.1,
    cashPct: 19.8,
    riskProfile: "Growth",
    nextReview: "2026-07-05",
    reviewDueDays: 3,
    trend: "up",
    spark: [100, 101, 102, 104, 103, 105, 106, 107],
    flags: ["Cash drag"],
  },
  {
    id: "HH-7788",
    name: "The Okonkwo Estate",
    lead: "S. Bianchi",
    segment: "private",
    aum: 54_700_000,
    netNewYtd: 4_100_000,
    ytdReturn: 10.2,
    benchmarkYtd: 8.1,
    cashPct: 4.3,
    riskProfile: "Growth",
    nextReview: "2026-08-11",
    reviewDueDays: 40,
    trend: "up",
    spark: [100, 102, 104, 103, 106, 108, 109, 111],
    flags: [],
  },
];

const SEGMENT_LABEL: Record<Segment, string> = {
  private: "Private",
  premier: "Premier",
  "family-office": "Family Office",
  emerging: "Emerging",
};

const SEGMENT_TONE: Record<Segment, string> = {
  private: "bg-indigo-100 text-indigo-700",
  premier: "bg-violet-100 text-violet-700",
  "family-office": "bg-amber-100 text-amber-800",
  emerging: "bg-sky-100 text-sky-700",
};

type SortKey = "aum" | "return" | "review" | "netnew";

function fmtMoney(n: number) {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(1)}m`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(0)}k`;
  return `${sign}$${a}`;
}

function fmtPct(n: number, withSign = false) {
  const s = withSign && n > 0 ? "+" : "";
  return `${s}${n.toFixed(1)}%`;
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const w = 96;
  const h = 28;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-24" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={positive ? "#059669" : "#e11d48"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down" | "neutral";
}) {
  const subTone =
    tone === "up"
      ? "text-emerald-600"
      : tone === "down"
        ? "text-rose-600"
        : "text-neutral-500";
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-neutral-900">
        {value}
      </div>
      {sub && <div className={`mt-0.5 text-xs font-medium ${subTone}`}>{sub}</div>}
    </div>
  );
}

export default function ClientOverviewPage() {
  const [segment, setSegment] = useState<"all" | Segment>("all");
  const [sort, setSort] = useState<SortKey>("aum");
  const [query, setQuery] = useState("");

  const totals = useMemo(() => {
    const aum = HOUSEHOLDS.reduce((s, h) => s + h.aum, 0);
    const netNew = HOUSEHOLDS.reduce((s, h) => s + h.netNewYtd, 0);
    const reviewsDue = HOUSEHOLDS.filter((h) => h.reviewDueDays <= 14).length;
    const wAvgReturn =
      HOUSEHOLDS.reduce((s, h) => s + h.ytdReturn * h.aum, 0) / aum;
    return { aum, netNew, reviewsDue, wAvgReturn };
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = HOUSEHOLDS.filter((h) => {
      if (segment !== "all" && h.segment !== segment) return false;
      if (q && !`${h.name} ${h.id} ${h.lead}`.toLowerCase().includes(q))
        return false;
      return true;
    });
    const sorters: Record<SortKey, (a: Household, b: Household) => number> = {
      aum: (a, b) => b.aum - a.aum,
      return: (a, b) => b.ytdReturn - a.ytdReturn,
      review: (a, b) => a.reviewDueDays - b.reviewDueDays,
      netnew: (a, b) => b.netNewYtd - a.netNewYtd,
    };
    return [...items].sort(sorters[sort]);
  }, [segment, sort, query]);

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              Advisory · Book of business
            </div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
              Client Overview
            </h1>
            <p className="mt-0.5 text-xs text-neutral-500">
              Every household you cover, triaged by AUM, performance and who's
              due a review.
            </p>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search household, lead or ID…"
            className="w-64 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
          />
        </div>

        {/* KPI strip */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi
            label="Total AUM"
            value={fmtMoney(totals.aum)}
            sub={`${HOUSEHOLDS.length} households`}
          />
          <Kpi
            label="Net new (YTD)"
            value={fmtMoney(totals.netNew)}
            sub={totals.netNew >= 0 ? "Positive flows" : "Net outflow"}
            tone={totals.netNew >= 0 ? "up" : "down"}
          />
          <Kpi
            label="Book return (YTD)"
            value={fmtPct(totals.wAvgReturn)}
            sub={`vs 8.1% benchmark`}
            tone={totals.wAvgReturn >= 8.1 ? "up" : "down"}
          />
          <Kpi
            label="Reviews due ≤14d"
            value={String(totals.reviewsDue)}
            sub="Schedule outreach"
            tone={totals.reviewsDue > 0 ? "down" : "neutral"}
          />
        </div>
      </header>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-6 py-2.5">
        <div className="flex flex-wrap items-center gap-1">
          {(["all", "private", "premier", "family-office", "emerging"] as const).map(
            (s) => {
              const active = segment === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSegment(s)}
                  aria-pressed={active}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "bg-neutral-900 text-white"
                      : "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
                  }`}
                >
                  {s === "all" ? "All segments" : SEGMENT_LABEL[s]}
                </button>
              );
            },
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs">
          <span className="text-neutral-400">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700"
          >
            <option value="aum">AUM (high → low)</option>
            <option value="return">YTD return</option>
            <option value="review">Review soonest</option>
            <option value="netnew">Net new money</option>
          </select>
        </div>
      </div>

      {/* Card board */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {shown.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center text-sm text-neutral-500">
            No households match your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((h) => {
              const beatBench = h.ytdReturn >= h.benchmarkYtd;
              const overdue = h.reviewDueDays < 0;
              const soon = h.reviewDueDays >= 0 && h.reviewDueDays <= 7;
              return (
                <article
                  key={h.id}
                  className="group flex flex-col rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-neutral-900">
                        {h.name}
                      </h3>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500">
                        <span className="font-mono">{h.id}</span>
                        <span aria-hidden>·</span>
                        <span>{h.lead}</span>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEGMENT_TONE[h.segment]}`}
                    >
                      {SEGMENT_LABEL[h.segment]}
                    </span>
                  </div>

                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                        AUM
                      </div>
                      <div className="text-xl font-semibold tabular-nums tracking-tight text-neutral-900">
                        {fmtMoney(h.aum)}
                      </div>
                    </div>
                    <Sparkline data={h.spark} positive={h.trend !== "down"} />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-3 text-center">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-neutral-400">
                        YTD
                      </div>
                      <div
                        className={`text-sm font-semibold tabular-nums ${
                          beatBench ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {fmtPct(h.ytdReturn, true)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-neutral-400">
                        Net new
                      </div>
                      <div
                        className={`text-sm font-semibold tabular-nums ${
                          h.netNewYtd > 0
                            ? "text-emerald-600"
                            : h.netNewYtd < 0
                              ? "text-rose-600"
                              : "text-neutral-500"
                        }`}
                      >
                        {h.netNewYtd === 0 ? "—" : fmtMoney(h.netNewYtd)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-neutral-400">
                        Cash
                      </div>
                      <div
                        className={`text-sm font-semibold tabular-nums ${
                          h.cashPct > 12 ? "text-amber-600" : "text-neutral-700"
                        }`}
                      >
                        {h.cashPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-600">
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-700">
                        {h.riskProfile}
                      </span>
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                        overdue
                          ? "text-rose-600"
                          : soon
                            ? "text-amber-600"
                            : "text-neutral-500"
                      }`}
                    >
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-3.5 w-3.5"
                        aria-hidden
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1.5 4.75c0-.69.56-1.25 1.25-1.25h9a1.25 1.25 0 0 1 1.25 1.25V8h-11.5V6.75Zm0 2.75V15.25c0 .69.56 1.25 1.25 1.25h9c.69 0 1.25-.56 1.25-1.25V9.5H4.25Z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {overdue
                        ? `Review ${Math.abs(h.reviewDueDays)}d overdue`
                        : `Review in ${h.reviewDueDays}d`}
                    </span>
                  </div>

                  {h.flags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {h.flags.map((f) => (
                        <span
                          key={f}
                          className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
