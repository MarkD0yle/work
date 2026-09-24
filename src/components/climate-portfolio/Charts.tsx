import { useMemo, useState } from "react";
import type { Options, PointOptionsObject } from "highcharts";
import HighchartsView from "../highcharts/HighchartsView";
import { tipHtml } from "../highcharts/tooltip";
import { SECTOR_LABEL, SECTOR_SHORT, type SectorRow, type Slice } from "./model";
import {
  ACCENT,
  DIVERGE,
  HEAT_STOPS,
  TARGET_INK,
  kt,
  nf,
  niceCeil,
  pct,
  signed,
  verdictFor,
} from "./format";
import { Card, Segmented, TD, TDN, TH, ViewToggle, type View } from "./ui";

const BENCH_LINE = "#a3a3a3";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

/* ------------------------------------------------------------------ *
 * 1. Decarbonisation pathway (hero)
 * ------------------------------------------------------------------ */

export function PathwayCard({ slice, scopeLabel }: { slice: Slice; scopeLabel: string }) {
  const [view, setView] = useState<View>("chart");
  const pw = slice.pathway;
  const benchShort = slice.bench.short;
  const pLast = pw.portfolio[pw.portfolio.length - 1][1];
  const bLast = pw.bench[pw.bench.length - 1][1];
  const proj = pw.projection[pw.projection.length - 1][1];
  const [, lo2030, hi2030] = pw.band[pw.band.length - 1];
  const verdict = verdictFor(proj, pw.targetAt2030);

  const options = useMemo<Options>(() => {
    const lastIdx = pw.portfolio.length - 1;
    // Keep the end labels off each other and off the target line: whichever
    // line ends higher is labelled above, the lower one below.
    const pEnd = pw.portfolio[lastIdx][1];
    const bEnd = pw.bench[pw.bench.length - 1][1];
    const projEnd = pw.projection[pw.projection.length - 1][1];
    const projAbove = projEnd > pw.targetAt2030;
    const benchAbove = bEnd >= pEnd;
    // HighchartsView merges point options on update, so every point states its
    // marker and label explicitly — a label set in one filter state must not
    // survive into the next.
    // Fresh objects per point: Highcharts merges into point options in place,
    // so one shared object would leak state between points.
    const off = () => ({ dataLabels: { enabled: false } });
    const endLabel = (text: string, align: "left" | "right", x: number, y: number) => ({
      enabled: true,
      crop: false,
      overflow: "allow" as const,
      align,
      x,
      y,
      format: text,
      // A surface plate keeps the label legible when another line runs through it.
      backgroundColor: "rgba(255,255,255,0.9)",
      borderRadius: 0,
      padding: 2,
      style: { fontSize: "11px", fontWeight: "600", color: "#262626", fontFamily: MONO },
    });

    return {
      chart: { type: "line", spacing: [10, 12, 6, 4] },
      xAxis: {
        min: 2019,
        max: 2035,
        tickInterval: 1,
        allowDecimals: false,
        crosshair: { color: "rgba(77,124,15,0.15)", width: 1 },
        plotBands: [
          {
            from: 2026,
            to: 2030,
            color: "rgba(0,0,0,0.025)",
            label: {
              text: "Projection 2026–30",
              align: "left",
              x: 6,
              y: 14,
              style: { fontSize: "10px", color: "#a3a3a3" },
            },
          },
        ],
      },
      yAxis: {
        min: 0,
        max: 108,
        endOnTick: false,
        tickInterval: 20,
        title: { text: "Index, 2019 = 100" },
      },
      legend: {
        enabled: true,
        align: "right",
        verticalAlign: "top",
        floating: false,
        itemDistance: 16,
        symbolWidth: 16,
        margin: 4,
      },
      tooltip: {
        shared: true,
        formatter() {
          const rows = (this.points ?? []).map((p) => {
            if (p.series.type === "arearange") {
              const pt = p as unknown as { low: number; high: number };
              return { label: "Projection range", value: `${nf(pt.low, 0)}–${nf(pt.high, 0)}`, color: String(p.color) };
            }
            return { label: p.series.name, value: nf(Number(p.y), 1), color: String(p.color) };
          });
          return tipHtml(String(this.x), rows, `Index, 2019 = 100 · ${scopeLabel}`);
        },
      },
      plotOptions: {
        series: {
          marker: { enabled: false, radius: 4, lineWidth: 2, lineColor: "#fff", symbol: "circle" },
          states: { hover: { lineWidthPlus: 0 } },
        },
      },
      series: [
        {
          type: "line",
          name: "Portfolio",
          legendIndex: 0,
          color: ACCENT,
          lineWidth: 2,
          zIndex: 5,
          data: pw.portfolio.map(([x, y], k) =>
            k === lastIdx
              ? { x, y, marker: { enabled: true }, dataLabels: endLabel(`Portfolio ${nf(y, 0)}`, "right", -8, benchAbove ? 22 : -6) }
              : { x, y, ...off() },
          ),
        },
        {
          type: "line",
          name: "Projection",
          legendIndex: 1,
          color: ACCENT,
          dashStyle: "ShortDash",
          lineWidth: 2,
          zIndex: 4,
          data: pw.projection.map(([x, y], k) =>
            k === pw.projection.length - 1
              ? { x, y, marker: { enabled: true }, dataLabels: endLabel(`${nf(y, 0)} projected`, "left", 8, projAbove ? -10 : 26) }
              : { x, y, ...off() },
          ),
        },
        {
          type: "arearange",
          name: "Projection range",
          legendIndex: 2,
          color: ACCENT,
          fillOpacity: 0.12,
          lineWidth: 0,
          zIndex: 1,
          data: pw.band.map(([x, lo, hi]) => [x, lo, hi]),
        },
        {
          type: "line",
          name: slice.bench.label,
          legendIndex: 3,
          color: BENCH_LINE,
          lineWidth: 2,
          zIndex: 3,
          data: pw.bench.map(([x, y], k) =>
            k === pw.bench.length - 1
              ? { x, y, dataLabels: endLabel(`${benchShort} ${nf(y, 0)}`, "right", -8, benchAbove ? -6 : 22) }
              : { x, y, ...off() },
          ),
        },
        {
          type: "line",
          name: "Net-zero target path",
          legendIndex: 4,
          color: TARGET_INK,
          dashStyle: "Dash",
          lineWidth: 2,
          zIndex: 2,
          data: pw.target.map(([x, y]) =>
            x === 2030
              ? { x, y, dataLabels: endLabel("−50% by 2030", "left", 8, projAbove ? 26 : -10) }
              : x === 2035
                ? { x, y, dataLabels: endLabel("net zero by 2050 →", "right", 0, -8) }
                : { x, y, ...off() },
          ),
        },
      ],
    };
  }, [pw, benchShort, slice.bench.label, scopeLabel]);

  const tableYears = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2035];
  const lookup = (s: [number, number][], y: number) => s.find((p) => p[0] === y)?.[1];

  return (
    <Card
      title="Decarbonisation pathway"
      subtitle={
        <>
          Financed-emissions intensity (tCO₂e per £m invested) indexed to 2019 = 100 · {scopeLabel}.
          Projection applies each holding&rsquo;s target or trend; the band spans slow and fast delivery.
        </>
      }
      actions={<ViewToggle label="Decarbonisation pathway" value={view} onChange={setView} />}
      footer={
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <span>
            <span className="font-medium text-neutral-700">2026</span> · Portfolio{" "}
            <b className="font-mono font-semibold text-neutral-800">{nf(pLast, 0)}</b> vs target path{" "}
            <b className="font-mono font-semibold text-neutral-800">{nf(pw.targetAt2026, 0)}</b> and {benchShort}{" "}
            <b className="font-mono font-semibold text-neutral-800">{nf(bLast, 0)}</b>
          </span>
          <span>
            <span className="font-medium text-neutral-700">2030</span> · Projected{" "}
            <b className="font-mono font-semibold text-neutral-800">{nf(proj, 0)}</b> (range {nf(lo2030, 0)}–{nf(hi2030, 0)})
            vs target <b className="font-mono font-semibold text-neutral-800">{nf(pw.targetAt2030, 0)}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-neutral-800">
            <span aria-hidden className="inline-block h-2.5 w-2.5" style={{ background: verdict.color }} />
            {verdict.label} for the 2030 interim target
          </span>
        </div>
      }
    >
      {view === "chart" ? (
        <div className="px-2 pt-2">
          <HighchartsView options={options} height={300} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <caption className="sr-only">Decarbonisation pathway, index 2019 = 100</caption>
            <thead className="border-b border-neutral-100">
              <tr>
                <th scope="col" className={TH}>Year</th>
                <th scope="col" className={`${TH} text-right`}>Portfolio</th>
                <th scope="col" className={`${TH} text-right`}>Projection</th>
                <th scope="col" className={`${TH} text-right`}>Range</th>
                <th scope="col" className={`${TH} text-right`}>{slice.bench.label}</th>
                <th scope="col" className={`${TH} text-right`}>Target path</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {tableYears.map((y) => {
                const b = pw.band.find((p) => p[0] === y);
                const cell = (v: number | undefined) => (v === undefined ? "—" : nf(v, 1));
                return (
                  <tr key={y}>
                    <th scope="row" className={`${TD} text-left font-mono font-medium tabular-nums`}>{y}</th>
                    <td className={TDN}>{cell(lookup(pw.portfolio, y))}</td>
                    <td className={TDN}>{y > 2026 ? cell(lookup(pw.projection, y)) : "—"}</td>
                    <td className={TDN}>{b && y > 2026 ? `${nf(b[1], 0)}–${nf(b[2], 0)}` : "—"}</td>
                    <td className={TDN}>{cell(lookup(pw.bench, y))}</td>
                    <td className={TDN}>{cell(lookup(pw.target, y))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * 2. Financed emissions treemap (sector → issuer)
 * ------------------------------------------------------------------ */

type TreeCustom = {
  kind: "sector" | "issuer";
  fe: number;
  share: number;
  intensity: number;
  weight: number;
  sector?: string;
  n?: number;
};

export function TreemapCard({
  slice,
  scopeLabel,
  filterKey,
  className,
}: {
  slice: Slice;
  scopeLabel: string;
  /** Identifies the filter state; the series id carries it so a filter change
   * replaces the treemap (and resets any drill) instead of merging points. */
  filterKey: string;
  className?: string;
}) {
  const [view, setView] = useState<View>("chart");
  const sectors = useMemo(
    () => slice.sectors.filter((s) => s.fe > 0).sort((a, b) => b.fe - a.fe),
    [slice.sectors],
  );

  const options = useMemo<Options>(() => {
    const parents: PointOptionsObject[] = sectors.map((s) => ({
      id: s.id,
      name: SECTOR_LABEL[s.id],
      colorValue: s.intensity,
      custom: {
        kind: "sector",
        fe: s.fe,
        share: s.feShare,
        intensity: s.intensity,
        weight: s.weight,
        n: s.holdings.length,
      } satisfies TreeCustom,
    }));
    const leaves: PointOptionsObject[] = slice.holdings
      .filter((h) => h.fe > 0)
      .map((h) => ({
        id: h.issuer.id,
        name: h.issuer.name,
        parent: h.issuer.sector,
        value: h.fe,
        colorValue: h.intensity,
        custom: {
          kind: "issuer",
          fe: h.fe,
          share: h.feShare,
          intensity: h.intensity,
          weight: h.weight,
          sector: SECTOR_LABEL[h.issuer.sector],
        } satisfies TreeCustom,
      }));
    const ints = slice.holdings.map((h) => h.intensity).filter((v) => v > 0);
    const cMin = Math.max(10, Math.pow(10, Math.floor(Math.log10(Math.max(1, Math.min(...ints))))));
    const cMax = Math.pow(10, Math.ceil(Math.log10(Math.max(...ints))));

    return {
      chart: { type: "treemap", spacing: [4, 4, 2, 4] },
      colorAxis: {
        type: "logarithmic",
        min: cMin,
        max: cMax,
        stops: HEAT_STOPS,
        labels: {
          style: { fontSize: "10px", color: "#737373", fontFamily: MONO },
          formatter() {
            return nf(Number(this.value), 0);
          },
        },
      },
      legend: {
        enabled: true,
        align: "center",
        verticalAlign: "bottom",
        layout: "horizontal",
        symbolWidth: 300,
        symbolHeight: 8,
        margin: 6,
        title: {
          text: `Carbon intensity · tCO₂e / $m revenue · ${scopeLabel} (log scale)`,
          style: { fontSize: "10px", fontWeight: "500", color: "#737373" },
        },
      },
      tooltip: {
        formatter() {
          const c = this.options.custom as TreeCustom;
          return tipHtml(
            String(this.name),
            [
              { label: "Financed emissions", value: `${kt(c.fe)} kt` },
              { label: "Share of portfolio total", value: pct(c.share, 1) },
              { label: "Carbon intensity", value: `${nf(c.intensity, 0)} t/$m` },
              { label: "Portfolio weight", value: pct(c.weight, 2) },
            ],
            c.kind === "sector" ? `${c.n} holdings · click to drill in` : c.sector,
          );
        },
      },
      series: [
        {
          type: "treemap",
          id: `fe-treemap-${filterKey}`,
          name: "Financed emissions",
          layoutAlgorithm: "squarified",
          allowTraversingTree: true,
          interactByLeaf: true,
          levelIsConstant: false,
          animationLimit: 1000,
          cursor: "pointer",
          borderColor: "#ffffff",
          borderWidth: 1,
          breadcrumbs: {
            showFullPath: true,
            floating: false,
            position: { align: "left", verticalAlign: "top" },
            buttonTheme: {
              style: { color: "#3f6212", fontSize: "11px", fontWeight: "600" },
              states: { hover: { fill: "#ecfccb" } },
            },
            separator: { style: { color: "#a3a3a3" } },
          },
          levels: [
            {
              level: 1,
              borderWidth: 2,
              borderColor: "#ffffff",
              dataLabels: {
                enabled: true,
                align: "left",
                verticalAlign: "top",
                // A white label plate reads on every step of the ramp.
                backgroundColor: "rgba(255,255,255,0.88)",
                borderRadius: 0,
                padding: 4,
                x: 3,
                y: 3,
                formatter() {
                  const c = this.options.custom as TreeCustom;
                  return `${this.name}<br/><span style="font-weight:400">${kt(c.fe)} kt · ${pct(c.share, c.share < 0.095 ? 1 : 0)}</span>`;
                },
                style: {
                  fontSize: "11px",
                  fontWeight: "600",
                  color: "#171717",
                  fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
                  textOutline: "none",
                  pointerEvents: "none",
                  textOverflow: "ellipsis",
                },
              },
            },
            {
              level: 2,
              borderWidth: 1,
              borderColor: "#ffffff",
              dataLabels: { enabled: false },
            },
          ],
          data: [...parents, ...leaves],
        },
      ],
    };
  }, [sectors, slice.holdings, scopeLabel, filterKey]);

  return (
    <Card
      className={className}
      title="Where the financed emissions sit"
      subtitle={<>Tile area = financed emissions; colour = carbon intensity. Click a sector to drill into its issuers.</>}
      actions={<ViewToggle label="Financed emissions treemap" value={view} onChange={setView} />}
      footer={
        <>
          Utilities, energy and materials hold{" "}
          <b className="font-mono font-semibold text-neutral-800">
            {pct(
              sectors.filter((s) => ["UTL", "ENE", "MAT"].includes(s.id)).reduce((a, s) => a + s.feShare, 0),
              0,
            )}
          </b>{" "}
          of financed emissions on{" "}
          <b className="font-mono font-semibold text-neutral-800">
            {pct(
              sectors.filter((s) => ["UTL", "ENE", "MAT"].includes(s.id)).reduce((a, s) => a + s.weight, 0),
              1,
            )}
          </b>{" "}
          of portfolio weight.
        </>
      }
    >
      {view === "chart" ? (
        <div className="px-2 pt-2">
          <HighchartsView options={options} height={372} />
        </div>
      ) : (
        <SectorFeTable sectors={sectors} />
      )}
    </Card>
  );
}

function SectorFeTable({ sectors }: { sectors: SectorRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <caption className="sr-only">Financed emissions by sector</caption>
        <thead className="border-b border-neutral-100">
          <tr>
            <th scope="col" className={TH}>Sector</th>
            <th scope="col" className={`${TH} text-right`}>Financed kt</th>
            <th scope="col" className={`${TH} text-right`}>Share</th>
            <th scope="col" className={`${TH} text-right`}>Intensity t/$m</th>
            <th scope="col" className={`${TH} text-right`}>Weight</th>
            <th scope="col" className={TH}>Largest emitter</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {sectors.map((s) => (
            <tr key={s.id}>
              <th scope="row" className={`${TD} text-left font-medium text-neutral-800`}>{SECTOR_LABEL[s.id]}</th>
              <td className={TDN}>{kt(s.fe)}</td>
              <td className={TDN}>{pct(s.feShare, 1)}</td>
              <td className={TDN}>{nf(s.intensity, 0)}</td>
              <td className={TDN}>{pct(s.weight, 1)}</td>
              <td className={TD}>{s.holdings[0]?.issuer.name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 3. Sector contribution to WACI vs benchmark (diverging bars)
 * ------------------------------------------------------------------ */

type Effect = "net" | "allocation" | "selection";
const EFFECT_LABEL: Record<Effect, string> = {
  net: "Net",
  allocation: "Allocation",
  selection: "Selection",
};

export function ContributionCard({
  slice,
  scopeLabel,
  className,
}: {
  slice: Slice;
  scopeLabel: string;
  className?: string;
}) {
  const [effect, setEffect] = useState<Effect>("net");
  const [view, setView] = useState<View>("chart");

  const rows = useMemo(
    () =>
      slice.sectors
        .map((s) => ({ s, v: s[effect] }))
        .sort((a, b) => b.v - a.v),
    [slice.sectors, effect],
  );
  const totals = useMemo(
    () => ({
      allocation: slice.sectors.reduce((a, s) => a + s.allocation, 0),
      selection: slice.sectors.reduce((a, s) => a + s.selection, 0),
    }),
    [slice.sectors],
  );

  const options = useMemo<Options>(() => {
    const ext = Math.max(1, ...rows.map((r) => Math.abs(r.v)));
    const lim = niceCeil(ext * 1.3);
    const maxIdx = rows.findIndex((r) => r.v === Math.max(...rows.map((x) => x.v)));
    const minIdx = rows.findIndex((r) => r.v === Math.min(...rows.map((x) => x.v)));
    return {
      chart: { type: "bar", spacing: [6, 12, 6, 4] },
      xAxis: {
        categories: rows.map((r) => SECTOR_SHORT[r.s.id]),
        lineWidth: 0,
        tickLength: 0,
        labels: { style: { fontSize: "11px", color: "#525252" } },
      },
      yAxis: {
        min: -lim,
        max: lim,
        tickAmount: 5,
        title: { text: `Contribution to WACI gap · tCO₂e / $m revenue` },
        labels: {
          formatter() {
            return signed(Number(this.value), 0);
          },
        },
        plotLines: [{ value: 0, color: "#a3a3a3", width: 1, zIndex: 4 }],
      },
      legend: { enabled: false },
      tooltip: {
        formatter() {
          const r = rows[this.index ?? 0];
          if (!r) return false;
          const s = r.s;
          return tipHtml(
            `${signed(Number(this.y), 1)} t/$m · ${SECTOR_LABEL[s.id]}`,
            [
              { label: "Allocation", value: signed(s.allocation, 1) },
              { label: "Selection", value: signed(s.selection, 1) },
              { label: "Weight (port / bench)", value: `${pct(s.weight, 1)} / ${pct(s.benchWeight, 1)}` },
              { label: "Intensity (port / bench)", value: `${nf(s.intensity, 0)} / ${nf(s.benchIntensity, 0)}` },
            ],
            Number(this.y) > 0 ? "Adds carbon vs benchmark" : "Reduces carbon vs benchmark",
          );
        },
      },
      plotOptions: {
        bar: {
          maxPointWidth: 18,
          pointPadding: 0.12,
          groupPadding: 0.08,
          borderWidth: 0,
        },
      },
      series: [
        {
          type: "bar",
          name: EFFECT_LABEL[effect],
          data: rows.map((r, k) => ({
            y: Math.round(r.v * 100) / 100,
            color: r.v > 0 ? DIVERGE.worse : DIVERGE.better,
            dataLabels: {
              enabled: (k === maxIdx && r.v > 0) || (k === minIdx && r.v < 0),
              format: signed(r.v, 1),
              style: { color: "#262626", fontSize: "10px" },
              inside: false,
            },
          })),
        },
      ],
    };
  }, [rows, effect]);

  const gap = slice.waci - slice.bench.waci;

  return (
    <Card
      className={className}
      title={<>Sector contribution to WACI vs {slice.bench.short}</>}
      subtitle={
        <>
          Allocation = over/underweight × sector intensity vs benchmark; selection = cleaner or dirtier
          names within the sector · {scopeLabel}.
        </>
      }
      actions={
        <>
          <Segmented<Effect>
            size="sm"
            label="Attribution effect"
            value={effect}
            onChange={setEffect}
            options={(Object.keys(EFFECT_LABEL) as Effect[]).map((e) => ({ value: e, label: EFFECT_LABEL[e] }))}
          />
          <ViewToggle label="Sector contribution" value={view} onChange={setView} />
        </>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5" style={{ background: DIVERGE.worse }} />
              Adds carbon
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5" style={{ background: DIVERGE.better }} />
              Reduces carbon
            </span>
          </span>
          <span className="font-mono tabular-nums">
            Alloc {signed(totals.allocation, 1)} + Sel {signed(totals.selection, 1)} ={" "}
            <b className="font-semibold text-neutral-800">{signed(gap, 1)}</b> t/$m
          </span>
        </div>
      }
    >
      {view === "chart" ? (
        <div className="px-2 pt-2">
          <HighchartsView options={options} height={372} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <caption className="sr-only">Sector contribution to WACI versus benchmark</caption>
            <thead className="border-b border-neutral-100">
              <tr>
                <th scope="col" className={TH}>Sector</th>
                <th scope="col" className={`${TH} text-right`}>Wt port / bm</th>
                <th scope="col" className={`${TH} text-right`}>Int. port / bm</th>
                <th scope="col" className={`${TH} text-right`}>Alloc</th>
                <th scope="col" className={`${TH} text-right`}>Sel</th>
                <th scope="col" className={`${TH} text-right`}>Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map(({ s }) => (
                <tr key={s.id}>
                  <th scope="row" className={`${TD} text-left font-medium text-neutral-800`}>{SECTOR_SHORT[s.id]}</th>
                  <td className={TDN}>
                    {pct(s.weight, 1)} / {pct(s.benchWeight, 1)}
                  </td>
                  <td className={TDN}>
                    {nf(s.intensity, 0)} / {nf(s.benchIntensity, 0)}
                  </td>
                  <td className={TDN}>{signed(s.allocation, 1)}</td>
                  <td className={TDN}>{signed(s.selection, 1)}</td>
                  <td className={`${TDN} font-semibold`}>{signed(s.net, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
