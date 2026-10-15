import { useMemo, useState, type ComponentType } from "react";
import {
  Banner,
  BannerStack,
  BulletBar,
  ChartGrid,
  ChartSpan,
  ChipToggle,
  ConfirmDialog,
  ContextPanel,
  DataTable,
  EmptyState,
  ExportButton,
  FilterBar,
  FilterSelect,
  Heatmap,
  InsightCard,
  KeyValueGrid,
  Legend,
  MetricCard,
  MetricGrid,
  PageHeader,
  PanelSection,
  ProgressBar,
  RankedList,
  SectionCard,
  SegmentedControl,
  Sparkline,
  SplitView,
  StatusBadge,
  StatusStrip,
  TableToolbar,
  Tabs,
  Timeline,
  tokens,
  type Column,
} from "../patterns";
import { ORDERS, STAGES, TREND, type Order, statusTone } from "./fixtures";

/* One small, working demo per catalog entry. Fixture data only. */

const noop = () => {};

function PageHeaderDemo() {
  return (
    <div className={tokens.border.default}>
      <PageHeader
        eyebrow="Monitor · Rates"
        title="Ops overview"
        description="As of 14:32:05 London · all desks"
        meta={<StatusBadge tone="positive" label="Live" dot />}
        actions={
          <>
            <ExportButton onClick={noop} />
            <button type="button" className={tokens.button.primary}>New order</button>
          </>
        }
      />
    </div>
  );
}

function SectionCardDemo() {
  return (
    <SectionCard title="Fills by venue" subtitle="Today, notional £m" actions={<ExportButton onClick={noop} />} footer="Source: OMS, refreshed 14:30">
      <p className={tokens.text.body}>Card body: chart, table, list or form block.</p>
    </SectionCard>
  );
}

function SplitViewDemo() {
  const [sel, setSel] = useState<string | null>(ORDERS[0].id);
  const order = ORDERS.find((o) => o.id === sel);
  return (
    <SplitView
      detailWidth="sm"
      list={
        <ul className={tokens.cx("divide-y", tokens.border.divide)}>
          {ORDERS.slice(0, 5).map((o) => (
            <li key={o.id}>
              <button type="button" onClick={() => setSel(o.id)} className={tokens.cx("flex w-full items-center justify-between px-4 py-2 text-left text-xs", sel === o.id ? tokens.surface.selected : tokens.surface.hover)}>
                <span className="font-medium">{o.id} · {o.instrument}</span>
                <StatusBadge tone={statusTone(o.status)} label={o.status} dot />
              </button>
            </li>
          ))}
        </ul>
      }
      detail={
        order ? (
          <div className="p-4">
            <div className={tokens.text.eyebrow}>{order.id}</div>
            <div className={tokens.cx("mb-3", tokens.text.title)}>{order.instrument}</div>
            <KeyValueGrid layout="rows" items={[{ label: "Side", value: order.side }, { label: "Quantity", value: order.qty.toLocaleString(), mono: true }, { label: "Venue", value: order.venue }]} />
          </div>
        ) : (
          <EmptyState kind="first" title="Select an order" compact />
        )
      }
    />
  );
}

function MetricCardDemo() {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <MetricGrid columns={4}>
      <MetricCard label="Notional traded" value="£1.84bn" delta={{ value: 6.2, label: "+6.2%", basis: "vs yesterday" }} caption="Target £1.6bn" />
      <MetricCard label="Fill rate" value="97.4" unit="%" delta={{ value: -0.8, label: "−0.8pp", basis: "vs 20d avg" }} trend={{ values: TREND, label: "Fill rate, last 20 days" }} />
      <MetricCard label="Open exceptions" value="23" status="warning" delta={{ value: 5, label: "+5", basis: "since open", goodWhen: "down" }} caption="Threshold 20" onClick={() => setSel(sel === "ex" ? null : "ex")} selected={sel === "ex"} />
      <MetricCard label="Settlement fails" value="4" status="negative" delta={{ value: 2, label: "+2", basis: "vs T-1", goodWhen: "down" }} caption="Limit 3 · click to filter" onClick={() => setSel(sel === "fa" ? null : "fa")} selected={sel === "fa"} />
    </MetricGrid>
  );
}

