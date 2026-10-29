import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  AS_OF,
  BASE_ALERTS,
  DIMENSIONS,
  SCENARIOS,
  TYPOLOGIES,
  ageingWeekly,
  applyOps,
  backlogAt,
  backlogTarget,
  flow,
  fmtDay,
  fmtDayLong,
  fmtRange,
  isOpenAt,
  matches,
  queueRows,
  scenarioProductivity,
  windowStart,
  type DimKey,
  type Filters,
  type Flow,
  type Op,
  type OpLog,
  type Preset,
} from "../components/aml-alert-operations/data";
import { FilterBar } from "../components/aml-alert-operations/FilterBar";
import { Queue } from "../components/aml-alert-operations/Queue";
import {
  BacklogAgeingCard,
  ScenarioScatterCard,
  TypologyMixCard,
  type TypologyRow,
} from "../components/aml-alert-operations/charts";

export const title = "AML Alert Operations";
export const fullWidth = true;

/* AML Alert Operations: transaction-monitoring alert operations for the
 * Head of TM Operations / MLRO. "Are we keeping up with alerts, and are our
 * detection scenarios productive?"
 *
 * Layout: funnel band + work queue. The funnel (generated → L1 reviewed →
 * escalated → case → SAR) is the KPI; beneath it the investigator queue sits
 * beside three chart cards. One chip filter row scopes everything.
 *
 * Two kinds of number, labelled as such: flow metrics count events in the
 * selected date range (the funnel, conversion, FP rate, handling time,
 * scenario productivity); backlog metrics are the state as of Mon 21 Sep
 * (open backlog, oldest alert, SLA breaches, typology mix, the queue). The
 * dimension chips scope both. Bulk actions in the queue are replayed over the
 * dataset as ops stamped on the as-of day, so closing alerts moves the funnel.
 */

const nf = new Intl.NumberFormat("en-GB");
const pct = (v: number, dp = 1) => `${v.toFixed(dp)}%`;
const ratio = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
/** A share with an empty denominator reads as a dash, not "0.0%". */
const share = (a: number, b: number, dp = 1) => (b > 0 ? pct((a / b) * 100, dp) : "—");
const SLA_TOLERANCE = 5; // % of open alerts allowed past SLA

const STAGE_BARS = ["#5b21b6", "#6d28d9", "#7c3aed", "#8b5cf6", "#a78bfa"];

