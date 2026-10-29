import { useMemo, useState, type ReactNode } from "react";
import type { Options } from "highcharts";
import { AlertTriangle, Check, Copy, Info, Maximize2 } from "lucide-react";
import HighchartsView from "../highcharts/HighchartsView";
import { NEG, POS, fmt, type Block, type ChartSpec, type Kpi, type TableSpec } from "./data";

/* Renderers for the typed blocks an assistant answer is made of.
 *
 * Charts and tables sit in a card with a small header toolbar (open in the
 * right panel, copy). That is the Claude-artifact / Copilot-card pattern: the
 * inline version is a preview, the panel is the workspace. `size="panel"`
 * gives the same component more room instead of a second implementation.
 */

export type OpenArtifact = (a: { id: string; kind: "chart" | "table"; title: string }) => void;

/* --- Text: a deliberately tiny markdown subset (bold, numbered lists, paras) --- */

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") ? (
      <strong key={i} className="font-semibold text-neutral-950">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

export function TextBlock({ md }: { md: string }) {
  const lines = md.split("\n");
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    out.push(
      <ol key={`ol${out.length}`} className="my-2 list-decimal space-y-1.5 pl-5">
        {list.map((l, i) => (
          <li key={i}>{inline(l)}</li>
        ))}
      </ol>,
    );
    list = [];
  };
  lines.forEach((line) => {
    const m = line.match(/^\d+\.\s+(.*)$/);
    if (m) return void list.push(m[1]);
    flush();
    if (line.trim()) out.push(<p key={`p${out.length}`}>{inline(line)}</p>);
  });
  flush();
  return <div className="space-y-2 text-[14px] leading-relaxed text-neutral-800">{out}</div>;
}

/* --- KPIs --------------------------------------------------------------------- */

const TONE: Record<NonNullable<Kpi["tone"]>, string> = {
  pos: "text-emerald-700",
  neg: "text-red-700",
  neutral: "text-neutral-500",
};

export function KpiBlock({ items }: { items: Kpi[] }) {
  return (
    <div
      className={`grid gap-px border border-neutral-200 bg-neutral-200 ${items.length === 3 ? "grid-cols-3" : "grid-cols-2 @xl:grid-cols-4"}`}
    >
      {items.map((k) => (
        <div key={k.label} className="bg-white px-3 py-2.5">
          <div className="text-[11px] text-neutral-500">{k.label}</div>
          <div className="mt-0.5 text-[20px] font-semibold tracking-tight tabular-nums text-neutral-950">{k.value}</div>
          {k.delta && <div className={`text-[11px] ${TONE[k.tone ?? "neutral"]}`}>{k.delta}</div>}
        </div>
      ))}
    </div>
  );
}

/* --- Card chrome shared by chart and table ------------------------------------ */

function CardHeader({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2">
      <div className="truncate text-[12px] font-semibold text-neutral-800">{title}</div>
      <div className="flex shrink-0 items-center gap-0.5">{children}</div>
    </div>
  );
}

export function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-7 w-7 place-items-center text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-neutral-900"
    >
      {children}
    </button>
  );
}