function SparklineDemo() {
  return (
    <div className="grid max-w-md grid-cols-2 gap-4">
      <div>
        <div className={tokens.text.label}>Fails rate, 20d</div>
        <Sparkline values={TREND.map((v) => 100 - v)} band={{ lo: 1.5, hi: 3 }} tone="negative" label="Fails rate rising, above usual range" />
      </div>
      <div>
        <div className={tokens.text.label}>Fill rate, 20d</div>
        <Sparkline values={TREND} tone="positive" label="Fill rate steady" />
      </div>
    </div>
  );
}

function ProgressDemo() {
  return (
    <div className="grid max-w-lg gap-4">
      <div>
        <div className={tokens.text.label}>Allocation complete</div>
        <ProgressBar value={68} max={100} label="Allocation complete" showValue />
      </div>
      <div>
        <div className="flex justify-between">
          <span className={tokens.text.label}>Desk VaR vs limit</span>
          <span className="text-xs tabular-nums">£8.6m / £10m</span>
        </div>
        <BulletBar value={8.6} target={8} limit={10} max={12} label="Desk VaR 8.6m, warning 8m, limit 10m" />
      </div>
    </div>
  );
}

function StatusBadgeDemo() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge label="Draft" />
      <StatusBadge tone="info" label="Working" />
      <StatusBadge tone="positive" label="Filled" />
      <StatusBadge tone="warning" label="Partial" />
      <StatusBadge tone="negative" label="Rejected" />
      <StatusBadge tone="critical" label="Breach" />
      <span className="mx-2 h-4 w-px bg-neutral-200" />
      <StatusBadge tone="positive" label="Filled" dot />
      <StatusBadge tone="negative" label="Rejected" dot />
    </div>
  );
}

function StatusStripDemo() {
  const [sel, setSel] = useState<string | null>(null);
  return <StatusStrip label="Trade lifecycle" stages={STAGES} selected={sel} onSelect={setSel} />;
}

function BannerDemo() {
  return (
    <BannerStack>
      <Banner tone="negative" title="FX desk limit breached" action={{ label: "Review", onClick: noop }}>
        Net open position £112m against a £100m limit since 14:05.
      </Banner>
      <Banner tone="warning" title="Prices are 4 minutes old" onDismiss={noop}>
        Bloomberg feed delayed. Values may not reflect the market.
      </Banner>
      <Banner tone="info" title="Read-only: month-end lock" />
    </BannerStack>
  );
}

function EmptyStateDemo() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {(["clear", "filtered", "first"] as const).map((k) => (
        <div key={k} className={tokens.border.default}>
          <EmptyState
            compact
            kind={k}
            title={k === "clear" ? "No exceptions" : k === "filtered" ? "No orders match" : "No reports yet"}
            description={k === "clear" ? "Everything settled on time." : k === "filtered" ? "3 filters are hiding 214 orders." : "Create one to schedule a daily export."}
            action={k === "clear" ? undefined : { label: k === "filtered" ? "Clear filters" : "New report", onClick: noop }}
          />
        </div>
      ))}
    </div>
  );
}

function SegmentedDemo() {
  const [p, setP] = useState<"1D" | "1W" | "1M" | "YTD">("1W");
  const [t, setT] = useState<"open" | "filled" | "all">("open");
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl label="Period" value={p} onChange={setP} options={[{ value: "1D", label: "1D" }, { value: "1W", label: "1W" }, { value: "1M", label: "1M" }, { value: "YTD", label: "YTD" }]} />
      <div className="border-b border-neutral-200">
        <Tabs label="Order views" value={t} onChange={setT} tabs={[{ value: "open", label: "Open", count: 42 }, { value: "filled", label: "Filled", count: 318 }, { value: "all", label: "All" }]} />
      </div>
    </div>
  );
}

