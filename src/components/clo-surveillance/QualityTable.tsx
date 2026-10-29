import { useMemo, useState } from "react";
import type { CompositionFocus, DealView, QualityTest } from "./model";
import { FOCUS, INK, STATUS, TH, qualityCushion, qualityValue } from "./format";
import { CardHeader, TestChip } from "./ui";

/* Collateral quality tests: a dense bespoke table. Each row carries the
 * actual, the covenant, a signed cushion bar, a pass/fail chip and an
 * eight-quarter sparkline. Clicking a row highlights the matching slice of
 * the composition treemap below (the CCC row lights the Caa bucket, the
 * largest-industry row lights that industry, and so on). */

type Sort = "spec" | "asc" | "desc";

const relative = (t: QualityTest) => (t.covenant === 0 ? 0 : t.cushion / Math.abs(t.covenant));
const sameFocus = (a: CompositionFocus | null, b: CompositionFocus) =>
  a !== null && a.kind === b.kind && a.id === b.id;

const SENSE_LABEL = { max: "Max", min: "Min" };

export function QualityTable({
  view,
  focus,
  onFocus,
}: {
  view: DealView;
  focus: CompositionFocus | null;
  onFocus: (f: CompositionFocus | null) => void;
}) {
  const [sort, setSort] = useState<Sort>("spec");
  const rows = useMemo(() => {
    if (sort === "spec") return view.quality;
    const m = sort === "asc" ? 1 : -1;
    return [...view.quality].sort((a, b) => m * (relative(a) - relative(b)));
  }, [view.quality, sort]);
  const failing = view.quality.filter((t) => !t.pass).length;
  const first = view.periods.find((p) => p !== null);
  const labels = view.periods.slice(4).map((p) => p?.label ?? "");

  return (
    <section aria-labelledby="clo-cqt-title" className="border border-neutral-200 bg-white">
      <CardHeader
        id="clo-cqt-title"
        title="Collateral quality tests"
        sub={`${view.quality.length} tests · ${failing === 0 ? "all passing" : `${failing} failing`} · covenants from the current matrix point · trend is the last eight determination dates${first ? "" : ""} · click a row to highlight it in the composition treemap`}
        right={
          focus ? (
            <button
              type="button"
              onClick={() => onFocus(null)}
              className={`border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-800 hover:border-neutral-900 ${FOCUS}`}
            >
              Clear highlight
            </button>
          ) : undefined
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left">
          <caption className="sr-only">Collateral quality tests for {view.deal.name}</caption>
          <thead className="border-b border-neutral-200 bg-neutral-50/70">
            <tr>
              <th scope="col" className={TH}>
                Test
              </th>
              <th scope="col" className={`${TH} text-right`}>
                Actual
              </th>
              <th scope="col" className={`${TH} text-right`}>
                Covenant
              </th>
              <th scope="col" className={TH} aria-sort={sort === "spec" ? "none" : sort === "asc" ? "ascending" : "descending"}>
                <button
                  type="button"
                  onClick={() => setSort((s) => (s === "asc" ? "desc" : s === "desc" ? "spec" : "asc"))}
                  className={`inline-flex items-center gap-1 uppercase ${FOCUS}`}
                  title="Sort by cushion relative to covenant"
                >
                  Cushion
                  <span aria-hidden className="font-mono text-neutral-400">
                    {sort === "asc" ? "▲" : sort === "desc" ? "▼" : "↕"}
                  </span>
                </button>
              </th>
              <th scope="col" className={TH}>
                Status
              </th>
              <th scope="col" className={TH}>
                8Q trend · {labels[0]} → {labels[7]}
              </th>
              <th scope="col" className={TH}>
                Highlights
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((t) => {
              const on = sameFocus(focus, t.focus);
              const state = !t.pass ? "fail" : relative(t) < 0.05 ? "thin" : "pass";
              const ink = on ? "text-white" : "text-neutral-900";
              const dim = on ? "text-neutral-400" : "text-neutral-500";
              return (
                <tr
                  key={t.id}
                  onClick={() => onFocus(on ? null : t.focus)}
                  className={`cursor-pointer transition ${on ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"}`}
                >
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={(e) => {
                        e.stopPropagation();
                        onFocus(on ? null : t.focus);
                      }}
                      className={`text-left text-[11px] font-medium ${ink} ${FOCUS}`}
                    >
                      {t.label}
                    </button>
                    {t.detail && <span className={`block truncate text-[10px] ${dim}`}>{t.detail}</span>}
                  </th>
                  <td className={`px-3 py-1.5 text-right font-mono text-[11px] font-semibold tabular-nums ${ink}`}>
                    {qualityValue(t)}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono text-[11px] tabular-nums ${dim}`}>
                    {SENSE_LABEL[t.sense]} {qualityValue(t, t.covenant)}
                  </td>
                  <td className="px-3 py-1.5">
                    <CushionCell t={t} on={on} />
                  </td>
                  <td className="px-3 py-1.5">
                    <TestChip state={state} size="sm" />
                  </td>
                  <td className="px-3 py-1.5">
                    <MiniTrend t={t} on={on} labels={labels} />
                  </td>
                  <td className={`px-3 py-1.5 text-[10px] ${dim}`}>{t.focus.label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Signed bar centred on the covenant: right is room, left is breach. */
function CushionCell({ t, on }: { t: QualityTest; on: boolean }) {
  const rel = relative(t);
  const half = Math.min(50, (Math.abs(rel) / 0.3) * 50);
  const color = rel < 0 ? STATUS.bad : rel < 0.05 ? STATUS.warn : STATUS.good;
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className={`relative block h-2 w-20 shrink-0 ${on ? "bg-neutral-700" : "bg-neutral-100"}`}>
        <span className={`absolute top-0 bottom-0 left-1/2 w-px ${on ? "bg-neutral-500" : "bg-neutral-300"}`} />
        <span
          className="absolute top-0 bottom-0"
          style={rel >= 0 ? { left: "50%", width: `${half}%`, background: color } : { right: "50%", width: `${half}%`, background: color }}
        />
      </span>
      <span className={`font-mono text-[11px] tabular-nums ${on ? "text-white" : rel < 0 ? "font-semibold text-rose-700" : "text-neutral-800"}`}>
        {qualityCushion(t)}
      </span>
    </span>
  );
}

const SW = 84;
const SH = 22;

/** Eight-point sparkline with the covenant drawn as a dashed reference. */
function MiniTrend({ t, on, labels }: { t: QualityTest; on: boolean; labels: string[] }) {
  const vals = t.history;
  const lo0 = Math.min(...vals, t.covenant);
  const hi0 = Math.max(...vals, t.covenant);
  const pad = (hi0 - lo0 || Math.abs(hi0) || 1) * 0.15;
  const lo = lo0 - pad;
  const hi = hi0 + pad;
  const x = (i: number) => 3 + (i / (vals.length - 1)) * (SW - 6);
  const y = (v: number) => 2 + (1 - (v - lo) / (hi - lo)) * (SH - 4);
  const path = vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const stroke = on ? "#ffffff" : INK;
  const start = vals[0];
  const end = vals[vals.length - 1];
  return (
    <svg
      viewBox={`0 0 ${SW} ${SH}`}
      width={SW}
      height={SH}
      className="block"
      role="img"
      aria-label={`${t.label}, ${labels[0]} to ${labels[7]}: ${qualityValue(t, start)} to ${qualityValue(t, end)}, covenant ${qualityValue(t, t.covenant)}`}
    >
      <line
        x1={0}
        x2={SW}
        y1={y(t.covenant)}
        y2={y(t.covenant)}
        stroke={on ? "#fda4af" : STATUS.bad}
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
      <rect x={x(vals.length - 1) - 2.5} y={y(end) - 2.5} width={5} height={5} fill={stroke} />
    </svg>
  );
}
