import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  AYS,
  FIRST_AY,
  LAST_AY,
  LARGE_LOSSES,
  TABS,
  buildView,
  fmtGBP,
  fmtMoney,
  fmtNum,
  fmtPct,
  fmtSigned,
  quarterly,
  type Basis,
  type TabId,
  type TabView,
} from "../components/claims-reserving/model";
import { Triangle, TriangleLegend, type TriangleMode } from "../components/claims-reserving/Triangle";
import { CombinedRatioCard, ReserveDevelopmentCard } from "../components/claims-reserving/Charts";
import { LargeLossRegister } from "../components/claims-reserving/LargeLosses";
import {
  FOCUS,
  IconCheck,
  IconDown,
  IconUp,
  MicroLabel,
  Seg,
} from "../components/claims-reserving/ui";

export const title = "Claims & Reserving";
export const fullWidth = true;

/* Claims & Reserving: the quarterly reserving committee's view of a P&C book.
 *
 * "Are our reserves adequate, and where is loss experience deteriorating?"
 * Tabbed by line of business: the tab strip is the primary filter and each
 * tab carries its own current accident-year loss ratio, so the committee can
 * see which line to open before opening it. Under the tabs, one compact row
 * scopes accident years, the paid/incurred basis and the triangle view, and
 * every number below (tiles, triangle, charts, register) recomputes from the
 * same chain ladder.
 */

/* ------------------------------------------------------------------ */
/* KPI tiles with a plan band                                          */
/* ------------------------------------------------------------------ */

type Verdict = "within" | "above" | "below";

interface Kpi {
  key: string;
  label: string;
  scope: string;
  value: number;
  fmt: (v: number) => string;
  /** Compact format for the plan range when the value format is long. */
  planFmt?: (v: number) => string;
  plan: [number, number];
  delta?: { text: string; up: boolean };
  ref?: { value: number; label: string };
  note?: string;
}

function verdict(k: Kpi): Verdict {
  if (k.value > k.plan[1]) return "above";
  if (k.value < k.plan[0]) return "below";
  return "within";
}

function PlanBand({ k }: { k: Kpi }) {
  const [lo, hi] = k.plan;
  const w = hi - lo;
  const pad = w * 1.1;
  let dMin = Math.min(lo - pad, k.value - pad * 0.35);
  let dMax = Math.max(hi + pad, k.value + pad * 0.35);
  if (k.ref) {
    dMin = Math.min(dMin, k.ref.value - pad * 0.3);
    dMax = Math.max(dMax, k.ref.value + pad * 0.3);
  }
  const x = (v: number) => `${((v - dMin) / (dMax - dMin)) * 100}%`;
  return (
    <div className="relative h-5" aria-hidden="true">
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-neutral-100" />
      <div
        className="absolute top-1/2 h-2.5 -translate-y-1/2 border-x border-teal-600 bg-teal-100"
        style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }}
      />
      {k.ref && (
        <div className="absolute top-0 bottom-0 w-px border-l border-dashed border-neutral-500" style={{ left: x(k.ref.value) }} />
      )}
      <div
        className="absolute top-0 bottom-0 w-[3px] -translate-x-1/2 bg-neutral-900 ring-2 ring-white"
        style={{ left: x(k.value) }}
      />
    </div>
  );
}

function KpiTile({ k }: { k: Kpi }) {
  const v = verdict(k);
  const status =
    v === "within"
      ? { text: "Within plan", cls: "text-neutral-700", icon: <IconCheck className="h-3 w-3 text-emerald-600" /> }
      : v === "above"
        ? { text: "Above plan", cls: "text-rose-700", icon: <IconUp className="h-2.5 w-2.5" /> }
        : { text: "Below plan", cls: "text-emerald-700", icon: <IconDown className="h-2.5 w-2.5" /> };
  return (
    <div className="flex flex-col gap-2 bg-white px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <MicroLabel>{k.label}</MicroLabel>
        <span className="font-mono text-[10px] text-neutral-400 tabular-nums">{k.scope}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[26px] leading-none font-semibold tracking-tight text-neutral-950">{k.fmt(k.value)}</span>
        {k.delta && (
          <span className={`text-[11px] font-medium ${k.delta.up ? "text-rose-600" : "text-emerald-600"}`}>
            {k.delta.up ? "▲" : "▼"} {k.delta.text}
          </span>
        )}
      </div>
      <PlanBand k={k} />
      <div className="flex items-center justify-between gap-2 text-[11px] whitespace-nowrap">
        <span className="text-neutral-500">
          Plan{" "}
          <span className="font-mono text-neutral-700 tabular-nums">
            {(k.planFmt ?? k.fmt)(k.plan[0])}–{(k.planFmt ?? k.fmt)(k.plan[1]).replace(/^£/, "")}
          </span>
        </span>
        <span className={`inline-flex items-center gap-1 font-semibold ${status.cls}`}>
          {status.icon}
          {status.text}
        </span>
      </div>
      {k.note && <p className="-mt-1 text-[10px] text-neutral-400">{k.note}</p>}
    </div>
  );
}