function CopyButton({ text }: { text: () => string }) {
  const [done, setDone] = useState(false);
  return (
    <IconButton
      label={done ? "Copied" : "Copy data"}
      onClick={() => {
        void navigator.clipboard?.writeText(text()).catch(() => {});
        setDone(true);
        window.setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
    </IconButton>
  );
}

/* --- Chart -------------------------------------------------------------------- */

function chartOptions(spec: ChartSpec, height: number): Options {
  const signed = spec.series.length === 1 && spec.series[0].data.some((v) => v < 0);
  return {
    chart: { type: spec.kind, height, backgroundColor: "transparent", spacing: [8, 8, 8, 4] },
    title: { text: undefined },
    credits: { enabled: false },
    exporting: { enabled: false },
    legend: { enabled: spec.series.length > 1, align: "left", verticalAlign: "top", itemStyle: { fontSize: "11px", fontWeight: "500" } },
    xAxis: { categories: spec.categories, lineColor: "#e5e5e5", tickLength: 0, labels: { style: { fontSize: "11px", color: "#525252" } } },
    yAxis: {
      title: { text: undefined },
      gridLineColor: "#f0f0f0",
      plotLines: [{ value: 0, color: "#a3a3a3", width: 1, zIndex: 3 }],
      labels: { format: `{value}${spec.unit}`, style: { fontSize: "11px", color: "#737373" } },
    },
    tooltip: { valueSuffix: spec.unit, valueDecimals: 1, shared: true },
    plotOptions: {
      series: { animation: { duration: 500 }, marker: { enabled: false, radius: 3 } },
      line: { lineWidth: 2 },
      column: { borderWidth: 0, pointPadding: 0.08, groupPadding: 0.12 },
      bar: { borderWidth: 0, pointPadding: 0.08, groupPadding: 0.1 },
    },
    series: spec.series.map((s) => ({
      type: spec.kind,
      name: s.name,
      data: signed ? s.data.map((y) => ({ y, color: y < 0 ? NEG : POS })) : s.data,
      color: s.color ?? "#111827",
    })),
  } as Options;
}

export function ChartBlock({
  id,
  spec,
  onOpen,
  size = "inline",
}: {
  id: string;
  spec: ChartSpec;
  onOpen?: OpenArtifact;
  size?: "compact" | "inline" | "panel";
}) {
  const height = size === "panel" ? 360 : size === "compact" ? 200 : 240;
  const options = useMemo(() => chartOptions(spec, height), [spec, height]);
  const csv = () =>
    [["", ...spec.series.map((s) => s.name)].join("\t"), ...spec.categories.map((c, i) => [c, ...spec.series.map((s) => s.data[i])].join("\t"))].join("\n");
  return (
    <figure className="border border-neutral-200 bg-white">
      <CardHeader title={spec.title}>
        <CopyButton text={csv} />
        {onOpen && (
          <IconButton label="Open in side panel" onClick={() => onOpen({ id, kind: "chart", title: spec.title })}>
            <Maximize2 size={14} />
          </IconButton>
        )}
      </CardHeader>
      <div className="px-1 pt-1">
        <HighchartsView options={options} height={height} />
      </div>
      <figcaption className="sr-only">{spec.title}</figcaption>
    </figure>
  );
}

/* --- Table -------------------------------------------------------------------- */

export function TableBlock({ id, spec, onOpen }: { id: string; spec: TableSpec; onOpen?: OpenArtifact }) {
  const tsv = () => [spec.columns.map((c) => c.label).join("\t"), ...spec.rows.map((r) => spec.columns.map((c) => fmt(r[c.key], c.format)).join("\t"))].join("\n");
  return (
    <div className="border border-neutral-200 bg-white">
      <CardHeader title={spec.title}>
        <CopyButton text={tsv} />
        {onOpen && (
          <IconButton label="Open in side panel" onClick={() => onOpen({ id, kind: "table", title: spec.title })}>
            <Maximize2 size={14} />
          </IconButton>
        )}
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-neutral-50">
              {spec.columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`border-b border-neutral-200 px-3 py-1.5 text-[11px] font-medium whitespace-nowrap text-neutral-500 ${c.align === "right" ? "text-right" : "text-left"}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spec.rows.map((r, i) => (
              <tr key={i} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                {spec.columns.map((c) => {
                  const v = r[c.key];
                  const signed = c.format === "spct" || c.format === "bps" || c.format === "money";
                  const tone = signed && typeof v === "number" ? (v < 0 ? "text-red-700" : v > 0 ? "text-emerald-700" : "") : "";
                  return (
                    <td
                      key={c.key}
                      className={`px-3 py-1.5 whitespace-nowrap ${c.align === "right" ? "text-right font-mono tabular-nums" : "text-neutral-800"} ${tone}`}
                    >
                      {fmt(v, c.format)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --- Callout ------------------------------------------------------------------ */

export function CalloutBlock({ tone, text }: { tone: "info" | "warn"; text: string }) {
  const warn = tone === "warn";
  return (
    <div
      role="note"
      className={`flex items-start gap-2 border-l-2 px-3 py-2 text-[13px] ${warn ? "border-amber-500 bg-amber-50 text-amber-900" : "border-sky-600 bg-sky-50 text-sky-900"}`}
    >
      {warn ? <AlertTriangle size={15} className="mt-0.5 shrink-0" /> : <Info size={15} className="mt-0.5 shrink-0" />}
      <span>{text}</span>
    </div>
  );
}

export function BlockView({ block, onOpen, compact = false }: { block: Block; onOpen: OpenArtifact; compact?: boolean }) {
  switch (block.type) {
    case "text":
      return <TextBlock md={block.md} />;
    case "kpis":
      return <KpiBlock items={block.items} />;
    case "chart":
      return <ChartBlock id={block.id} spec={block.spec} onOpen={onOpen} size={compact ? "compact" : "inline"} />;
    case "table":
      return <TableBlock id={block.id} spec={block.spec} onOpen={onOpen} />;
    case "callout":
      return <CalloutBlock tone={block.tone} text={block.text} />;
  }
}
