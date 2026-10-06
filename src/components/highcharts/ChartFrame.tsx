import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { Chart, Options } from "highcharts";
import { HighchartsView } from "./HighchartsView";
import {
  formatValue,
  sortRows,
  toCsv,
  unitLabel,
  type ChartData,
  type ChartQuery,
  type Currency,
  type SortDir,
  type Unit,
  type UnitKind,
} from "./chart-query";

/* ChartFrame — the card chrome for a report chart.
 *
 * Every chart on a report screen needs the same four things, and building
 * them per chart meant sixteen near-identical controls on one page. They all
 * live here instead, and a chart declares which of them apply:
 *
 *   metric      what is measured        `metrics`     omit → measure is fixed
 *   dimension   how it is broken down   `dimensions`  omit → axis is fixed
 *   unit        bps or cash             `unitsFor`    omit → both offered
 *   order       which end comes first   `sortable`    false → order is the data
 *
 * Nothing is ever rendered disabled. A waterfall's stages are its meaning, so
 * it passes `sortable={false}` and simply has no sort control — which is a
 * quieter way of saying "not applicable" than a greyed-out button.
 *
 * The header reads as the sentence the chart answers — "Total spread by
 * Counterparty" — with each noun being the control that changes it. That buys
 * the metric and dimension menus for free: the title had to say those words
 * anyway.
 *
 * `getData` and `toOptions` must be stable (useCallback). They are memo
 * dependencies, and an inline arrow would rebuild the Highcharts options on
 * every render, cancelling the animation each time — the hazard HighchartsView
 * documents. Putting the caller's real dependencies (filtered trades, say) in
 * the useCallback is also what makes filter changes flow through.
 */

const ALL_KINDS: UnitKind[] = ["bps", "cash"];
const DEFAULT_CURRENCIES: Currency[] = ["USD", "EUR", "GBP"];

export type ChartFrameProps<M extends string, D extends string> = {
  /** Shown in place of the metric menu when the measure is fixed. */
  title?: string;
  hint?: string;
  height?: number;
  className?: string;
  metrics?: { id: M; label: string }[];
  dimensions?: { id: D; label: string }[];
  currencies?: Currency[];
  /** Denominations the given metric supports. Notional is cash-only. */
  unitsFor?: (metric: M) => UnitKind[];
  sortable?: boolean;
  initial?: Partial<ChartQuery<M, D>>;
  getData: (query: ChartQuery<M, D>) => ChartData;
  toOptions: (data: ChartData, query: ChartQuery<M, D>) => Options;
  footer?: ReactNode;
};

type FrameState<M extends string, D extends string> = {
  metric: M;
  dimension: D;
  kind: UnitKind;
  ccy: Currency;
  dir: SortDir;
};

