import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DataGrid, {
  Column,
  ColumnChooser,
  ColumnChooserSearch,
  ColumnFixing,
  FilterPanel,
  FilterRow,
  GroupItem,
  GroupPanel,
  Grouping,
  HeaderFilter,
  Item,
  LoadPanel,
  MasterDetail,
  Paging,
  Scrolling,
  SearchPanel,
  Selection,
  Sorting,
  StateStoring,
  Summary,
  Toolbar,
  TotalItem,
  type DataGridRef,
  type DataGridTypes,
} from "devextreme-react/data-grid";
import { TabPanel, Item as TabPanelItem } from "devextreme-react/tab-panel";
import "devextreme/dist/css/dx.fluent.saas.light.compact.css";
import {
  makeBook,
  makeIncomingTrade,
  tickBook,
  type AssetClass,
  type SettleStatus,
  type Side,
  type TradeRow,
  type TradeStatus,
} from "../lib/dx-blotter-data";

// DevExtreme is a commercial library. No license key is registered here, so the
// grid runs in trial mode and DevExtreme logs its licensing notice — expected
// for an internal design workspace, same posture as the AG Grid pages.

export const title = "DevExtreme Trade Blotter";
export const fullWidth = true;

/* ------------------------------------------------------------------ */
/*  Formatters                                                         */
/* ------------------------------------------------------------------ */

const nfInt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nfSigned = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  signDisplay: "always",
});

const compactUsd = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}bn`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}m`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
};

/* ------------------------------------------------------------------ */
/*  Cell templates                                                     */
/* ------------------------------------------------------------------ */

const chip =
  "inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold tracking-wide leading-none";

/* The grid types `value` as `any`; narrowing it per column keeps the cell
 * templates honest about what they render. */
type CellOf<V> = Omit<
  DataGridTypes.ColumnCellTemplateData<TradeRow, string>,
  "value"
> & { value?: V };

