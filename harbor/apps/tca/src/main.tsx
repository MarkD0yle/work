import { useCallback, useEffect, useMemo, useState } from 'react'
import { mountApp, useApp, useContextListener, useIntentListener, useTrades } from '@harbor/app-kit'
import { ALL_PAIRS, formatRate, type CostBucket, type TcaFilter, type Trade } from '@harbor/mock-data'
import type { Context, FxTradeContext } from '@harbor/schemas'
import { AmountCell, Badge, Button, Select, SideLabel, Skeleton, formatBps } from '@harbor/ui'
import '@harbor/tokens/tokens.css'
import '@harbor/ui/ui.css'
import '@harbor/app-kit/app-kit.css'
import './app.css'
import { Chart } from './Chart.tsx'

interface View {
  series: { tradeId: string; executedAt: string; bps: number; pair: string }[]
  byCounterparty: CostBucket[]
  byMethod: CostBucket[]
  byHour: CostBucket[]
  worst: { trade: Trade; bps: number }[]
}

/* TCA: the MEASURE leg. It closes the loop: a fill made in FX Execution shows up here without anyone entering it. */
function Tca() {
  const { client, services } = useApp()
  const trades = useTrades(services)
  const [filter, setFilter] = useState<TcaFilter>({})
  const [view, setView] = useState<View | null>(null)
  const [latest, setLatest] = useState<string | null>(null)
  const [counterparty, setCounterparty] = useState<string | null>(null)
  const lpName = useCallback((id: string) => services.dataset.liquidityProviders.find((lp) => lp.id === id)?.name ?? id, [services])

  const take = useCallback(
    async (context: FxTradeContext) => {
      // Matching is Post-Trade's business; here the trade only needs to be counted.
      await services.trades.record({ ...context, matchStatus: 'MATCHED' })
      setLatest(context.id.tradeId)
    },
    [services],
  )
  const focusPair = (context: Context) => {
    const ticker = (context.id as { ticker?: unknown } | undefined)?.ticker
    if (typeof ticker === 'string' && ALL_PAIRS.includes(ticker)) setFilter((f) => ({ ...f, pair: ticker }))
  }
  useContextListener(client, 'harbor.fxTrade', (context) => void take(context as FxTradeContext))
  useContextListener(client, 'fdc3.instrument', focusPair)
  useContextListener(client, 'fdc3.timeRange', (context) => {
    const range = context as { startTime?: string; endTime?: string }
    setFilter((f) => ({ ...f, from: range.startTime, to: range.endTime }))
  })
  useIntentListener(client, 'ViewAnalysis', (context) => {
    if (context.type === 'harbor.fxTrade') {
      const trade = context as FxTradeContext
      void take(trade).then(() => setFilter({ pair: trade.pair }))
    } else focusPair(context)
  })

  useEffect(() => {
    if (!trades) return
    let live = true
    const { tca } = services
    void Promise.all([tca.series(filter), tca.byCounterparty(filter), tca.byMethod(filter), tca.byHour(filter), tca.worst(10, filter)]).then(([series, byCounterparty, byMethod, byHour, worst]) => {
      if (live) setView({ series, byCounterparty, byMethod, byHour, worst })
    })
    return () => {
      live = false
    }
  }, [services, trades, filter])

  const seriesX = useMemo(() => view?.series.map((s) => Date.parse(s.executedAt) / 1000) ?? [], [view])
  const seriesY = useMemo(() => view?.series.map((s) => s.bps) ?? [], [view])
  const chart = (buckets: CostBucket[], name: (key: string) => string = (k) => k) => ({ x: buckets.map((b) => name(b.key)), y: buckets.map((b) => b.avgBps) })
  const byCounterparty = useMemo(() => chart(view?.byCounterparty ?? [], (id) => id.replace('LP-', '')), [view])
  const byMethod = useMemo(() => chart(view?.byMethod ?? []), [view])
  const byHour = useMemo(() => chart(view?.byHour ?? [], (h) => `${h}h`), [view])

  if (!trades || !view) return <Skeleton label="Loading analysis" />

  const latestIndex = latest ? view.series.findIndex((s) => s.tradeId === latest) : -1
  const latestPoint = latestIndex >= 0 ? view.series[latestIndex] : undefined
  const average = view.series.length ? view.series.reduce((sum, s) => sum + s.bps, 0) / view.series.length : 0
  const selectCounterparty = (lpId: string) => {
    setCounterparty(lpId)
    void client.broadcast({ type: 'fdc3.organization', id: { LP_ID: lpId }, name: lpName(lpId) }).catch(() => {})
  }
  const filtered = Boolean(filter.pair || filter.from || filter.to)

  return (
    <div className="ha-app" data-testid="tca">
      <div className="ha-toolbar">
        <h1 className="ha-toolbar__title">TCA</h1>
        <Select
          label="Pair"
          hideLabel
          value={filter.pair ?? 'ALL'}
          onChange={(e) => setFilter((f) => ({ ...f, pair: e.target.value === 'ALL' ? undefined : e.target.value }))}
          options={[{ value: 'ALL', label: 'All pairs' }, ...ALL_PAIRS.map((p) => ({ value: p, label: p }))]}
        />
        {(filter.from || filter.to) && (
          <Badge>
            {filter.from?.slice(0, 10) ?? 'start'} to {filter.to?.slice(0, 10) ?? 'now'}
          </Badge>
        )}
        {filtered && (
          <Button variant="ghost" onClick={() => setFilter({})}>
            Clear filters
          </Button>
        )}
        <span className="ha-toolbar__spacer" />
        <span className="ha-muted">Positive bps is a cost against arrival mid</span>
      </div>

      <div className="ha-scroll" role="region" aria-label="TCA content" tabIndex={0}>
        <div className="tc-grid">
        <section className="tc-card tc-card--wide" aria-labelledby="tc-slippage">
          <h2 id="tc-slippage">Slippage vs arrival</h2>
          <p className="tc-summary" data-testid="slippage-summary">
            <span data-testid="slippage-count">{view.series.length}</span> trades · average {formatBps(average)} bps
            {latestPoint && (
              <>
                {' '}
                · latest <strong data-testid="slippage-latest">{latestPoint.tradeId}</strong> {formatBps(latestPoint.bps)} bps
              </>
            )}
          </p>
          <Chart kind="points" label={`Slippage against arrival for ${view.series.length} trades over time, in basis points`} x={seriesX} y={seriesY} highlight={latestIndex >= 0 ? latestIndex : undefined} height={200} />
        </section>

        <section className="tc-card" aria-labelledby="tc-cp">
          <h2 id="tc-cp">Cost by counterparty</h2>
          <Chart kind="bars" label="Average cost by counterparty, in basis points" x={byCounterparty.x} y={byCounterparty.y} highlight={counterparty ? view.byCounterparty.findIndex((b) => b.key === counterparty) : undefined} />
          <table className="ha-table" data-testid="tca-counterparties">
            <thead>
              <tr>
                <th scope="col">Counterparty</th>
                <th scope="col" className="ha-num">Trades</th>
                <th scope="col" className="ha-num">Avg bps</th>
              </tr>
            </thead>
            <tbody>
              {view.byCounterparty.map((b) => (
                <tr key={b.key} className={b.key === counterparty ? 'is-selected' : ''}>
                  <th scope="row">
                    <button type="button" className="tc-link" aria-pressed={b.key === counterparty} onClick={() => selectCounterparty(b.key)}>
                      {lpName(b.key)}
                    </button>
                  </th>
                  <td className="ha-num">{b.trades}</td>
                  <td className="ha-num">{formatBps(b.avgBps)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="tc-column">
          <section className="tc-card" aria-labelledby="tc-method">
            <h2 id="tc-method">Cost by method</h2>
            <Chart kind="bars" label="Average cost by execution method, in basis points" x={byMethod.x} y={byMethod.y} height={150} />
          </section>
          <section className="tc-card" aria-labelledby="tc-hour">
            <h2 id="tc-hour">Cost by time of day (UTC)</h2>
            <Chart kind="bars" label="Average cost by hour of day, in basis points" x={byHour.x} y={byHour.y} height={150} />
          </section>
        </div>

        <section className="tc-card tc-card--wide" aria-labelledby="tc-worst">
          <h2 id="tc-worst">Worst ten trades</h2>
          <div className="tc-table-scroll" role="region" aria-label="Worst ten trades table" tabIndex={0}>
          <table className="ha-table" data-testid="tca-worst">
            <thead>
              <tr>
                <th scope="col">Trade</th>
                <th scope="col">Executed</th>
                <th scope="col">Pair</th>
                <th scope="col">Side</th>
                <th scope="col" className="ha-num">Amount</th>
                <th scope="col" className="ha-num">Rate</th>
                <th scope="col" className="ha-num">Arrival mid</th>
                <th scope="col">Counterparty</th>
                <th scope="col">Method</th>
                <th scope="col" className="ha-num">Slippage (bps)</th>
              </tr>
            </thead>
            <tbody>
              {view.worst.map(({ trade, bps }) => (
                <tr key={trade.id.tradeId} className={trade.id.tradeId === latest ? 'is-selected' : ''}>
                  <th scope="row">{trade.id.tradeId}</th>
                  <td>{trade.executedAt.slice(0, 16).replace('T', ' ')}</td>
                  <td>{trade.pair}</td>
                  <td><SideLabel side={trade.side} /></td>
                  <td className="ha-num"><AmountCell value={trade.amount} /></td>
                  <td className="ha-num">{formatRate(trade.pair, trade.rate)}</td>
                  <td className="ha-num">{formatRate(trade.pair, trade.arrivalMid)}</td>
                  <td>{lpName(trade.counterparty)}</td>
                  <td>{trade.method}</td>
                  <td className="ha-num">{formatBps(bps)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
        </div>
      </div>
    </div>
  )
}

mountApp(<Tca />)
