import { useId, useMemo, useState, type ReactNode } from "react";
import {
  AC_BY_ID,
  CH_BY_ID,
  INFLOW,
  OUTFLOW,
  PERIOD_BY_ID,
  RG_BY_ID,
  money,
  pct,
  shortDate,
  type ClientMove,
  type PeriodKey,
  type Summary,
} from "./data";
import { NetSparkline } from "./charts";
import { EmptyState, FOCUS_RING, MicroLabel, Swatch, Tile, ViewToggle, type View } from "./ui";

/* The custom (non-Highcharts) tiles: the hero, net flows by fund, the region
 * table-bar hybrid and the biggest-client-moves table. */

const flowColor = (v: number) => (v >= 0 ? INFLOW : OUTFLOW);

/* --- shared bits ------------------------------------------------------------------ */

/** Organic growth / deltas: direction glyph + sign, coloured by up-is-good. */
function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  const up = value >= 0;
  return (
    <span className={`whitespace-nowrap ${up ? "text-emerald-700" : "text-rose-700"}`}>
      <span aria-hidden="true">{up ? "▲" : "▼"}</span> {pct(value, 1, true)}
      {suffix}
    </span>
  );
}

/** Inline diverging mini bar about a gray zero line. */
function MiniDiverging({ value, max, width = 60 }: { value: number; max: number; width?: number }) {
  const half = width / 2;
  const w = max > 0 ? Math.max(1, (Math.abs(value) / max) * (half - 1)) : 0;
  return (
    <span aria-hidden="true" className="relative inline-block h-2.5 shrink-0 align-middle" style={{ width }}>
      <span className="absolute inset-y-0 w-px" style={{ left: half, background: "#a3a3a3" }} />
      <span
        className="absolute inset-y-0"
        style={{
          left: value >= 0 ? half + 1 : half - w,
          width: w,
          background: flowColor(value),
        }}
      />
    </span>
  );
}

/* --- hero ---------------------------------------------------------------------------- */

function Satellite({ label, value, sub }: { label: string; value: string; sub: ReactNode }) {
  return (
    <div className="bg-white px-4 py-3">
      <MicroLabel>{label}</MicroLabel>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">{value}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-neutral-500">{sub}</div>
    </div>
  );
}

function topShares(rows: { label: string; v: number }[]) {
  const total = rows.reduce((a, r) => a + r.v, 0);
  if (total <= 0) return "—";
  return [...rows]
    .sort((a, b) => b.v - a.v)
    .slice(0, 2)
    .map((r) => `${r.label} ${pct((r.v / total) * 100, 0)}`)
    .join(" · ");
}

function RateStatus({ rate }: { rate: number }) {
  if (rate > 25)
    return (
      <span className="inline-flex items-center gap-1 text-amber-700">
        <span aria-hidden="true">▲</span> Above the 15–25% norm
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-emerald-700">
      <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3">
        <path d="M2.5 6.2 5 8.6 9.6 3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      {rate < 15 ? "Below the 15–25% norm" : "Within the 15–25% norm"}
    </span>
  );
}

