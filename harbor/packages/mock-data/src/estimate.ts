import type { FxOrderContext, PreTradeEstimateContext } from '@harbor/schemas'
import type { Dataset } from './entities.ts'
import { pairSpec } from './pairs.ts'
import { slippageBps } from './services.ts'

export interface SuggestedCounterparty {
  lpId: string
  name: string
  /** Historical share of RFQs won, 0–1. */
  hitRate: number
  /** Average slippage on this pair in the trade history, in bps. Null when there is none. */
  avgBps: number | null
}

export interface PreTradeEstimate {
  context: PreTradeEstimateContext
  /** One line on why the method is recommended. */
  reason: string
  counterparties: SuggestedCounterparty[]
}

/** Above this size (in dealt currency) an order is worked rather than shown to dealers in one go. */
export const LARGE_ORDER = 50_000_000

/**
 * A pre-trade estimate from the order and the seeded history. Pure, so two
 * apps given the same order produce the same numbers.
 */
export function estimateOrder(dataset: Dataset, order: FxOrderContext): PreTradeEstimate {
  const spec = pairSpec(order.pair)
  // Liquidity: the majors score highest, and size eats into it.
  const depth = spec.weight >= 7 ? 5 : spec.weight >= 4 ? 4 : spec.weight >= 3 ? 3 : 2
  const sizePenalty = order.amount >= 100_000_000 ? 2 : order.amount >= LARGE_ORDER ? 1 : 0
  const liquidityScore = Math.max(1, depth - sizePenalty) as 1 | 2 | 3 | 4 | 5

  const history = dataset.trades.filter((t) => t.pair === order.pair)
  const counterparties: SuggestedCounterparty[] = dataset.liquidityProviders
    .map((lp) => {
      const theirs = history.filter((t) => t.counterparty === lp.id)
      const avgBps = theirs.length ? Number((theirs.reduce((sum, t) => sum + slippageBps(t), 0) / theirs.length).toFixed(2)) : null
      return { lpId: lp.id, name: lp.name, hitRate: lp.hitRate, avgBps, spreadPips: lp.spreadPips }
    })
    // Cheapest on this pair first; LPs with no history on it rank by quoted spread, after the rest.
    .sort((a, b) => (a.avgBps ?? 50 + a.spreadPips) - (b.avgBps ?? 50 + b.spreadPips))
    .slice(0, 5)
    .map(({ spreadPips: _spreadPips, ...rest }) => rest)

  // Expected cost: half the typical spread of the suggested dealers, scaled up for size and thin liquidity.
  const suggested = dataset.liquidityProviders.filter((lp) => counterparties.some((c) => c.lpId === lp.id))
  const halfSpreadBps = (suggested.reduce((sum, lp) => sum + lp.spreadPips, 0) / suggested.length / 2) * (spec.pip / spec.referenceMid) * 10_000
  const sizeFactor = 1 + Math.log10(Math.max(1, order.amount / 10_000_000)) * 0.6
  const expectedCostBps = Number((halfSpreadBps * sizeFactor * (1 + (5 - liquidityScore) * 0.25)).toFixed(2))

  const recommendedMethod = order.amount >= LARGE_ORDER || liquidityScore <= 2 ? 'ALGO' : 'RFQ'
  const reason =
    recommendedMethod === 'ALGO'
      ? order.amount >= LARGE_ORDER
        ? 'Large for this pair: working it over time should reduce market impact.'
        : 'Liquidity is thin in this pair: an algo avoids showing the full size at once.'
      : 'Size is within normal dealer appetite: competing quotes should be tight.'

  return {
    context: {
      type: 'harbor.preTradeEstimate',
      id: { orderId: order.id.orderId },
      expectedCostBps,
      recommendedMethod,
      suggestedCounterparties: counterparties.map((c) => c.lpId),
      liquidityScore,
    },
    reason,
    counterparties,
  }
}