export function ChartFrame<M extends string, D extends string>({
  title,
  hint,
  height = 260,
  className = "",
  metrics,
  dimensions,
  currencies = DEFAULT_CURRENCIES,
  unitsFor,
  sortable = true,
  initial,
  getData,
  toOptions,
  footer,
}: ChartFrameProps<M, D>) {
  const [state, setState] = useState<FrameState<M, D>>(() => ({
    metric: initial?.metric ?? metrics?.[0]?.id ?? ("" as M),
    dimension: initial?.dimension ?? dimensions?.[0]?.id ?? ("" as D),
    kind: initial?.unit?.kind ?? "bps",
    ccy: initial?.unit?.kind === "cash" ? initial.unit.ccy : currencies[0],
    dir: initial?.dir ?? "desc",
  }));
  const [mode, setMode] = useState<"chart" | "table">("chart");
  const [maximized, setMaximized] = useState(false);

  const kinds = useMemo(
    () => (unitsFor ? unitsFor(state.metric) : ALL_KINDS),
    [unitsFor, state.metric],
  );

  // A metric can drop the denomination the chart is currently in — picking
  // Notional while showing bps. Coerce rather than render an impossible axis.
  const kind = kinds.includes(state.kind) ? state.kind : kinds[0];

  const query = useMemo<ChartQuery<M, D>>(() => {
    const unit: Unit = kind === "bps" ? { kind: "bps" } : { kind: "cash", ccy: state.ccy };
    return { metric: state.metric, dimension: state.dimension, unit, dir: state.dir };
  }, [kind, state.ccy, state.metric, state.dimension, state.dir]);

  const data = useMemo(() => {
    const raw = getData(query);
    const ordered = sortable ? sortRows(raw.rows, query.dir) : raw.rows;
    // Slice after sorting, so "ten worst" follows the current order and the
    // table shows the same ten rows the chart plots.
    return { ...raw, rows: raw.limit ? ordered.slice(0, raw.limit) : ordered };
  }, [getData, query, sortable]);

  const options = useMemo(() => toOptions(data, query), [toOptions, data, query]);

  const flipDir = useCallback(
    () => setState((s) => ({ ...s, dir: s.dir === "desc" ? "asc" : "desc" })),
    [],
  );

  const heading = metrics?.find((m) => m.id === state.metric)?.label ?? title ?? data.valueLabel;
  const dimensionLabel = dimensions?.find((d) => d.id === state.dimension)?.label;
  const subtitle = [hint, sortable && (state.dir === "desc" ? "highest first" : "lowest first")]
    .filter(Boolean)
    .join(" · ");

  const controls = (expanded: boolean) => (
    <div className="flex shrink-0 items-center gap-1.5">
      <UnitControl
        kinds={kinds}
        kind={kind}
        ccy={state.ccy}
        currencies={currencies}
        onKind={(k) => setState((s) => ({ ...s, kind: k }))}
        onCcy={(c) => setState((s) => ({ ...s, kind: "cash", ccy: c }))}
      />
      {sortable && (
        <IconButton
          label={
            state.dir === "desc"
              ? "Sorted highest first. Show lowest first"
              : "Sorted lowest first. Show highest first"
          }
          onClick={flipDir}
        >
          <SortIcon dir={state.dir} />
        </IconButton>
      )}
      <div className="flex border border-neutral-200" role="group" aria-label="Chart or table">
        <ToggleButton label="Chart" active={mode === "chart"} onClick={() => setMode("chart")}>
          <ChartIcon />
        </ToggleButton>
        <ToggleButton label="Table" active={mode === "table"} onClick={() => setMode("table")}>
          <TableIcon />
        </ToggleButton>
      </div>
      {!expanded && (
        <IconButton label={`Expand ${heading}`} onClick={() => setMaximized(true)}>
          <ExpandIcon />
        </IconButton>
      )}
    </div>
  );

  const header = (expanded: boolean) => (
    <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-2.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-1.5">
          {metrics && metrics.length > 1 ? (
            <Menu
              ariaLabel="Metric"
              variant="title"
              value={state.metric}
              options={metrics}
              onChange={(metric) => setState((s) => ({ ...s, metric }))}
            />
          ) : (
            <h2 className="truncate text-sm font-semibold text-neutral-900">{heading}</h2>
          )}
          {dimensions && dimensions.length > 1 && (
            <>
              <span className="text-sm text-neutral-400">by</span>
              <Menu
                ariaLabel="Break down by"
                variant="title"
                value={state.dimension}
                options={dimensions}
                onChange={(dimension) => setState((s) => ({ ...s, dimension }))}
              />
            </>
          )}
          {(!dimensions || dimensions.length <= 1) && dimensionLabel && (
            <span className="text-sm text-neutral-400">by {dimensionLabel.toLowerCase()}</span>
          )}
        </div>
        {subtitle && <p className="mt-0.5 text-[11px] text-neutral-500">{subtitle}</p>}
      </div>
      {controls(expanded)}
    </header>
  );

  const body = (chartHeight: number) =>
    data.rows.length === 0 ? (
      <div className="px-4 py-12 text-center text-sm text-neutral-500">
        No data for this selection.
      </div>
    ) : mode === "chart" ? (
      <HighchartsView options={options} height={chartHeight} />
    ) : (
      <ChartTable
        data={data}
        unit={query.unit}
        sortable={sortable}
        dir={state.dir}
        onToggleDir={flipDir}
        maxHeight={chartHeight}
      />
    );

  return (
    <section className={`flex flex-col border border-neutral-200 bg-white ${className}`}>
      {header(false)}
      <div className="min-w-0 flex-1 px-2 py-2">
        {/* While expanded the card is behind a backdrop, so there is nothing
            to gain from a second live Highcharts instance on the same
            options — and something to lose, since the two would share the
            series data arrays. */}
        {maximized ? (
          <div
            style={{ height }}
            className="flex items-center justify-center text-[11px] text-neutral-400"
          >
            Shown in the expanded view
          </div>
        ) : (
          body(height)
        )}
      </div>
      {footer && (
        <div className="border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-500">
          {footer}
        </div>
      )}
      {maximized && (
        <MaximizedChart
          heading={heading}
          header={header(true)}
          data={data}
          unit={query.unit}
          options={options}
          sortable={sortable}
          dir={state.dir}
          onToggleDir={flipDir}
          onClose={() => setMaximized(false)}
        />
      )}
    </section>
  );
}