export function HeroTile({ s, period, area }: { s: Summary; period: PeriodKey; area: string }) {
  const id = useId();
  const p = PERIOD_BY_ID[period];
  const aumChange = s.opening > 0 ? (s.closing / s.opening - 1) * 100 : 0;

  const moved = useMemo(() => {
    const lines: { key: string; tone: number; body: ReactNode }[] = [];
    const first = s.byFund[0];
    const last = s.byFund[s.byFund.length - 1];
    if (first && first.net > 0)
      lines.push({
        key: "in",
        tone: 1,
        body: (
          <>
            <b className="font-semibold text-neutral-900">{first.fund.name}</b> led inflows at{" "}
            <span className="font-mono whitespace-nowrap tabular-nums">{money(first.net, { signed: true })}</span>
          </>
        ),
      });
    if (last && last.net < 0 && last !== first)
      lines.push({
        key: "out",
        tone: -1,
        body: (
          <>
            <b className="font-semibold text-neutral-900">{last.fund.name}</b> had the largest outflow,{" "}
            <span className="font-mono whitespace-nowrap tabular-nums">{money(last.net)}</span>
          </>
        ),
      });
    if (s.byAc.length > 1) {
      const sorted = [...s.byAc].sort((a, b) => b.net - a.net);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      lines.push({
        key: "ac",
        tone: best.net,
        body: (
          <>
            <b className="font-semibold text-neutral-900">{AC_BY_ID[best.ac].label}</b>{" "}
            <span className="font-mono whitespace-nowrap tabular-nums">{money(best.net, { signed: true })}</span> against{" "}
            <b className="font-semibold text-neutral-900">{AC_BY_ID[worst.ac].label.toLowerCase()}</b>{" "}
            <span className="font-mono whitespace-nowrap tabular-nums">{money(worst.net, { signed: true })}</span>
          </>
        ),
      });
    }
    if (s.byChannel.length > 1) {
      const sorted = [...s.byChannel].sort((a, b) => b.net - a.net);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      lines.push({
        key: "ch",
        tone: best.net,
        body: (
          <>
            <b className="font-semibold text-neutral-900">{CH_BY_ID[best.ch].label}</b> was the best channel at{" "}
            <span className="font-mono whitespace-nowrap tabular-nums">{money(best.net, { signed: true })}</span>;{" "}
            <b className="font-semibold text-neutral-900">{CH_BY_ID[worst.ch].label}</b>{" "}
            <span className="font-mono whitespace-nowrap tabular-nums">{money(worst.net, { signed: true })}</span>
          </>
        ),
      });
    }
    if (s.byRegion.length > 1) {
      const sorted = [...s.byRegion].sort((a, b) => b.net - a.net);
      const best = sorted[0];
      lines.push({
        key: "rg",
        tone: best.net,
        body: (
          <>
            <b className="font-semibold text-neutral-900">{RG_BY_ID[best.rg].label}</b> was the strongest region,{" "}
            <span className="font-mono whitespace-nowrap tabular-nums">{money(best.net, { signed: true })}</span> (
            {pct(best.organic, 1, true)} organic)
          </>
        ),
      });
    }
    return lines;
  }, [s]);

  const bridge: { label: string; value: string; key: string }[] = [
    { key: "open", label: "Opening", value: money(s.opening, { bnDp: 1 }) },
    { key: "sales", label: "sales", value: money(s.sales, { signed: true, bnDp: 1 }) },
    { key: "red", label: "redemptions", value: money(-s.red, { bnDp: 1 }) },
    { key: "mkt", label: "markets", value: money(s.mkt, { signed: true, bnDp: 1 }) },
    { key: "close", label: "Closing", value: money(s.closing, { bnDp: 1 }) },
  ];

  return (
    <section
      aria-labelledby={id}
      style={{ gridArea: area }}
      className="flex min-w-0 flex-col border border-neutral-200 bg-white"
    >
      <div className="px-5 pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 id={id}>
            <MicroLabel>Net flows · {p.long}</MicroLabel>
          </h2>
          <span className="text-[11px] text-neutral-500">{p.range}</span>
        </div>

        <div
          className="mt-3 leading-none font-semibold tracking-tight text-neutral-950"
          style={{ fontSize: 60, letterSpacing: "-0.03em" }}
        >
          {money(s.net, { signed: true })}
        </div>
        <div className="mt-2.5 text-[13px] text-neutral-600">
          <Delta value={s.organic} /> organic growth, annualised on {money(s.opening, { bnDp: 1 })} opening AUM
        </div>

        <div className="mt-5">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <MicroLabel>Net flow by month · last 12</MicroLabel>
            <span className="text-[10px] text-neutral-400">
              {period === "12M" ? "whole window" : `shaded = ${p.label}`}
            </span>
          </div>
          <NetSparkline data={s.monthly} from={p.from} height={64} />
        </div>
      </div>

      <div className="mt-5 border-t border-neutral-100 px-5 py-4">
        <MicroLabel>AUM bridge</MicroLabel>
        <p className="mt-1.5 text-[15px] leading-7 text-neutral-500">
          {bridge.map((b, i) => (
            <span key={b.key}>
              {i > 0 && " "}
              <span className="whitespace-nowrap">
              {i > 0 && (
                <span aria-hidden="true" className="mr-1.5 text-neutral-300">
                  →
                </span>
              )}
              {b.key === "open" || b.key === "close" ? (
                <>
                  {b.label} <span className="font-semibold text-neutral-900">{b.value}</span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-neutral-900">{b.value}</span> {b.label}
                </>
              )}
              </span>
            </span>
          ))}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px border-y border-neutral-200 bg-neutral-200">
        <Satellite
          label="Gross sales"
          value={money(s.sales)}
          sub={topShares(s.byChannel.map((c) => ({ label: CH_BY_ID[c.ch].label, v: c.sales })))}
        />
        <Satellite
          label="Redemptions"
          value={money(s.red)}
          sub={topShares(s.byChannel.map((c) => ({ label: CH_BY_ID[c.ch].label, v: c.red })))}
        />
        <Satellite
          label="AUM"
          value={money(s.closing)}
          sub={
            <>
              <Delta value={aumChange} /> since {p.opened}, incl. markets
            </>
          }
        />
        <Satellite
          label="Redemption rate"
          value={pct(s.redRate)}
          sub={
            <span className="flex flex-wrap items-center gap-x-2">
              <RateStatus rate={s.redRate} />
              <span className="text-neutral-400">ann., on avg AUM</span>
            </span>
          }
        />
      </div>

      <div className="flex-1 px-5 pt-4 pb-5">
        <MicroLabel>What moved</MicroLabel>
        <ul className="mt-2 flex flex-col gap-2 text-[12.5px] leading-snug text-neutral-600">
          {moved.map((m) => (
            <li key={m.key} className="flex items-start gap-2.5">
              <Swatch color={flowColor(m.tone)} className="mt-1 h-2 w-2" />
              <span>{m.body}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* --- net flows by fund (diverging, click to focus) ------------------------------------ */

const TH = "px-2 py-1.5 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase";
const TD_NUM = "px-2 py-1.5 text-right font-mono text-[11px] whitespace-nowrap text-neutral-800 tabular-nums";

export function FundsTile({
  s,
  area,
  focus,
  onFocus,
  inline = false,
}: {
  s: Summary;
  area: string;
  focus: string | null;
  onFocus: (id: string | null) => void;
  /** wide tile: fund name and bar on one line instead of stacked */
  inline?: boolean;
}) {
  const [view, setView] = useState<View>("chart");
  const max = Math.max(1, ...s.byFund.map((f) => Math.abs(f.net)));
  const SCALE = 33; // % of the row width the longest bar may take on its side

  return (
    <Tile
      area={area}
      title="Net flows by fund"
      subtitle="Most positive to most negative · click a fund to focus the client table"
      actions={<ViewToggle subject="Net flows by fund" chartLabel="Bars" value={view} onChange={setView} />}
      footer={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <Swatch color={INFLOW} /> Net inflow
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Swatch color={OUTFLOW} /> Net outflow
          </span>
          <span className="text-neutral-400">Small square = asset class</span>
        </span>
      }
    >
      {view === "chart" ? (
        <div>
          <div
            className="mb-1 flex justify-between px-1.5 text-[10px] font-medium text-neutral-400"
            style={inline ? { paddingLeft: 258 } : undefined}
          >
            <span>← Outflow</span>
            <span>Inflow →</span>
          </div>
          <ul className="flex flex-col">
            {s.byFund.map((f) => {
              const on = focus === f.fund.id;
              const dim = focus !== null && !on;
              const w = (Math.abs(f.net) / max) * SCALE;
              const pos = f.net >= 0;
              return (
                <li key={f.fund.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`${f.fund.name}: net ${pos ? "inflow" : "outflow"} ${money(f.net, { signed: true })}. ${
                      on ? "Clear focus" : "Focus the client table on this fund"
                    }`}
                    onClick={() => onFocus(on ? null : f.fund.id)}
                    className={`w-full px-1.5 py-[3px] text-left transition ${inline ? "flex items-center gap-3" : "block"} ${FOCUS_RING} ${
                      on ? "bg-sky-50 ring-1 ring-sky-600 ring-inset" : "hover:bg-neutral-50"
                    } ${dim ? "opacity-35 hover:opacity-80" : ""}`}
                  >
                    <span
                      className={`flex items-center gap-1.5 text-[11px] leading-4 text-neutral-800 ${inline ? "shrink-0" : ""}`}
                      style={inline ? { width: 240 } : undefined}
                    >
                      <Swatch color={AC_BY_ID[f.fund.ac].color} className="h-1.5 w-1.5" />
                      <span className={`truncate ${on ? "font-semibold text-neutral-950" : ""}`}>{f.fund.name}</span>
                    </span>
                    <span className={`relative block h-3 ${inline ? "min-w-0 flex-1" : "mt-0.5"}`}>
                      <span className="absolute inset-y-0 left-1/2 w-px" style={{ background: "#a3a3a3" }} />
                      <span
                        className="absolute inset-y-0"
                        style={{
                          background: flowColor(f.net),
                          width: `${Math.max(w, 0.4)}%`,
                          ...(pos ? { left: "calc(50% + 1px)" } : { right: "50%" }),
                        }}
                      />
                      <span
                        className="absolute top-1/2 -translate-y-1/2 font-mono text-[10px] leading-none whitespace-nowrap text-neutral-700 tabular-nums"
                        style={pos ? { left: `calc(50% + ${w}% + 5px)` } : { right: `calc(50% + ${w}% + 4px)` }}
                      >
                        {money(f.net, { signed: true })}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Gross sales, redemptions and net flows by fund</caption>
            <thead>
              <tr className="border-b border-neutral-200">
                <th scope="col" className={TH}>
                  Fund
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Sales
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Redm.
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Net
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {s.byFund.map((f) => (
                <tr key={f.fund.id} className={focus === f.fund.id ? "bg-sky-50" : undefined}>
                  <th scope="row" className="px-2 py-1.5 text-[11px] leading-tight font-normal text-neutral-800">
                    {f.fund.name}
                  </th>
                  <td className={TD_NUM}>{money(f.sales)}</td>
                  <td className={TD_NUM}>{money(f.red)}</td>
                  <td className={`${TD_NUM} font-semibold`}>{money(f.net, { signed: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tile>
  );
}

/* --- net flows by region (table-bar hybrid) -------------------------------------------- */

export function RegionTile({ s, area }: { s: Summary; area: string }) {
  const rows = [...s.byRegion].sort((a, b) => b.net - a.net);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
  return (
    <Tile
      area={area}
      title="Net flows by region"
      subtitle="Ranked by net flow · bar about zero, gross in / out beneath"
      footer="Organic = annualised net flows ÷ opening AUM."
    >
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Net flows, organic growth, gross sales and redemptions by region</caption>
        <thead>
          <tr className="border-b border-neutral-200">
            <th scope="col" className={`${TH} pl-0`}>
              Region
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Net flow
            </th>
            <th scope="col" className={`${TH} w-20 pr-0 text-right`}>
              Organic
            </th>
          </tr>
        </thead>
        {rows.map((r) => (
          <tbody key={r.rg} className="border-b border-neutral-100 last:border-b-0">
            <tr>
              <th scope="row" className="pt-2.5 pr-2 text-left text-xs font-medium whitespace-nowrap text-neutral-800">
                {RG_BY_ID[r.rg].label}
              </th>
              <td className="px-2 pt-2.5 text-right font-mono text-xs font-semibold whitespace-nowrap text-neutral-900 tabular-nums">
                {money(r.net, { signed: true })}
              </td>
              <td className="pt-2.5 pl-2 text-right font-mono text-[11px] tabular-nums">
                <Delta value={r.organic} />
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="pt-1.5 pb-2.5">
                <div className="flex items-center gap-3">
                  <div className="relative h-2.5 min-w-0 flex-1" aria-hidden="true">
                    <span className="absolute -inset-y-0.5 left-1/2 w-px" style={{ background: "#a3a3a3" }} />
                    <span
                      className="absolute inset-y-0"
                      style={{
                        background: flowColor(r.net),
                        width: `${Math.max(0.5, (Math.abs(r.net) / max) * 49.5)}%`,
                        ...(r.net >= 0 ? { left: "calc(50% + 1px)" } : { right: "50%" }),
                      }}
                    />
                  </div>
                  <span className="shrink-0 font-mono text-[10px] whitespace-nowrap text-neutral-400 tabular-nums">
                    {money(r.sales, { bnDp: 1 })} in · {money(r.red, { bnDp: 1 })} out
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        ))}
      </table>
    </Tile>
  );
}

/* --- biggest client moves ----------------------------------------------------------------- */

type SortKey = "size" | "client" | "type" | "fund" | "channel" | "net" | "last" | "rm";
type Dir = "asc" | "desc";

const COLUMNS: { key: Exclude<SortKey, "size">; label: string; right?: boolean }[] = [
  { key: "client", label: "Client" },
  { key: "type", label: "Client type" },
  { key: "fund", label: "Fund" },
  { key: "channel", label: "Channel" },
  { key: "net", label: "Net flow", right: true },
  { key: "last", label: "Last trade", right: true },
  { key: "rm", label: "RM" },
];

const sortValue = (m: ClientMove, k: SortKey): string | number => {
  switch (k) {
    case "size":
      return Math.abs(m.net);
    case "client":
      return m.client.name;
    case "type":
      return m.client.type;
    case "fund":
      return m.fund.name;
    case "channel":
      return CH_BY_ID[m.client.ch].label;
    case "net":
      return m.net;
    case "last":
      return m.last;
    case "rm":
      return m.client.rm;
  }
};

function SortIcon({ state }: { state: Dir | null }) {
  return (
    <svg viewBox="0 0 8 12" aria-hidden="true" className="h-3 w-2 shrink-0">
      <path d="M1 4.5 4 1.5l3 3" fill="none" strokeWidth="1.3" stroke={state === "asc" ? "#0369a1" : "#d4d4d4"} />
      <path d="M1 7.5 4 10.5l3-3" fill="none" strokeWidth="1.3" stroke={state === "desc" ? "#0369a1" : "#d4d4d4"} />
    </svg>
  );
}

export function ClientsTile({
  moves,
  area,
  period,
  focusName,
  onClearFocus,
  retailOnly,
}: {
  /** every move in the slice (already fund-focused), largest first */
  moves: ClientMove[];
  area: string;
  period: PeriodKey;
  focusName: string | null;
  onClearFocus: () => void;
  retailOnly: boolean;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: Dir }>({ key: "size", dir: "desc" });
  const top = useMemo(() => moves.slice(0, 12), [moves]);
  const rows = useMemo(
    () =>
      [...top].sort((a, b) => {
        const va = sortValue(a, sort.key);
        const vb = sortValue(b, sort.key);
        const c =
          typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
        return sort.dir === "asc" ? c : -c;
      }),
    [top, sort],
  );
  const max = Math.max(1, ...top.map((m) => Math.abs(m.net)));
  const p = PERIOD_BY_ID[period];

  const clickSort = (key: SortKey) =>
    setSort((cur) =>
      cur.key === key
        ? { key, dir: cur.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "net" || key === "last" ? "desc" : "asc" },
    );

  return (
    <Tile
      area={area}
      title={
        <span className="flex flex-wrap items-center gap-2">
          Biggest client moves
          {focusName && (
            <button
              type="button"
              onClick={onClearFocus}
              aria-label={`Remove fund focus: ${focusName}`}
              className={`inline-flex h-6 items-center gap-1.5 border border-sky-300 bg-sky-50 pr-1.5 pl-2 text-[11px] font-medium text-sky-950 hover:border-sky-500 ${FOCUS_RING}`}
            >
              <span className="text-sky-700">Fund</span> {focusName}
              <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3 text-sky-700">
                <path d="M3 3l6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          )}
        </span>
      }
      subtitle={
        moves.length > 0
          ? `Top ${top.length} of ${moves.length} client × fund net flows · ${p.long} (${p.range})`
          : `${p.long} (${p.range})`
      }
      actions={
        sort.key !== "size" ? (
          <button
            type="button"
            onClick={() => setSort({ key: "size", dir: "desc" })}
            className={`h-6 border border-neutral-200 px-2 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100 ${FOCUS_RING}`}
          >
            Rank by size
          </button>
        ) : (
          <span className="text-[11px] text-neutral-400">Ranked by size of move</span>
        )
      }
      footer="Net of subscriptions and redemptions per client and fund over the period. Tickets under £10m are excluded."
    >
      {rows.length === 0 ? (
        <EmptyState
          title="No client moves above £10m"
          body={
            retailOnly
              ? "Retail direct flows are many small tickets; no single client move tops £10m."
              : focusName
                ? `No single client moved more than £10m in ${focusName} over this period.`
                : "Nothing in this slice clears the £10m threshold. Widen the period or filters."
          }
          action={
            focusName ? (
              <button
                type="button"
                onClick={onClearFocus}
                className={`mt-1 h-7 border border-neutral-200 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-100 ${FOCUS_RING}`}
              >
                Clear fund focus
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="-mx-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <caption className="sr-only">
              Biggest client moves, {p.long.toLowerCase()}. Column headers sort the table.
            </caption>
            <thead>
              <tr className="border-y border-neutral-200 bg-neutral-50">
                {COLUMNS.map((c, i) => {
                  const active = sort.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={`py-0 ${i === 0 ? "pl-4" : "pl-2"} ${i === COLUMNS.length - 1 ? "pr-4" : "pr-2"} ${
                        c.right ? "text-right" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => clickSort(c.key)}
                        className={`inline-flex h-8 items-center gap-1 text-[10px] font-semibold tracking-wider whitespace-nowrap uppercase ${FOCUS_RING} ${
                          active ? "text-sky-800" : "text-neutral-500 hover:text-neutral-800"
                        } ${c.right ? "flex-row-reverse" : ""}`}
                      >
                        {c.label}
                        <SortIcon state={active ? sort.dir : null} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((m) => (
                <tr key={m.key} className="hover:bg-neutral-50">
                  <th scope="row" className="py-2.5 pr-2 pl-4 text-xs font-medium text-neutral-900">
                    {m.client.name}
                  </th>
                  <td className="px-2 py-2.5 text-[11px] whitespace-nowrap text-neutral-600">{m.client.type}</td>
                  <td className="px-2 py-2.5 text-xs text-neutral-800">
                    <span className="flex items-center gap-1.5">
                      <Swatch color={AC_BY_ID[m.fund.ac].color} className="h-1.5 w-1.5" />
                      <span className="leading-tight">{m.fund.name}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-[11px] whitespace-nowrap text-neutral-600">
                    {CH_BY_ID[m.client.ch].label}
                  </td>
                  <td className="px-2 py-2.5 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-2.5">
                      <span className="font-mono text-xs font-semibold text-neutral-900 tabular-nums">
                        {money(m.net, { signed: true })}
                      </span>
                      <MiniDiverging value={m.net} max={max} />
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-[11px] whitespace-nowrap text-neutral-600 tabular-nums">
                    {shortDate(m.last)}
                  </td>
                  <td className="py-2.5 pr-4 pl-2 text-[11px] whitespace-nowrap text-neutral-600">{m.client.rm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tile>
  );
}