export default function AmlAlertOperationsPage() {
  const [preset, setPreset] = useState<Preset>("QTD");
  const [filters, setFilters] = useState<Filters>({});
  const [log, setLog] = useState<OpLog>({});
  const [history, setHistory] = useState<OpLog[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const ws = windowStart(preset);
  const alerts = useMemo(() => applyOps(BASE_ALERTS, log), [log]);
  const scoped = useMemo(() => alerts.filter((a) => matches(a, filters)), [alerts, filters]);

  const view = useMemo(() => {
    const f = flow(scoped, ws, AS_OF);
    const rows = queueRows(scoped);
    const weeks = ageingWeekly(scoped);
    const target = backlogTarget(scoped);
    const backlogStart = backlogAt(scoped, ws - 1);
    const scenarios = scenarioProductivity(scoped, ws, AS_OF);
    const oldest = rows.reduce<(typeof rows)[number] | null>((m, r) => (!m || r.age > m.age ? r : m), null);
    const breached = rows.filter((r) => r.left < 0).length;

    const typ = new Map(TYPOLOGIES.map((t) => [t, { typology: t, open: 0, breached: 0, fresh: 0 } as TypologyRow]));
    for (const r of rows) {
      const t = typ.get(r.alert.typology)!;
      t.open++;
      if (r.left < 0) t.breached++;
    }
    for (const a of scoped) if (a.created >= ws) typ.get(a.typology)!.fresh++;
    const typology = [...typ.values()].filter((t) => t.open > 0).sort((a, b) => b.open - a.open);

    return { f, rows, weeks, target, backlogStart, scenarios, oldest, breached, typology };
  }, [scoped, ws]);

  // Team load for the assign menu reads the whole book, not the filtered slice.
  const load = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of alerts) if (a.assignee && isOpenAt(a, AS_OF)) m.set(a.assignee, (m.get(a.assignee) ?? 0) + 1);
    return m;
  }, [alerts]);

  const facetCounts = useCallback(
    (dim: DimKey) => {
      const m = new Map<string, number>();
      for (const a of alerts) {
        if (a.created < ws || !matches(a, filters, dim)) continue;
        m.set(a[dim], (m.get(a[dim]) ?? 0) + 1);
      }
      return m;
    },
    [alerts, filters, ws],
  );

  const onBulk = (ids: string[], op: Op, text: string) => {
    setHistory((h) => [...h.slice(-19), log]);
    setLog((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = [...(next[id] ?? []), op];
      return next;
    });
    setNotice(text);
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setLog(prev);
    setHistory((h) => h.slice(0, -1));
    setNotice(null);
  };

  const hasFilters = DIMENSIONS.some((d) => (filters[d.key]?.length ?? 0) > 0);
  const empty = scoped.length === 0;
  const range = fmtRange(ws, AS_OF);
  const { f, rows } = view;

  return (
    <div className="flex h-full flex-col bg-neutral-50 text-neutral-900">
      <div className="relative z-30 flex-none border-b border-neutral-200 bg-white">
        {/* pl-36 clears the app's fixed Home pill. */}
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pt-4 pr-6 pb-3 pl-36">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              Financial crime <span className="text-neutral-300">/</span> Transaction monitoring
            </div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-950">AML Alert Operations</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-neutral-500">
              Are we keeping up with alerts, and are our detection scenarios productive? Alerts from generation
              to SAR, the backlog by age, and the queue to work next.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-neutral-500">
            <span className="inline-block h-2 w-2 bg-emerald-600" aria-hidden />
            <span>
              Nightly TM batch loaded · data through{" "}
              <span className="font-medium text-neutral-700">{fmtDayLong(AS_OF)}</span>
            </span>
          </div>
        </header>
        <div className="border-t border-neutral-100 px-4 py-2">
          <FilterBar
            preset={preset}
            onPreset={setPreset}
            filters={filters}
            onFilters={setFilters}
            facetCounts={facetCounts}
            scopeNote={`Flow ${range} · Backlog as of ${fmtDay(AS_OF)} · ${nf.format(f.generated)} alerts in range`}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          <FunnelBand
            f={f}
            range={range}
            preset={preset}
            empty={empty}
            backlogNow={rows.length}
            backlogStart={view.backlogStart}
            startLabel={fmtDay(ws - 1)}
            target={view.target}
            oldest={view.oldest ? { age: view.oldest.age, id: view.oldest.alert.id, stage: view.oldest.stage } : null}
            breached={view.breached}
          />

          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-8">
            <div className="min-w-0 xl:col-span-5">
              <Queue
                rows={rows}
                load={load}
                onBulk={onBulk}
                notice={notice}
                onUndo={undo}
                onDismiss={() => setNotice(null)}
                hasFilters={hasFilters}
                onClearFilters={() => setFilters({})}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-4 xl:col-span-3">
              <BacklogAgeingCard weeks={view.weeks} target={view.target} windowFrom={ws} empty={empty} />
              <ScenarioScatterCard points={view.scenarios} totalSars={f.sars} empty={empty || view.scenarios.length === 0} />
              <TypologyMixCard rows={view.typology} empty={view.typology.length === 0} rangeLabel={preset} />
            </div>
          </div>

          <p className="pb-2 text-[11px] leading-relaxed text-neutral-400">
            Synthetic data: {nf.format(BASE_ALERTS.length)} alerts from {SCENARIOS.length} detection scenarios,
            seeded and fixed. Customer identifiers are masked. SLA runs from alert generation: PEP 10 days, High 15,
            Medium 25, Low 30, plus 20 days once with L2. Queue actions are local to this session.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ funnel band */

function FunnelBand({
  f,
  range,
  preset,
  empty,
  backlogNow,
  backlogStart,
  startLabel,
  target,
  oldest,
  breached,
}: {
  f: Flow;
  range: string;
  preset: Preset;
  empty: boolean;
  backlogNow: number;
  backlogStart: number;
  startLabel: string;
  target: number;
  oldest: { age: number; id: string; stage: string } | null;
  breached: number;
}) {
  const stages = [
    {
      label: "Alerts generated",
      n: f.generated,
      note: `${(f.generated / Math.max(1, f.bizDays)).toFixed(1)} per business day`,
    },
    { label: "L1 reviewed", n: f.l1Reviewed, note: `${nf.format(f.fpClosed)} closed as false positive` },
    { label: "Escalated to L2", n: f.escalated, note: `${nf.format(f.l2ClosedNoCase)} closed at L2, no case` },
    { label: "Cases opened", n: f.casesOpened, note: `${nf.format(f.casesClosedNoSar)} closed without a SAR` },
    {
      label: "SARs filed",
      n: f.sars,
      note: f.medianSarLag != null ? `Median ${Math.round(f.medianSarLag)} days alert → SAR` : "None filed in range",
    },
  ];
  const chips = [
    { v: share(f.l1Reviewed, f.generated), cap: "reviewed" },
    { v: share(f.escalated, f.l1Reviewed), cap: "escalated" },
    { v: share(f.casesOpened, f.escalated), cap: "to case" },
    { v: share(f.sars, f.casesOpened), cap: "filed" },
  ];
  const max = Math.max(1, f.generated);
  const delta = backlogNow - backlogStart;
  // Growth alone isn't "behind": a backlog still under target is fine.
  const overTarget = backlogNow > target;
  const behind = overTarget && delta > 0;
  const pace = behind ? "Falling behind" : overTarget ? "Catching up" : "Within target";
  const breachPct = ratio(breached, backlogNow);
  const cols = "minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr)";

  return (
    <section className="border border-neutral-200 bg-white" aria-labelledby="aml-funnel-title">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-neutral-100 px-5 py-2.5">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 id="aml-funnel-title" className="text-sm font-semibold text-neutral-900">
            Alert funnel
          </h2>
          <span className="text-[11px] text-neutral-500">
            Events in range · {range} ({preset})
          </span>
        </div>
        {!empty && (
          <span
            className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] font-medium ${
              behind
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : overTarget
                  ? "border-neutral-200 bg-neutral-50 text-neutral-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            <span aria-hidden>{delta > 0 ? "▲" : delta < 0 ? "▼" : "–"}</span>
            {pace}: backlog {delta > 0 ? "+" : delta < 0 ? "−" : "±"}
            {nf.format(Math.abs(delta))} since {startLabel}
          </span>
        )}
      </header>

      <ol className="grid items-stretch px-5" style={{ gridTemplateColumns: cols }} aria-label="Alert funnel stages">
        {stages.map((s, i) => [
          <li key={s.label} className="min-w-0 py-4">
            <div className="flex items-baseline gap-1.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
              <span className="font-mono text-neutral-300">{String(i + 1).padStart(2, "0")}</span>
              <span className="truncate">{s.label}</span>
            </div>
            <div className="mt-1 text-3xl font-semibold tracking-tight text-neutral-950">{nf.format(s.n)}</div>
            <div className="mt-2 h-2 bg-neutral-100" aria-hidden>
              <div
                className="h-full"
                style={{
                  width: `${(s.n / max) * 100}%`,
                  minWidth: s.n > 0 ? 3 : 0,
                  background: STAGE_BARS[i],
                }}
              />
            </div>
            <div className="mt-1.5 truncate text-[11px] text-neutral-500">{s.note}</div>
          </li>,
          i < chips.length && (
            <li
              key={`${s.label}-chip`}
              className="flex flex-col items-center justify-center px-3"
              aria-label={`${chips[i].v} ${chips[i].cap}`}
            >
              <span className="inline-flex items-center gap-1 border border-violet-200 bg-violet-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-violet-900 tabular-nums">
                {chips[i].v}
                <span aria-hidden className="text-violet-500">
                  →
                </span>
              </span>
              <span className="mt-1 text-[10px] text-neutral-400">{chips[i].cap}</span>
            </li>
          ),
        ])}
      </ol>

      <div className="grid grid-cols-2 border-t border-neutral-100 sm:grid-cols-3 lg:grid-cols-6">
        <StatGroupLabel className="col-span-2 sm:col-span-3">Backlog · as of {fmtDay(AS_OF)}</StatGroupLabel>
        <StatGroupLabel className="col-span-2 hidden sm:col-span-3 lg:block">Flow · in range</StatGroupLabel>
        <Stat
          label="Open backlog"
          value={nf.format(backlogNow)}
          sub={
            <>
              <span className={delta > 0 ? "text-rose-700" : delta < 0 ? "text-emerald-700" : ""}>
                {delta > 0 ? "▲ +" : delta < 0 ? "▼ −" : ""}
                {nf.format(Math.abs(delta))}
              </span>{" "}
              since {startLabel} · target {nf.format(target)}
            </>
          }
        />
        <Stat
          label="Oldest open alert"
          value={oldest ? `${oldest.age} days` : "—"}
          sub={oldest ? `${oldest.id} · ${oldest.stage}` : "No open alerts"}
        />
        <Stat
          label="SLA breaches"
          value={share(breached, backlogNow)}
          sub={
            backlogNow === 0 ? (
              "No open alerts"
            ) : breachPct > SLA_TOLERANCE ? (
              <span className="inline-flex items-center gap-1 text-rose-700">
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
                  <path d="M8 1 15 14H1L8 1Zm-.75 5v4h1.5V6h-1.5Zm0 5v1.5h1.5V11h-1.5Z" />
                </svg>
                {nf.format(breached)} past SLA · tolerance {SLA_TOLERANCE}%
              </span>
            ) : (
              <span className="text-emerald-700">
                ✓ {nf.format(breached)} past SLA · within {SLA_TOLERANCE}%
              </span>
            )
          }
        />
        <Stat
          label="Alert → SAR conversion"
          value={share(f.sars, f.generated, 2)}
          sub={`${nf.format(f.sars)} SARs from ${nf.format(f.generated)} alerts`}
          divider
        />
        <Stat
          label="False-positive closure"
          value={share(f.fpClosed, f.l1Reviewed)}
          sub={`of ${nf.format(f.l1Reviewed)} L1 dispositions`}
        />
        <Stat
          label="Median handling time"
          value={f.medianHandleMins != null ? `${Math.round(f.medianHandleMins)} min` : "—"}
          sub="Analyst time per L1 disposition"
        />
      </div>
    </section>
  );
}

function StatGroupLabel({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`px-5 pt-2.5 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase ${className}`}>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  divider,
}: {
  label: string;
  value: string;
  sub: ReactNode;
  divider?: boolean;
}) {
  return (
    <dl className={`min-w-0 px-5 pt-1 pb-3 ${divider ? "lg:border-l lg:border-neutral-100" : ""}`}>
      <dt className="truncate text-[11px] text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-900">{value}</dd>
      <dd className="truncate text-[11px] text-neutral-500">{sub}</dd>
    </dl>
  );
}
