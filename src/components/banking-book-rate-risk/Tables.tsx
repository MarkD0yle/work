import { useMemo, useState } from "react";
import { BUCKETS, LIMITS, type BucketId, type HedgeRow, type LimitRow, type ScenarioId, type View as RiskView } from "./model";
import { DIRECTION_META, FOCUS, PURPOSE_SHORT, STATUS, gbpK, gbpM, gbpMSigned, num, pct, pctSigned, rate } from "./format";
import { CardHeader, EmptyState, SortTh, StatusChip, Swatch, TextChip, type SortDir } from "./ui";

/* Row 3: the hedge programme (scoped by the ladder's bucket focus) and the
 * limits table (its ΔEVE rows select the scenario). */

const TH = "px-3 py-2 text-[10px] font-semibold tracking-wider whitespace-nowrap text-neutral-500 uppercase";
const NUM = "px-3 py-2 text-right font-mono text-[11px] tabular-nums whitespace-nowrap";
const BUCKET_ORDER = new Map(BUCKETS.map((b, i) => [b.id, i]));

/* ------------------------------------------------------------------ *
 * Hedge programme
 * ------------------------------------------------------------------ */

type HedgeSort = "purpose" | "direction" | "bucket" | "notional" | "fixed" | "par" | "dv01" | "pv";

const hedgeCmp = (k: HedgeSort) => (a: HedgeRow, b: HedgeRow) => {
  switch (k) {
    case "purpose":
      return a.purpose.localeCompare(b.purpose) || BUCKET_ORDER.get(a.bucket)! - BUCKET_ORDER.get(b.bucket)!;
    case "direction":
      return a.direction.localeCompare(b.direction) || BUCKET_ORDER.get(a.bucket)! - BUCKET_ORDER.get(b.bucket)!;
    case "bucket":
      return BUCKET_ORDER.get(a.bucket)! - BUCKET_ORDER.get(b.bucket)! || a.purpose.localeCompare(b.purpose);
    default:
      return a[k] - b[k];
  }
};