/* --- maximized view ----------------------------------------------------- */

/* Expanding is not the card at a larger size. There is finally room for both
 * renderings, so the toggle stops being a toggle and the chart sits beside its
 * table, sharing one sort. The toolbar is the same one, so the controls do not
 * move under the cursor when the dialog opens. */
function MaximizedChart({
  heading,
  header,
  data,
  unit,
  options,
  sortable,
  dir,
  onToggleDir,
  onClose,
}: {
  heading: string;
  header: ReactNode;
  data: ChartData;
  unit: Unit;
  options: Options;
  sortable: boolean;
  dir: SortDir;
  onToggleDir: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewport, setViewport] = useState(() =>
    typeof window === "undefined" ? 800 : window.innerHeight,
  );

  useDialog(onClose, panelRef);

  useEffect(() => {
    const onResize = () => setViewport(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const copyCsv = useCallback(() => {
    void navigator.clipboard?.writeText(toCsv(data, unit)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }, [data, unit]);

  const exportPng = useCallback(() => {
    // Offline export: renders client-side, never posts the chart anywhere.
    chartRef.current?.exportChartLocal({
      type: "image/png",
      filename: heading.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      scale: 2,
    });
  }, [heading]);

  const onReady = useCallback((chart: Chart) => {
    chartRef.current = chart;
  }, []);

  const chartHeight = Math.max(320, viewport - 260);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${heading}, expanded`}
      className="fixed inset-0 z-50 flex p-4 sm:p-6"
    >
      <button
        type="button"
        aria-label="Close expanded chart"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-neutral-900/40"
      />
      <div
        ref={panelRef}
        className="relative flex min-h-0 w-full flex-col border border-neutral-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">{header}</div>
          <div className="flex shrink-0 items-center gap-1.5 border-b border-neutral-100 py-2.5 pr-4">
            <TextButton onClick={copyCsv}>{copied ? "Copied" : "Copy CSV"}</TextButton>
            <TextButton onClick={exportPng}>Download PNG</TextButton>
            <IconButton label="Close expanded chart" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-px overflow-hidden bg-neutral-100 lg:grid-cols-[2fr_1fr]">
          <div className="min-w-0 overflow-hidden bg-white px-2 py-2">
            <HighchartsView options={options} height={chartHeight} onReady={onReady} />
          </div>
          <div className="min-h-0 overflow-auto bg-white">
            <ChartTable
              data={data}
              unit={unit}
              sortable={sortable}
              dir={dir}
              onToggleDir={onToggleDir}
              sticky
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Esc to close, Tab kept inside the panel, focus returned to the opener.
 * Menus inside the panel listen in the capture phase and stop the event, so
 * Esc closes an open menu before it closes the dialog. */
function useDialog(onClose: () => void, panelRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose, panelRef]);
}

/* --- table view --------------------------------------------------------- */

/* Rendered from the same sorted rows as the chart, so switching view never
 * reorders anything, and the value header drives the same sort state the
 * chart uses — sort in the table, flip back, the bars agree. */
function ChartTable({
  data,
  unit,
  sortable,
  dir,
  onToggleDir,
  maxHeight,
  sticky = false,
}: {
  data: ChartData;
  unit: Unit;
  sortable: boolean;
  dir: SortDir;
  onToggleDir: () => void;
  maxHeight?: number;
  sticky?: boolean;
}) {
  const metaLabels = data.rows[0]?.meta?.map((m) => m.label) ?? [];
  const fmt = { signed: data.signed ?? true, decimals: data.decimals ?? 1 };
  const valueHead = `${data.valueLabel} (${unitLabel(unit)})`;
  const headCell = `px-2 py-2 text-[11px] font-medium tracking-wide text-neutral-500 uppercase ${
    sticky ? "sticky top-0 z-10 bg-white" : ""
  }`;

  return (
    <div className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-neutral-200 text-left">
            <th scope="col" className={headCell}>
              {data.categoryLabel}
            </th>
            <th
              scope="col"
              aria-sort={sortable ? (dir === "desc" ? "descending" : "ascending") : "none"}
              className={`${headCell} text-right`}
            >
              {sortable ? (
                <button
                  type="button"
                  onClick={onToggleDir}
                  className="inline-flex items-center gap-1 uppercase hover:text-neutral-900"
                >
                  {valueHead}
                  <SortIcon dir={dir} />
                </button>
              ) : (
                valueHead
              )}
            </th>
            {data.compareLabel && (
              <th scope="col" className={`${headCell} text-right`}>
                {data.compareLabel}
              </th>
            )}
            {metaLabels.map((label) => (
              <th key={label} scope="col" className={`${headCell} text-right`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.key} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
              <th scope="row" className="px-2 py-1.5 text-left font-normal text-neutral-800">
                {row.name}
              </th>
              <td
                className={`px-2 py-1.5 text-right font-medium tabular-nums ${
                  fmt.signed
                    ? row.value > 0
                      ? "text-rose-700"
                      : row.value < 0
                        ? "text-emerald-700"
                        : "text-neutral-800"
                    : "text-neutral-800"
                }`}
              >
                {formatValue(row.value, unit, fmt)}
              </td>
              {data.compareLabel && (
                <td className="px-2 py-1.5 text-right text-neutral-500 tabular-nums">
                  {row.compare === undefined ? "—" : formatValue(row.compare, unit, fmt)}
                </td>
              )}
              {row.meta?.map((m) => (
                <td key={m.label} className="px-2 py-1.5 text-right text-neutral-500 tabular-nums">
                  {m.value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --- controls ----------------------------------------------------------- */

/* The denomination picker carries the sort with it: the ranking key is always
 * whatever is on screen, so switching bps → USD reorders the chart. That is
 * the reason to offer the choice, not a side effect of it. The currency caret
 * only appears when there is more than one currency to pick. */
function UnitControl({
  kinds,
  kind,
  ccy,
  currencies,
  onKind,
  onCcy,
}: {
  kinds: UnitKind[];
  kind: UnitKind;
  ccy: Currency;
  currencies: Currency[];
  onKind: (kind: UnitKind) => void;
  onCcy: (ccy: Currency) => void;
}) {
  const showBps = kinds.includes("bps");
  const showCash = kinds.includes("cash");
  if (!showCash && currencies.length <= 1) return null;
  if (!showBps && currencies.length <= 1) return null;

  return (
    <div className="flex border border-neutral-200" role="group" aria-label="Denomination">
      {showBps && (
        <ToggleButton label="Basis points" active={kind === "bps"} onClick={() => onKind("bps")} wide>
          bps
        </ToggleButton>
      )}
      {showCash && (
        <ToggleButton
          label={`Cash, ${ccy}`}
          active={kind === "cash"}
          onClick={() => onKind("cash")}
          wide
        >
          {ccy}
        </ToggleButton>
      )}
      {showCash && currencies.length > 1 && (
        <Menu
          ariaLabel="Reporting currency"
          variant="caret"
          value={ccy}
          options={currencies.map((c) => ({ id: c, label: c }))}
          onChange={onCcy}
        />
      )}
    </div>
  );
}

function Menu<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
  variant,
}: {
  ariaLabel: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
  variant: "title" | "caret";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    // Capture phase, so Esc closes this menu without also closing a dialog
    // the menu happens to be inside.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const current = options.find((o) => o.id === value);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${current?.label ?? value}`}
        onClick={() => setOpen((o) => !o)}
        className={
          variant === "title"
            ? "-mx-1 inline-flex max-w-[14rem] items-center gap-1 px-1 text-sm font-semibold text-neutral-900 hover:bg-neutral-100"
            : "inline-flex h-6 items-center px-1 text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700"
        }
      >
        {variant === "title" && <span className="truncate">{current?.label ?? value}</span>}
        <CaretIcon />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={ariaLabel}
          className="absolute top-full right-0 z-30 mt-1 max-h-64 min-w-[11rem] overflow-auto border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={option.id === value}
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs whitespace-nowrap hover:bg-neutral-50 ${
                option.id === value ? "font-medium text-neutral-900" : "text-neutral-600"
              }`}
            >
              <span className="w-3 shrink-0 text-indigo-600">{option.id === value ? "✓" : ""}</span>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleButton({
  label,
  active,
  onClick,
  wide = false,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex h-6 items-center justify-center text-[11px] font-medium transition ${
        wide ? "px-1.5" : "w-6"
      } ${active ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"}`}
    >
      {children}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center border border-neutral-200 text-neutral-400 transition hover:border-neutral-300 hover:text-neutral-700"
    >
      {children}
    </button>
  );
}

function TextButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-6 items-center border border-neutral-200 px-2 text-[11px] font-medium text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
    >
      {children}
    </button>
  );
}