function FilterBarDemo() {
  const [q, setQ] = useState("");
  const [desk, setDesk] = useState<"" | "rates" | "fx" | "credit">("rates");
  const [mine, setMine] = useState(false);
  const active = [
    ...(desk ? [{ key: "desk", label: `Desk: ${desk}`, onRemove: () => setDesk("") }] : []),
    ...(mine ? [{ key: "mine", label: "Mine only", onRemove: () => setMine(false) }] : []),
  ];
  return (
    <div className={tokens.border.default}>
      <FilterBar
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search orders, ISIN, client"
        active={active}
        onClearAll={() => {
          setDesk("");
          setMine(false);
        }}
        trailing={<span className={tokens.text.muted}>Saved view: Morning</span>}
      >
        <FilterSelect label="Desk" value={desk} onChange={setDesk} options={[{ value: "rates", label: "Rates" }, { value: "fx", label: "FX" }, { value: "credit", label: "Credit" }]} />
        <ChipToggle label="Mine only" pressed={mine} onChange={setMine} count={12} />
      </FilterBar>
    </div>
  );
}

const ORDER_COLS: Column<Order>[] = [
  { key: "id", header: "Order", cell: (o) => <span className="font-mono">{o.id}</span>, sortValue: (o) => o.id },
  { key: "instrument", header: "Instrument", cell: (o) => o.instrument, sortValue: (o) => o.instrument },
  { key: "side", header: "Side", cell: (o) => <span className={o.side === "Buy" ? "text-emerald-700" : "text-red-700"}>{o.side}</span> },
  { key: "qty", header: "Quantity", align: "right", cell: (o) => o.qty.toLocaleString(), sortValue: (o) => o.qty },
  { key: "filled", header: "Filled", width: "w-32", cell: (o) => <ProgressBar value={o.filled} max={1} label={`${o.id} filled`} showValue /> , sortValue: (o) => o.filled },
  { key: "status", header: "Status", cell: (o) => <StatusBadge tone={statusTone(o.status)} label={o.status} dot />, sortValue: (o) => o.status },
];

function TableToolbarDemo() {
  const [sel, setSel] = useState<Set<string>>(new Set(["ORD-1042", "ORD-1043"]));
  return (
    <div className={tokens.border.default}>
      <TableToolbar
        title="Orders"
        count={ORDERS.length}
        total={340}
        selectedCount={sel.size}
        onClearSelection={() => setSel(new Set())}
        bulkActions={[{ label: "Cancel", onClick: noop }, { label: "Amend", onClick: noop }, { label: "Release", onClick: noop, variant: "primary" }]}
        actions={<ExportButton onClick={noop} />}
      />
      <div className={tokens.cx("px-4 py-3", tokens.text.muted)}>{sel.size ? "Clear the selection to see browse mode." : "Browse mode. Select rows in the Data table demo below."}</div>
    </div>
  );
}

