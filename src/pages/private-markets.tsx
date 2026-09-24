import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  COLOR,
  FUNDS,
  LATEST_Q,
  STRATEGIES,
  STRATEGY_LABEL,
  VINTAGES,
  VINTAGE_MAX,
  VINTAGE_MIN,
  aggregate,
  gbp,
  mult,
  num,
  pct,
  pp,
  qLabel,
  type Aggregate,
  type Fund,
  type StrategyId,
  type Universe,
} from "../components/private-markets/model";
import {
  Card,
  FOCUS,
  MiniMultiples,
  QuartileBadge,
  Swatch,
  TD,
  TDL,
  TH,
  THL,
} from "../components/private-markets/ui";
import {
  JCurveCard,
  ProjectionCard,
  VintageCard,
} from "../components/private-markets/charts";

export const title = "Private Markets";
export const fullWidth = true;

/* Private Markets: master–detail over an LP's fund commitments.
 *
 * Left: the commitment list with its filters (search, strategy chips, vintage
 * range) and a pinned "Total programme" row that aggregates whatever the
 * filters leave. Right: the detail for the selected row — KPIs, the
 * DPI + RVPI = TVPI bar, net IRR against a public-market equivalent, the
 * J-curve, vintage quartile ranking and the call projection, then either the
 * fund table (programme) or the capital account statement (one fund).
 * Everything is derived from the seeded cash flows in the model module. */

const MICRO = "text-[10px] font-semibold tracking-widest text-neutral-400 uppercase";
const TOTAL = "total";

type SortKey =
  | "name"
  | "vintage"
  | "commitment"
  | "paidIn"
  | "nav"
  | "dpi"
  | "rvpi"
  | "tvpi"
  | "irr"
  | "quartile";

