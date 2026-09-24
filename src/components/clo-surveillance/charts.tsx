import { useMemo, useState } from "react";
import type { Options, Point } from "highcharts";
import HighchartsView from "../highcharts/HighchartsView";
import { tipHtml } from "../highcharts/tooltip";
import {
  BUCKETS,
  CCC_LIMIT,
  INDUSTRY_BY_ID,
  PAY_DATES,
  THIN_BPS,
  matchesFocus,
  ratingBucket,
  type CompositionFocus,
  type CoverageTest,
  type DealView,
  type IndustrySlice,
  type Obligor,
  type WaterfallScenario,
  type WaterfallStep,
} from "./model";
import {
  BUCKET_COLOR,
  BUCKET_LABEL,
  DIM,
  FOCUS,
  INK,
  MON,
  MUTED_SERIES,
  SPREAD_BINS,
  STATUS,
  TD,
  TH,
  bps,
  dateMid,
  eurM,
  num0,
  pct,
  signedPp,
  spread,
  spreadColor,
} from "./format";
import { CardHeader, EmptyState, LegendItem, MicroLabel, Seg, TestChip, ViewToggle, type TestState, type View } from "./ui";

const r2 = (v: number) => Math.round(v * 100) / 100;
const periodLabel = (t: number) => {
  const d = new Date(t);
  return `${MON[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
};
const PERIOD_LABELS = PAY_DATES.map(periodLabel);
const testState = (t: CoverageTest): TestState => (!t.pass ? "fail" : t.thin ? "thin" : "pass");

/* ------------------------------------------------------------------ *
 * Row 1: coverage tests as bullet tiles + the tightest test's trend
 * ------------------------------------------------------------------ */

export function CoverageCard({ view }: { view: DealView }) {
  const [mode, setMode] = useState<View>("chart");
  const priorLabel = view.periods[10]?.label ?? null;
  const t = view.tightest;
  const trend = view.periods.map((p, i) => ({
    label: PERIOD_LABELS[i],
    ratio: t.history[i],
    cushion: t.history[i] === null ? null : Math.round((t.history[i] - t.trigger) * 100),
    projected: p?.projected ?? false,
  }));

  return (
    <section aria-labelledby="clo-cov-title" className="border border-neutral-200 bg-white">
      <CardHeader
        id="clo-cov-title"
        title="Coverage tests"
        sub={`OC: adjusted par ${eurM(view.adjustedPar)} ÷ notes at and above the class · IC: interest proceeds ${eurM(view.proceeds, 2)} ÷ interest and senior fees due at and above · 3M Euribor ${pct(view.euribor, 2)} · thin = under ${THIN_BPS} bps of cushion`}
        right={<ViewToggle value={mode} onChange={setMode} name="Coverage tests" />}
      />
      {mode === "chart" ? (
        <div className="grid grid-cols-1 gap-px bg-neutral-100 sm:grid-cols-2 xl:grid-cols-4">
          {view.coverage.map((c) => (
            <BulletTile key={c.id} t={c} priorLabel={priorLabel} />
          ))}
          <TightestTile view={view} trend={trend} />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3">
          <div className="overflow-x-auto xl:col-span-2">
            <table className="w-full text-left">
              <caption className="sr-only">Coverage tests: actual against trigger</caption>
              <thead className="border-b border-neutral-200 bg-neutral-50/70">
                <tr>
                  <th scope="col" className={TH}>Test</th>
                  <th scope="col" className={`${TH} text-right`}>Numerator</th>
                  <th scope="col" className={`${TH} text-right`}>Denominator</th>
                  <th scope="col" className={`${TH} text-right`}>Actual</th>
                  <th scope="col" className={`${TH} text-right`}>Trigger</th>
                  <th scope="col" className={`${TH} text-right`}>Cushion</th>
                  <th scope="col" className={`${TH} text-right`}>Prior{priorLabel ? ` (${priorLabel})` : ""}</th>
                  <th scope="col" className={TH}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {view.coverage.map((c) => (
                  <tr key={c.id}>
                    <th scope="row" className="px-3 py-1.5 text-left text-[11px] font-medium text-neutral-900">{c.label}</th>
                    <td className={`${TD} text-right`}>{eurM(c.numerator, 2)}</td>
                    <td className={`${TD} text-right`}>{eurM(c.denominator, 2)}</td>
                    <td className={`${TD} text-right font-semibold`}>{pct(c.actual, 2)}</td>
                    <td className={`${TD} text-right text-neutral-500`}>{pct(c.trigger, 2)}</td>
                    <td className={`${TD} text-right ${c.pass ? "" : "font-semibold text-rose-700"}`}>{bps(c.cushionBps)}</td>
                    <td className={`${TD} text-right text-neutral-500`}>{c.prior === null ? "—" : pct(c.prior, 2)}</td>
                    <td className="px-3 py-1.5"><TestChip state={testState(c)} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-neutral-100 xl:border-t-0 xl:border-l">
            <table className="w-full text-left">
              <caption className="px-3 py-1.5 text-left text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
                {t.label} · 12 determination dates
              </caption>
              <thead className="border-y border-neutral-200 bg-neutral-50/70">
                <tr>
                  <th scope="col" className={TH}>Period</th>
                  <th scope="col" className={`${TH} text-right`}>Ratio</th>
                  <th scope="col" className={`${TH} text-right`}>Cushion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {trend.map((p) => (
                  <tr key={p.label}>
                    <th scope="row" className="px-3 py-1 text-left text-[11px] font-medium text-neutral-800">
                      {p.label}
                      {p.projected && <span className="ml-1 text-[9px] text-neutral-400">current</span>}
                    </th>
                    <td className={`${TD} py-1 text-right`}>{p.ratio === null ? "—" : pct(p.ratio, 2)}</td>
                    <td className={`${TD} py-1 text-right ${p.cushion !== null && p.cushion < 0 ? "font-semibold text-rose-700" : ""}`}>
                      {p.cushion === null ? "—" : bps(p.cushion)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function BulletTile({ t, priorLabel }: { t: CoverageTest; priorLabel: string | null }) {
  const state = testState(t);
  const options = useMemo<Options>(() => {
    const pad = t.kind === "OC" ? 3 : 15;
    const lo = Math.floor(Math.min(t.actual, t.trigger) - pad);
    const hi = Math.ceil(Math.max(t.actual, t.trigger) + pad);
    const color = state === "fail" ? STATUS.bad : state === "thin" ? STATUS.warn : STATUS.good;
    return {
      chart: {
        type: "bullet",
        inverted: true,
        spacing: [0, 4, 0, 4],
        marginTop: 4,
        marginBottom: 20,
        marginLeft: 4,
        marginRight: 4,
        animation: false,
      },
      xAxis: { categories: [t.label], lineWidth: 0, tickLength: 0, labels: { enabled: false } },
      yAxis: {
        min: lo,
        max: hi,
        startOnTick: false,
        endOnTick: false,
        gridLineWidth: 0,
        lineWidth: 1,
        lineColor: "#e5e5e5",
        tickPositions: [lo, t.trigger, hi],
        title: { text: undefined },
        labels: {
          style: { fontSize: "9px", color: "#737373" },
          formatter() {
            return `${Number(this.value).toFixed(t.kind === "OC" ? 1 : 0)}%`;
          },
        },
        plotBands: [
          { from: lo, to: t.trigger, color: "rgba(225,29,72,0.10)" },
          { from: t.trigger, to: t.trigger + THIN_BPS / 100, color: "rgba(217,119,6,0.16)" },
        ],
      },
      legend: { enabled: false },
      tooltip: {
        formatter() {
          return tipHtml(t.label, [
            { label: "Actual", value: pct(t.actual, 2) },
            { label: "Trigger", value: pct(t.trigger, 2) },
            { label: "Cushion", value: bps(t.cushionBps) },
            ...(t.prior !== null ? [{ label: `Prior · ${priorLabel}`, value: pct(t.prior, 2) }] : []),
          ]);
        },
      },
      plotOptions: {
        bullet: {
          borderWidth: 0,
          pointPadding: 0.3,
          groupPadding: 0,
          color,
          targetOptions: { width: "180%", height: 3, color: INK, borderWidth: 0 },
        },
        series: { animation: false, states: { hover: { enabled: false }, inactive: { opacity: 1 } } },
      },
      series: [{ type: "bullet", name: t.label, data: [{ y: r2(t.actual), target: t.trigger }] }],
    };
  }, [t, state, priorLabel]);
  const delta = t.prior !== null ? t.actual - t.prior : null;
  const tone = state === "fail" ? "text-rose-700" : state === "thin" ? "text-amber-700" : "text-emerald-700";

  return (
    <div className="bg-white px-4 pt-3 pb-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-neutral-900">{t.label}</span>
        <TestChip state={state} size="sm" />
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl leading-none font-semibold text-neutral-950">{pct(t.actual, 1)}</span>
        <span className="text-[10px] text-neutral-500">trigger {pct(t.trigger, 1)}</span>
      </div>
      <HighchartsView options={options} height={54} />
      <div className="flex items-center justify-between font-mono text-[10px] tabular-nums">
        <span className={tone}>{bps(t.cushionBps)} cushion</span>
        {delta !== null && (
          <span className="text-neutral-500">
            {delta >= 0 ? "▲" : "▼"} {signedPp(delta, 1)} vs {priorLabel}
          </span>
        )}
      </div>
    </div>
  );
}

const TW = 240;
const TH_ = 52;

function TightestTile({
  view,
  trend,
}: {
  view: DealView;
  trend: { label: string; cushion: number | null; projected: boolean }[];
}) {
  const t = view.tightest;
  const vals = trend.map((p) => p.cushion).filter((v): v is number => v !== null);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  const span = hi - lo || 1;
  const x = (i: number) => 4 + (i / (trend.length - 1)) * (TW - 8);
  const y = (v: number) => 6 + (1 - (v - lo) / span) * (TH_ - 12);
  let path = "";
  trend.forEach((p, i) => {
    if (p.cushion === null) return;
    path += `${path === "" ? "M" : "L"}${x(i).toFixed(1)},${y(p.cushion).toFixed(1)}`;
  });
  const firstIdx = trend.findIndex((p) => p.cushion !== null);
  const last = trend[trend.length - 1];
  const min = Math.min(...vals);
  const max = Math.max(...vals);

  return (
    <div className="bg-white px-4 pt-3 pb-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-neutral-900">Tightest test · 12 quarters</span>
        <MicroLabel>{t.label}</MicroLabel>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl leading-none font-semibold text-neutral-950">{bps(t.cushionBps)}</span>
        <span className="text-[10px] text-neutral-500">cushion now · {trend[firstIdx].label} → {last.label}</span>
      </div>
      <svg
        viewBox={`0 0 ${TW} ${TH_}`}
        className="mt-1 block h-[54px] w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${t.label} cushion over 12 quarters, from ${bps(vals[0])} to ${bps(t.cushionBps)}; low ${bps(min)}, high ${bps(max)}`}
      >
        {lo < 0 && <rect x={0} y={y(0)} width={TW} height={TH_ - y(0)} fill="rgba(225,29,72,0.08)" />}
        <line x1={0} x2={TW} y1={y(0)} y2={y(0)} stroke={lo < 0 ? STATUS.bad : "#d4d4d4"} strokeWidth={1} strokeDasharray={lo < 0 ? "3 2" : undefined} vectorEffect="non-scaling-stroke" />
        <path d={path} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {last.cushion !== null && (
          <rect x={x(trend.length - 1) - 3} y={y(last.cushion) - 3} width={6} height={6} fill={last.cushion < 0 ? STATUS.bad : INK} />
        )}
      </svg>
      <div className="flex items-center justify-between font-mono text-[10px] text-neutral-500 tabular-nums">
        <span>trigger = 0</span>
        <span>
          low {bps(min)} · high {bps(max)}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Row 3a: portfolio composition treemap with obligor side table
 * ------------------------------------------------------------------ */

