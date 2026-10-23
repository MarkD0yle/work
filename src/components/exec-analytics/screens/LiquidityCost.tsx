import { Info } from "lucide-react";
import { useMemo, useState } from "react";
import { Chart, ChartPanel, PanelGrid, chartColors, type PanelDef } from "../chart";
import { Chip, IconButton, PageHeader, Popover, usePopover } from "../ui";
import { useEa } from "../ui/context";
import { DateRange, ExportMenu, ToolbarContext, useDateRange, useInitialLoad, usePreviewState } from "../shell";
import { TRADES, type Trade } from "../data/mock";
import { formatDate, formatNumber } from "../lib/format";
import { usePersisted } from "../lib/persist";
import {
  algoGroups, algoOptions, forwardOptions, liquidityCurveOptions, momentumOptions, swapProfileOptions, twapOptions,
} from "./liquidity-cost/charts";
import {
  ALGO_TABS, TENORS, TENOR_LABEL, algoPoints, forwardCurves, liquidityCurve, momentum, swapProfile, tenorText, twapCosts, type AlgoGroup,
} from "./liquidity-cost/mock";
import { TradeList } from "./liquidity-cost/TradeList";

const NO_TRADE = "Select a trade to see analysis";

export default function LiquidityCost() {
  const { theme } = useEa();
  const c = chartColors(theme);
  const loading = useInitialLoad();
  const preview = usePreviewState();
  const [range, setRange] = useDateRange("liquiditycost");
  const [trade, setTrade] = useState<Trade | null>(null); // no selection on first load
  const [algoTab, setAlgoTab] = usePersisted<AlgoGroup>("tab.liquiditycost.algo", "algo");
  const [tick, setTick] = useState(0);
  const { open: infoOpen, triggerRef: infoRef, close: infoClose, toggle: infoToggle } = usePopover();

  const isLoading = loading || preview === "loading";
  const error = preview === "error" ? "Could not load liquidity and cost data." : undefined;
  const retry = () => setTick((n) => n + 1);
  const empty = !trade ? { message: NO_TRADE } : preview === "empty" ? { message: "No data for this selection" } : false;
  const common = { loading: isLoading, error, onRetry: retry, empty };
  const when = `${formatDate(range.start)} to ${formatDate(range.end)}`;

  const panels: PanelDef[] = useMemo(() => {
    const t = trade ?? TRADES[0];
    const name = `${t.pair} ${t.direction}, ${tenorText(t)}`;
    const lc = liquidityCurve(t), sp = swapProfile(t), mo = momentum(t), tw = twapCosts(t), fw = forwardCurves(t), ap = algoPoints(t);
    const ag = algoGroups(t, algoTab, c);
    const tabs = { tabs: ALGO_TABS.map((x) => ({ id: x.id, label: x.label })), value: algoTab, onChange: (id: string) => setAlgoTab(id as AlgoGroup), label: "Group algo comparison by" };
    const f = (v: number, s: Parameters<typeof formatNumber>[1]) => formatNumber(v, s);
    return [
      { id: "liq", size: "M", render: () => (
        <ChartPanel title="Liquidity curve (spot)" {...common} key={tick}
          asTable={{ columns: ["Hour", "Volume"], rows: lc.data.map(([h, v]) => [`${f(h, "count")}:00`, f(v, "notional")]) }}>
          {({ height }) => <Chart height={height} options={liquidityCurveOptions(t, c)} valueFormat="notional" summary={`Intraday spot volume for ${name}, with the fair-value reference pinned at hour ${f(lc.fv.x, "count")}.`} />}
        </ChartPanel>) },
      { id: "swap", size: "M", render: () => (
        <ChartPanel title="Spot swap liquidity profile" {...common}
          asTable={{ columns: ["Business day", "Low", "High"], rows: sp.map((r) => [f(r.day, "count"), f(r.low, "notional"), f(r.high, "notional")]) }}>
          {({ height }) => <Chart height={height} options={swapProfileOptions(t, c)} valueFormat="notional" summary={`Liquidity band across 20 business days for ${name}, rising with horizon.`} />}
        </ChartPanel>) },
      { id: "mom", size: "M", render: () => (
        <ChartPanel title="Momentum" {...common}
          asTable={{ columns: ["Factor", "Score"], rows: mo.map((r) => [r.name, f(r.value, "bps-signed")]) }}>
          {({ height }) => <Chart height={height} options={momentumOptions(t, c)} valueFormat="bps-signed" summary={`Momentum scores from lower (−100) to higher (100) for ${name}. Positive scores are shown in the better colour, negative in the worse colour, each with an explicit sign.`} />}
        </ChartPanel>) },
      { id: "twap", size: "M", render: () => (
        <ChartPanel title="Spot TWAP costs" {...common}
          asTable={{ columns: ["Minutes", "Opportunity (bps)", "Spread (bps)", "Total (bps)"], rows: tw.rows.map((r) => [f(r.minutes, "count"), f(r.opportunity, "bps"), f(r.spread, "bps"), f(r.total, "bps")]) }}>
          {({ height }) => <Chart height={height} options={twapOptions(t, c)} valueFormat="bps"
            legend={[{ id: "Opportunity", name: "Opportunity", color: c.cat[0] }, { id: "Spread", name: "Spread", color: c.cat[1] }, { id: "Total", name: "Total", color: c.cat[2] }]}
            summary={`Opportunity, spread and total TWAP cost by horizon. Minimum total cost is ${f(tw.rows[tw.minIndex].total, "bps")} bps at ${f(tw.rows[tw.minIndex].minutes, "count")} minutes.`} />}
        </ChartPanel>) },
      { id: "fwd", size: "M", render: () => (
        <ChartPanel title="Forward point curve" {...common}
          asTable={{ columns: ["Tenor", ...fw.map((x) => formatDate(x.date))], rows: TENORS.map((d, i) => [TENOR_LABEL[d], ...fw.map((x) => f(x.points[i][1], "bps"))]) }}>
          {({ height }) => <Chart height={height} options={forwardOptions(t, c)} valueFormat="bps"
            legend={fw.map((x, i) => ({ id: formatDate(x.date), name: formatDate(x.date), color: c.cat[i] }))}
            summary={`Forward points by tenor from 1 day to 1 year on a logarithmic axis, for four dates up to ${formatDate(fw[0].date)}.`} />}
        </ChartPanel>) },
      { id: "algo", size: "M", render: () => (
        <ChartPanel title="Algo comparison" {...common} tabs={tabs}
          asTable={{ columns: ["Duration (min)", "Cost (bps)", "Algo", "Channel", "Counterparty", "Fill position", "Post-fill position"], rows: ap.map((p) => [f(p.minutes, "count"), f(p.cost, "bps"), p.algo, p.channel, p.counterparty, p.fill, p.postFill]) }}>
          {({ height }) => <Chart height={height} options={algoOptions(t, algoTab, c)} valueFormat="bps" legend={ag.names}
            summary={`Scatter of cost against duration for ${ap.length} simulated executions, coloured by ${ALGO_TABS.find((x) => x.id === algoTab)?.label.toLowerCase()}.`} />}
        </ChartPanel>) },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trade, c.cat[0], theme, algoTab, isLoading, error, preview, tick]);

  return (
    <>
      <ToolbarContext>
        <DateRange label="Included dates" value={range} onChange={setRange} />
        <ExportMenu formats={["PDF", "Excel"]} />
        <IconButton ref={infoRef} label="About this page" aria-haspopup="dialog" aria-expanded={infoOpen} onClick={infoToggle}><Info size={20} strokeWidth={1.5} /></IconButton>
        <Popover open={infoOpen} onClose={infoClose} anchor={infoRef} align="end" pad label="About liquidity and cost">
          <div style={{ maxWidth: 320, display: "flex", flexDirection: "column", gap: 6 }}>
            <strong>Liquidity and cost</strong>
            <span>Pick a planned trade in the list to estimate spot liquidity, swap depth, momentum, TWAP cost, forward points and algo behaviour for it. All figures are illustrative.</span>
            <span className="ea-caption">Included dates: {when}</span>
          </div>
        </Popover>
      </ToolbarContext>
      <div className="ea-page">
        <PageHeader title="Liquidity and cost" left={trade ? <Chip>{`${trade.pair} · ${trade.direction === "buy" ? "Buy" : "Sell"} · ${tenorText(trade)}`}</Chip> : <span className="ea-caption">No trade selected</span>} />
        <PanelGrid id="liquiditycost" panels={panels} />
        <TradeList activeId={trade?.id ?? null} onSelect={setTrade} loading={isLoading} error={error} onRetry={retry} />
      </div>
    </>
  );
}