export function HedgeTable({
  view,
  focus,
  onClearFocus,
}: {
  view: RiskView;
  focus: BucketId | null;
  onClearFocus: () => void;
}) {
  const [sort, setSort] = useState<{ key: HedgeSort; dir: SortDir }>({ key: "bucket", dir: "asc" });
  const onSort = (key: HedgeSort) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "purpose" || key === "direction" || key === "bucket" ? "asc" : "desc" },
    );

  const all = view.hedges;
  const rows = useMemo(() => {
    const scoped = focus ? all.filter((h) => h.bucket === focus) : all;
    const cmp = hedgeCmp(sort.key);
    return [...scoped].sort((a, b) => (sort.dir === "asc" ? cmp(a, b) : -cmp(a, b)));
  }, [all, focus, sort]);
  const maxDv01 = Math.max(1, ...all.map((h) => Math.abs(h.dv01)));
  const shown = {
    notional: rows.reduce((s, h) => s + h.notional, 0),
    dv01: rows.reduce((s, h) => s + h.dv01, 0),
    pv: rows.reduce((s, h) => s + h.pv, 0),
  };
  const focusLabel = focus ? BUCKETS.find((b) => b.id === focus)?.label : null;
  const t = view.hedgeTotals;
  const pipelineCover = view.assumptions.hedge;

  return (
    <section aria-labelledby="bb-hedge-title" className="flex flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="bb-hedge-title"
        title="Hedge programme"
        sub={
          all.length
            ? `${gbpM(t.notional)} of swaps: ${gbpM(t.receive)} receive-fixed against core NMDs, ${gbpM(t.pay)} pay-fixed against fixed mortgages and the pipeline (${pct(pipelineCover * 100, 0)} covered) · net DV01 ${gbpK(t.dv01)}/bp · MTM ${gbpMSigned(t.pv)}`
            : `No swaps are booked to ${view.entityLabel}`
        }
        right={
          focusLabel ? (
            <button
              type="button"
              onClick={onClearFocus}
              className={`inline-flex shrink-0 items-center gap-1.5 border border-neutral-900 bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase ${FOCUS}`}
            >
              Bucket {focusLabel} · clear ×
            </button>
          ) : undefined
        }
      />
      {all.length === 0 ? (
        <EmptyState
          title={`No swaps booked to ${view.entityLabel}`}
          body="Treasury executes the programme, but each swap is allocated to the segment whose position it hedges. Switch to Group or UK Retail to see the book."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No swaps reprice in ${focusLabel}`}
          body="The programme is laddered from 1–2y to 5–7y, with floating legs in 1–3m. Clear the bucket focus to see every tranche."
          action={
            <button
              type="button"
              onClick={onClearFocus}
              className={`mt-3 border border-neutral-300 px-2.5 py-1 text-[11px] font-medium text-neutral-800 hover:border-neutral-900 ${FOCUS}`}
            >
              Clear bucket focus
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <caption className="sr-only">Swap hedge programme for {view.entityLabel}</caption>
            <thead className="border-b border-neutral-200 bg-neutral-50/70">
              <tr>
                <SortTh col="purpose" label="Purpose" sort={sort} onSort={onSort} />
                <SortTh col="direction" label="Direction" sort={sort} onSort={onSort} />
                <SortTh col="bucket" label="Bucket" sort={sort} onSort={onSort} />
                <SortTh col="notional" label="Notional" sort={sort} onSort={onSort} align="right" />
                <SortTh col="fixed" label="Fixed" sort={sort} onSort={onSort} align="right" />
                <SortTh col="par" label="Par today" sort={sort} onSort={onSort} align="right" />
                <SortTh col="dv01" label="DV01 / bp" sort={sort} onSort={onSort} align="right" className="min-w-[150px]" />
                <SortTh col="pv" label="MTM" sort={sort} onSort={onSort} align="right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((h) => {
                const dm = DIRECTION_META[h.direction];
                return (
                  <tr key={h.id} className="hover:bg-neutral-50">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      <TextChip>{PURPOSE_SHORT[h.purpose]}</TextChip>
                      {h.forward && <span className="ml-1.5 text-[10px] text-neutral-500">fwd start</span>}
                    </th>
                    <td className="px-3 py-2 text-[11px] whitespace-nowrap text-neutral-800">
                      <span className="inline-flex items-center gap-1.5">
                        <Swatch color={dm.color} className="h-2 w-2" />
                        {dm.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] whitespace-nowrap text-neutral-800">{h.bucketLabel}</td>
                    <td className={`${NUM} text-neutral-800`}>{gbpM(h.notional)}</td>
                    <td className={`${NUM} text-neutral-800`}>{rate(h.fixed)}</td>
                    <td className={`${NUM} text-neutral-500`}>{rate(h.par)}</td>
                    <td className={`${NUM} text-neutral-800`}>
                      <span className="flex items-center justify-end gap-2">
                        <span aria-hidden className="relative h-2 w-20 shrink-0 bg-neutral-100">
                          <span
                            className="absolute inset-y-0 left-0"
                            style={{ width: `${(Math.abs(h.dv01) / maxDv01) * 100}%`, background: dm.color }}
                          />
                        </span>
                        <span className="w-14 text-right">{gbpK(h.dv01)}</span>
                      </span>
                    </td>
                    <td className={`${NUM} ${h.pv < 0 ? "text-rose-700" : "text-neutral-800"}`}>{gbpMSigned(h.pv, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-neutral-200 bg-neutral-50/70">
              <tr>
                <th scope="row" colSpan={3} className="px-3 py-2 text-left text-[11px] font-semibold text-neutral-900">
                  {focus ? `Total in ${focusLabel} (${rows.length} of ${all.length})` : `Total (${all.length} tranches)`}
                </th>
                <td className={`${NUM} font-semibold text-neutral-900`}>{gbpM(shown.notional)}</td>
                <td className={NUM} />
                <td className={NUM} />
                <td className={`${NUM} font-semibold text-neutral-900`}>{gbpK(shown.dv01)}</td>
                <td className={`${NUM} font-semibold ${shown.pv < 0 ? "text-rose-700" : "text-neutral-900"}`}>{gbpMSigned(shown.pv, 1)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Limits
 * ------------------------------------------------------------------ */

function limitValue(l: LimitRow) {
  return l.unit === "pct" ? pct(l.value) : gbpM(l.value);
}
function limitLimit(l: LimitRow) {
  return l.unit === "pct" ? pct(l.limit, 0) : gbpM(l.limit);
}
function headroom(l: LimitRow) {
  const h = l.limit - l.value;
  return l.unit === "pct" ? `${num(h, 1)} pp` : gbpMSigned(h);
}

/** Usage against the limit as a track: early-warning and internal marks, the limit as an ink line. */
function HeadroomBar({ l }: { l: LimitRow }) {
  const scale = Math.max(l.limit * 1.25, l.value * 1.05);
  const x = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  return (
    <span aria-hidden className="relative block h-2.5 w-full bg-neutral-100">
      <span className="absolute inset-y-0 left-0" style={{ width: x(l.value), background: STATUS[l.status] }} />
      <span className="absolute inset-y-0 w-px bg-neutral-400" style={{ left: x(l.early) }} />
      {l.internal !== undefined && <span className="absolute inset-y-0 w-px bg-neutral-400" style={{ left: x(l.internal) }} />}
      <span className="absolute inset-y-0 w-0.5 bg-neutral-900" style={{ left: x(l.limit) }} />
    </span>
  );
}

export function LimitsTable({
  view,
  selected,
  onSelect,
}: {
  view: RiskView;
  selected: ScenarioId;
  onSelect: (id: ScenarioId) => void;
}) {
  const byId = new Map(view.scenarios.map((s) => [s.id, s]));
  const breached = view.limits.filter((l) => l.status === "bad").length;
  const watch = view.limits.filter((l) => l.status === "warn").length;
  return (
    <section aria-labelledby="bb-limits-title" className="flex flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="bb-limits-title"
        title="Limits"
        sub={`${breached ? `${breached} breached · ` : ""}${watch ? `${watch} on watch · ` : ""}ΔEVE rows against the ${pct(LIMITS.outlier, 0)} outlier test (internal ${pct(LIMITS.internal, 0)}, early warning ${pct(LIMITS.early, 0)}) · limits are set at Group; segment views are compared against the same thresholds for reference`}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left">
          <caption className="sr-only">Limit usage for {view.entityLabel}</caption>
          <thead className="border-b border-neutral-200 bg-neutral-50/70">
            <tr>
              <th scope="col" className={TH}>Measure</th>
              <th scope="col" className={`${TH} text-right`}>Value</th>
              <th scope="col" className={`${TH} text-right`}>Limit</th>
              <th scope="col" className={`${TH} min-w-[140px]`}>Usage</th>
              <th scope="col" className={`${TH} text-right`}>Headroom</th>
              <th scope="col" className={TH}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {view.limits.map((l) => {
              const sc = l.scenario ? byId.get(l.scenario) : undefined;
              const isEve = l.id.startsWith("eve-");
              const on = isEve && l.scenario === selected;
              const gain = isEve && sc && sc.dEvePct > 0;
              return (
                <tr
                  key={l.id}
                  aria-current={on ? "true" : undefined}
                  className={`${on ? "bg-neutral-50 shadow-[inset_2px_0_0_#171717]" : "hover:bg-neutral-50"}`}
                >
                  <th scope="row" className="px-3 py-2 text-left text-[11px] font-medium text-neutral-800">
                    {isEve && l.scenario ? (
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => onSelect(l.scenario!)}
                        className={`text-left hover:text-neutral-950 ${FOCUS}`}
                      >
                        {l.label}
                        <span className="block text-[10px] font-normal text-neutral-500">
                          {on ? "Selected scenario" : "Select to drive the charts"}
                        </span>
                      </button>
                    ) : (
                      <>
                        {l.label}
                        <span className="block text-[10px] font-normal text-neutral-500">
                          {l.id === "nii" && sc ? `Worst case: ${sc.label}` : "Behaviouralised, incl. swap legs"}
                        </span>
                      </>
                    )}
                  </th>
                  <td className={`${NUM} text-neutral-900`}>
                    {limitValue(l)}
                    {isEve && sc && (
                      <span className="block text-[10px] text-neutral-500">
                        {gain ? `gain ${pctSigned(sc.dEvePct)}` : gbpMSigned(sc.dEve)}
                      </span>
                    )}
                    {l.id === "nii" && (
                      <span className="block text-[10px] text-neutral-500">{pctSigned((100 * view.niiAtRisk.value) / (view.groupNiiHorizon || 1))} of group NII</span>
                    )}
                  </td>
                  <td className={`${NUM} text-neutral-700`}>
                    {limitLimit(l)}
                    {l.internal !== undefined && <span className="block text-[10px] text-neutral-500">int. {pct(l.internal, 0)}</span>}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <HeadroomBar l={l} />
                    <span className="mt-0.5 block font-mono text-[9px] text-neutral-400 tabular-nums">{pct(l.usage * 100, 0)} used</span>
                  </td>
                  <td className={`${NUM} ${l.status === "bad" ? "font-semibold text-rose-700" : "text-neutral-800"}`}>{headroom(l)}</td>
                  <td className="px-3 py-2">
                    <StatusChip status={l.status} size="sm" label={isEve ? (l.status === "bad" ? "Outlier" : l.status === "warn" ? "Early warn" : "Inside") : undefined} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
