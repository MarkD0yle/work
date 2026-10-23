import { useId, useMemo, useState } from "react";
import type { Options } from "highcharts";
import { HighchartsView } from "../../highcharts/HighchartsView";
import type { FormatSpec } from "../config/formats";
import { useEa } from "../ui/context";
import { baseOptions, mergeOptions } from "./theme";

export type LegendItem = { id: string; name: string; color: string };

type Props = {
  /** Chart-specific options (series, axes). Merged onto the shared flat base. */
  options: Options;
  height?: number;
  valueFormat?: FormatSpec;
  /** Text summary announced to assistive tech (aria-describedby). */
  summary: string;
  /** Legend entries; toggling hides the series whose `id` or `name` matches. Pass [] for none. */
  legend?: LegendItem[];
  /** Override legend toggling for non-series legends (e.g. selecting a counterparty). */
  onLegendToggle?: (id: string) => void;
  hiddenIds?: Set<string>;
};

/** Library-agnostic chart wrapper (Highcharts today). Everything else uses this, never Highcharts directly. */
export function Chart({ options, height = 260, valueFormat = "bps", summary, legend = [], onLegendToggle, hiddenIds }: Props) {
  const { theme } = useEa();
  const sumId = useId();
  const [localHidden, setLocalHidden] = useState<Set<string>>(new Set());
  const hidden = hiddenIds ?? localHidden;
  const toggle = (id: string) => {
    if (onLegendToggle) return onLegendToggle(id);
    setLocalHidden((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const merged = useMemo(() => {
    const m = mergeOptions(baseOptions(theme, valueFormat), options);
    if (m.series && legend.length) {
      m.series = m.series.map((s) => ({ ...s, visible: !(hidden.has(String((s as { id?: string }).id ?? "")) || hidden.has(String((s as { name?: string }).name ?? ""))) })) as Options["series"];
    }
    return m;
  }, [options, theme, valueFormat, legend.length, hidden]);

  const right = legend.length > 8;
  const list = (
    <ul className="ea-legend" data-scroll={right || undefined} style={{ listStyle: "none", margin: 0, padding: right ? "0 0 0 12px" : "6px 0 0", flex: right ? "0 0 auto" : undefined, maxWidth: right ? "42%" : undefined, minWidth: 0 }} aria-label="Legend">
      {legend.map((l) => (
        <li key={l.id}>
          <button type="button" className="ea-legend-item" data-off={hidden.has(l.id) || hidden.has(l.name) || undefined} aria-pressed={!(hidden.has(l.id) || hidden.has(l.name))} onClick={() => toggle(l.id)}>
            <span className="ea-swatch" style={{ background: l.color }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.name}>{l.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
  return (
    <div role="img" aria-describedby={sumId} style={{ display: "flex", flexDirection: right ? "row" : "column", minWidth: 0 }}>
      <p id={sumId} className="ea-sr">{summary}</p>
      <div style={{ flex: "1 1 0", minWidth: 0 }}><HighchartsView options={merged} height={height} /></div>
      {legend.length > 0 && list}
    </div>
  );
}