const STATUS_STYLE: Record<TradeStatus, string> = {
  NEW: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  WORKING: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  "PART-FILL": "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  FILLED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  ALLOCATED: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
  CANCELLED: "bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200",
  REJECTED: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

function StatusCell(cell: CellOf<TradeStatus>) {
  const v = cell.value;
  if (!v) return null;
  const live = v === "NEW" || v === "WORKING" || v === "PART-FILL";
  return (
    <span className={`${chip} gap-1 ${STATUS_STYLE[v]}`}>
      {live && <span className="h-1.5 w-1.5 animate-pulse bg-current" />}
      {v}
    </span>
  );
}

function SideCell(cell: CellOf<Side>) {
  const v = cell.value;
  if (!v) return null;
  return (
    <span
      className={`${chip} ${
        v === "BUY"
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
      }`}
    >
      {v}
    </span>
  );
}

const ASSET_STYLE: Record<AssetClass, string> = {
  Govt: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  Credit: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  Equity: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  ETF: "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200",
  FX: "bg-lime-50 text-lime-700 ring-1 ring-lime-200",
  Future: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
};

function AssetClassCell(cell: CellOf<AssetClass>) {
  const v = cell.value;
  if (!v) return null;
  return <span className={`${chip} ${ASSET_STYLE[v]}`}>{v}</span>;
}

function TickerCell(cell: CellOf<string>) {
  return (
    <span
      className="font-mono text-[11px] font-medium text-neutral-800"
      title={cell.data?.instrument}
    >
      {cell.value}
    </span>
  );
}

function PriceCell(cell: CellOf<number>) {
  const v = cell.value;
  if (v == null) return null;
  const dir = cell.data?.priceDir ?? 0;
  const dp = cell.data?.assetClass === "FX" ? 4 : 2;
  return (
    <span className="flex items-center justify-end gap-1 font-mono tabular-nums">
      {v.toFixed(dp)}
      {dir !== 0 && (
        <span className={dir > 0 ? "text-emerald-600" : "text-rose-600"}>
          {dir > 0 ? "▲" : "▼"}
        </span>
      )}
    </span>
  );
}

function FillCell(cell: CellOf<number>) {
  const row = cell.data;
  if (!row) return null;
  const pct = row.quantity > 0 ? row.filledQty / row.quantity : 0;
  const done = pct >= 1;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden bg-neutral-200">
        <div
          className={`h-full ${done ? "bg-emerald-500" : "bg-indigo-500"}`}
          style={{ width: `${Math.min(100, pct * 100)}%` }}
        />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-neutral-600">
        {(pct * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function PnlCell(cell: CellOf<number>) {
  const v = cell.value;
  if (v == null) return null;
  return (
    <span
      className={`font-mono tabular-nums ${
        v === 0
          ? "text-neutral-500"
          : v > 0
            ? "text-emerald-600"
            : "text-rose-600"
      }`}
    >
      {nfSigned.format(v)}
    </span>
  );
}

function CounterpartyCell(cell: CellOf<string>) {
  const row = cell.data;
  if (!row) return null;
  return (
    <span className="flex items-center gap-1.5">
      <span className="truncate">{row.counterparty}</span>
      <span className="bg-neutral-100 px-1 text-[10px] font-medium text-neutral-500 ring-1 ring-neutral-200">
        {row.cptyRating}
      </span>
    </span>
  );
}

const SETTLE_STYLE: Record<SettleStatus, string> = {
  SETTLED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  MATCHED: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  PENDING: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  FAILED: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

function SettleCell(cell: CellOf<SettleStatus>) {
  const v = cell.value;
  if (!v) return null;
  const fails = cell.data?.failDays ?? 0;
  return (
    <span className="flex items-center gap-1.5">
      <span className={`${chip} ${SETTLE_STYLE[v]}`}>{v}</span>
      {v === "FAILED" && fails > 0 && (
        <span className="font-mono text-[10px] text-rose-600">+{fails}d</span>
      )}
    </span>
  );
}

function LimitCell(cell: CellOf<number>) {
  const v = cell.value;
  if (v == null) return null;
  const tone =
    v >= 90 ? "bg-rose-500" : v >= 75 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-12 overflow-hidden bg-neutral-200">
        <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, v)}%` }} />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-neutral-600">
        {v}%
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Master detail — executions + allocations                           */
/* ------------------------------------------------------------------ */

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium tracking-wide uppercase text-neutral-400">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[12px] font-medium tabular-nums text-neutral-800">
        {value}
      </div>
    </div>
  );
}

/* Component templates receive the DevExtreme template model under `data`, so
 * the row itself is one level deeper than in the `render` form. */
function TradeDetail(props: {
  data: DataGridTypes.MasterDetailTemplateData<TradeRow, string>;
}) {
  const row = props.data.data;
  const dp = row.assetClass === "FX" ? 4 : 2;
  const vwap = row.executions.length
    ? row.executions.reduce((s, e) => s + e.price * e.qty, 0) /
      row.executions.reduce((s, e) => s + e.qty, 0)
    : row.price;

  return (
    <div className="bg-neutral-50 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-x-8 gap-y-2 border border-neutral-200 bg-white px-4 py-3">
        <div>
          <div className="text-[10px] font-medium tracking-wide uppercase text-neutral-400">
            Instrument
          </div>
          <div className="mt-0.5 text-[13px] font-medium text-neutral-900">
            {row.instrument}
          </div>
        </div>
        <DetailStat label="ISIN" value={row.isin} />
        <DetailStat label="Order" value={row.orderId} />
        <DetailStat label="VWAP" value={vwap.toFixed(dp)} />
        <DetailStat
          label="Slippage"
          value={`${(((vwap - row.price) / row.price) * 10000).toFixed(1)} bps`}
        />
        <DetailStat label="Commission" value={nfInt.format(row.commission)} />
        <DetailStat label="Fees" value={nfInt.format(row.fees)} />
        <DetailStat
          label="Net consideration"
          value={nfInt.format(row.netConsideration)}
        />
      </div>

      <TabPanel deferRendering={false} animationEnabled={false}>
        <TabPanelItem title={`Executions (${row.executions.length})`}>
          <DataGrid
            dataSource={row.executions}
            keyExpr="execId"
            showBorders
            columnAutoWidth
            showRowLines
            noDataText="No executions on this trade"
          >
            <Column dataField="execId" caption="Exec ID" width={140} />
            <Column
              dataField="time"
              caption="Time"
              dataType="datetime"
              format="HH:mm:ss"
              width={100}
            />
            <Column
              dataField="qty"
              caption="Qty"
              dataType="number"
              format="#,##0"
              alignment="right"
              width={120}
            />
            <Column
              dataField="price"
              caption="Price"
              dataType="number"
              format={{ type: "fixedPoint", precision: dp }}
              alignment="right"
              width={110}
            />
            <Column dataField="venue" caption="Venue" width={130} />
            <Column dataField="broker" caption="Broker" width={120} />
            <Column dataField="liquidity" caption="Liquidity" width={100} />
            <Summary>
              <TotalItem
                column="qty"
                summaryType="sum"
                valueFormat="#,##0"
                displayFormat="{0}"
              />
            </Summary>
          </DataGrid>
        </TabPanelItem>

        <TabPanelItem title={`Allocations (${row.allocations.length})`}>
          <DataGrid
            dataSource={row.allocations}
            keyExpr="allocId"
            showBorders
            columnAutoWidth
            showRowLines
            noDataText="Block not yet allocated"
          >
            <Column dataField="account" caption="Account" width={130} />
            <Column dataField="accountName" caption="Mandate" width={200} />
            <Column
              dataField="qty"
              caption="Qty"
              dataType="number"
              format="#,##0"
              alignment="right"
              width={120}
            />
            <Column
              dataField="pct"
              caption="Share"
              dataType="number"
              format={{ type: "fixedPoint", precision: 1 }}
              alignment="right"
              width={90}
            />
            <Column dataField="custodian" caption="Custodian" width={140} />
            <Column
              dataField="ssi"
              caption="SSI"
              width={110}
              cellRender={(c: CellOf<SettleStatus>) =>
                c.value ? (
                  <span className={`${chip} ${SETTLE_STYLE[c.value]}`}>
                    {c.value}
                  </span>
                ) : null
              }
            />
            <Summary>
              <TotalItem
                column="qty"
                summaryType="sum"
                valueFormat="#,##0"
                displayFormat="{0}"
              />
            </Summary>
          </DataGrid>
        </TabPanelItem>
      </TabPanel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KPIs                                                               */
/* ------------------------------------------------------------------ */

function computeKpis(rows: TradeRow[]) {
  let live = 0;
  let gross = 0;
  let filled = 0;
  let dv01 = 0;
  let pnl = 0;
  let fails = 0;
  for (const r of rows) {
    if (r.status === "NEW" || r.status === "WORKING" || r.status === "PART-FILL")
      live += 1;
    gross += r.notional;
    if (r.quantity > 0) filled += (r.filledQty / r.quantity) * r.notional;
    dv01 += r.dv01;
    pnl += r.mtmPnl;
    if (r.settleStatus === "FAILED") fails += 1;
  }
  return { live, gross, filled, dv01, pnl, fails, count: rows.length };
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "warn";
}) {
  return (
    <div className="border border-neutral-200 bg-neutral-50 px-3 py-2">
      <div className="text-[10px] font-medium tracking-wide uppercase text-neutral-400">
        {label}
      </div>
      <div
        className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${
          tone === "pos"
            ? "text-emerald-600"
            : tone === "neg"
              ? "text-rose-600"
              : tone === "warn"
                ? "text-amber-600"
                : "text-neutral-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ToolbarBtn({
  label,
  onClick,
  active,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 border px-2.5 text-[12px] font-medium transition ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
      }`}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const ASSET_CLASSES: Array<AssetClass | "ALL"> = [
  "ALL",
  "Govt",
  "Credit",
  "Equity",
  "ETF",
  "FX",
  "Future",
];

type GroupBy = "none" | "assetClass" | "trader" | "counterparty" | "status";

const GROUP_FIELDS: Exclude<GroupBy, "none">[] = [
  "assetClass",
  "trader",
  "counterparty",
  "status",
];

const INITIAL_BOOK = makeBook(180);

export default function DevExtremeBlotter() {
  const gridRef = useRef<DataGridRef<TradeRow, string>>(null);
  const seqRef = useRef(0);
  const tickRef = useRef(0);
  const liveRef = useRef(true);

  const [rows, setRows] = useState<TradeRow[]>(INITIAL_BOOK);
  const [assetFilter, setAssetFilter] = useState<AssetClass | "ALL">("ALL");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [live, setLive] = useState(true);
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    liveRef.current = live;
  }, [live]);

  /* ---- live market simulation ------------------------------------- */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!liveRef.current) return;
      tickRef.current += 1;
      setRows((prev) => {
        const changed = tickBook(prev, 12);
        if (!changed.length) return prev;
        const byId = new Map(changed.map((r) => [r.tradeId, r]));
        const next = prev.map((r) => byId.get(r.tradeId) ?? r);
        // a fresh print lands on the desk every few ticks
        if (tickRef.current % 6 === 0) {
          next.unshift(makeIncomingTrade(++seqRef.current));
        }
        return next;
      });
    }, 1300);
    return () => window.clearInterval(id);
  }, []);

  const visibleRows = useMemo(
    () =>
      assetFilter === "ALL"
        ? rows
        : rows.filter((r) => r.assetClass === assetFilter),
    [rows, assetFilter],
  );

  const kpis = useMemo(() => computeKpis(visibleRows), [visibleRows]);

  /* ---- grouping is driven declaratively from `groupBy` ------------- */
  useEffect(() => {
    const grid = gridRef.current?.instance();
    if (!grid) return;
    grid.beginUpdate();
    for (const field of GROUP_FIELDS) {
      grid.columnOption(field, "groupIndex", field === groupBy ? 0 : -1);
    }
    grid.endUpdate();
  }, [groupBy]);

  /* ---- notional-weighted fill rate, at group and grand-total level -- */
  const calculateCustomSummary = useCallback(
    (o: DataGridTypes.CustomSummaryInfo<TradeRow, string>) => {
      if (o.name !== "fillRate") return;
      if (o.summaryProcess === "start") {
        o.totalValue = { filled: 0, gross: 0 };
      } else if (o.summaryProcess === "calculate") {
        const row = o.value as TradeRow | undefined;
        const acc = o.totalValue as { filled: number; gross: number };
        if (row && acc) {
          acc.gross += row.notional;
          if (row.quantity > 0)
            acc.filled += (row.filledQty / row.quantity) * row.notional;
        }
      } else if (o.summaryProcess === "finalize") {
        const acc = o.totalValue as { filled: number; gross: number };
        o.totalValue = acc && acc.gross > 0 ? (acc.filled / acc.gross) * 100 : 0;
      }
    },
    [],
  );

  const onRowPrepared = useCallback(
    (e: DataGridTypes.RowPreparedEvent<TradeRow, string>) => {
      if (e.rowType !== "data" || !e.data) return;
      if (e.data.status === "CANCELLED") e.rowElement.classList.add("row-void");
      if (e.data.status === "REJECTED") e.rowElement.classList.add("row-reject");
      if (e.data.settleStatus === "FAILED")
        e.rowElement.classList.add("row-fail");
    },
    [],
  );

  const cancelSelected = useCallback(() => {
    const grid = gridRef.current?.instance();
    if (!grid) return;
    const keys = grid.getSelectedRowKeys();
    if (!keys.length) return;
    const keySet = new Set(keys);
    setRows((prev) =>
      prev.map((r) =>
        keySet.has(r.tradeId) &&
        (r.status === "NEW" ||
          r.status === "WORKING" ||
          r.status === "PART-FILL")
          ? { ...r, status: "CANCELLED" as const }
          : r,
      ),
    );
    grid.clearSelection();
  }, []);

  const exportCsv = useCallback(() => {
    const grid = gridRef.current?.instance();
    if (!grid) return;
    const data = grid
      .getVisibleRows()
      .filter((r) => r.rowType === "data")
      .map((r) => r.data as TradeRow);
    const cols: Array<[string, (r: TradeRow) => string | number]> = [
      ["Trade ID", (r) => r.tradeId],
      ["Status", (r) => r.status],
      ["Side", (r) => r.side],
      ["Ticker", (r) => r.ticker],
      ["Asset class", (r) => r.assetClass],
      ["CCY", (r) => r.ccy],
      ["Quantity", (r) => r.quantity],
      ["Filled", (r) => r.filledQty],
      ["Price", (r) => r.price],
      ["Notional (USD)", (r) => r.notional],
      ["Venue", (r) => r.venue],
      ["Counterparty", (r) => r.counterparty],
      ["Settle date", (r) => r.settleDate.toISOString().slice(0, 10)],
      ["Settle status", (r) => r.settleStatus],
      ["DV01", (r) => r.dv01],
      ["MTM P&L", (r) => r.mtmPnl],
    ];
    const esc = (v: string | number) =>
      typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const csv = [
      cols.map(([h]) => h).join(","),
      ...data.map((r) => cols.map(([, get]) => esc(get(r))).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "dx-trade-blotter.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const resetLayout = useCallback(() => {
    const grid = gridRef.current?.instance();
    if (!grid) return;
    grid.state(null);
    setGroupBy("none");
  }, []);

  return (
    <div className="dx-blotter flex h-screen flex-col bg-neutral-50">
      {/* header */}
      <div className="border-b border-neutral-200 bg-white px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
                Cross-asset execution
              </span>
              <span className="border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-indigo-600">
                DevExtreme DataGrid
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                <span
                  className={`h-1.5 w-1.5 ${
                    live ? "animate-pulse bg-emerald-500" : "bg-neutral-300"
                  }`}
                />
                {live ? "Live market data" : "Feed paused"}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
              Trade Blotter
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Trades" value={nfInt.format(kpis.count)} />
            <Kpi label="Live" value={nfInt.format(kpis.live)} />
            <Kpi label="Gross notional" value={compactUsd(kpis.gross)} />
            <Kpi label="Executed" value={compactUsd(kpis.filled)} />
            <Kpi
              label="Net DV01"
              value={nfSigned.format(kpis.dv01)}
              tone={kpis.dv01 >= 0 ? "pos" : "neg"}
            />
            <Kpi
              label="MTM P&L"
              value={`$${nfSigned.format(kpis.pnl)}`}
              tone={kpis.pnl >= 0 ? "pos" : "neg"}
            />
          </div>
        </div>

        {/* asset-class chips + view controls */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 border border-neutral-200 bg-white p-0.5">
            {ASSET_CLASSES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAssetFilter(a)}
                className={`px-2 py-1 text-[11px] font-medium transition ${
                  assetFilter === a
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {a}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
            Group
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="h-7 border border-neutral-200 bg-white px-2 text-[12px] outline-none focus:border-indigo-400"
            >
              <option value="none">None</option>
              <option value="assetClass">Asset class</option>
              <option value="trader">Trader</option>
              <option value="counterparty">Counterparty</option>
              <option value="status">Status</option>
            </select>
          </label>

          {kpis.fails > 0 && (
            <span className="border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700">
              {kpis.fails} failing settlement{kpis.fails > 1 ? "s" : ""}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {selectedCount > 0 && (
              <>
                <span className="text-[11px] font-medium text-neutral-500">
                  {selectedCount} selected
                </span>
                <ToolbarBtn label="Cancel selected" onClick={cancelSelected} />
              </>
            )}
            <ToolbarBtn
              label={live ? "Pause feed" : "Resume feed"}
              onClick={() => setLive((l) => !l)}
              active={!live}
            />
            <ToolbarBtn label="Export CSV" onClick={exportCsv} />
            <ToolbarBtn label="Reset layout" onClick={resetLayout} />
          </div>
        </div>
      </div>

      {/* grid */}
      <div className="min-h-0 flex-1 px-4 py-4">
        <DataGrid
          ref={gridRef}
          dataSource={visibleRows}
          keyExpr="tradeId"
          height="100%"
          width="100%"
          showBorders
          showRowLines
          showColumnLines
          rowAlternationEnabled
          hoverStateEnabled
          allowColumnResizing
          allowColumnReordering
          columnResizingMode="widget"
          columnMinWidth={60}
          repaintChangesOnly
          highlightChanges
          twoWayBindingEnabled={false}
          noDataText="No trades match the current filters"
          onRowPrepared={onRowPrepared}
          onSelectionChanged={(e) =>
            setSelectedCount(e.selectedRowKeys?.length ?? 0)
          }
        >
          <StateStoring
            enabled
            type="localStorage"
            storageKey="dx-blotter.layout"
            savingTimeout={400}
          />
          <Scrolling mode="virtual" rowRenderingMode="virtual" />
          <Paging enabled={false} />
          <LoadPanel enabled={false} />
          <Sorting mode="multiple" />
          <FilterRow visible />
          <FilterPanel visible />
          <HeaderFilter visible />
          <SearchPanel visible width={260} placeholder="Search blotter…" />
          <GroupPanel visible emptyPanelText="Drag a column here to group" />
          <Grouping autoExpandAll expandMode="rowClick" />
          <ColumnFixing enabled />
          <ColumnChooser enabled mode="select">
            <ColumnChooserSearch enabled />
          </ColumnChooser>
          <Selection
            mode="multiple"
            selectAllMode="allPages"
            showCheckBoxesMode="always"
          />
          <MasterDetail enabled component={TradeDetail} />

          <Toolbar>
            <Item name="groupPanel" location="before" />
            <Item name="searchPanel" location="after" />
            <Item name="columnChooserButton" location="after" />
          </Toolbar>

          {/* fixed identity columns */}
          <Column
            dataField="status"
            caption="Status"
            width={124}
            fixed
            fixedPosition="left"
            allowGrouping
            cellRender={StatusCell}
          />
          <Column
            dataField="tradeId"
            caption="Trade ID"
            width={106}
            fixed
            fixedPosition="left"
            allowGrouping={false}
            cssClass="cell-mono"
          />
          <Column
            dataField="side"
            caption="Side"
            width={76}
            fixed
            fixedPosition="left"
            cellRender={SideCell}
          />

          <Column caption="Trade">
            <Column
              dataField="execTime"
              caption="Exec time"
              dataType="datetime"
              format="HH:mm:ss"
              width={92}
              cssClass="cell-mono cell-muted"
            />
            <Column dataField="trader" caption="Trader" width={112} />
            <Column dataField="desk" caption="Desk" width={118} />
            <Column
              dataField="orderId"
              caption="Parent order"
              width={110}
              visible={false}
              cssClass="cell-mono"
            />
          </Column>

          <Column caption="Instrument">
            <Column
              dataField="ticker"
              caption="Ticker"
              width={132}
              cellRender={TickerCell}
            />
            <Column
              dataField="assetClass"
              caption="Class"
              width={92}
              cellRender={AssetClassCell}
            />
            <Column
              dataField="instrument"
              caption="Description"
              width={220}
              visible={false}
            />
            <Column
              dataField="isin"
              caption="ISIN"
              width={128}
              visible={false}
              cssClass="cell-mono"
            />
            <Column
              dataField="ccy"
              caption="CCY"
              width={68}
              cssClass="cell-mono"
            />
          </Column>

          <Column caption="Execution">
            <Column
              dataField="quantity"
              caption="Quantity"
              dataType="number"
              format="#,##0"
              alignment="right"
              width={118}
              cssClass="cell-mono"
            />
            <Column
              dataField="filledQty"
              caption="Filled"
              width={124}
              alignment="left"
              allowSorting
              cellRender={FillCell}
            />
            <Column
              dataField="price"
              caption="Price"
              dataType="number"
              alignment="right"
              width={104}
              cellRender={PriceCell}
            />
            <Column
              dataField="notional"
              caption="Notional (USD)"
              dataType="number"
              format="#,##0"
              alignment="right"
              width={134}
              cssClass="cell-mono"
            />
            <Column dataField="venue" caption="Venue" width={116} />
            <Column
              dataField="counterparty"
              caption="Counterparty"
              width={172}
              cellRender={CounterpartyCell}
            />
            <Column
              dataField="broker"
              caption="Broker"
              width={104}
              visible={false}
            />
          </Column>

          <Column caption="Settlement">
            <Column
              dataField="settleDate"
              caption="Settles"
              dataType="date"
              format="yyyy-MM-dd"
              width={110}
              cssClass="cell-mono"
            />
            <Column
              dataField="settleStatus"
              caption="SSI"
              width={132}
              cellRender={SettleCell}
            />
            <Column
              dataField="netConsideration"
              caption="Net consideration"
              dataType="number"
              format="#,##0"
              alignment="right"
              width={150}
              cssClass="cell-mono"
            />
            <Column
              dataField="commission"
              caption="Commission"
              dataType="number"
              format="#,##0"
              alignment="right"
              width={110}
              visible={false}
              cssClass="cell-mono"
            />
            <Column
              dataField="tradeDate"
              caption="Traded"
              dataType="date"
              format="yyyy-MM-dd"
              width={110}
              visible={false}
              cssClass="cell-mono"
            />
          </Column>

          <Column caption="Risk & P&L">
            <Column
              dataField="yieldPct"
              caption="Yield %"
              dataType="number"
              format={{ type: "fixedPoint", precision: 3 }}
              alignment="right"
              width={92}
              cssClass="cell-mono"
            />
            <Column
              dataField="spreadBps"
              caption="Spread"
              dataType="number"
              format="#,##0"
              alignment="right"
              width={90}
              cssClass="cell-mono"
            />
            <Column
              dataField="dv01"
              caption="DV01"
              dataType="number"
              format="#,##0"
              alignment="right"
              width={100}
              cssClass="cell-mono"
            />
            <Column
              dataField="mtmPnl"
              caption="MTM P&L"
              dataType="number"
              alignment="right"
              width={118}
              cellRender={PnlCell}
            />
            <Column
              dataField="dayPnl"
              caption="Day P&L"
              dataType="number"
              alignment="right"
              width={112}
              visible={false}
              cellRender={PnlCell}
            />
            <Column
              dataField="limitUtil"
              caption="Line util"
              dataType="number"
              width={120}
              cellRender={LimitCell}
            />
          </Column>

          <Summary calculateCustomSummary={calculateCustomSummary}>
            <TotalItem
              column="tradeId"
              summaryType="count"
              displayFormat="{0} trades"
            />
            <TotalItem
              name="fillRate"
              summaryType="custom"
              showInColumn="filledQty"
              valueFormat={{ type: "fixedPoint", precision: 1 }}
              displayFormat="{0}% filled"
            />
            <TotalItem
              column="notional"
              summaryType="sum"
              valueFormat="#,##0"
              displayFormat="{0}"
            />
            <TotalItem
              column="dv01"
              summaryType="sum"
              valueFormat="#,##0"
              displayFormat="{0}"
            />
            <TotalItem
              column="mtmPnl"
              summaryType="sum"
              valueFormat="#,##0"
              displayFormat="{0}"
            />

            <GroupItem column="tradeId" summaryType="count" displayFormat="{0}" />
            <GroupItem
              column="notional"
              summaryType="sum"
              valueFormat="#,##0"
              displayFormat="{0}"
              alignByColumn
              showInGroupFooter={false}
            />
            <GroupItem
              column="dv01"
              summaryType="sum"
              valueFormat="#,##0"
              displayFormat="{0}"
              alignByColumn
              showInGroupFooter={false}
            />
            <GroupItem
              column="mtmPnl"
              summaryType="sum"
              valueFormat="#,##0"
              displayFormat="{0}"
              alignByColumn
              showInGroupFooter={false}
            />
            <GroupItem
              name="fillRate"
              summaryType="custom"
              showInColumn="filledQty"
              valueFormat={{ type: "fixedPoint", precision: 1 }}
              displayFormat="{0}%"
              alignByColumn
              showInGroupFooter={false}
            />
          </Summary>
        </DataGrid>
      </div>
    </div>
  );
}
