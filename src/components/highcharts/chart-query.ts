/* The query behind a report chart.
 *
 * Global controls decide which trades are in scope — on the exception
 * screens that is the timeframe and the filter drawer, and nothing else.
 * Everything in `ChartQuery` is per chart: which measure it draws, how it is
 * broken down, what the numbers are denominated in, and which end of the
 * ranking comes first.
 *
 * Two things follow from keeping those four together in one value:
 *
 *  1. Sorting happens once, in the frame, over `ChartData.rows`. The chart
 *     and the table are handed the same ordered rows, so they cannot
 *     disagree about what "worst" means.
 *  2. Denomination is part of the query rather than a formatting step.
 *     Converting basis points to cash needs the notional behind each row, so
 *     it has to happen while the data is being built — and it reorders the
 *     ranking, which is the whole point of offering the choice: 40 bps on a
 *     2M ticket and 12 bps on a 300M ticket swap places.
 */

export type Currency = "USD" | "EUR" | "GBP";

export type UnitKind = "bps" | "cash";

export type Unit = { kind: "bps" } | { kind: "cash"; ccy: Currency };

export type SortDir = "desc" | "asc";

export type ChartQuery<M extends string = string, D extends string = string> = {
  metric: M;
  dimension: D;
  unit: Unit;
  dir: SortDir;
};

export type ChartRow = {
  key: string;
  name: string;
  value: number;
  /** Optional second series — "expected" beside "actual". Never sorted on. */
  compare?: number;
  /** Extra table columns, in declaration order. Never plotted. */
  meta?: { label: string; value: string }[];
};

export type ChartData = {
  /** Heads the category column in table view: "Counterparty", "Stage", … */
  categoryLabel: string;
  /** Heads the value column, without the unit: "Total spread". */
  valueLabel: string;
  compareLabel?: string;
  /** False for notional and other measures that are never cost or saving. */
  signed?: boolean;
  decimals?: number;
  /** Keep only the first N rows after sorting — "ten worst", not "all 42". */
  limit?: number;
  rows: ChartRow[];
};

const SYMBOL: Record<Currency, string> = { USD: "$", EUR: "€", GBP: "£" };

export const unitLabel = (unit: Unit) => (unit.kind === "bps" ? "bps" : unit.ccy);

/* One formatter for axis labels, data labels, tooltips and table cells, so
 * the same number never prints two ways in two places on the same card. The
 * minus is U+2212, matching the condition chips elsewhere on the screen. */
export function formatValue(
  value: number,
  unit: Unit,
  { signed = true, decimals = 1 }: { signed?: boolean; decimals?: number } = {},
) {
  const sign = value > 0 ? (signed ? "+" : "") : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (unit.kind === "bps") return `${sign}${abs.toFixed(decimals)}`;
  const s = SYMBOL[unit.ccy];
  if (abs >= 1e6) return `${sign}${s}${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}${s}${Math.round(abs / 1e3)}k`;
  return `${sign}${s}${abs.toFixed(0)}`;
}

/** Value plus its unit, for tooltips and table headers. */
export function formatWithUnit(
  value: number,
  unit: Unit,
  opts?: { signed?: boolean; decimals?: number },
) {
  const text = formatValue(value, unit, opts);
  return unit.kind === "bps" ? `${text} bps` : text;
}

export function sortRows(rows: ChartRow[], dir: SortDir) {
  return [...rows].sort((a, b) => (dir === "desc" ? b.value - a.value : a.value - b.value));
}

/* Table view makes a CSV free: the rows are already flat and already in the
 * order on screen, so the export matches what was being looked at. */
export function toCsv(data: ChartData, unit: Unit) {
  const metaLabels = data.rows[0]?.meta?.map((m) => m.label) ?? [];
  const head = [data.categoryLabel, `${data.valueLabel} (${unitLabel(unit)})`];
  if (data.compareLabel) head.push(`${data.compareLabel} (${unitLabel(unit)})`);
  head.push(...metaLabels);

  const esc = (cell: string) =>
    /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;

  const lines = data.rows.map((row) => {
    const cells = [row.name, String(row.value)];
    if (data.compareLabel) cells.push(row.compare === undefined ? "" : String(row.compare));
    cells.push(...(row.meta?.map((m) => m.value) ?? []));
    return cells.map(esc).join(",");
  });

  return [head.map(esc).join(","), ...lines].join("\n");
}