export default function PrivateMarketsPage() {
  const [query, setQuery] = useState("");
  const [strats, setStrats] = useState<StrategyId[]>([]);
  const [from, setFrom] = useState(VINTAGE_MIN);
  const [to, setTo] = useState(VINTAGE_MAX);
  const [selectedId, setSelectedId] = useState<string>(TOTAL);
  const mainRef = useRef<HTMLElement>(null);

  const needle = query.trim().toLowerCase();
  // `base` applies every filter except strategy, so the chips can show counts.
  const base = useMemo(
    () =>
      FUNDS.filter(
        (f) =>
          f.vintage >= from &&
          f.vintage <= to &&
          (!needle ||
            `${f.name} ${f.gp} ${STRATEGY_LABEL[f.strategy]}`
              .toLowerCase()
              .includes(needle)),
      ),
    [needle, from, to],
  );
  const filtered = useMemo(
    () => (strats.length ? base.filter((f) => strats.includes(f.strategy)) : base),
    [base, strats],
  );
  // A fund that the filters remove drops the view back to the programme.
  const selected =
    selectedId === TOTAL ? null : (filtered.find((f) => f.id === selectedId) ?? null);
  const programme = useMemo(() => aggregate(filtered), [filtered]);
  const agg = useMemo(
    () => (selected ? aggregate([selected]) : programme),
    [selected, programme],
  );

  const filtersActive =
    needle !== "" || strats.length > 0 || from !== VINTAGE_MIN || to !== VINTAGE_MAX;
  const reset = () => {
    setQuery("");
    setStrats([]);
    setFrom(VINTAGE_MIN);
    setTo(VINTAGE_MAX);
  };

  const select = (id: string, opts: { scrollDetail?: boolean } = {}) => {
    setSelectedId(id);
    document.getElementById(`pm-row-${id}`)?.scrollIntoView({ block: "nearest" });
    if (opts.scrollDetail) mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const order = [TOTAL, ...filtered.map((f) => f.id)];
  const onRowKey = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = order.indexOf(id);
    const next =
      order[Math.max(0, Math.min(order.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
    setSelectedId(next);
    document.getElementById(`pm-row-${next}`)?.focus();
  };

  const vintages = useMemo(() => VINTAGES.filter((v) => v >= from && v <= to), [from, to]);
  const strategiesInView = new Set(filtered.map((f) => f.strategy));
  const universe: Universe = selected
    ? selected.strategy
    : strategiesInView.size === 1
      ? [...strategiesInView][0]
      : "all";
  const dots = useMemo(
    () => (selected ? filtered.filter((f) => f.strategy === selected.strategy) : filtered),
    [selected, filtered],
  );

  return (
    <div className="flex h-full flex-col bg-neutral-50 text-neutral-900">
      {/* pl-36 clears the app's fixed Home pill. */}
      <header className="shrink-0 border-b border-neutral-200 bg-white py-4 pr-6 pl-36">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className={MICRO}>Dashboards · Private markets · Oakmere Pension Scheme</div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-950">
              Private Markets
            </h1>
            <p className="mt-0.5 max-w-xl text-xs text-neutral-500">
              How are our commitments performing, and how much cash will be called?
              Twenty-two fund commitments across six strategies, at the latest GP NAVs.
            </p>
          </div>
          <dl className="flex shrink-0 gap-px border border-neutral-200 bg-neutral-200">
            {[
              ["NAV date", "30 Jun 2026"],
              ["Cash flows to", qLabel(LATEST_Q)],
              ["Base currency", "GBP"],
              ["Public market", "MSCI World"],
            ].map(([k, v]) => (
              <div key={k} className="bg-white px-3 py-1.5">
                <dt className={MICRO}>{k}</dt>
                <dd className="mt-0.5 text-[12px] font-medium text-neutral-800">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---------------- master: commitment list ---------------- */}
        <aside
          aria-label="Fund commitments"
          className="flex shrink-0 flex-col border-r border-neutral-200 bg-white"
          style={{ width: 380 }}
        >
          <div className="shrink-0 space-y-3 border-b border-neutral-200 px-4 pt-3 pb-3">
            <div>
              <label htmlFor="pm-search" className={MICRO}>
                Search
              </label>
              <div className="relative mt-1">
                <svg
                  aria-hidden
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 3.5a5.5 5.5 0 1 0 3.4 9.82l3.64 3.64a.75.75 0 1 0 1.06-1.06l-3.64-3.64A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
                    clipRule="evenodd"
                  />
                </svg>
                <input
                  id="pm-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Fund, manager or strategy"
                  className={`w-full appearance-none border border-neutral-200 bg-white py-1.5 pr-2 pl-7 text-[12px] text-neutral-900 placeholder:text-neutral-400 ${FOCUS}`}
                />
              </div>
            </div>

            <fieldset>
              <legend className={MICRO}>Strategy</legend>
              <div className="mt-1 flex flex-wrap gap-1">
                <Chip on={strats.length === 0} onClick={() => setStrats([])} count={base.length}>
                  All
                </Chip>
                {STRATEGIES.map((s) => (
                  <Chip
                    key={s.id}
                    on={strats.includes(s.id)}
                    count={base.filter((f) => f.strategy === s.id).length}
                    onClick={() =>
                      setStrats((cur) =>
                        cur.includes(s.id) ? cur.filter((x) => x !== s.id) : [...cur, s.id],
                      )
                    }
                  >
                    {s.label}
                  </Chip>
                ))}
              </div>
            </fieldset>

            <div className="flex items-end gap-2">
              <VintageSelect
                id="pm-from"
                label="Vintage from"
                value={from}
                onChange={(v) => {
                  setFrom(v);
                  if (v > to) setTo(v);
                }}
              />
              <span aria-hidden className="pb-1.5 text-neutral-300">
                –
              </span>
              <VintageSelect
                id="pm-to"
                label="to"
                value={to}
                onChange={(v) => {
                  setTo(v);
                  if (v < from) setFrom(v);
                }}
              />
              <div className="ml-auto pb-1 text-right" aria-live="polite">
                <div className="text-[12px] text-neutral-600">
                  <span className="font-semibold text-neutral-900">{filtered.length}</span> of{" "}
                  {FUNDS.length} funds
                </div>
                {filtersActive && (
                  <button
                    type="button"
                    onClick={reset}
                    className={`text-[11px] font-medium text-fuchsia-700 underline-offset-2 hover:underline ${FOCUS}`}
                  >
                    Reset filters
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 bg-neutral-50 px-4 py-1.5">
            <span className={MICRO}>Commitment</span>
            <span className="flex items-center gap-2">
              <span className={`${MICRO} w-[44px] text-center`}>DPI+RVPI</span>
              <span className={`${MICRO} w-12 text-right`}>TVPI</span>
              <span className={`${MICRO} w-12 text-right`}>Net IRR</span>
            </span>
          </div>

          {/* Pinned aggregate row: stays put while the funds scroll. */}
          <div className="shrink-0 border-b border-neutral-200">
            <RowButton
              id={TOTAL}
              selected={!selected}
              disabled={!programme}
              onClick={() => select(TOTAL)}
              onKeyDown={(e) => onRowKey(e, TOTAL)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-neutral-950">Total programme</span>
                <span className="text-[11px] text-neutral-500">
                  {filtered.length} fund{filtered.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-[11px] text-neutral-500">
                  {programme ? `${gbp(programme.commitment)} committed` : "No funds in view"}
                </span>
                {programme && <RowMetrics a={programme} />}
              </div>
            </RowButton>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-neutral-800">No funds match</p>
                <p className="mt-1 text-[12px] text-neutral-500">
                  Try clearing the search or widening the vintage range.
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className={`mt-3 border border-neutral-300 px-3 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50 ${FOCUS}`}
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {filtered.map((f) => (
                  <li key={f.id}>
                    <RowButton
                      id={f.id}
                      selected={selected?.id === f.id}
                      onClick={() => select(f.id)}
                      onKeyDown={(e) => onRowKey(e, f.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-neutral-900">
                          {f.name}
                        </span>
                        <QuartileBadge
                          q={f.quartile}
                          context={`${f.vintage} ${STRATEGY_LABEL[f.strategy].toLowerCase()} peers`}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <StrategyTag id={f.strategy} />
                          <span className="font-mono text-[11px] text-neutral-500 tabular-nums">
                            {f.vintage}
                          </span>
                        </span>
                        <RowMetrics a={f} />
                      </div>
                    </RowButton>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="shrink-0 border-t border-neutral-200 px-4 py-2 text-[10px] leading-snug text-neutral-500">
            Q badge: net IRR quartile vs same-strategy, same-vintage peers. Bar: DPI{" "}
            <Swatch color={COLOR.accent} /> + RVPI <Swatch color={COLOR.accentLight} />, tick at
            1.0×.
          </p>
        </aside>

        {/* ---------------- detail pane ---------------- */}
        <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto" aria-live="polite">
          {!programme || !agg ? (
            <div className="flex justify-center px-10 pt-16">
              <div className="max-w-sm border border-dashed border-neutral-300 bg-white px-8 py-10 text-center">
                <p className="text-sm font-semibold text-neutral-900">Nothing to show</p>
                <p className="mt-1 text-[12px] text-neutral-500">
                  No commitments match the current search, strategy and vintage filters, so
                  there is no programme to aggregate.
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className={`mt-4 bg-fuchsia-700 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-fuchsia-800 ${FOCUS}`}
                >
                  Reset filters
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-5">
              <DetailHeader
                fund={selected}
                funds={filtered}
                agg={agg}
                onBack={() => select(TOTAL)}
              />
              <KpiStrip agg={agg} fund={selected} funds={filtered} />
              <MultiplesPanel agg={agg} fund={selected} />
              <JCurveCard agg={agg} scope={selected ? selected.name : "Total programme"} />
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))" }}
              >
                <VintageCard
                  funds={dots}
                  selectedId={selected?.id ?? null}
                  universe={universe}
                  vintages={vintages}
                  onSelect={select}
                />
                <ProjectionCard
                  agg={agg}
                  showBudget={!selected && !filtersActive}
                  budgetNote={
                    selected
                      ? "Fund-level projection; the scheme liquidity budget is shown on the programme view."
                      : "The scheme's quarterly liquidity budget covers the whole programme; clear the filters to compare against it."
                  }
                />
              </div>
              {selected ? (
                <StatementCard key={selected.id} fund={selected} />
              ) : (
                <FundTableCard
                  funds={filtered}
                  agg={programme}
                  onSelect={(id) => select(id, { scrollDetail: true })}
                />
              )}
              <p className="text-[11px] leading-relaxed text-neutral-500">
                Net IRR is XIRR on quarter-end cash flows with the 30 Jun 2026 NAV as terminal
                value, net of fees and carry. KS-PME discounts the same flows by a modelled
                MSCI World (GBP, net) series. Peer quartiles come from a modelled universe of
                about 30 funds per strategy and vintage. Call projections run 400 seeded paths
                with a shared deal-pace shock. All fund and manager names are fictional.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* master list pieces                                                        */
/* ------------------------------------------------------------------------ */

function Chip({
  on,
  count,
  onClick,
  children,
}: {
  on: boolean;
  count: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex items-center gap-1 border px-2 py-1 text-[11px] font-medium transition ${FOCUS} ${
        on
          ? "border-fuchsia-700 bg-fuchsia-700 text-white"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
      }`}
    >
      {children}
      <span
        className={`font-mono text-[10px] tabular-nums ${on ? "text-fuchsia-100" : "text-neutral-400"}`}
      >
        {count}
      </span>
    </button>
  );
}

function VintageSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className={MICRO}>
        {label}
      </label>
      <div className="relative mt-1">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`appearance-none border border-neutral-200 bg-white py-1 pr-7 pl-2 font-mono text-[12px] text-neutral-900 tabular-nums ${FOCUS}`}
        >
          {VINTAGES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          fill="currentColor"
          className="pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </div>
  );
}

function RowButton({
  id,
  selected,
  disabled,
  onClick,
  onKeyDown,
  children,
}: {
  id: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  return (
    <button
      id={`pm-row-${id}`}
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`relative block w-full py-2.5 pr-4 pl-5 text-left transition focus-visible:ring-2 focus-visible:ring-fuchsia-600 focus-visible:outline-none focus-visible:ring-inset ${
        selected ? "bg-fuchsia-50" : "hover:bg-neutral-50"
      }`}
    >
      {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-fuchsia-700" />}
      {children}
    </button>
  );
}

function RowMetrics({ a }: { a: { dpi: number; rvpi: number; tvpi: number; irr: number | null } }) {
  return (
    <span className="flex shrink-0 items-center gap-2">
      <MiniMultiples dpi={a.dpi} rvpi={a.rvpi} />
      <span className="w-12 text-right font-mono text-[12px] font-semibold text-neutral-900 tabular-nums">
        {mult(a.tvpi)}
      </span>
      <span className="w-12 text-right font-mono text-[12px] text-neutral-700 tabular-nums">
        {pct(a.irr)}
      </span>
    </span>
  );
}

function StrategyTag({ id }: { id: StrategyId }) {
  return (
    <span className="shrink-0 border border-neutral-200 bg-neutral-50 px-1 py-px text-[9.5px] font-semibold tracking-wide text-neutral-600 uppercase">
      {STRATEGY_LABEL[id]}
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* detail pieces                                                             */
/* ------------------------------------------------------------------------ */

function DetailHeader({
  fund,
  funds,
  agg,
  onBack,
}: {
  fund: Fund | null;
  funds: Fund[];
  agg: Aggregate;
  onBack: () => void;
}) {
  if (fund) {
    const age = (LATEST_Q + 1 - fund.firstQ) / 4;
    return (
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className={MICRO}>
            Fund · {STRATEGY_LABEL[fund.strategy]} · Vintage {fund.vintage}
          </div>
          <h2 className="mt-0.5 flex items-center gap-2 text-lg font-semibold tracking-tight text-neutral-950">
            {fund.name}
            <QuartileBadge
              q={fund.quartile}
              context={`${fund.vintage} ${STRATEGY_LABEL[fund.strategy].toLowerCase()} peers`}
            />
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Managed by {fund.gp} · first capital call {qLabel(fund.firstQ)} · {age.toFixed(1)}{" "}
            years of cash flows · ranked against {fund.peer.n}{" "}
            {STRATEGY_LABEL[fund.strategy].toLowerCase()} funds of the same vintage
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className={`border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50 ${FOCUS}`}
        >
          ← Total programme
        </button>
      </div>
    );
  }
  const vMin = Math.min(...funds.map((f) => f.vintage));
  const vMax = Math.max(...funds.map((f) => f.vintage));
  const strategies = STRATEGIES.filter((s) => funds.some((f) => f.strategy === s.id));
  return (
    <div className="min-w-0">
      <div className={MICRO}>
        Programme · {funds.length} of {FUNDS.length} funds
      </div>
      <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-950">
        Total programme
      </h2>
      <p className="mt-0.5 text-xs text-neutral-500">
        {strategies.map((s) => s.label).join(", ")} · vintages{" "}
        {vMin === vMax ? vMin : `${vMin}–${vMax}`} · pooled from the first call in{" "}
        {qLabel(agg.firstQ)}
      </p>
    </div>
  );
}

function Delta({
  value,
  tone,
  children,
}: {
  value: number;
  tone: "good-up" | "neutral";
  children: ReactNode;
}) {
  const up = value >= 0;
  const cls =
    tone === "neutral" || Math.abs(value) < 0.05
      ? "text-neutral-600"
      : up
        ? "text-emerald-700"
        : "text-rose-700";
  return (
    <span className={cls}>
      <span aria-hidden>{up ? "▲" : "▼"}</span> {gbp(value, 1, true)}{" "}
      <span className="text-neutral-500">{children}</span>
    </span>
  );
}

function KpiStrip({ agg, fund, funds }: { agg: Aggregate; fund: Fund | null; funds: Fund[] }) {
  const strategies = new Set(funds.map((f) => f.strategy)).size;
  const items: { label: string; value: string; sub: ReactNode }[] = [
    {
      label: "Commitment",
      value: gbp(agg.commitment),
      sub: fund
        ? `${STRATEGY_LABEL[fund.strategy]} · vintage ${fund.vintage}`
        : `${funds.length} funds · ${strategies} strateg${strategies === 1 ? "y" : "ies"}`,
    },
    {
      label: "Paid-in",
      value: gbp(agg.paidIn),
      sub: (
        <>
          <span className="font-semibold text-neutral-800">
            {pct(agg.paidIn / agg.commitment, 0)} called
          </span>{" "}
          · <Delta value={agg.callsLast} tone="neutral">this qtr</Delta>
        </>
      ),
    },
    {
      label: "Distributed",
      value: gbp(agg.distributed),
      sub: <Delta value={agg.distLast} tone="good-up">received in {qLabel(LATEST_Q)}</Delta>,
    },
    {
      label: "NAV",
      value: gbp(agg.nav),
      // NAV's own change mixes in calls and distributions; the valuation
      // move is what the GP marks actually did this quarter.
      sub: (
        <Delta value={agg.nav - agg.navPrev - agg.callsLast + agg.distLast} tone="good-up">
          valuation {agg.nav - agg.navPrev - agg.callsLast + agg.distLast >= 0 ? "gain" : "loss"} in{" "}
          {qLabel(LATEST_Q)}
        </Delta>
      ),
    },
    {
      label: "Unfunded",
      value: gbp(agg.unfunded),
      sub: `${pct(agg.unfunded / agg.commitment, 0)} of commitment still to call`,
    },
  ];
  return (
    <dl
      className="grid gap-px border border-neutral-200 bg-neutral-200"
      style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
    >
      {items.map((k) => (
        <div key={k.label} className="bg-white px-4 py-3">
          <dt className={MICRO}>{k.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">
            {k.value}
          </dd>
          <dd className="mt-1 text-[11px] leading-snug text-neutral-500">{k.sub}</dd>
        </div>
      ))}
    </dl>
  );
}

function MultiplesPanel({ agg, fund }: { agg: Aggregate; fund: Fund | null }) {
  const { dpi, rvpi, tvpi, irr, pme } = agg;
  const max = Math.max(2, Math.ceil((tvpi + 0.2) * 2) / 2);
  const ticks: number[] = [];
  for (let t = 0; t <= max + 1e-9; t += 0.5) ticks.push(t);
  const at = (x: number) => `${(Math.min(x, max) / max) * 100}%`;
  // Keep the in-bar RVPI label clear of the dashed 1.0× line.
  const lineInRvpi = (1 - dpi) / rvpi;
  const rvpiLabelRight = lineInRvpi > 0 && lineInRvpi < 0.55;

  const gap = pme === null ? 0 : pme - 1;
  const verdict =
    pme === null
      ? { icon: "–", cls: "text-neutral-600", text: "Not enough history for a PME" }
      : gap >= 0.03
        ? {
            icon: "▲",
            cls: "text-emerald-700",
            text: `Ahead of public markets: ${pct(gap, 0)} more value than the same cash in MSCI World`,
          }
        : gap <= -0.03
          ? {
              icon: "▼",
              cls: "text-rose-700",
              text: `Behind public markets: ${pct(-gap, 0)} less value than the same cash in MSCI World`,
            }
          : { icon: "●", cls: "text-neutral-700", text: "In line with public markets" };

  const dpiNote =
    dpi >= 1
      ? `Capital back in cash: every £1 paid in has returned ${mult(dpi)} so far, with ${mult(rvpi)} still held at NAV.`
      : `${pct(dpi, 0)} of paid-in capital returned in cash; ${mult(rvpi)} still held at NAV.`;

  return (
    <section
      className="grid border border-neutral-200 bg-white"
      style={{ gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)" }}
    >
      <div className="px-5 py-4">
        <div className={MICRO}>Multiples on paid-in capital</div>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-neutral-600">
          <span className="inline-flex items-baseline gap-1.5">
            <Swatch color={COLOR.accent} />
            DPI <b className="font-semibold text-neutral-900">{mult(dpi)}</b>
          </span>
          <span aria-hidden>+</span>
          <span className="inline-flex items-baseline gap-1.5">
            <Swatch color={COLOR.accentLight} />
            RVPI <b className="font-semibold text-neutral-900">{mult(rvpi)}</b>
          </span>
          <span aria-hidden>=</span>
          <span className="inline-flex items-baseline gap-1.5">
            TVPI{" "}
            <b className="text-3xl font-semibold tracking-tight text-neutral-950">{mult(tvpi)}</b>
          </span>
        </p>

        <div className="mt-3">
          <div
            role="img"
            aria-label={`DPI ${mult(dpi)} plus RVPI ${mult(rvpi)} equals TVPI ${mult(tvpi)}`}
            className="relative h-7 bg-neutral-100"
          >
            <div
              className="absolute inset-y-0 left-0 flex items-center overflow-hidden"
              style={{ width: at(dpi), background: COLOR.accent }}
            >
              {dpi / max > 0.14 && (
                <span className="pl-2 font-mono text-[11px] font-semibold whitespace-nowrap text-white">
                  DPI {mult(dpi)}
                </span>
              )}
            </div>
            <div
              className={`absolute inset-y-0 flex items-center overflow-hidden ${
                rvpiLabelRight ? "justify-end" : ""
              }`}
              style={{
                left: at(dpi),
                width: `calc(${at(dpi + rvpi)} - ${at(dpi)})`,
                background: COLOR.accentLight,
                borderLeft: "2px solid #fff",
              }}
            >
              {rvpi / max > 0.14 && (
                <span className="px-2 font-mono text-[11px] font-semibold whitespace-nowrap text-fuchsia-950">
                  RVPI {mult(rvpi)}
                </span>
              )}
            </div>
            <div
              aria-hidden
              className="absolute -top-1.5 -bottom-1.5 border-l-2 border-dashed border-neutral-800"
              style={{ left: at(1) }}
            />
          </div>
          <div className="relative mt-1 h-4" aria-hidden>
            {ticks.map((t) => (
              <span
                key={t}
                className={`absolute -translate-x-1/2 font-mono text-[10px] tabular-nums ${
                  t === 1 ? "font-semibold text-neutral-800" : "text-neutral-400"
                }`}
                style={{ left: at(t) }}
              >
                {t === 1 ? "1.0× cost" : `${t.toFixed(1)}×`}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-neutral-500">{dpiNote}</p>
      </div>

      <div className="border-l border-neutral-100 px-5 py-4">
        <div className={MICRO}>Net IRR vs public markets</div>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-sm text-neutral-600">
          <span>Net IRR</span>
          <b className="text-3xl font-semibold tracking-tight text-neutral-950">{pct(irr)}</b>
        </p>
        <p className="mt-0.5 text-sm text-neutral-600">
          KS-PME <b className="font-semibold text-neutral-900">{pme?.toFixed(2) ?? "–"}</b> vs
          MSCI World (GBP)
        </p>
        <p className={`mt-2 flex items-start gap-1.5 text-[12px] font-medium ${verdict.cls}`}>
          <span aria-hidden className="mt-px">
            {verdict.icon}
          </span>
          <span>{verdict.text}</span>
        </p>
        <p className="mt-2 text-[11px] leading-snug text-neutral-500">
          {fund && irr !== null ? (
            <>
              <span className="font-mono tabular-nums">{pp(irr - fund.peer.median)}</span> vs the{" "}
              {fund.vintage} {STRATEGY_LABEL[fund.strategy].toLowerCase()} peer median of{" "}
              {pct(fund.peer.median)}; top-quartile threshold {pct(fund.peer.upper)}.
            </>
          ) : (
            "Pooled IRR on the programme's dated cash flows, NAV as terminal value. KS-PME above 1.00 means the commitments beat the index on the same cash-flow timing."
          )}
        </p>
      </div>
    </section>
  );
}

/* --- fund-level table (Total programme) -------------------------------- */

const SORT_COLS: { key: SortKey; label: string; left?: boolean }[] = [
  { key: "name", label: "Fund", left: true },
  { key: "vintage", label: "Vintage" },
  { key: "commitment", label: "Commit." },
  { key: "paidIn", label: "Paid-in" },
  { key: "nav", label: "NAV" },
  { key: "dpi", label: "DPI" },
  { key: "rvpi", label: "RVPI" },
  { key: "tvpi", label: "TVPI" },
  { key: "irr", label: "Net IRR" },
  { key: "quartile", label: "Quartile" },
];

function FundTableCard({
  funds,
  agg,
  onSelect,
}: {
  funds: Fund[];
  agg: Aggregate;
  onSelect: (id: string) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "vintage", dir: 1 });
  const rows = useMemo(() => {
    const val = (f: Fund): number | string =>
      sort.key === "name" ? f.name : sort.key === "irr" ? (f.irr ?? -9) : f[sort.key];
    return [...funds].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const c = typeof va === "string" ? va.localeCompare(String(vb)) : va - Number(vb);
      return c * sort.dir || a.name.localeCompare(b.name);
    });
  }, [funds, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 1 ? -1 : 1 }
        : { key, dir: key === "name" || key === "vintage" || key === "quartile" ? 1 : -1 },
    );

  return (
    <Card
      title="Fund performance"
      subtitle={`${funds.length} commitments in the current filter · amounts in £m · click a column to sort, a fund to open it`}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <caption className="sr-only">Fund-level performance, sortable</caption>
          <thead>
            <tr className="border-b border-neutral-200">
              {SORT_COLS.map((c) => {
                const on = sort.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                    className={`p-0 text-[10px] font-semibold whitespace-nowrap text-neutral-500 ${
                      c.left ? "text-left" : "text-right"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className={`inline-flex w-full items-center gap-0.5 px-3 py-2 tracking-wider uppercase ${
                        c.left ? "justify-start" : "justify-end"
                      } ${on ? "text-fuchsia-800" : "hover:text-neutral-800"} ${FOCUS} focus-visible:ring-inset`}
                    >
                      {c.label}
                      <span aria-hidden className="w-2 text-[9px]">
                        {on ? (sort.dir === 1 ? "▲" : "▼") : ""}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((f) => (
              <tr key={f.id} className="hover:bg-neutral-50">
                <th scope="row" className="px-3 py-1.5 text-left font-normal">
                  <button
                    type="button"
                    onClick={() => onSelect(f.id)}
                    className={`block max-w-[240px] truncate text-left text-[12px] leading-tight font-medium text-neutral-900 hover:text-fuchsia-800 hover:underline ${FOCUS}`}
                  >
                    {f.name}
                  </button>
                  <span className="block text-[10px] leading-tight text-neutral-500">
                    {STRATEGY_LABEL[f.strategy]}
                  </span>
                </th>
                <td className={TD}>{f.vintage}</td>
                <td className={TD}>{num(f.commitment, 0)}</td>
                <td className={TD}>{num(f.paidIn)}</td>
                <td className={TD}>{num(f.nav)}</td>
                <td className={TD}>{mult(f.dpi)}</td>
                <td className={TD}>{mult(f.rvpi)}</td>
                <td className={`${TD} font-semibold text-neutral-950`}>{mult(f.tvpi)}</td>
                <td className={TD}>{pct(f.irr)}</td>
                <td className={`${TD} py-1`}>
                  <span className="inline-flex justify-end">
                    <QuartileBadge
                      q={f.quartile}
                      context={`${f.vintage} ${STRATEGY_LABEL[f.strategy].toLowerCase()} peers`}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-200 bg-neutral-50">
              <th scope="row" className="px-3 py-2 text-left text-[12px] font-semibold text-neutral-900">
                Total programme
              </th>
              <td className={TD} />
              <td className={`${TD} font-semibold`}>{num(agg.commitment, 0)}</td>
              <td className={`${TD} font-semibold`}>{num(agg.paidIn)}</td>
              <td className={`${TD} font-semibold`}>{num(agg.nav)}</td>
              <td className={`${TD} font-semibold`}>{mult(agg.dpi)}</td>
              <td className={`${TD} font-semibold`}>{mult(agg.rvpi)}</td>
              <td className={`${TD} font-semibold`}>{mult(agg.tvpi)}</td>
              <td className={`${TD} font-semibold`}>{pct(agg.irr)}</td>
              <td className={`${TD} font-sans text-[10px] text-neutral-400`}>pooled</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

/* --- capital account statement (single fund) --------------------------- */

function StatementCard({ fund }: { fund: Fund }) {
  const [all, setAll] = useState(false);
  const rows = [...fund.statement].reverse();
  const shown = all ? rows : rows.slice(0, 12);
  const latest = fund.statement[fund.statement.length - 1];

  return (
    <Card
      title="Capital account statement"
      subtitle={`${fund.name} · by quarter, most recent first · £m`}
      actions={
        rows.length > 12 ? (
          <button
            type="button"
            aria-expanded={all}
            onClick={() => setAll((v) => !v)}
            className={`border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 ${FOCUS}`}
          >
            {all ? "Show last 12 quarters" : `Show all ${rows.length} quarters`}
          </button>
        ) : undefined
      }
      footer="Since-inception IRR is shown from the fifth quarter; earlier annualised figures are not meaningful."
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <caption className="sr-only">Capital account statement for {fund.name}</caption>
          <thead>
            <tr className="border-b border-neutral-200">
              <th scope="col" className={THL}>Quarter</th>
              <th scope="col" className={TH}>Contributions</th>
              <th scope="col" className={TH}>Distributions</th>
              <th scope="col" className={TH}>NAV</th>
              <th scope="col" className={TH}>Cum. net cash flow</th>
              <th scope="col" className={TH}>TVPI</th>
              <th scope="col" className={TH}>Since-inception IRR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {shown.map((r) => {
              const isLatest = r.q === latest.q;
              return (
                <tr key={r.q} className={isLatest ? "bg-fuchsia-50" : undefined}>
                  <th
                    scope="row"
                    className={`relative ${TDL} font-medium ${isLatest ? "text-neutral-950" : ""}`}
                  >
                    {isLatest && (
                      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-fuchsia-700" />
                    )}
                    {qLabel(r.q)}
                    {isLatest && (
                      <span className="ml-2 border border-fuchsia-200 bg-white px-1 font-sans text-[9.5px] font-semibold tracking-wide text-fuchsia-800 uppercase">
                        Latest
                      </span>
                    )}
                  </th>
                  <td className={TD}>{r.call > 0.005 ? num(r.call, 2) : "–"}</td>
                  <td className={TD}>{r.dist > 0.005 ? num(r.dist, 2) : "–"}</td>
                  <td className={TD}>{num(r.nav, 2)}</td>
                  <td className={TD}>{num(r.cumNet, 2)}</td>
                  <td className={TD}>{mult(r.tvpi)}</td>
                  <td className={`${TD} ${r.irr === null ? "text-neutral-400" : ""}`}>
                    {pct(r.irr)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-200 bg-neutral-50">
              <th scope="row" className="px-3 py-2 text-left text-[12px] font-semibold text-neutral-900">
                Since inception
              </th>
              <td className={`${TD} font-semibold`}>{num(fund.paidIn, 2)}</td>
              <td className={`${TD} font-semibold`}>{num(fund.distributed, 2)}</td>
              <td className={`${TD} font-semibold`}>{num(fund.nav, 2)}</td>
              <td className={`${TD} font-semibold`}>{num(latest.cumNet, 2)}</td>
              <td className={`${TD} font-semibold`}>{mult(fund.tvpi)}</td>
              <td className={`${TD} font-semibold`}>{pct(fund.irr)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
