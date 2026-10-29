import { useMemo, useState } from "react";
import type { Options, Point, PointOptionsObject } from "highcharts";
import HighchartsView from "../highcharts/HighchartsView";
import { tipHtml } from "../highcharts/tooltip";
import {
  AS_OF,
  COHORT_COLUMNS,
  MONTH_END,
  STAGES,
  slaBoundary,
  timeInStage,
  type CaseRow,
  type CohortRow,
  type Funnel,
  type Pacing,
  type StageIdx,
} from "./model";
import {
  CAT,
  HEAT,
  INDIGO_FADE,
  INK,
  MUTED_SERIES,
  STATUS,
  dateMid,
  dateShort,
  days,
  gbpM,
  int,
  pct,
  rate1,
  timeShort,
} from "./format";
import { CardHeader, Chip, LegendItem, MicroLabel, Seg, ViewToggle, type View } from "./ui";

const TH = "px-3 py-1.5 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase whitespace-nowrap";
const TD = "px-3 py-1.5 font-mono text-[11px] tabular-nums text-neutral-800";
const LABEL_STYLE = { fontSize: "10px", fontWeight: "600", color: INK, textOutline: "none" };

/* ------------------------------------------------------------------ *
 * Cohort funnel: this month's applications, and last month's at the same age
 * ------------------------------------------------------------------ */

type Compare = "off" | "prior";

