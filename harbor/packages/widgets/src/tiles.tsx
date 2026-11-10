import { useEffect, useMemo, useState } from 'react'
import { useContextListener, useNow, useSession, useTrades } from '@harbor/app-kit'
import { ALL_PAIRS, pairSpec, upcomingCutOffs, type MatchStatus, type PriceTick } from '@harbor/mock-data'
import type { FxTradeContext, SettlementContext } from '@harbor/schemas'
import { PriceCell, Skeleton, Sparkline, formatAge, formatBps } from '@harbor/ui'
import type { WidgetProps } from './types.ts'

const DEFAULT_RATES = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF']
const SPARK_POINTS = 40

interface RateRow extends PriceTick {
  history: number[]
  direction: 'up' | 'down' | 'none'
}

/** Tile: up to six pairs with live mid, day change and a sparkline. Click a pair to share it on the channel. */
export function RatesTile({ client, config }: WidgetProps) {
  const session = useSession(client)
  const prices = session?.services.prices
  const pairs = useMemo(() => {
    const wanted = Array.isArray(config.pairs) ? config.pairs.filter((p): p is string => typeof p === 'string' && ALL_PAIRS.includes(p)) : []
    return (wanted.length ? wanted : DEFAULT_RATES).slice(0, 6)
  }, [config.pairs])
  const [rows, setRows] = useState<Record<string, RateRow>>({})

  useEffect(() => {
    if (!prices) return
    // Ticks land in a buffer and reach React at most once per animation frame.
    const shown: Record<string, RateRow> = {}
    const pending = new Map<string, PriceTick>(pairs.map((pair) => [pair, prices.latest(pair)]))
    let frame = 0
    const flush = () => {
      frame = 0
      for (const [pair, tick] of pending) {
        const before = shown[pair]
        shown[pair] = {
          ...tick,
          history: [...(before?.history ?? []), tick.mid].slice(-SPARK_POINTS),
          direction: !before || before.mid === tick.mid ? (before?.direction ?? 'none') : tick.mid > before.mid ? 'up' : 'down',
        }
      }
      pending.clear()
      setRows({ ...shown })
    }
    frame = requestAnimationFrame(flush)
    const off = prices.subscribe(pairs, (tick) => {
      pending.set(tick.pair, tick)
      if (!frame) frame = requestAnimationFrame(flush)
    })
    return () => {
      off()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [prices, pairs])

  if (!session) return <Skeleton lines={3} label="Loading rates" />
  return (
    <div className="hw-tile hw-tile--static" data-testid="tile-rates">
      <span className="hw-tile__label">Rates{session.connected ? '' : ' · paused (disconnected)'}</span>
      <ul className="hw-rates">
        {pairs.map((pair) => {
          const row = rows[pair]
          return (
            <li key={pair}>
              <button type="button" title={`Share ${pair} on this channel`} data-pair={pair} onClick={() => void client.broadcast({ type: 'fdc3.instrument', id: { ticker: pair }, name: pair }).catch(() => {})}>
                <span className="hw-rates__pair">{pair}</span>
                <span key={row?.seq} className="hw-rates__mid">
                  <PriceCell value={row?.mid} decimals={pairSpec(pair).decimals} flash={row?.direction} />
                </span>
                <span className="hw-rates__change">{row ? `${row.changePct > 0 ? '▲' : row.changePct < 0 ? '▼' : ''} ${Math.abs(row.changePct).toFixed(2)}%` : ''}</span>
                <Sparkline values={row?.history ?? []} />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const UNSETTLED: readonly MatchStatus[] = ['UNMATCHED', 'MISMATCHED']

/** Tile: trades not yet matched, and how long the oldest has waited. Follows fills and settlement updates on its channel. */
export function UnmatchedTradesTile({ client }: WidgetProps) {
  const session = useSession(client)
  const now = useNow(15_000)
  /** What this tile has learned from the channel since it opened: trade id -> execution time and whether it is still waiting. */
  const [updates, setUpdates] = useState<Record<string, { executedAt: string; waiting: boolean }>>({})
  const dataset = session?.services.dataset
  // The seeded history is the starting point; every app builds it identically.
  const seeded = useMemo(() => new Map(dataset?.trades.map((t) => [t.id.tradeId, { executedAt: t.executedAt, waiting: UNSETTLED.includes(t.matchStatus) }]) ?? []), [dataset])

  useContextListener(client, 'harbor.fxTrade', (context) => {
    const trade = context as FxTradeContext
    // A new fill is unmatched until Post-Trade says otherwise.
    if (!seeded.has(trade.id.tradeId)) setUpdates((u) => (trade.id.tradeId in u ? u : { ...u, [trade.id.tradeId]: { executedAt: trade.executedAt, waiting: true } }))
  })
  useContextListener(client, 'harbor.settlement', (context) => {
    const update = context as SettlementContext
    const tradeId = update.id.tradeId
    setUpdates((u) => ({ ...u, [tradeId]: { executedAt: u[tradeId]?.executedAt ?? seeded.get(tradeId)?.executedAt ?? new Date().toISOString(), waiting: UNSETTLED.includes(update.matchStatus) } }))
  })

  const waiting = dataset ? [...new Map([...seeded, ...Object.entries(updates)]).values()].filter((t) => t.waiting) : null

  if (!waiting) return <Skeleton lines={2} label="Loading trades" />
  const times = waiting.map((t) => t.executedAt).sort()
  return (
    <div className="hw-tile hw-tile--static" data-testid="tile-unmatched">
      <span className="hw-tile__label">Unmatched trades</span>
      <span className="hw-tile__value" data-testid="tile-unmatched-count">
        {times.length}
      </span>
      <span className="hw-tile__detail">{times[0] ? `Oldest waiting ${formatAge(times[0], now)}` : 'Everything is matched'}</span>
    </div>
  )
}

/** Tile: the next three fund cut-offs, with a countdown. */
export function CutOffsTile({ client }: WidgetProps) {
  const session = useSession(client)
  const now = useNow(30_000)
  if (!session) return <Skeleton lines={3} label="Loading cut-offs" />
  const next = upcomingCutOffs(session.services.dataset.moneyMarketFunds, now, 3)
  return (
    <div className="hw-tile hw-tile--static" data-testid="tile-cutoffs">
      <span className="hw-tile__label">Next cut-offs</span>
      <ul className="hw-cutoffs">
        {next.map(({ fund, at }) => {
          const minutes = Math.max(0, Math.floor((at - now) / 60_000))
          return (
            <li key={fund.id} className={minutes < 30 ? 'is-soon' : ''}>
              <strong>{minutes >= 60 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`}</strong>
              <span>
                {fund.currency} · {fund.cutOff} {fund.cutOffZone}
              </span>
              <span className="hw-cutoffs__fund">{fund.name}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Tile: today's average slippage against the 30-day average. */
export function DayCostTile({ client }: WidgetProps) {
  const session = useSession(client)
  const services = session?.services
  const trades = useTrades(services)
  const [cost, setCost] = useState<{ todayBps: number | null; todayTrades: number; thirtyDayBps: number } | null>(null)

  // Count fills made anywhere on this channel.
  useContextListener(client, 'harbor.fxTrade', (context) => void services?.trades.record({ ...(context as FxTradeContext), matchStatus: 'MATCHED' }))
  useEffect(() => {
    if (!services || !trades) return
    let live = true
    void services.tca.dayCost().then((next) => live && setCost(next))
    return () => {
      live = false
    }
  }, [services, trades])

  if (!cost) return <Skeleton lines={2} label="Loading cost" />
  const better = cost.todayBps !== null && cost.todayBps <= cost.thirtyDayBps
  return (
    <div className="hw-tile hw-tile--static" data-testid="tile-day-cost">
      <span className="hw-tile__label">Day cost</span>
      <span className="hw-tile__value" data-testid="tile-day-cost-value">
        {cost.todayBps === null ? '–' : formatBps(cost.todayBps)}
        <span className="hw-tile__unit"> bps</span>
      </span>
      <span className="hw-tile__detail">
        {cost.todayBps === null ? 'No trades yet today' : `${cost.todayTrades} ${cost.todayTrades === 1 ? 'trade' : 'trades'} today · ${better ? 'better' : 'worse'} than usual`} · 30-day average {formatBps(cost.thirtyDayBps)}
      </span>
    </div>
  )
}