/* --- icons -------------------------------------------------------------- */

const svg = "h-3.5 w-3.5";

function CaretIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 shrink-0" aria-hidden>
      <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" />
    </svg>
  );
}

function SortIcon({ dir }: { dir: SortDir }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 shrink-0" aria-hidden>
      {dir === "desc" ? (
        <path d="M10 15.5a.75.75 0 0 1-.53-.22l-4-4a.75.75 0 1 1 1.06-1.06L9.25 13V5a.75.75 0 0 1 1.5 0v8l2.72-2.78a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-.53.22Z" />
      ) : (
        <path d="M10 4.5c.2 0 .39.08.53.22l4 4a.75.75 0 0 1-1.06 1.06L10.75 7v8a.75.75 0 0 1-1.5 0V7L6.53 9.78A.75.75 0 0 1 5.47 8.72l4-4A.75.75 0 0 1 10 4.5Z" />
      )}
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={svg} aria-hidden>
      <path d="M3.5 12h2.25v4.5H3.5V12Zm5.25-6.5H11v11H8.75v-11ZM14 8.5h2.25v8H14v-8Z" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={svg} aria-hidden>
      <path d="M3 4h14v2.5H3V4Zm0 4h5.5v3H3V8Zm7 0h7v3h-7V8ZM3 12.5h5.5V16H3v-3.5Zm7 0h7V16h-7v-3.5Z" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={svg} aria-hidden>
      <path d="M4 3h4.25a.75.75 0 0 1 0 1.5H5.56l3.22 3.22a.75.75 0 1 1-1.06 1.06L4.5 5.56v2.69a.75.75 0 0 1-1.5 0V4a1 1 0 0 1 1-1Zm12 14h-4.25a.75.75 0 0 1 0-1.5h2.69l-3.22-3.22a.75.75 0 1 1 1.06-1.06l3.22 3.22v-2.69a.75.75 0 0 1 1.5 0V16a1 1 0 0 1-1 1Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={svg} aria-hidden>
      <path d="M4.28 4.28a.75.75 0 0 1 1.06 0L10 8.94l4.66-4.66a.75.75 0 1 1 1.06 1.06L11.06 10l4.66 4.66a.75.75 0 1 1-1.06 1.06L10 11.06l-4.66 4.66a.75.75 0 1 1-1.06-1.06L8.94 10 4.28 5.34a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

export default ChartFrame;