function buildKpis(view: TabView, from: number, to: number): Kpi[] {
  const cur = view.rows[to - FIRST_AY];
  const prev = to > FIRST_AY ? view.rows[to - FIRST_AY - 1] : null;
  const ay = `AY ${to}`;
  const vsPrev = (d: number, unit: string, dp = 1) =>
    prev ? { text: `${fmtSigned(d, dp, unit)} vs ${to - 1}`, up: d > 0 } : undefined;
  const pct1 = (v: number) => fmtPct(v, 1);
  const planFreq = (cur.planClaims / cur.policies) * 1000;
  const planSev = ((cur.ep * cur.pick) / 100) * 1e6 / cur.planClaims;
  const ibnr = view.inRange.reduce((a, r) => a + r.ibnr, 0);
  const bf = view.inRange.reduce((a, r) => a + r.bfIbnr, 0);
  const ult = view.inRange.reduce((a, r) => a + r.ult, 0);
  // ±4% of the BF figure, but never narrower than 0.5% of ultimate: a fully
  // run-off year has almost no IBNR and a zero-width plan would be noise.
  const ibnrTol = Math.max(bf * 0.04, ult * 0.005);
  const lrPlan: [number, number] = [cur.pick - 1.5, cur.pick + 1.5];
  return [
    {
      key: "lr",
      label: "Loss ratio",
      scope: ay,
      value: cur.ulr,
      fmt: pct1,
      plan: lrPlan,
      delta: vsPrev(cur.ulr - (prev?.ulr ?? 0), "pp"),
    },
    {
      key: "er",
      label: "Expense ratio",
      scope: ay,
      value: cur.er,
      fmt: pct1,
      plan: [cur.planERlo, cur.planERhi],
      delta: vsPrev(cur.er - (prev?.er ?? 0), "pp"),
    },
    {
      key: "cr",
      label: "Combined ratio",
      scope: ay,
      value: cur.cr,
      fmt: pct1,
      plan: [lrPlan[0] + cur.planERlo, lrPlan[1] + cur.planERhi],
      delta: vsPrev(cur.cr - (prev?.cr ?? 0), "pp"),
      ref: { value: 100, label: "100%" },
      note: "Dashed tick is 100%: under it the year makes an underwriting profit.",
    },
    {
      key: "freq",
      label: "Claims frequency",
      scope: ay,
      value: cur.freq,
      fmt: (v) => fmtNum(v, 1),
      plan: [planFreq * 0.96, planFreq * 1.04],
      delta: vsPrev(cur.freq - (prev?.freq ?? 0), "", 1),
      note: "Claims per 1,000 policies.",
    },
    {
      key: "sev",
      label: "Average severity",
      scope: ay,
      value: cur.sev,
      fmt: fmtGBP,
      planFmt: (v) => `£${fmtNum(v / 1000, 1)}k`,
      plan: [planSev * 0.97, planSev * 1.03],
      delta: prev ? { text: `${fmtSigned(((cur.sev - prev.sev) / prev.sev) * 100, 1, "%")} vs ${to - 1}`, up: cur.sev > prev.sev } : undefined,
      note: "Ultimate cost per ultimate claim.",
    },
    {
      key: "ibnr",
      label: "IBNR reserve",
      scope: from === to ? `AY ${from}` : `AY ${from}–${String(to).slice(2)}`,
      value: ibnr,
      fmt: (v) => fmtMoney(v),
      plan: [bf - ibnrTol, bf + ibnrTol],
      note: `${fmtPct((ibnr / ult) * 100, 1)} of ultimate. Plan: Bornhuetter–Ferguson on initial picks.`,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5' fill='none' stroke='%23525252' stroke-width='1.5'/%3E%3C/svg%3E\")";

function YearSelect({
  id,
  label,
  value,
  onChange,
  min,
  max,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`appearance-none border border-neutral-300 bg-white py-1 pr-7 pl-2 font-mono text-xs text-neutral-900 tabular-nums hover:border-neutral-400 ${FOCUS}`}
        style={{ backgroundImage: CHEVRON, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center", backgroundSize: "12px" }}
      >
        {AYS.filter((y) => y >= min && y <= max).map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ClaimsReservingPage() {
  const [tab, setTab] = useState<TabId>("all");
  const [from, setFrom] = useState(FIRST_AY);
  const [to, setTo] = useState(LAST_AY);
  const [basis, setBasis] = useState<Basis>("incurred");
  const [mode, setMode] = useState<TriangleMode>("cum");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const views = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.id, buildView(t.id, basis, from, to)])) as Record<TabId, TabView>,
    [basis, from, to],
  );
  const view = views[tab];
  const kpis = useMemo(() => buildKpis(view, from, to), [view, from, to]);
  const quarters = useMemo(() => quarterly(tab), [tab]);
  const losses = useMemo(
    () => LARGE_LOSSES.filter((l) => (tab === "all" || l.lob === tab) && l.ay >= from && l.ay <= to),
    [tab, from, to],
  );

  const tabLabel = TABS.find((t) => t.id === tab)!.label;
  const basisLabel = basis === "paid" ? "Paid" : "Incurred";
  const years = to - from + 1;
  const scope = `${tabLabel} · AY ${from === to ? from : `${from}–${to}`}`;

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = TABS.findIndex((t) => t.id === tab);
    let next: number;
    if (e.key === "ArrowRight") next = (idx + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="flex h-full flex-col bg-neutral-50 text-neutral-900">
      {/* Fixed top: title, LOB tabs and the scoping row. The body scrolls. */}
      <div className="shrink-0 bg-white">
        <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 py-4 pr-6 pl-36 lg:flex-nowrap">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              Insurance / Actuarial
            </div>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-neutral-950">Claims &amp; Reserving</h1>
            <p className="mt-0.5 text-xs text-neutral-500" style={{ maxWidth: 860 }}>
              Are our reserves adequate, and where is loss experience deteriorating? Chain-ladder reserving by line of
              business for the Q2 2026 reserving committee.
            </p>
          </div>
          <dl className="flex shrink-0 gap-6 text-right">
            <div>
              <dt className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Valuation</dt>
              <dd className="font-mono text-xs font-semibold text-neutral-900">30 Jun 2026</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Triangle diagonal</dt>
              <dd className="font-mono text-xs font-semibold text-neutral-900">31 Dec 2025</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Currency</dt>
              <dd className="font-mono text-xs font-semibold text-neutral-900">GBP</dd>
            </div>
          </dl>
        </header>

        {/* LOB tabs: the primary filter. */}
        <div className="overflow-x-auto border-t border-neutral-200 bg-neutral-100">
          <div
            role="tablist"
            aria-label="Line of business"
            onKeyDown={onTabKey}
            className="grid min-w-[880px]"
            style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}
          >
            {TABS.map((t, k) => {
              const on = t.id === tab;
              const rows = views[t.id].rows;
              const cur = rows[to - FIRST_AY];
              const prev = to > FIRST_AY ? rows[to - FIRST_AY - 1] : null;
              const d = prev ? cur.ulr - prev.ulr : 0;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[k] = el;
                  }}
                  role="tab"
                  type="button"
                  id={`cr-tab-${t.id}`}
                  aria-selected={on}
                  aria-controls="cr-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  className={`relative flex flex-col items-start gap-1 border-b px-5 pt-3 pb-2.5 text-left transition ${FOCUS} ${
                    k > 0 ? "border-l border-l-neutral-200" : ""
                  } ${on ? "border-b-white bg-white" : "border-b-neutral-200 hover:bg-neutral-50"}`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-0 top-0 h-[3px] ${on ? "bg-teal-600" : "bg-transparent"}`}
                  />
                  <span className={`text-sm font-semibold ${on ? "text-neutral-950" : "text-neutral-600"}`}>{t.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className={`text-lg leading-none font-semibold tracking-tight ${on ? "text-neutral-950" : "text-neutral-700"}`}>
                      {fmtPct(cur.ulr, 1)}
                    </span>
                    {prev && (
                      <span className={`text-[10px] font-medium ${d > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        {d > 0 ? "▲" : "▼"} {fmtSigned(d, 1, "pp")}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-neutral-400">AY {to} loss ratio{prev ? ` vs ${to - 1}` : ""}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scoping row under the tabs. */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-neutral-200 px-5 py-2.5">
          <div className="flex items-center gap-2">
            <MicroLabel>Accident years</MicroLabel>
            <YearSelect
              id="cr-from"
              label="From accident year"
              value={from}
              min={FIRST_AY}
              max={LAST_AY}
              onChange={(v) => {
                setFrom(v);
                if (v > to) setTo(v);
              }}
            />
            <span className="text-xs text-neutral-400">to</span>
            <YearSelect
              id="cr-to"
              label="To accident year"
              value={to}
              min={FIRST_AY}
              max={LAST_AY}
              onChange={(v) => {
                setTo(v);
                if (v < from) setFrom(v);
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <MicroLabel>Basis</MicroLabel>
            <Seg
              label="Basis"
              value={basis}
              onChange={setBasis}
              options={[
                { value: "paid", label: "Paid" },
                { value: "incurred", label: "Incurred" },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <MicroLabel>Triangle view</MicroLabel>
            <Seg
              label="Triangle view"
              value={mode}
              onChange={setMode}
              options={[
                { value: "cum", label: "Cumulative £m" },
                { value: "factor", label: "Age-to-age factors" },
              ]}
            />
          </div>
          <p className="ml-auto text-[11px] text-neutral-500">
            <span className="font-medium text-neutral-800">{tabLabel}</span> · {years} accident year{years === 1 ? "" : "s"} ·{" "}
            {basisLabel.toLowerCase()} basis
          </p>
        </div>
      </div>

      <main
        id="cr-panel"
        role="tabpanel"
        aria-labelledby={`cr-tab-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="flex flex-col gap-4 p-5">
          {/* KPI tiles: value against a plan band. */}
          <section aria-label="Key indicators">
            <div className="grid grid-cols-1 gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 xl:grid-cols-6">
              {kpis.map((k) => (
                <KpiTile key={k.key} k={k} />
              ))}
            </div>
          </section>

          {/* Hero: the loss development triangle. */}
          <section className="border border-neutral-200 bg-white" aria-labelledby="tri-title">
            <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-neutral-100 px-4 py-3">
              <div className="min-w-0">
                <h2 id="tri-title" className="text-sm font-semibold text-neutral-900">
                  Loss development triangle
                  <span className="ml-2 font-normal text-neutral-500">
                    {tabLabel} · {basisLabel.toLowerCase()} · {mode === "cum" ? "£m" : "age-to-age factors"}
                  </span>
                </h2>
                <p className="mt-0.5 max-w-3xl text-[11px] leading-snug text-neutral-500">
                  Rows are accident years, columns months of development. Shading compares each link ratio with its
                  column&rsquo;s volume-weighted average over AY {from}–{to}; the hatched lower-right is the chain-ladder
                  projection on the selected factors.
                </p>
              </div>
              <TriangleLegend />
            </header>
            <Triangle view={view} mode={mode} basis={basis} from={from} to={to} />
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <CombinedRatioCard rows={quarters} scope={tabLabel} filterKey={tab} />
            <ReserveDevelopmentCard view={view} scope={`${scope} · ${basisLabel.toLowerCase()}`} />
          </div>

          <LargeLossRegister key={`${tab}-${from}-${to}`} losses={losses} scope={scope} />

          <footer className="border-t border-neutral-200 pt-3 pb-2 text-[11px] leading-relaxed text-neutral-500">
            Chain ladder on volume-weighted link ratios over the selected accident years; selections are rounded to 0.005
            above 1.05 and to 0.001 below, with benchmark tails beyond 120 months (Liability 1.015 incurred, 1.053
            paid). IBNR is ultimate less incurred to date on either basis. Plan bands: loss ratio at the initial pick
            ±1.5pp, frequency ±4%, severity ±3%, IBNR at Bornhuetter–Ferguson on initial picks ±4%. Quarterly combined
            ratios are calendar-period and not scoped by accident year. All insureds, vessels, storms and firms are
            fictional.
          </footer>
        </div>
      </main>
    </div>
  );
}
