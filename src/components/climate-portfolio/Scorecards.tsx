import { useMemo, type ReactNode } from "react";
import type { Options } from "highcharts";
import HighchartsView from "../highcharts/HighchartsView";
import type { Slice } from "./model";
import {
  ACCENT,
  ACCENT_LIGHT,
  ACCENT_TRACK,
  SBTI_GOAL_2030,
  TEMP_BANDS,
  kt,
  money,
  nf,
  niceCeil,
  pct,
  signed,
  signedPct,
  tempBand,
} from "./format";
import { Delta, FrameworkTag, MicroLabel } from "./ui";

/* The scorecard row: four questions, four different instruments.
 *  (a) ITR — a solid gauge over a stepped temperature ramp
 *  (b) WACI — a linear meter with a benchmark tick
 *  (c) SBTi coverage — an SVG progress ring with flat (butt) caps
 *  (d) Financed emissions — a plain big number with its deltas
 * Each reads the same slice the charts and table below read. */

export function Scorecards({ slice, scopeLabel }: { slice: Slice; scopeLabel: string }) {
  return (
    <div className="grid grid-cols-1 gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-2 xl:grid-cols-4">
      <ItrGauge itr={slice.itr} bench={slice.bench.itr} benchLabel={slice.bench.label} scopeLabel={scopeLabel} />
      <WaciMeter waci={slice.waci} bench={slice.bench.waci} benchLabel={slice.bench.label} benchShort={slice.bench.short} scopeLabel={scopeLabel} />
      <SbtiRing
        validated={slice.sbti.Validated}
        committed={slice.sbti.Committed}
        benchValidated={slice.bench.sbtiValidated}
        benchLabel={slice.bench.label}
      />
      <FinancedEmissions slice={slice} scopeLabel={scopeLabel} />
    </div>
  );
}