export function FunnelCard({ funnel, selected }: { funnel: Funnel; selected: StageIdx | null }) {
  const [mode, setMode] = useState<View>("chart");
  const [compare, setCompare] = useState<Compare>("prior");
  const showPrior = compare === "prior";

  /* Band heights are proportional to the counts, which is the honest shape
   * but leaves the Offer and Completion bands too thin to label inside or
   * beside. The numbers therefore live in the band list to the right,
   * aligned row for row with the stages; the tooltip carries them too. */
  const options = useMemo<Options>(() => {
    const cur = funnel.current;
    const pri = funnel.prior;
    return {
      chart: { type: "funnel", spacing: [4, 4, 4, 4] },
      legend: { enabled: false },
      plotOptions: {
        funnel: {
          neckWidth: "26%",
          neckHeight: "0%",
          borderWidth: 2,
          borderColor: "#ffffff",
          dataLabels: { enabled: false },
          states: { hover: { brightness: 0.06 }, inactive: { opacity: 1 } },
        },
        series: { animation: false },
      },
      tooltip: {
        formatter(this: Point) {
          const i = this.index;
          const isPrior = this.series.options.id === "prior";
          const b = (isPrior ? pri : cur)[i];
          const other = (isPrior ? cur : pri)[i];
          return tipHtml(
            `${b.label} · ${isPrior ? "Aug cohort" : "Sep cohort"}`,
            [
              { label: "Reached", value: int(b.n) },
              { label: "Of stage above", value: i === 0 ? "—" : pct(b.ofPrev * 100, 1) },
              { label: "Of applications", value: pct(b.ofTop * 100, 1) },
              ...(showPrior
                ? [{ label: isPrior ? "Sep at same age" : "Aug at same age", value: `${int(other.n)} · ${pct(other.ofTop * 100, 1)}` }]
                : []),
            ],
            `Measured ${days(funnel.ageDays)} into the month`,
          );
        },
      },
      series: [
        ...(showPrior
          ? [
              {
                type: "funnel" as const,
                id: "prior",
                name: "Aug cohort at the same age",
                center: ["26%", "50%"],
                width: "42%",
                height: "94%",
                color: MUTED_SERIES,
                data: pri.map((b) => ({ name: b.label, y: Math.max(b.n, 0.5), color: MUTED_SERIES })),
              },
            ]
          : []),
        {
          type: "funnel" as const,
          id: "current",
          name: "Sep cohort",
          center: [showPrior ? "74%" : "50%", "50%"],
          width: showPrior ? "46%" : "70%",
          height: "94%",
          data: cur.map((b, i) => ({
            name: b.label,
            y: Math.max(b.n, 0.5),
            color: selected === null || selected === i ? CAT[0] : INDIGO_FADE,
          })),
        },
      ],
    };
  }, [funnel, selected, showPrior]);

  const [c0, c1] = funnel.currentRange;
  const [p0, p1] = funnel.priorRange;

  return (
    <section aria-labelledby="mp-funnel-title" className="flex flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="mp-funnel-title"
        title="Cohort conversion"
        sub={`Applications received ${dateShort(c0)}–${dateShort(c1)} and how far they have got by ${timeShort(AS_OF)} today · Aug cohort (${dateShort(p0)}–${dateShort(p1)}) measured at the same age, ${days(funnel.ageDays)}`}
        right={<ViewToggle value={mode} onChange={setMode} name="Cohort funnel" />}
      />
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-4 pt-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <LegendItem color={CAT[0]}>Sep cohort{selected !== null ? " · selected stage" : ""}</LegendItem>
          {selected !== null && <LegendItem color={INDIGO_FADE}>Other stages</LegendItem>}
          {showPrior && <LegendItem color={MUTED_SERIES}>Aug at same age</LegendItem>}
        </div>
        <Seg<Compare>
          label="Compare"
          size="sm"
          value={compare}
          onChange={setCompare}
          options={[
            { value: "off", label: "Sep only" },
            { value: "prior", label: "vs Aug" },
          ]}
        />
      </div>
      {mode === "chart" ? (
        <div className="flex min-w-0 items-stretch gap-2 px-2 pt-1 pb-3">
          <div className="min-w-0 flex-1">
            <HighchartsView options={options} height={300} />
          </div>
          <ol className="flex w-[196px] shrink-0 flex-col justify-around py-1" aria-label="Cohort bands">
            {funnel.current.map((b, i) => {
              const p = funnel.prior[i];
              const on = selected === i;
              const dim = selected !== null && !on;
              return (
                <li
                  key={b.label}
                  className={`border-l-2 py-1 pl-2 ${on ? "border-neutral-900 bg-neutral-50" : dim ? "border-transparent opacity-60" : "border-transparent"}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[10px] font-semibold tracking-wide text-neutral-700 uppercase">{b.label}</span>
                    <span className="font-mono text-[12px] font-semibold text-neutral-950 tabular-nums">{int(b.n)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 font-mono text-[10px] tabular-nums">
                    <span className="text-neutral-500">{i === 0 ? "cohort" : `${pct(b.ofPrev * 100)} of prior`}</span>
                    {showPrior && (
                      <span className="text-neutral-400">
                        Aug {int(p.n)}
                        {i === 0 ? "" : ` · ${pct(p.ofPrev * 100)}`}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Cohort conversion by stage, September against August at the same age</caption>
            <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e5e5e5]">
              <tr>
                <th scope="col" className={TH}>Stage</th>
                <th scope="col" className={`${TH} text-right`}>Sep</th>
                <th scope="col" className={`${TH} text-right`}>Of prior</th>
                <th scope="col" className={`${TH} text-right`}>Of apps</th>
                <th scope="col" className={`${TH} text-right`}>Aug</th>
                <th scope="col" className={`${TH} text-right`}>Of prior</th>
                <th scope="col" className={`${TH} text-right`}>Of apps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {funnel.current.map((b, i) => {
                const p = funnel.prior[i];
                const on = selected === i;
                return (
                  <tr key={b.label} className={on ? "bg-neutral-100" : undefined}>
                    <th scope="row" className="px-3 py-1.5 text-[11px] font-medium text-neutral-800">
                      {b.label}
                    </th>
                    <td className={`${TD} text-right font-semibold`}>{int(b.n)}</td>
                    <td className={`${TD} text-right`}>{i === 0 ? "—" : pct(b.ofPrev * 100, 1)}</td>
                    <td className={`${TD} text-right`}>{pct(b.ofTop * 100, 1)}</td>
                    <td className={`${TD} text-right text-neutral-500`}>{int(p.n)}</td>
                    <td className={`${TD} text-right text-neutral-500`}>{i === 0 ? "—" : pct(p.ofPrev * 100, 1)}</td>
                    <td className={`${TD} text-right text-neutral-500`}>{pct(p.ofTop * 100, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Week-cohort conversion heatmap
 * ------------------------------------------------------------------ */

export function CohortHeatmapCard({ cohorts, selected }: { cohorts: CohortRow[]; selected: StageIdx | null }) {
  const [mode, setMode] = useState<View>("chart");
  // stage 0 (Application) has no column: every cohort reached it by definition
  const col = selected === null || selected === 0 ? null : selected - 1;

  const options = useMemo<Options>(() => {
    const data: PointOptionsObject[] = [];
    cohorts.forEach((row, y) =>
      row.pct.forEach((v, x) => {
        // Unique ids: heatmap cells share x values, and without an id
        // Highcharts matches updated points by x and drops cells on update.
        data.push({ id: `c${y}-${x}`, x, y, value: Math.round(v * 10) / 10 });
      }),
    );
    return {
      chart: { type: "heatmap", spacing: [8, 4, 4, 4] },
      xAxis: {
        categories: COHORT_COLUMNS,
        opposite: true,
        lineWidth: 0,
        tickLength: 0,
        crosshair: false,
        labels: { rotation: 0, style: { fontSize: "10px", color: "#525252" } },
        plotBands:
          col === null
            ? []
            : [{ from: col - 0.5, to: col + 0.5, color: "transparent", borderColor: INK, borderWidth: 2, zIndex: 5 }],
      },
      yAxis: {
        categories: cohorts.map((r) => `w/c ${dateShort(r.weekStart)}`),
        reversed: true,
        title: { text: undefined },
        gridLineWidth: 0,
        labels: { style: { fontSize: "10px", color: "#525252", fontFamily: "inherit" } },
      },
      colorAxis: {
        min: 0,
        max: 100,
        startOnTick: false,
        endOnTick: false,
        tickPositions: [0, 50, 100],
        stops: HEAT.map((c, i) => [i / (HEAT.length - 1), c] as [number, string]),
        labels: { format: "{value}%", style: { fontSize: "9px", color: "#737373" } },
      },
      legend: {
        enabled: true,
        layout: "vertical",
        align: "right",
        verticalAlign: "middle",
        symbolWidth: 8,
        symbolHeight: 180,
        padding: 2,
        margin: 8,
      },
      tooltip: {
        formatter(this: Point) {
          const row = cohorts[Number(this.y)];
          const x = Number(this.x);
          return tipHtml(
            `Week of ${dateMid(row.weekStart)} · ${int(row.n)} applications`,
            [
              { label: `Reached ${COHORT_COLUMNS[x]}`, value: `${pct(row.pct[x], 1)} · ${int(row.counts[x])}` },
              { label: "Fallen through", value: `${int(row.fell)} · ${pct(row.n ? (100 * row.fell) / row.n : 0)}` },
            ],
            "Share of the week's applications that has reached at least this stage",
          );
        },
      },
      series: [
        {
          type: "heatmap",
          name: "Share of cohort",
          data,
          borderWidth: 2,
          borderColor: "#ffffff",
          dataLabels: {
            enabled: true,
            formatter(this: Point) {
              const v = Number(this.options.value ?? 0);
              return `<span style="color:${v > 55 ? "#ffffff" : INK}">${Math.round(v)}</span>`;
            },
            style: { fontSize: "10px", fontWeight: "500", textOutline: "none" },
          },
          states: { hover: { brightness: 0.1 } },
        },
      ],
    };
  }, [cohorts, col]);

  return (
    <section aria-labelledby="mp-cohort-title" className="flex flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="mp-cohort-title"
        title="Week-cohort conversion"
        sub="Applications by week received × share that has reached at least each stage · recent weeks are still maturing, so the lower right is naturally light"
        right={<ViewToggle value={mode} onChange={setMode} name="Cohort heatmap" />}
      />
      {mode === "chart" ? (
        <div className="min-w-0 px-1 pt-1 pb-2">
          <HighchartsView options={options} height={330} />
        </div>
      ) : (
        <div className="max-h-[352px] overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Share of each application week that has reached each stage</caption>
            <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e5e5e5]">
              <tr>
                <th scope="col" className={TH}>Week</th>
                <th scope="col" className={`${TH} text-right`}>Apps</th>
                {COHORT_COLUMNS.map((c, i) => (
                  <th key={c} scope="col" className={`${TH} text-right ${col === i ? "text-neutral-900" : ""}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {cohorts.map((r) => (
                <tr key={r.weekStart}>
                  <th scope="row" className="px-3 py-1.5 text-[11px] font-medium whitespace-nowrap text-neutral-800">
                    w/c {dateShort(r.weekStart)}
                  </th>
                  <td className={`${TD} text-right`}>{int(r.n)}</td>
                  {r.pct.map((v, i) => (
                    <td key={i} className={`${TD} text-right ${col === i ? "bg-neutral-100 font-semibold" : ""}`}>
                      {pct(v)}
                    </td>
                  ))}
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
 * Completions pacing
 * ------------------------------------------------------------------ */

export function PacingCard({ pacing, scope }: { pacing: Pacing; scope: string }) {
  const [mode, setMode] = useState<View>("chart");
  const gap = pacing.projectedCount - pacing.targetCount;
  const onTrack = gap >= 0;
  const monthEndT = MONTH_END + 17 * 3_600_000;

  const options = useMemo<Options>(() => {
    const actual = pacing.points.filter((p) => p.actual !== null).map((p) => [p.t, p.actual as number]);
    const target = pacing.points.map((p) => [p.t, Math.round(p.target * 10) / 10]);
    return {
      chart: { type: "line", spacing: [12, 12, 4, 4] },
      xAxis: {
        type: "datetime",
        min: Date.UTC(2026, 8, 1),
        max: monthEndT,
        tickInterval: 7 * 86_400_000,
        labels: { format: "{value:%e %b}" },
        crosshair: { color: "rgba(23,23,23,0.12)", width: 1 },
        plotLines: [
          {
            value: AS_OF,
            color: "#a3a3a3",
            width: 1,
            zIndex: 4,
            label: { text: "Now", rotation: 0, x: 4, y: 12, style: { fontSize: "9px", color: "#737373" } },
          },
        ],
      },
      yAxis: {
        title: { text: undefined },
        min: 0,
        max: Math.max(pacing.targetCount, pacing.projectedCount) * 1.08,
        endOnTick: false,
        plotLines: [
          {
            value: pacing.targetCount,
            color: "#d4d4d4",
            width: 1,
            zIndex: 2,
            label: {
              text: `Target ${int(pacing.targetCount)}`,
              align: "left",
              x: 4,
              y: -4,
              style: { fontSize: "9px", color: "#737373" },
            },
          },
        ],
      },
      legend: { enabled: false },
      tooltip: {
        shared: true,
        formatter(this: Point) {
          const t = Number(this.x);
          const pt = pacing.points.reduce((best, p) => (Math.abs(p.t - t) < Math.abs(best.t - t) ? p : best), pacing.points[0]);
          const rows = [
            { label: "Linear target", value: int(Math.round(pt.target)), color: MUTED_SERIES },
            ...(pt.actual !== null
              ? [
                  { label: "Completed", value: int(pt.actual), color: INK },
                  { label: "Value", value: gbpM(pt.actualValue ?? 0) },
                  { label: "Against pace", value: `${pt.actual - pt.target >= 0 ? "+" : "−"}${int(Math.round(Math.abs(pt.actual - pt.target)))}` },
                ]
              : []),
          ];
          return tipHtml(t === AS_OF ? `Today ${timeShort(AS_OF)}` : dateMid(t), rows, "Cumulative, month to date");
        },
      },
      plotOptions: {
        series: { animation: false, marker: { enabled: false, symbol: "square" }, states: { inactive: { opacity: 1 } } },
      },
      series: [
        { type: "line", id: "target", name: "Linear target", color: MUTED_SERIES, lineWidth: 2, data: target, zIndex: 1 },
        {
          type: "line",
          id: "required",
          name: "Required run-rate",
          color: INK,
          lineWidth: 1.5,
          dashStyle: "Dash",
          enableMouseTracking: false,
          data: [
            [AS_OF, pacing.mtdCount],
            [monthEndT, pacing.targetCount],
          ],
          zIndex: 2,
        },
        {
          type: "line",
          id: "projection",
          name: "Projected at trailing run-rate",
          color: onTrack ? STATUS.good : STATUS.bad,
          lineWidth: 2,
          dashStyle: "ShortDot",
          enableMouseTracking: false,
          data: [
            [AS_OF, pacing.mtdCount],
            {
              x: monthEndT,
              y: pacing.projectedCount,
              marker: { enabled: true, radius: 4, fillColor: onTrack ? STATUS.good : STATUS.bad, lineWidth: 2, lineColor: "#ffffff" },
              dataLabels: {
                enabled: true,
                align: "right",
                x: -6,
                y: -2,
                format: `Proj. ${int(pacing.projectedCount)}`,
                style: { ...LABEL_STYLE, color: onTrack ? STATUS.good : STATUS.bad },
              },
            },
          ],
          zIndex: 3,
        },
        {
          type: "line",
          id: "actual",
          name: "Completed",
          color: INK,
          lineWidth: 2,
          data: actual,
          zIndex: 4,
          marker: { enabled: false },
        },
        {
          type: "scatter",
          id: "today",
          name: "Today",
          color: INK,
          enableMouseTracking: false,
          data: [{ x: AS_OF, y: pacing.mtdCount, marker: { enabled: true, radius: 4, symbol: "square", lineWidth: 2, lineColor: "#ffffff" } }],
          zIndex: 5,
        },
      ],
    };
  }, [pacing, onTrack, monthEndT]);

  const rateGap = pacing.rateCount - pacing.requiredRate;
  const dayRows = pacing.points.filter((p) => p.t !== AS_OF && p.t !== Date.UTC(2026, 8, 1));

  return (
    <section aria-labelledby="mp-pacing-title" className="flex flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="mp-pacing-title"
        title="Completions pacing"
        sub={`September month to date · ${scope} · projection = MTD + remaining working days × trailing 10-day run-rate`}
        right={<ViewToggle value={mode} onChange={setMode} name="Completions pacing" />}
      />
      <div className="grid grid-cols-2 gap-px border-b border-neutral-100 bg-neutral-100 sm:grid-cols-4">
        <div className="bg-white px-4 py-2.5">
          <MicroLabel>Projected month end</MicroLabel>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[30px] leading-none font-semibold tracking-tight text-neutral-950">
              {int(pacing.projectedCount)}
            </span>
            <Chip tone={onTrack ? "good" : "bad"} size="sm">
              {onTrack ? `On track · +${int(gap)}` : `Short by ${int(-gap)}`}
            </Chip>
          </div>
          <div className="mt-1 text-[10px] text-neutral-500">
            {gbpM(pacing.projectedValue)} of {gbpM(pacing.targetValue)}
          </div>
        </div>
        <div className="bg-white px-4 py-2.5">
          <MicroLabel>Completed MTD</MicroLabel>
          <div className="mt-1 text-xl leading-none font-semibold text-neutral-900">{int(pacing.mtdCount)}</div>
          <div className="mt-1 text-[10px] text-neutral-500">
            {gbpM(pacing.mtdValue)} · pace {int(Math.round((pacing.targetCount * pacing.elapsed) / pacing.workingDays))}
          </div>
        </div>
        <div className="bg-white px-4 py-2.5">
          <MicroLabel>Target</MicroLabel>
          <div className="mt-1 text-xl leading-none font-semibold text-neutral-900">{int(pacing.targetCount)}</div>
          <div className="mt-1 text-[10px] text-neutral-500">
            {gbpM(pacing.targetValue)} · {pacing.workingDays} working days
          </div>
        </div>
        <div className="bg-white px-4 py-2.5">
          <MicroLabel>Run-rate · per day</MicroLabel>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl leading-none font-semibold text-neutral-900">{rate1(pacing.rateCount)}</span>
            <span className={`text-[11px] font-medium ${rateGap >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              vs {rate1(pacing.requiredRate)} needed
            </span>
          </div>
          <div className="mt-1 text-[10px] text-neutral-500">
            trailing 10 days · {rate1(pacing.remaining)} days left
          </div>
        </div>
      </div>
      {mode === "chart" ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2.5">
            <LegendItem color={INK} line>
              Completed
            </LegendItem>
            <LegendItem color={MUTED_SERIES} line>
              Linear target
            </LegendItem>
            <LegendItem color={INK} line dashed>
              Required run-rate
            </LegendItem>
            <LegendItem color={onTrack ? STATUS.good : STATUS.bad} line dashed>
              Projection
            </LegendItem>
          </div>
          <div className="min-w-0 px-1 pt-1 pb-2">
            <HighchartsView options={options} height={218} />
          </div>
        </>
      ) : (
        <div className="max-h-[276px] overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Cumulative completions by working day against the linear target</caption>
            <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e5e5e5]">
              <tr>
                <th scope="col" className={TH}>Working day</th>
                <th scope="col" className={`${TH} text-right`}>Completed</th>
                <th scope="col" className={`${TH} text-right`}>Value</th>
                <th scope="col" className={`${TH} text-right`}>Target</th>
                <th scope="col" className={`${TH} text-right`}>Gap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {dayRows.map((p, i) => {
                const g = p.actual === null ? null : p.actual - p.target;
                return (
                  <tr key={p.t}>
                    <th scope="row" className="px-3 py-1.5 text-[11px] font-medium whitespace-nowrap text-neutral-800">
                      {i + 1} · {dateShort(p.t)}
                    </th>
                    <td className={`${TD} text-right`}>{p.actual === null ? "—" : int(p.actual)}</td>
                    <td className={`${TD} text-right`}>{p.actualValue === null ? "—" : gbpM(p.actualValue)}</td>
                    <td className={`${TD} text-right text-neutral-500`}>{int(Math.round(p.target))}</td>
                    <td className={`${TD} text-right ${g === null ? "" : g < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                      {g === null ? "—" : `${g < 0 ? "−" : "+"}${int(Math.round(Math.abs(g)))}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Time-in-stage distribution
 * ------------------------------------------------------------------ */

export function TimeInStageCard({ rows, selected }: { rows: CaseRow[]; selected: StageIdx | null }) {
  const [mode, setMode] = useState<View>("chart");
  const buckets = useMemo(() => timeInStage(rows, selected), [rows, selected]);
  const stage = selected === null ? null : STAGES[selected];
  const total = buckets.reduce((s, b) => s + b.total, 0);

  const options = useMemo<Options>(() => {
    const categories = buckets.map((b) => b.label);
    const series: Options["series"] = stage
      ? [
          {
            type: "column",
            name: stage.label,
            data: buckets.map((b) => ({ y: b.total, color: b.breach > 0 ? STATUS.bad : STATUS.neutral })),
          },
        ]
      : STAGES.map((s) => ({
          type: "column" as const,
          name: s.label,
          color: CAT[s.idx],
          data: buckets.map((b) => b.byStage[s.idx]),
        }));
    return {
      chart: { type: "column", spacing: [12, 8, 4, 4] },
      xAxis: {
        categories,
        title: { text: "Business days in current stage" },
        crosshair: { color: "rgba(23,23,23,0.06)", width: undefined },
        plotLines: stage
          ? [
              {
                value: slaBoundary(stage.sla),
                color: INK,
                width: 1.5,
                dashStyle: "Dash",
                zIndex: 5,
                label: { text: `SLA ${stage.sla}d`, rotation: 0, align: "left", x: 5, y: 12, style: LABEL_STYLE },
              },
            ]
          : [],
      },
      yAxis: { title: { text: "Live cases" }, allowDecimals: false, min: 0, reversedStacks: false },
      legend: { enabled: !stage, align: "left", verticalAlign: "top", margin: 4 },
      tooltip: {
        shared: true,
        formatter(this: Point) {
          const b = buckets[this.index];
          const range = b.to === null ? `${b.from}+ days` : `${b.from}–${b.to} days`;
          const lines = stage
            ? [
                { label: "Live cases", value: int(b.total), color: b.breach > 0 ? STATUS.bad : STATUS.neutral },
                { label: "Past SLA", value: int(b.breach) },
              ]
            : STAGES.map((s) => ({ label: s.label, value: int(b.byStage[s.idx]), color: CAT[s.idx] })).concat([
                { label: "All stages", value: int(b.total), color: "" },
              ]);
          return tipHtml(range, lines, stage ? `${stage.label} · SLA ${stage.sla} business days` : "Business days in current stage");
        },
      },
      plotOptions: {
        column: { stacking: "normal", borderWidth: 2, borderColor: "#ffffff", pointPadding: 0.06, groupPadding: 0.04, maxPointWidth: 30 },
        series: { animation: false, states: { inactive: { opacity: 1 } } },
      },
      series,
    };
  }, [buckets, stage]);

  return (
    <section aria-labelledby="mp-tis-title" className="flex h-full flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="mp-tis-title"
        title="Time in stage"
        sub={
          stage
            ? `${int(total)} live cases in ${stage.label} by business days in stage · SLA ${stage.sla}d · rose buckets are past SLA`
            : `${int(total)} live cases by business days in their current stage, stacked by stage · select a stage on the board for its SLA line`
        }
        right={<ViewToggle value={mode} onChange={setMode} name="Time in stage" />}
      />
      {mode === "chart" ? (
        <>
          {stage && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2.5">
              <LegendItem color={STATUS.neutral}>Inside SLA</LegendItem>
              <LegendItem color={STATUS.bad}>Past SLA</LegendItem>
              <LegendItem color={INK} line dashed>
                SLA boundary
              </LegendItem>
            </div>
          )}
          <div className="min-w-0 px-1 pt-1 pb-2">
            <HighchartsView options={options} height={stage ? 262 : 288} />
          </div>
        </>
      ) : (
        <div className="max-h-[316px] overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Live cases by business days in stage</caption>
            <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e5e5e5]">
              <tr>
                <th scope="col" className={TH}>Days in stage</th>
                {stage ? (
                  <>
                    <th scope="col" className={`${TH} text-right`}>Live cases</th>
                    <th scope="col" className={`${TH} text-right`}>Past SLA</th>
                  </>
                ) : (
                  STAGES.map((s) => (
                    <th key={s.id} scope="col" className={`${TH} text-right`}>
                      {s.short}
                    </th>
                  ))
                )}
                <th scope="col" className={`${TH} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {buckets.map((b) => (
                <tr key={b.label}>
                  <th scope="row" className="px-3 py-1.5 text-[11px] font-medium text-neutral-800">
                    {b.label}
                  </th>
                  {stage ? (
                    <>
                      <td className={`${TD} text-right`}>{int(b.total)}</td>
                      <td className={`${TD} text-right ${b.breach ? "font-semibold text-rose-700" : "text-neutral-400"}`}>
                        {int(b.breach)}
                      </td>
                    </>
                  ) : (
                    STAGES.map((s) => (
                      <td key={s.id} className={`${TD} text-right ${b.byStage[s.idx] ? "" : "text-neutral-400"}`}>
                        {int(b.byStage[s.idx])}
                      </td>
                    ))
                  )}
                  <td className={`${TD} text-right font-semibold`}>{int(b.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
