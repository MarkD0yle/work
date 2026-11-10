import { useEffect, useMemo, useState } from 'react'
import { ALL_PAIRS, COUNTS, createDataset, createPriceStream, rateParts, seedFromSearch, type PriceTick } from '@harbor/mock-data'
import { Badge } from '@harbor/ui'
import type { WidgetProps } from './types.ts'

type Row = PriceTick & { direction: 'up' | 'down' | 'none' }

/** A rate with the pip digits larger, as traders read it. */
export function Rate({ pair, value }: { pair: string; value: number }) {
  const parts = rateParts(pair, value)
  return (
    <span className="hw-rate">
      {parts.big}
      <span className="hw-rate__pips">{parts.pips}</span>
      {parts.fraction}
    </span>
  )
}

/**
 * Developer tool for the mock data layer: shows the seed, the dataset
 * fingerprint and entity counts, and the live price stream with the best LP
 * quote per pair. Reload with the same `?seed=` and everything here matches.
 */
export function MockDataInspector(_props: WidgetProps) {
  const seed = useMemo(() => seedFromSearch(window.location.search), [])
  const dataset = useMemo(() => createDataset(seed), [seed])
  const stream = useMemo(() => createPriceStream({ seed, liquidityProviders: dataset.liquidityProviders }), [seed, dataset])
  const [ticks, setTicks] = useState<Record<string, Row>>({})

  useEffect(() => {
    // Ticks land in a buffer and reach React at most once per animation frame.
    const buffer: Record<string, PriceTick> = Object.fromEntries(ALL_PAIRS.map((pair) => [pair, stream.latest(pair)]))
    const shown: Record<string, Row> = {}
    let frame = 0
    let dirty = true
    const flush = () => {
      frame = 0
      if (!dirty) return
      dirty = false
      for (const pair of ALL_PAIRS) {
        const tick = buffer[pair]
        const before = shown[pair]
        if (!tick) continue
        const direction = !before || before.mid === tick.mid ? (before?.direction ?? 'none') : tick.mid > before.mid ? 'up' : 'down'
        shown[pair] = { ...tick, direction }
      }
      setTicks({ ...shown })
    }
    frame = requestAnimationFrame(flush)
    const unsubscribe = stream.subscribe(ALL_PAIRS, (tick) => {
      buffer[tick.pair] = tick
      dirty = true
      if (!frame) frame = requestAnimationFrame(flush)
    })
    return () => {
      unsubscribe()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [stream])

  const counts: [string, number, number][] = [
    ['Funds', dataset.funds.length, COUNTS.funds],
    ['Open orders', dataset.orders.length, COUNTS.orders],
    ['Historical trades', dataset.trades.length, COUNTS.trades],
    ['Liquidity providers', dataset.liquidityProviders.length, COUNTS.liquidityProviders],
    ['Money-market funds', dataset.moneyMarketFunds.length, COUNTS.moneyMarketFunds],
    ['Beneficiaries', dataset.beneficiaries.length, COUNTS.beneficiaries],
    ['Research notes', dataset.researchNotes.length, COUNTS.researchNotes],
  ]

  return (
    <div className="hw-mock">
      <header className="hw-mock__header">
        <strong>Mock Data</strong>
        <span>
          seed <Badge tone="accent"><span data-testid="mock-seed">{seed}</span></Badge>
        </span>
        <span>
          as of <span data-testid="mock-asof">{dataset.asOf}</span>
        </span>
        <span>
          fingerprint <code data-testid="mock-fingerprint">{dataset.fingerprint}</code>
        </span>
      </header>
      <p className="hw-mock__note">Same seed and date always give this exact data. Change it with <code>?seed=</code> in the address bar.</p>

      <div className="hw-mock__columns">
        <table className="hw-table" data-testid="mock-counts">
          <caption>Seeded entities</caption>
          <tbody>
            {counts.map(([label, actual]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td className="hw-num">{actual}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">First order</th>
              <td data-testid="mock-first-order">
                {dataset.orders[0]?.id.orderId} {dataset.orders[0]?.side} {((dataset.orders[0]?.amount ?? 0) / 1e6).toLocaleString('en-US')}m {dataset.orders[0]?.pair}
              </td>
            </tr>
          </tbody>
        </table>

        <table className="hw-table" data-testid="mock-prices">
          <caption>Live prices (best of {dataset.liquidityProviders.length} LPs)</caption>
          <thead>
            <tr>
              <th scope="col">Pair</th>
              <th scope="col" className="hw-num">Best bid</th>
              <th scope="col" className="hw-num">Mid</th>
              <th scope="col" className="hw-num">Best offer</th>
              <th scope="col" className="hw-num">Day %</th>
              <th scope="col" className="hw-num">Tick</th>
            </tr>
          </thead>
          <tbody>
            {ALL_PAIRS.map((pair) => {
              const tick = ticks[pair]
              if (!tick) return null
              const quotes = stream.quotes(pair)
              const bid = Math.max(...quotes.map((q) => q.bid))
              const offer = Math.min(...quotes.map((q) => q.offer))
              return (
                <tr key={pair} data-pair={pair}>
                  <th scope="row">{pair}</th>
                  <td className="hw-num"><Rate pair={pair} value={bid} /></td>
                  {/* Keyed by tick so the flash animation restarts on every move. */}
                  <td key={tick.seq} className={`hw-num hw-flash-${tick.direction}`} data-testid={`mid-${pair}`}><Rate pair={pair} value={tick.mid} /></td>
                  <td className="hw-num"><Rate pair={pair} value={offer} /></td>
                  <td className="hw-num">
                    {tick.changePct > 0 ? '▲' : tick.changePct < 0 ? '▼' : ''} {Math.abs(tick.changePct).toFixed(3)}
                  </td>
                  <td className="hw-num hw-muted">{tick.seq}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