function Tile({
  label,
  tag,
  children,
  foot,
}: {
  label: string;
  tag: string;
  children: ReactNode;
  foot: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col bg-white px-4 pt-3 pb-3" aria-label={label}>
      <div className="flex items-center justify-between gap-2">
        <h2>
          <MicroLabel>{label}</MicroLabel>
        </h2>
        <FrameworkTag>{tag}</FrameworkTag>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <div className="mt-3 border-t border-neutral-100 pt-2 text-[11px] leading-snug text-neutral-500">
        {foot}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * (a) Implied temperature rise — solid gauge
 * ------------------------------------------------------------------ */

function ItrGauge({
  itr,
  bench,
  benchLabel,
  scopeLabel,
}: {
  itr: number;
  bench: number;
  benchLabel: string;
  scopeLabel: string;
}) {
  const options = useMemo<Options>(
    () => ({
      chart: { type: "solidgauge", spacing: [6, 0, 0, 0], animation: { duration: 500 } },
      tooltip: { enabled: false },
      accessibility: {
        description: `Implied temperature rise ${itr.toFixed(1)} degrees against ${benchLabel} ${bench.toFixed(1)} degrees.`,
      },
      // Pane size is relative to plot height here, so the dial keeps the same
      // radius whatever the tile width and never clips at 1280px.
      pane: {
        center: ["50%", "96%"],
        size: "164%",
        startAngle: -90,
        endAngle: 90,
        background: [
          {
            backgroundColor: "#f5f5f5",
            borderWidth: 0,
            innerRadius: "64%",
            outerRadius: "100%",
            shape: "arc",
          },
        ],
      },
      yAxis: {
        min: 1,
        max: 4,
        lineWidth: 0,
        tickWidth: 0,
        minorTickInterval: undefined,
        tickPositions: [1, 1.5, 2, 3, 4],
        labels: {
          distance: 11,
          format: "{value}°",
          style: { fontSize: "10px", color: "#737373", fontFamily: "ui-monospace, Menlo, monospace" },
        },
        stops: [
          [0, ACCENT],
          [1, ACCENT],
        ],
        // The stepped background: each temperature band a step of one ramp.
        plotBands: [
          ...TEMP_BANDS.map((b) => ({
            from: b.from,
            to: b.to,
            color: b.color,
            innerRadius: "64%",
            outerRadius: "100%",
          })),
          {
            // Benchmark tick, drawn over the arc so it reads at any value.
            from: bench - 0.018,
            to: bench + 0.018,
            color: "#171717",
            innerRadius: "56%",
            outerRadius: "107%",
            zIndex: 5,
          },
        ],
      },
      plotOptions: {
        solidgauge: {
          rounded: false,
          dataLabels: { enabled: false },
          enableMouseTracking: false,
        },
      },
      series: [
        {
          type: "solidgauge",
          name: "Portfolio ITR",
          data: [{ y: Math.min(4, Math.max(1, itr)), radius: "92%", innerRadius: "72%" }],
        },
      ],
    }),
    [itr, bench, benchLabel],
  );

  const band = tempBand(itr);
  return (
    <Tile
      label="Implied temperature rise"
      tag="ISSB S2"
      foot={
        <>
          Weighted issuer temperature scores · {scopeLabel}. Bands step at 1.5°, 2° and 3°C.
        </>
      }
    >
      <div className="relative mt-1" style={{ height: 150 }}>
        <HighchartsView options={options} height={150} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-[48px] leading-none font-semibold tracking-tight text-neutral-950">
            {nf(itr, 1)}°C
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-600">
          <span aria-hidden className="inline-block h-3 w-[3px] bg-neutral-900" />
          Benchmark <span className="font-medium text-neutral-800">{nf(bench, 1)}°C</span>
        </span>
        <Delta value={itr - bench} text={`${signed(itr - bench, 1)}°C`} goodWhen="down" suffix="vs benchmark" />
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-500">
        <span aria-hidden className="inline-block h-2.5 w-2.5 border border-black/10" style={{ background: band.color }} />
        In the {band.label} band
      </div>
    </Tile>
  );
}

/* ------------------------------------------------------------------ *
 * (b) WACI — meter with benchmark tick
 * ------------------------------------------------------------------ */

function WaciMeter({
  waci,
  bench,
  benchLabel,
  benchShort,
  scopeLabel,
}: {
  waci: number;
  bench: number;
  benchLabel: string;
  benchShort: string;
  scopeLabel: string;
}) {
  const max = niceCeil(Math.max(waci, bench) * 1.12);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const at = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const rel = waci / bench - 1;
  const benchPos = bench / max;

  return (
    <Tile
      label="Weighted avg carbon intensity"
      tag="TCFD"
      foot={
        <>
          Σ weight × emissions ÷ revenue · {scopeLabel}. Benchmark {benchLabel}.
        </>
      }
    >
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[32px] leading-none font-semibold tracking-tight text-neutral-950">
          {nf(waci, 0)}
        </span>
        <span className="text-xs text-neutral-500">tCO₂e / $m revenue</span>
      </div>
      <div className="mt-1.5">
        <Delta value={rel} text={signedPct(rel, 0)} goodWhen="down" suffix="vs benchmark" />
      </div>

      <div
        className="relative mt-auto pt-5"
        role="meter"
        aria-label={`WACI ${nf(waci, 0)} against benchmark ${nf(bench, 0)} tCO2e per $m revenue`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(waci)}
      >
        {/* benchmark label rides above its tick, clamped inside the track */}
        <div
          className="absolute top-0 font-mono text-[10px] whitespace-nowrap text-neutral-700 tabular-nums"
          style={
            benchPos > 0.7
              ? { right: `${100 - benchPos * 100}%`, transform: "translateX(1px)" }
              : { left: at(bench), transform: "translateX(-1px)" }
          }
        >
          {benchShort} {nf(bench, 0)}
        </div>
        <div className="relative h-4" style={{ background: ACCENT_TRACK }}>
          <div className="absolute inset-y-0 left-0" style={{ width: at(waci), background: ACCENT }} />
          <div
            className="absolute -top-1.5 -bottom-1.5 w-[2px] bg-neutral-900"
            style={{ left: at(bench), transform: "translateX(-1px)" }}
          />
        </div>
        <div className="relative mt-1 h-3.5">
          {ticks.map((t, k) => (
            <span
              key={t}
              className="absolute font-mono text-[10px] text-neutral-400 tabular-nums"
              style={{
                left: `${(t / max) * 100}%`,
                transform: k === 0 ? "none" : k === ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {nf(t, 0)}
            </span>
          ))}
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-neutral-600">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5" style={{ background: ACCENT }} />
            Portfolio
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-[2px] bg-neutral-900" />
            Benchmark
          </span>
        </div>
      </div>
    </Tile>
  );
}

/* ------------------------------------------------------------------ *
 * (c) SBTi coverage — SVG ring, flat caps, 2030 goal tick
 * ------------------------------------------------------------------ */

function SbtiRing({
  validated,
  committed,
  benchValidated,
  benchLabel,
}: {
  validated: number;
  committed: number;
  benchValidated: number;
  benchLabel: string;
}) {
  const size = 124;
  const c = size / 2;
  const r = 47;
  const stroke = 14;
  const C = 2 * Math.PI * r;
  const gap = 2; // surface gap between the two steps
  const vLen = Math.max(0, validated * C - (committed > 0 ? gap : 0));
  const cLen = Math.max(0, committed * C - gap);
  const theta = SBTI_GOAL_2030 * 2 * Math.PI - Math.PI / 2;
  const tick = (rad: number) => [c + rad * Math.cos(theta), c + rad * Math.sin(theta)];
  const [x1, y1] = tick(r - stroke / 2 - 5);
  const [x2, y2] = tick(r + stroke / 2 + 5);
  const gapPts = (SBTI_GOAL_2030 - validated) * 100;
  const none = Math.max(0, 1 - validated - committed);

  return (
    <Tile
      label="Science-based targets"
      tag="SBTi"
      foot={
        <>
          Share of portfolio weight. Benchmark {benchLabel}:{" "}
          <span className="font-medium text-neutral-700">{pct(benchValidated, 0)}</span> validated.
        </>
      }
    >
      <div className="mt-2 flex flex-1 items-center gap-4">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg
            viewBox={`0 0 ${size} ${size}`}
            width={size}
            height={size}
            role="img"
            aria-label={`${pct(validated, 0)} of portfolio weight has validated science-based targets, ${pct(committed, 0)} committed; 2030 goal ${pct(SBTI_GOAL_2030, 0)}.`}
          >
            <circle cx={c} cy={c} r={r} fill="none" stroke="#f0f0f0" strokeWidth={stroke} />
            <g transform={`rotate(-90 ${c} ${c})`}>
              {/* Butt caps: flat, radial ends that stop exactly at the value. */}
              <circle
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={ACCENT}
                strokeWidth={stroke}
                strokeLinecap="butt"
                strokeDasharray={`${vLen} ${C}`}
                style={{ transition: "stroke-dasharray 400ms ease" }}
              />
              <circle
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={ACCENT_LIGHT}
                strokeWidth={stroke}
                strokeLinecap="butt"
                strokeDasharray={`0 ${validated * C} ${cLen} ${C}`}
                style={{ transition: "stroke-dasharray 400ms ease" }}
              />
            </g>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#171717" strokeWidth={2} strokeLinecap="butt" />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[26px] leading-none font-semibold tracking-tight text-neutral-950">
              {nf(validated * 100, 0)}%
            </span>
            <span className="mt-1 text-[10px] text-neutral-500">validated</span>
          </div>
        </div>

        <dl className="min-w-0 flex-1 space-y-1.5 text-[11px]">
          {[
            { label: "Validated", v: validated, swatch: ACCENT },
            { label: "Committed", v: committed, swatch: ACCENT_LIGHT },
            { label: "No target", v: none, swatch: "#f0f0f0" },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-2">
              <dt className="inline-flex items-center gap-1.5 text-neutral-600">
                <span aria-hidden className="inline-block h-2.5 w-2.5 border border-black/5" style={{ background: row.swatch }} />
                {row.label}
              </dt>
              <dd className="font-mono text-neutral-800 tabular-nums">{pct(row.v, 1)}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-1.5">
            <dt className="inline-flex items-center gap-1.5 text-neutral-600">
              <span aria-hidden className="inline-block h-3 w-[2px] bg-neutral-900" />
              2030 goal
            </dt>
            <dd className="font-mono text-neutral-800 tabular-nums">{pct(SBTI_GOAL_2030, 0)}</dd>
          </div>
          <div className="text-right">
            {gapPts > 0 ? (
              <span className="text-[11px] text-neutral-500">
                <span className="font-mono font-medium text-neutral-800 tabular-nums">{nf(gapPts, 1)} pts</span> to go
              </span>
            ) : (
              <span className="text-[11px] font-medium text-emerald-700">✓ Goal met</span>
            )}
          </div>
        </dl>
      </div>
    </Tile>
  );
}

/* ------------------------------------------------------------------ *
 * (d) Financed emissions — big number and deltas
 * ------------------------------------------------------------------ */

function FinancedEmissions({ slice, scopeLabel }: { slice: Slice; scopeLabel: string }) {
  const years = slice.feByYear;
  const peak = Math.max(...years.map((y) => y.fe));
  return (
    <Tile
      label="Financed emissions"
      tag="PCAF"
      foot={
        <>
          Footprint <span className="font-medium text-neutral-700">{nf(slice.footprint, 0)} tCO₂e/£m</span> ·
          PCAF data quality <span className="font-medium text-neutral-700">{nf(slice.pcaf, 1)}</span> ·
          AUM {money(slice.aum)}
        </>
      }
    >
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[32px] leading-none font-semibold tracking-tight text-neutral-950">
          {kt(slice.fe)}
        </span>
        <span className="text-xs text-neutral-500">ktCO₂e · {scopeLabel}</span>
      </div>
      <div className="mt-1.5 flex flex-col gap-0.5">
        <Delta value={slice.feYoY} text={signedPct(slice.feYoY, 1)} goodWhen="down" suffix="YoY (vs 2025)" />
        <Delta value={slice.feVsBase} text={signedPct(slice.feVsBase, 1)} goodWhen="down" suffix="vs 2019 baseline" />
      </div>

      <div className="mt-auto pt-3">
        <div
          className="flex h-11 items-end gap-[2px]"
          role="img"
          aria-label={`Financed emissions by year: ${years.map((y) => `${y.year} ${kt(y.fe)} kt`).join(", ")}`}
        >
          {years.map((y, k) => (
            <div
              key={y.year}
              title={`${y.year}: ${kt(y.fe)} ktCO₂e`}
              className="flex-1"
              style={{
                height: `${(y.fe / peak) * 100}%`,
                background: k === years.length - 1 ? ACCENT : k === 0 ? "#a3a3a3" : "#d4d4d4",
              }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-neutral-400 tabular-nums">
          <span>2019 base</span>
          <span>2026</span>
        </div>
      </div>
    </Tile>
  );
}