type ColorMode = "rating" | "spread";
type LeafCustom = { kind: "obligor"; o: Obligor; ind: IndustrySlice };
type ParentCustom = { kind: "industry"; ind: IndustrySlice };

export function CompositionCard({
  view,
  focus,
  onClearFocus,
  industry,
  onIndustry,
}: {
  view: DealView;
  focus: CompositionFocus | null;
  onClearFocus: () => void;
  industry: string | null;
  onIndustry: (id: string | null) => void;
}) {
  const [mode, setMode] = useState<View>("chart");
  const [colorBy, setColorBy] = useState<ColorMode>("rating");

  const highlighted = useMemo(
    () => (focus ? view.pool.filter((o) => matchesFocus(o, focus, view)) : null),
    [focus, view],
  );
  const hlIds = useMemo(() => (highlighted ? new Set(highlighted.map((o) => o.id)) : null), [highlighted]);
  const hlPar = highlighted?.reduce((s, o) => s + o.par, 0) ?? 0;

  const options = useMemo<Options>(() => {
    const leafColor = (o: Obligor) =>
      colorBy === "rating" ? BUCKET_COLOR[ratingBucket(o)] : o.fixed ? "#d4d4d4" : spreadColor(o.spread);
    const data = [
      ...view.industries.map((ind) => ({
        id: ind.id,
        name: ind.short,
        color: "#ffffff",
        custom: { kind: "industry", ind } satisfies ParentCustom,
        dataLabels:
          industry === ind.id
            ? { style: { color: "#ffffff", textOutline: "none" }, backgroundColor: INK, padding: 3 }
            : undefined,
      })),
      ...view.industries.flatMap((ind) =>
        ind.obligors.map((o) => ({
          id: o.id,
          parent: ind.id,
          name: o.name,
          value: Math.round(o.par * 1000) / 1000,
          color: hlIds && !hlIds.has(o.id) ? DIM : leafColor(o),
          custom: { kind: "obligor", o, ind } satisfies LeafCustom,
        })),
      ),
    ];
    return {
      chart: { type: "treemap", spacing: [4, 4, 4, 4], animation: false },
      tooltip: {
        formatter(this: Point) {
          const c = this.options.custom as LeafCustom | ParentCustom;
          if (c.kind === "industry") {
            const i = c.ind;
            return tipHtml(i.name, [
              { label: "Par", value: eurM(i.par) },
              { label: "Share of pool", value: pct(i.share, 1) },
              { label: "Obligors", value: String(i.count) },
              { label: "WAS", value: pct(i.was, 2) },
              { label: "CCC and below", value: pct(i.cccShare, 1) },
            ]);
          }
          const o = c.o;
          return tipHtml(
            o.name,
            [
              { label: "Rating", value: `${o.rating}${o.defaulted ? " · defaulted" : ""}` },
              { label: o.fixed ? "Fixed coupon" : "Spread", value: o.fixed ? pct(o.spread / 100, 2) : spread(o.spread) },
              { label: "Par", value: eurM(o.par, 2) },
              { label: "Share of pool", value: pct((o.par / view.par) * 100, 2) },
              { label: "Price", value: o.price.toFixed(2) },
              { label: "Lien", value: o.lien === 2 ? "Second" : "First" },
            ],
            `${c.ind.name} · click to focus the industry`,
          );
        },
      },
      plotOptions: { series: { animation: false, states: { inactive: { opacity: 1 } } } },
      series: [
        {
          type: "treemap",
          name: "Par",
          layoutAlgorithm: "squarified",
          allowTraversingTree: false,
          interactByLeaf: true,
          cursor: "pointer",
          borderColor: "#ffffff",
          borderWidth: 1,
          levelIsConstant: false,
          levels: [
            {
              level: 1,
              borderWidth: 3,
              borderColor: "#ffffff",
              dataLabels: {
                enabled: true,
                align: "left",
                verticalAlign: "top",
                padding: 2,
                style: { fontSize: "10px", fontWeight: "600", color: INK, textOutline: "2px #ffffff" },
              },
            },
            { level: 2, borderWidth: 1, dataLabels: { enabled: false } },
          ],
          point: {
            events: {
              click() {
                const c = this.options.custom as LeafCustom | ParentCustom;
                onIndustry(industry === c.ind.id ? null : c.ind.id);
              },
            },
          },
          data,
        },
      ],
    };
  }, [view, colorBy, hlIds, industry, onIndustry]);

  const slice = industry ? view.industries.find((i) => i.id === industry) : undefined;
  const sideRows = (slice ? slice.obligors : highlighted ? [...highlighted].sort((a, b) => b.par - a.par) : [...view.pool].sort((a, b) => b.par - a.par)).slice(0, 8);
  const sideTitle = slice
    ? `Top obligors · ${slice.short} (${slice.count} names, ${pct(slice.share, 1)} of par)`
    : highlighted
      ? `Largest highlighted obligors · ${focus?.label}`
      : "Largest obligors in the pool";

  return (
    <section aria-labelledby="clo-comp-title" className="flex flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="clo-comp-title"
        title="Portfolio composition"
        sub={`${view.industries.length} Moody's industries · ${view.pool.length} obligors · sized by par · click an industry to list its obligors`}
        right={
          <>
            <Seg<ColorMode>
              label="Colour by"
              hideLabel
              size="sm"
              value={colorBy}
              onChange={setColorBy}
              options={[
                { value: "rating", label: "Rating bucket" },
                { value: "spread", label: "Spread" },
              ]}
            />
            <ViewToggle value={mode} onChange={setMode} name="Composition" />
          </>
        }
      />
      {mode === "chart" ? (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-2.5">
            {colorBy === "rating"
              ? BUCKETS.map((b) => (
                  <LegendItem key={b} color={BUCKET_COLOR[b]}>
                    {BUCKET_LABEL[b]}
                  </LegendItem>
                ))
              : [
                  ...SPREAD_BINS.map((b) => (
                    <LegendItem key={b.label} color={b.color}>
                      {b.label} bps
                    </LegendItem>
                  )),
                  <LegendItem key="fixed" color="#d4d4d4">
                    Fixed rate
                  </LegendItem>,
                ]}
            {hlIds && <LegendItem color={DIM}>Outside highlight</LegendItem>}
          </div>
          <div className="min-w-0 px-2 pt-1">
            <HighchartsView options={options} height={300} />
          </div>
        </>
      ) : (
        <div className="max-h-[352px] overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Portfolio composition by industry</caption>
            <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e5e5e5]">
              <tr>
                <th scope="col" className={TH}>Industry</th>
                <th scope="col" className={`${TH} text-right`}>Obligors</th>
                <th scope="col" className={`${TH} text-right`}>Par</th>
                <th scope="col" className={`${TH} text-right`}>Share</th>
                <th scope="col" className={`${TH} text-right`}>WAS</th>
                <th scope="col" className={`${TH} text-right`}>WARF</th>
                <th scope="col" className={`${TH} text-right`}>CCC</th>
                <th scope="col" className={`${TH} text-right`}>Defaulted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {view.industries.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => onIndustry(industry === i.id ? null : i.id)}
                  className={`cursor-pointer ${industry === i.id ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"}`}
                >
                  <th scope="row" className={`px-3 py-1.5 text-left text-[11px] font-medium ${industry === i.id ? "text-white" : "text-neutral-900"}`}>{i.name}</th>
                  <td className={`${TD} text-right ${industry === i.id ? "text-white" : ""}`}>{i.count}</td>
                  <td className={`${TD} text-right ${industry === i.id ? "text-white" : ""}`}>{eurM(i.par)}</td>
                  <td className={`${TD} text-right ${industry === i.id ? "text-white" : ""}`}>{pct(i.share, 1)}</td>
                  <td className={`${TD} text-right ${industry === i.id ? "text-white" : ""}`}>{pct(i.was, 2)}</td>
                  <td className={`${TD} text-right ${industry === i.id ? "text-white" : ""}`}>{num0(i.warf)}</td>
                  <td className={`${TD} text-right ${industry === i.id ? "text-white" : ""}`}>{pct(i.cccShare, 1)}</td>
                  <td className={`${TD} text-right ${industry === i.id ? "text-white" : ""}`}>{pct(i.defaultedShare, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {highlighted && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 bg-neutral-50 px-4 py-1.5 text-[11px] text-neutral-700">
          <span>
            Highlighting <span className="font-semibold text-neutral-900">{focus?.label}</span>:{" "}
            <span className="font-mono tabular-nums">
              {highlighted.length} obligor{highlighted.length === 1 ? "" : "s"} · {eurM(hlPar)} · {pct((hlPar / view.par) * 100, 1)} of par
            </span>
          </span>
          <button
            type="button"
            onClick={onClearFocus}
            className={`border border-neutral-300 bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-800 hover:border-neutral-900 ${FOCUS}`}
          >
            Clear highlight
          </button>
        </div>
      )}

      <div className="mt-auto border-t border-neutral-100">
        <div className="flex items-center justify-between gap-2 px-4 pt-2 pb-1">
          <MicroLabel>{sideTitle}</MicroLabel>
          {slice && (
            <button
              type="button"
              onClick={() => onIndustry(null)}
              className={`text-[11px] font-medium text-neutral-700 hover:underline ${FOCUS}`}
            >
              Show whole pool
            </button>
          )}
        </div>
        {sideRows.length === 0 ? (
          <EmptyState
            title="No obligors to list"
            body={`Nothing in this pool matches ${focus?.label ?? "the selection"}. Clear the highlight to see the largest obligors.`}
          />
        ) : (
          <table className="w-full text-left">
            <caption className="sr-only">{sideTitle}</caption>
            <thead>
              <tr>
                <th scope="col" className={`${TH} py-1`}>Obligor</th>
                {!slice && <th scope="col" className={`${TH} py-1`}>Industry</th>}
                <th scope="col" className={`${TH} py-1`}>Rating</th>
                <th scope="col" className={`${TH} py-1 text-right`}>Spread</th>
                <th scope="col" className={`${TH} py-1 text-right`}>Par</th>
                <th scope="col" className={`${TH} py-1 text-right`}>% pool</th>
                <th scope="col" className={`${TH} py-1 text-right`}>Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sideRows.map((o) => (
                <tr key={o.id}>
                  <th scope="row" className="max-w-[220px] truncate px-3 py-1 text-left text-[11px] font-medium text-neutral-900">{o.name}</th>
                  {!slice && <td className="px-3 py-1 text-[11px] text-neutral-600">{INDUSTRY_BY_ID[o.industry].short}</td>}
                  <td className="px-3 py-1 text-[11px] text-neutral-700">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="inline-block h-2 w-2" style={{ background: BUCKET_COLOR[ratingBucket(o)] }} />
                      {o.rating}
                      {o.defaulted && <span className="text-[9px] font-semibold text-rose-700 uppercase">Def</span>}
                    </span>
                  </td>
                  <td className={`${TD} py-1 text-right`}>{o.fixed ? `${pct(o.spread / 100, 2)} fixed` : spread(o.spread)}</td>
                  <td className={`${TD} py-1 text-right`}>{eurM(o.par, 2)}</td>
                  <td className={`${TD} py-1 text-right`}>{pct((o.par / view.par) * 100, 2)}</td>
                  <td className={`${TD} py-1 text-right ${o.price < 80 ? "text-rose-700" : ""}`}>{o.price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Row 3b: CCC bucket and defaults over 12 quarters
 * ------------------------------------------------------------------ */

export function CccTrendCard({ view }: { view: DealView }) {
  const [mode, setMode] = useState<View>("chart");
  const periods = view.periods;

  const options = useMemo<Options>(() => {
    const haircutPts = periods.flatMap((p, i) =>
      p && p.ccc > CCC_LIMIT
        ? [
            {
              x: i,
              y: r2(p.ccc),
              dataLabels: { enabled: true, format: `haircut ${eurM(p.cccHaircut, 1)}`, y: -6 },
            },
          ]
        : [],
    );
    return {
      chart: { spacing: [8, 8, 4, 4], animation: false },
      xAxis: { categories: PERIOD_LABELS, tickLength: 0, labels: { style: { fontSize: "10px" } } },
      yAxis: {
        title: { text: "% of collateral par" },
        min: 0,
        labels: { format: "{value}%" },
        plotLines: [
          {
            value: CCC_LIMIT,
            color: STATUS.bad,
            width: 1,
            dashStyle: "Dash",
            zIndex: 4,
            label: { text: `CCC limit ${CCC_LIMIT}%`, align: "left", x: 4, y: -4, style: { fontSize: "9px", color: STATUS.bad } },
          },
        ],
      },
      legend: { enabled: false },
      tooltip: {
        shared: true,
        formatter(this: Point) {
          const p = periods[Number(this.x)];
          if (!p) return false;
          return tipHtml(
            `${p.label} · determination ${dateMid(p.detDate)}`,
            [
              { label: "CCC and below", value: pct(p.ccc, 2), color: INK },
              { label: "Defaulted", value: pct(p.defaulted, 2), color: MUTED_SERIES },
              { label: "Excess over limit", value: p.ccc > CCC_LIMIT ? signedPp(p.ccc - CCC_LIMIT, 2) : "none" },
              { label: "CCC excess haircut", value: eurM(p.cccHaircut, 2) },
            ],
            p.projected ? "Current trustee report" : undefined,
          );
        },
      },
      plotOptions: {
        column: { maxPointWidth: 22, borderWidth: 0 },
        series: { animation: false, states: { inactive: { opacity: 1 } } },
      },
      series: [
        { type: "column", name: "Defaulted", color: MUTED_SERIES, data: periods.map((p) => (p ? r2(p.defaulted) : null)) },
        {
          type: "line",
          name: "CCC and below",
          color: INK,
          lineWidth: 2,
          marker: { enabled: true, radius: 3, symbol: "square" },
          zIndex: 3,
          data: periods.map((p) => (p ? r2(p.ccc) : null)),
        },
        {
          type: "scatter",
          name: "CCC excess haircut",
          color: STATUS.warn,
          marker: { symbol: "diamond", radius: 6, lineWidth: 1.5, lineColor: "#ffffff" },
          zIndex: 4,
          enableMouseTracking: false,
          dataLabels: { style: { fontSize: "9px", fontWeight: "600", color: INK } },
          data: haircutPts,
        },
      ],
    };
  }, [periods]);

  const shown = periods.filter((p) => p !== null);
  const over = shown.filter((p) => p.ccc > CCC_LIMIT).length;

  return (
    <section aria-labelledby="clo-ccc-title" className="flex flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="clo-ccc-title"
        title="CCC bucket and defaults"
        sub={`Share of collateral par at each determination date · ${over === 0 ? "the bucket has stayed under the limit" : `${over} period${over === 1 ? "" : "s"} over the ${CCC_LIMIT}% limit, with the excess haircut to market value`}`}
        right={<ViewToggle value={mode} onChange={setMode} name="CCC trend" />}
      />
      {mode === "chart" ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2.5">
            <LegendItem color={INK} line>
              CCC and below
            </LegendItem>
            <LegendItem color={MUTED_SERIES}>Defaulted</LegendItem>
            <LegendItem color={STATUS.warn}>Excess over limit → haircut</LegendItem>
            <LegendItem color={STATUS.bad} line dashed>
              {CCC_LIMIT}% limit
            </LegendItem>
          </div>
          <div className="min-w-0 px-1 pt-1 pb-2">
            <HighchartsView options={options} height={300} />
          </div>
        </>
      ) : (
        <div className="max-h-[352px] overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">CCC bucket and defaulted share by period</caption>
            <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e5e5e5]">
              <tr>
                <th scope="col" className={TH}>Period</th>
                <th scope="col" className={TH}>Determination</th>
                <th scope="col" className={`${TH} text-right`}>CCC and below</th>
                <th scope="col" className={`${TH} text-right`}>Defaulted</th>
                <th scope="col" className={`${TH} text-right`}>Excess</th>
                <th scope="col" className={`${TH} text-right`}>Haircut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {shown.map((p) => (
                <tr key={p.idx}>
                  <th scope="row" className="px-3 py-1.5 text-left text-[11px] font-medium text-neutral-900">{p.label}</th>
                  <td className="px-3 py-1.5 text-[11px] text-neutral-600">{dateMid(p.detDate)}</td>
                  <td className={`${TD} text-right ${p.ccc > CCC_LIMIT ? "font-semibold text-rose-700" : ""}`}>{pct(p.ccc, 2)}</td>
                  <td className={`${TD} text-right`}>{pct(p.defaulted, 2)}</td>
                  <td className={`${TD} text-right`}>{p.ccc > CCC_LIMIT ? signedPp(p.ccc - CCC_LIMIT, 2) : "—"}</td>
                  <td className={`${TD} text-right`}>{p.cccHaircut > 0 ? eurM(p.cccHaircut, 2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Row 4a: next payment date waterfall
 * ------------------------------------------------------------------ */

export function WaterfallCard({ view }: { view: DealView }) {
  const [mode, setMode] = useState<View>("chart");
  const [scenario, setScenario] = useState<WaterfallScenario>("current");
  const w = view.waterfalls[scenario];
  const failingNow = view.waterfalls.current.diversion > 0;

  const options = useMemo<Options>(
    () => ({
      chart: { type: "waterfall", spacing: [8, 8, 4, 4], animation: false },
      xAxis: { type: "category", tickLength: 0, labels: { rotation: -38, style: { fontSize: "9px" } } },
      yAxis: {
        title: { text: "€m" },
        labels: {
          formatter() {
            return eurM(Number(this.value), 1).replace(".0m", "m");
          },
        },
        plotLines: [{ value: 0, color: "#a3a3a3", width: 1, zIndex: 3 }],
      },
      legend: { enabled: false },
      tooltip: {
        formatter(this: Point) {
          const s = this.options.custom as WaterfallStep;
          const kind = s.kind === "sum" ? "Residual" : s.kind === "start" ? "Proceeds" : "Payment";
          return tipHtml(
            s.label,
            [
              { label: kind, value: eurM(Math.abs(s.amount), 2) },
              { label: "Remaining after", value: eurM(s.remaining, 2) },
            ],
            s.note + (s.deferred ? " · shortfall deferred" : ""),
          );
        },
      },
      plotOptions: {
        waterfall: {
          borderWidth: 0,
          lineWidth: 1,
          lineColor: "#d4d4d4",
          maxPointWidth: 36,
          dataLabels: {
            enabled: true,
            formatter() {
              const s = this.options.custom as WaterfallStep;
              return s.kind === "step" ? "" : eurM(s.amount, 2);
            },
            style: { fontSize: "10px", fontWeight: "600", color: INK },
          },
        },
        series: { animation: false, states: { inactive: { opacity: 1 } } },
      },
      series: [
        {
          type: "waterfall",
          name: "Interest waterfall",
          data: w.steps.map((s) => ({
            name: s.label,
            y: Math.round(s.amount * 1000) / 1000,
            color: s.color,
            isSum: s.kind === "sum",
            custom: s,
          })),
        },
      ],
    }),
    [w],
  );

  const paid = w.steps.filter((s) => s.kind === "step" && s.id !== "diversion").reduce((s, x) => s + -x.amount, 0);

  return (
    <section aria-labelledby="clo-wf-title" className="flex flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="clo-wf-title"
        title="Interest waterfall · 15 Oct 2026 payment date"
        sub={
          scenario === "stress" && failingNow
            ? `${w.note} The deal is already failing, so the scenario equals the current projection.`
            : w.note
        }
        right={
          <>
            <Seg<WaterfallScenario>
              label="Scenario"
              hideLabel
              size="sm"
              value={scenario}
              onChange={setScenario}
              options={[
                { value: "current", label: "Current" },
                { value: "stress", label: "Class E OC fails" },
              ]}
            />
            <ViewToggle value={mode} onChange={setMode} name="Waterfall" />
          </>
        }
      />
      {mode === "chart" ? (
        <div className="min-w-0 px-1 pt-1">
          <HighchartsView options={options} height={300} />
        </div>
      ) : (
        <div className="max-h-[316px] overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Interest waterfall steps</caption>
            <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e5e5e5]">
              <tr>
                <th scope="col" className={TH}>Step</th>
                <th scope="col" className={`${TH} text-right`}>Amount</th>
                <th scope="col" className={`${TH} text-right`}>Remaining</th>
                <th scope="col" className={TH}>Basis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {w.steps.map((s) => (
                <tr key={s.id} className={s.kind === "sum" ? "bg-neutral-50 font-semibold" : ""}>
                  <th scope="row" className="px-3 py-1.5 text-left text-[11px] font-medium text-neutral-900">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="inline-block h-2 w-2" style={{ background: s.color }} />
                      {s.label}
                      {s.deferred && <span className="text-[9px] font-semibold text-amber-700 uppercase">deferred</span>}
                    </span>
                  </th>
                  <td className={`${TD} text-right`}>{eurM(s.amount, 2)}</td>
                  <td className={`${TD} text-right text-neutral-500`}>{s.kind === "sum" ? "—" : eurM(s.remaining, 2)}</td>
                  <td className="max-w-[320px] px-3 py-1.5 text-[10px] leading-snug text-neutral-600">{s.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <dl className="mt-auto grid grid-cols-2 gap-px border-t border-neutral-200 bg-neutral-100 sm:grid-cols-4">
        {[
          { l: "Interest proceeds", v: eurM(w.proceeds, 2) },
          { l: "Fees and note interest", v: eurM(paid, 2) },
          { l: "Diverted to Class A", v: w.diversion > 0 ? eurM(w.diversion, 2) : "None" },
          { l: "Residual to equity", v: `${eurM(w.equity, 2)} · ${pct(w.coc, 1)}` },
        ].map((s) => (
          <div key={s.l} className="bg-white px-4 py-2">
            <dt>
              <MicroLabel>{s.l}</MicroLabel>
            </dt>
            <dd className="mt-0.5 font-mono text-sm font-semibold text-neutral-900 tabular-nums">{s.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Row 4b: equity distribution history (quarterly cash-on-cash)
 * ------------------------------------------------------------------ */

export function EquityHistoryCard({ view }: { view: DealView }) {
  const [mode, setMode] = useState<View>("chart");
  const periods = view.periods;
  const subOrig = view.deal.tranches.find((t) => t.cls === "Sub")!.orig;

  const options = useMemo<Options>(
    () => ({
      chart: { type: "column", spacing: [8, 8, 4, 4], animation: false },
      xAxis: { categories: PERIOD_LABELS, tickLength: 0, labels: { style: { fontSize: "10px" } } },
      yAxis: { title: { text: "Quarterly cash-on-cash, % of sub notes" }, min: 0, labels: { format: "{value}%" } },
      legend: { enabled: false },
      tooltip: {
        formatter(this: Point) {
          const p = periods[Number(this.x)];
          if (!p) return false;
          return tipHtml(
            `${p.label} · paid ${dateMid(p.payDate)}`,
            [
              { label: "Distribution", value: eurM(p.equity, 2) },
              { label: "Cash-on-cash", value: pct(p.coc, 2) },
              { label: "Annualised", value: pct(p.coc * 4, 1) },
            ],
            p.projected ? "Projected from the current waterfall" : p.diverted ? "Nothing paid: interest diverted to Class A" : undefined,
          );
        },
      },
      plotOptions: {
        column: { maxPointWidth: 26, borderWidth: 0 },
        series: { animation: false, states: { inactive: { opacity: 1 } } },
      },
      series: [
        {
          type: "column",
          name: "Cash-on-cash",
          data: periods.map((p) =>
            p
              ? {
                  y: r2(p.coc),
                  color: p.projected ? "#ffffff" : INK,
                  borderColor: INK,
                  borderWidth: p.projected ? 1.5 : 0,
                  dashStyle: p.projected ? "Dash" : "Solid",
                }
              : null,
          ),
        },
        {
          type: "scatter",
          name: "Diverted",
          color: STATUS.bad,
          marker: { symbol: "square", radius: 4 },
          enableMouseTracking: false,
          zIndex: 3,
          dataLabels: { enabled: true, format: "0", y: -4, style: { fontSize: "9px", color: STATUS.bad, fontWeight: "600" } },
          data: periods.flatMap((p, i) => (p && p.diverted ? [{ x: i, y: 0 }] : [])),
        },
      ],
    }),
    [periods],
  );

  const shown = periods.filter((p) => p !== null);
  const actual = shown.filter((p) => !p.projected);
  const paidTotal = actual.reduce((s, p) => s + p.equity, 0);
  const avg = actual.length ? actual.reduce((s, p) => s + p.coc, 0) / actual.length : 0;

  return (
    <section aria-labelledby="clo-eq-title" className="flex flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="clo-eq-title"
        title="Equity distributions"
        sub={`Quarterly cash-on-cash on ${eurM(subOrig)} of subordinated notes · ${actual.length} paid periods averaging ${pct(avg, 1)} (${pct(avg * 4, 1)} annualised) · ${eurM(paidTotal)} paid in total`}
        right={<ViewToggle value={mode} onChange={setMode} name="Equity distributions" />}
      />
      {mode === "chart" ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2.5">
            <LegendItem color={INK}>Paid</LegendItem>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-600">
              <span aria-hidden className="inline-block h-2.5 w-2.5 border border-dashed border-neutral-900 bg-white" />
              Projected, 15 Oct 2026
            </span>
            <LegendItem color={STATUS.bad}>Diverted, nothing paid</LegendItem>
          </div>
          <div className="min-w-0 px-1 pt-1 pb-2">
            <HighchartsView options={options} height={272} />
          </div>
        </>
      ) : (
        <div className="max-h-[316px] overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Equity distributions by payment date</caption>
            <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e5e5e5]">
              <tr>
                <th scope="col" className={TH}>Payment date</th>
                <th scope="col" className={`${TH} text-right`}>Distribution</th>
                <th scope="col" className={`${TH} text-right`}>Cash-on-cash</th>
                <th scope="col" className={`${TH} text-right`}>Annualised</th>
                <th scope="col" className={TH}>Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {shown.map((p) => (
                <tr key={p.idx} className={p.projected ? "bg-neutral-50" : ""}>
                  <th scope="row" className="px-3 py-1.5 text-left text-[11px] font-medium text-neutral-900">{dateMid(p.payDate)}</th>
                  <td className={`${TD} text-right`}>{eurM(p.equity, 2)}</td>
                  <td className={`${TD} text-right ${p.diverted ? "font-semibold text-rose-700" : ""}`}>{pct(p.coc, 2)}</td>
                  <td className={`${TD} text-right text-neutral-500`}>{pct(p.coc * 4, 1)}</td>
                  <td className="px-3 py-1.5 text-[10px] text-neutral-600">
                    {p.projected ? "Projected" : p.diverted ? "Interest diverted to Class A" : "Paid"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