function DataTableDemo() {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");
  return (
    <div className={tokens.border.default}>
      <TableToolbar
        title="Orders"
        count={ORDERS.length}
        selectedCount={sel.size}
        onClearSelection={() => setSel(new Set())}
        bulkActions={[{ label: "Cancel", onClick: noop }, { label: "Release", onClick: noop, variant: "primary" }]}
        actions={<SegmentedControl size="xs" label="Density" value={density} onChange={setDensity} options={[{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" }]} />}
      />
      <DataTable caption="Orders" columns={ORDER_COLS} rows={ORDERS} rowKey={(o) => o.id} selectable selected={sel} onSelectedChange={setSel} density={density} />
    </div>
  );
}

function RankedListDemo() {
  return (
    <SectionCard title="Slippage by broker" subtitle="bp vs arrival, lower is better">
      <RankedList
        label="Slippage by broker"
        order="asc"
        items={[
          { id: "a", label: "Broker A", value: 1.2, display: "1.2bp", tone: "positive" },
          { id: "b", label: "Broker B", value: 2.1, display: "2.1bp" },
          { id: "c", label: "Broker C", value: 2.4, display: "2.4bp" },
          { id: "d", label: "Broker D", value: 4.9, display: "4.9bp", tone: "negative", sublabel: "3bp above peer median" },
        ]}
      />
    </SectionCard>
  );
}

function TimelineDemo() {
  return (
    <SectionCard title="Order history" subtitle="ORD-1042">
      <Timeline
        label="Order history"
        events={[
          { id: "5", at: "14:32:05", title: "Partially filled 60%", actor: "Venue: Tradeweb", tone: "warning" },
          { id: "4", at: "14:31:40", title: "Price amended", actor: "J. Patel", detail: "Limit 99.42 → 99.45", tone: "info" },
          { id: "3", at: "14:30:12", title: "Routed", actor: "Smart order router", tone: "info" },
          { id: "2", at: "14:30:10", title: "Pre-trade checks passed", actor: "Compliance engine", tone: "positive" },
          { id: "1", at: "14:30:02", title: "Created", actor: "J. Patel" },
        ]}
      />
    </SectionCard>
  );
}

function KeyValueDemo() {
  return (
    <SectionCard title="Trade economics">
      <KeyValueGrid
        columns={3}
        items={[
          { label: "Instrument", value: "UKT 4¼ 2032" },
          { label: "ISIN", value: "GB00B6460505", mono: true },
          { label: "Side", value: "Buy" },
          { label: "Quantity", value: "25,000,000", mono: true },
          { label: "Price", value: "99.45", previous: "99.42", mono: true },
          { label: "Settlement", value: "T+1 · 16 Oct" },
          { label: "Counterparty", value: "Broker B" },
          { label: "Trader", value: "J. Patel" },
          { label: "Comment", value: "" },
        ]}
      />
    </SectionCard>
  );
}

function ChartGridDemo() {
  return (
    <ChartGrid columns={3}>
      <ChartSpan span={2}>
        <SectionCard title="Notional by hour" subtitle="Lead chart spans two columns" footer={<Legend items={[{ label: "Today", tone: "info" }, { label: "20d avg", tone: "neutral", shape: "line" }]} />}>
          <Sparkline className="h-32 w-full" values={TREND} tone="info" label="Notional by hour (placeholder chart)" />
        </SectionCard>
      </ChartSpan>
      <SectionCard title="Fill rate" subtitle="Supporting">
        <Sparkline className="h-32 w-full" values={TREND.map((v) => v - 2)} tone="positive" label="Fill rate (placeholder chart)" />
      </SectionCard>
    </ChartGrid>
  );
}

function HeatmapDemo() {
  const [cell, setCell] = useState("Click a cell");
  const rows = ["Rates", "FX", "Credit", "Equities"];
  const cols = ["1M", "3M", "1Y", "5Y", "10Y"];
  const values = [
    [12, -8, 30, 44, -20],
    [-5, 14, 9, -2, 0],
    [3, 6, -15, -38, -12],
    [22, 18, 4, -6, 9],
  ];
  return (
    <div className="flex flex-col gap-2">
      <Heatmap label="P&L by desk and tenor, £k" rows={rows} columns={cols} values={values} scale="diverging" onSelect={(r, c) => setCell(`${rows[r]} ${cols[c]}: £${values[r][c]}k`)} />
      <div className={tokens.text.muted}>{cell}</div>
    </div>
  );
}

function InsightDemo() {
  return (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <InsightCard tone="negative" title="Broker D slippage is 3bp above peers" evidence="On 41 orders this week, costing an estimated £86k." action={{ label: "Review routing", onClick: noop }} secondary={{ label: "Dismiss", onClick: noop }} />
      <InsightCard tone="positive" title="Netting could cut 18 settlements" evidence="Same-day offsetting trades with Broker B." action={{ label: "Propose netting", onClick: noop }} />
    </div>
  );
}

function SidePanelDemo() {
  return (
    <div className="h-80 max-w-sm border border-neutral-200">
      <ContextPanel title="ORD-1042" eyebrow="Order detail" severity="required" onClose={noop} actions={<button type="button" className={tokens.button.primary}>Amend</button>}>
        <PanelSection title="Economics">
          <KeyValueGrid layout="rows" items={[{ label: "Quantity", value: "25,000,000", mono: true }, { label: "Filled", value: "60%" }, { label: "Venue", value: "Tradeweb" }]} />
        </PanelSection>
      </ContextPanel>
    </div>
  );
}

function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={tokens.button.secondary}>
        Cancel 2 orders…
      </button>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} onConfirm={() => setOpen(false)} title="Cancel 2 orders?" description="ORD-1042 and ORD-1043 will be withdrawn from all venues. Fills so far are kept." confirmLabel="Cancel orders" cancelLabel="Keep orders" destructive />
    </>
  );
}

const DEMOS: Record<string, ComponentType> = {
  "page-header": PageHeaderDemo,
  "section-card": SectionCardDemo,
  "split-view": SplitViewDemo,
  "metric-card": MetricCardDemo,
  sparkline: SparklineDemo,
  progress: ProgressDemo,
  "status-badge": StatusBadgeDemo,
  "status-strip": StatusStripDemo,
  banner: BannerDemo,
  "empty-state": EmptyStateDemo,
  segmented: SegmentedDemo,
  "filter-bar": FilterBarDemo,
  "table-toolbar": TableToolbarDemo,
  "data-table": DataTableDemo,
  "ranked-list": RankedListDemo,
  timeline: TimelineDemo,
  "key-value": KeyValueDemo,
  "chart-grid": ChartGridDemo,
  heatmap: HeatmapDemo,
  "insight-card": InsightDemo,
  "side-panel": SidePanelDemo,
  modal: ModalDemo,
};

/** Renders the live demo for a catalog entry. */
export function PatternDemo({ id }: { id: string }) {
  const Demo = DEMOS[id];
  return Demo ? <Demo /> : null;
}

/* Composition: screen 6 (order blotter) built only from patterns. Proves
 * the patterns fit together before any real screen is migrated. */
export function BlotterComposition() {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(
    () => ORDERS.filter((o) => (!stage || o.stage === stage) && (!q || `${o.id} ${o.instrument}`.toLowerCase().includes(q.toLowerCase()))),
    [q, stage],
  );
  const order = ORDERS.find((o) => o.id === open);

  return (
    <div className={tokens.cx(tokens.border.default, tokens.surface.page)}>
      <PageHeader eyebrow="Order flow" title="Order blotter" description="As of 14:32:05 · Rates desk" actions={<button type="button" className={tokens.button.primary}>New order</button>} />
      <div className="flex flex-col gap-4 p-4">
        <Banner tone="warning" title="Prices are 4 minutes old">Bloomberg feed delayed.</Banner>
        <MetricGrid columns={4}>
          <MetricCard label="Open orders" value="42" delta={{ value: 6, label: "+6", basis: "since open", goodWhen: "none" }} />
          <MetricCard label="Notional working" value="£612m" />
          <MetricCard label="Fill rate" value="97.4" unit="%" trend={{ values: TREND, label: "Fill rate trend" }} />
          <MetricCard label="Rejected today" value="3" status="negative" delta={{ value: 2, label: "+2", basis: "vs T-1", goodWhen: "down" }} />
        </MetricGrid>
        <StatusStrip label="Order stages" stages={STAGES} selected={stage} onSelect={setStage} />
        <SplitView
          detailWidth="sm"
          list={
            <>
              <FilterBar search={q} onSearch={setQ} searchPlaceholder="Search orders" active={stage ? [{ key: "stage", label: `Stage: ${stage}`, onRemove: () => setStage(null) }] : []} onClearAll={() => setStage(null)} />
              <TableToolbar count={rows.length} total={ORDERS.length} selectedCount={sel.size} onClearSelection={() => setSel(new Set())} bulkActions={[{ label: "Cancel", onClick: noop }]} actions={<ExportButton onClick={noop} />} />
              <DataTable caption="Orders" columns={ORDER_COLS} rows={rows} rowKey={(o) => o.id} selectable selected={sel} onSelectedChange={setSel} onRowClick={(o) => setOpen(o.id)} activeKey={open} />
            </>
          }
          detail={
            order ? (
              <ContextPanel title={order.id} eyebrow={order.instrument} onClose={() => setOpen(null)}>
                <PanelSection title="Economics">
                  <KeyValueGrid layout="rows" items={[{ label: "Side", value: order.side }, { label: "Quantity", value: order.qty.toLocaleString(), mono: true }, { label: "Venue", value: order.venue }]} />
                </PanelSection>
                <PanelSection title="History">
                  <Timeline label="Order history" events={[{ id: "2", at: "14:31", title: order.status, tone: statusTone(order.status) }, { id: "1", at: "14:30", title: "Created", actor: "J. Patel" }]} />
                </PanelSection>
              </ContextPanel>
            ) : (
              <EmptyState kind="first" title="Select an order" description="Its detail and history open here." compact />
            )
          }
        />
      </div>
    </div>
  );
}
