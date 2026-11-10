import type { FxOrderContext, Side } from '@harbor/schemas'
import { createDataset, type Dataset, type LiquidityProvider, type MatchStatus, type Order, type Trade } from './entities.ts'
import { roundRate, valueDate } from './pairs.ts'
import { createPriceStream, quoteFor, type PriceStream } from './prices.ts'
import { createRng, type Rng } from './rng.ts'
import { realScheduler, type Scheduler } from './scheduler.ts'

/* The five service interfaces from SPEC section 11. Apps code against these;
 * the mock implementations below can be swapped for a real backend or another
 * mock source without touching an app. Everything is async for that reason. */

type Unsubscribe = () => void

export interface OrderService {
  list(): Promise<Order[]>
  get(orderId: string): Promise<Order | undefined>
  setStatus(orderId: string, status: FxOrderContext['status']): Promise<Order>
  subscribe(listener: (orders: Order[]) => void): Unsubscribe
}

export type QuoteStatus = 'PENDING' | 'QUOTED' | 'DECLINED' | 'EXPIRED'
export interface RfqQuote {
  lpId: string
  status: QuoteStatus
  bid?: number
  offer?: number
  /** Epoch ms after which the quote can no longer be accepted. */
  expiresAt?: number
}
export interface RfqRequest {
  orderId: string
  pair: string
  lpIds: readonly string[]
}
export interface RfqHandle {
  /** Current state of every requested LP. */
  quotes(): RfqQuote[]
  cancel(): void
}
export interface QuoteService {
  /** Send an RFQ. `onUpdate` fires whenever any LP's quote changes. */
  requestQuotes(request: RfqRequest, onUpdate: (quotes: RfqQuote[]) => void): RfqHandle
}

export interface ExecuteRequest {
  order: FxOrderContext
  lpId: string
  rate: number
  method: Trade['method']
  /** Mid when the order reached the desk; defaults to the order's own arrival mid. */
  arrivalMid?: number
}
export interface TradeService {
  list(): Promise<Trade[]>
  get(tradeId: string): Promise<Trade | undefined>
  /** Book a fill: creates the trade, marks the order FILLED and starts matching. */
  execute(request: ExecuteRequest): Promise<Trade>
  /** Record a trade that was executed elsewhere (e.g. received over a channel). */
  record(trade: Trade): Promise<void>
  subscribe(listener: (trades: Trade[]) => void): Unsubscribe
}

export interface MismatchDetail {
  tradeId: string
  /** Field-by-field view of both sides. `differs` marks the breaking field. */
  fields: { field: string; ours: string; theirs: string; differs: boolean }[]
  escalated: boolean
}
export interface ActivityEntry {
  at: string
  tradeId: string
  action: 'ACCEPT_THEIRS' | 'RESEND' | 'ESCALATE' | 'AUTO_MATCH' | 'AUTO_MISMATCH' | 'FORCED_MISMATCH'
  userId: string
  before: MatchStatus
  after: MatchStatus
}
export interface SettlementEvent {
  tradeId: string
  status: MatchStatus
  exceptionReason?: string
}
export interface SettlementService {
  status(tradeId: string): Promise<MatchStatus | undefined>
  exceptions(): Promise<MismatchDetail[]>
  acceptTheirs(tradeId: string, userId: string): Promise<void>
  resend(tradeId: string, userId: string): Promise<void>
  escalate(tradeId: string, userId: string): Promise<void>
  /** Dev panel: turn a trade into a mismatch on demand. */
  forceMismatch(tradeId: string): Promise<void>
  activity(): Promise<ActivityEntry[]>
  subscribe(listener: (event: SettlementEvent) => void): Unsubscribe
}

export interface CostBucket {
  key: string
  trades: number
  /** Notional-weighted average slippage against arrival, in bps. Positive = cost. */
  avgBps: number
}
export interface TcaFilter {
  pair?: string
  /** Inclusive ISO timestamps. */
  from?: string
  to?: string
}
export interface TcaService {
  slippageBps(trade: Pick<Trade, 'side' | 'rate' | 'arrivalMid'>): number
  series(filter?: TcaFilter): Promise<{ tradeId: string; executedAt: string; bps: number; pair: string }[]>
  byCounterparty(filter?: TcaFilter): Promise<CostBucket[]>
  byMethod(filter?: TcaFilter): Promise<CostBucket[]>
  byHour(filter?: TcaFilter): Promise<CostBucket[]>
  worst(count: number, filter?: TcaFilter): Promise<{ trade: Trade; bps: number }[]>
  /** Today's average slippage against the previous 30 days. */
  dayCost(): Promise<{ todayBps: number | null; todayTrades: number; thirtyDayBps: number }>
}

export const RFQ_REPLY_MIN_MS = 200
export const RFQ_REPLY_MAX_MS = 1500
export const QUOTE_LIFETIME_MS = 10_000
export const MATCH_MIN_MS = 3000
export const MATCH_MAX_MS = 8000
export const MISMATCH_RATE = 1 / 6

/** Slippage against arrival in bps. Paying above mid on a buy, or receiving below it on a sell, is a cost. */
export function slippageBps(trade: Pick<Trade, 'side' | 'rate' | 'arrivalMid'>): number {
  const sign: Record<Side, number> = { BUY: 1, SELL: -1 }
  return Number(((sign[trade.side] * (trade.rate - trade.arrivalMid)) / trade.arrivalMid * 10_000).toFixed(2))
}

export interface MockServices {
  dataset: Dataset
  prices: PriceStream
  orders: OrderService
  quotes: QuoteService
  trades: TradeService
  settlement: SettlementService
  tca: TcaService
  /** Stop every timer (panel close). */
  dispose(): void
}

export function createMockServices(options: { seed: string; asOf?: Date; scheduler?: Scheduler } ): MockServices {
  const scheduler = options.scheduler ?? realScheduler
  const dataset = createDataset(options.seed, options.asOf ?? new Date(scheduler.now()))
  const prices = createPriceStream({ seed: options.seed, liquidityProviders: dataset.liquidityProviders, scheduler })
  const rng = createRng(`${options.seed}/services`)
  const timers = new Set<unknown>()
  const later = (delayMs: number, work: () => void) => {
    const handle = scheduler.setTimeout(() => {
      timers.delete(handle)
      work()
    }, delayMs)
    timers.add(handle)
    return handle
  }
  const cancel = (handle: unknown) => {
    scheduler.clearTimeout(handle)
    timers.delete(handle)
  }

  /* ---------- orders ---------- */
  const orderList = dataset.orders.map((o) => ({ ...o }))
  const orderListeners = new Set<(orders: Order[]) => void>()
  const orders: OrderService = {
    list: async () => orderList.map((o) => ({ ...o })),
    get: async (orderId) => {
      const found = orderList.find((o) => o.id.orderId === orderId)
      return found && { ...found }
    },
    setStatus: async (orderId, status) => {
      const found = orderList.find((o) => o.id.orderId === orderId)
      if (!found) throw new Error(`Unknown order ${orderId}`)
      found.status = status
      for (const l of [...orderListeners]) l(orderList.map((o) => ({ ...o })))
      return { ...found }
    },
    subscribe: (listener) => {
      orderListeners.add(listener)
      return () => void orderListeners.delete(listener)
    },
  }

  /* ---------- quotes (RFQ) ---------- */
  let rfqCount = 0
  const quotes: QuoteService = {
    requestQuotes: (request, onUpdate) => {
      // Each RFQ has its own stream, so its outcome does not depend on what else ran first.
      const local: Rng = rng.fork(`rfq/${request.orderId}/${++rfqCount}`)
      const lps = request.lpIds.map((id) => dataset.liquidityProviders.find((lp) => lp.id === id)).filter((lp): lp is LiquidityProvider => lp !== undefined)
      const state = new Map<string, RfqQuote>(lps.map((lp) => [lp.id, { lpId: lp.id, status: 'PENDING' }]))
      const handles: unknown[] = []
      let live = true
      const emit = () => live && onUpdate([...state.values()].map((q) => ({ ...q })))
      const requote = () => {
        const { mid } = prices.latest(request.pair)
        for (const lp of lps) {
          const q = state.get(lp.id)
          if (q?.status === 'QUOTED') state.set(lp.id, { ...q, ...quoteFor(request.pair, mid, lp) })
        }
      }
      // Live quotes stream with the market until they expire.
      const unsubscribe = prices.subscribe([request.pair], () => {
        requote()
        emit()
      })
      for (const lp of lps) {
        const replyIn = local.int(RFQ_REPLY_MIN_MS, RFQ_REPLY_MAX_MS)
        const declines = local.chance(lp.declineRate)
        handles.push(
          later(replyIn, () => {
            if (declines) {
              state.set(lp.id, { lpId: lp.id, status: 'DECLINED' })
            } else {
              const expiresAt = scheduler.now() + QUOTE_LIFETIME_MS
              state.set(lp.id, { ...quoteFor(request.pair, prices.latest(request.pair).mid, lp), status: 'QUOTED', expiresAt })
              handles.push(
                later(QUOTE_LIFETIME_MS, () => {
                  state.set(lp.id, { lpId: lp.id, status: 'EXPIRED' })
                  emit()
                }),
              )
            }
            emit()
          }),
        )
      }
      return {
        quotes: () => [...state.values()].map((q) => ({ ...q })),
        cancel: () => {
          live = false
          unsubscribe()
          for (const h of handles) cancel(h)
        },
      }
    },
  }

  /* ---------- trades and settlement ---------- */
  const tradeList = dataset.trades.map((t) => ({ ...t }))
  const tradeListeners = new Set<(trades: Trade[]) => void>()
  const settlementListeners = new Set<(event: SettlementEvent) => void>()
  const mismatches = new Map<string, MismatchDetail>()
  const activityLog: ActivityEntry[] = []
  let tradeSeq = tradeList.length
  const findTrade = (tradeId: string) => {
    const found = tradeList.find((t) => t.id.tradeId === tradeId)
    if (!found) throw new Error(`Unknown trade ${tradeId}`)
    return found
  }
  const notifyTrades = () => {
    for (const l of [...tradeListeners]) l(tradeList.map((t) => ({ ...t })))
  }

  /** What the counterparty's record says: ours, with one field broken. */
  function describeMismatch(trade: Trade, reason: string | undefined, local: Rng): MismatchDetail {
    const ours = { rate: String(trade.rate), amount: trade.amount.toLocaleString('en-US'), valueDate: trade.valueDate, counterparty: trade.counterparty }
    const theirs = { ...ours }
    const broken = reason?.startsWith('Amount') ? 'amount' : reason?.startsWith('Value') ? 'valueDate' : reason?.startsWith('Unknown') ? 'counterparty' : 'rate'
    if (broken === 'rate') theirs.rate = String(roundRate(trade.pair, trade.rate * (1 + local.pick([-1, 1]) * 0.0003)))
    else if (broken === 'amount') theirs.amount = (trade.amount + local.pick([-1, 1]) * 1_000_000).toLocaleString('en-US')
    else if (broken === 'valueDate') theirs.valueDate = valueDate(trade.pair, new Date(`${trade.valueDate}T00:00:00Z`), 'TOM')
    else theirs.counterparty = `${trade.counterparty}-X`
    return {
      tradeId: trade.id.tradeId,
      escalated: false,
      fields: (Object.keys(ours) as (keyof typeof ours)[]).map((field) => ({ field, ours: ours[field], theirs: theirs[field], differs: ours[field] !== theirs[field] })),
    }
  }

  function setMatchStatus(trade: Trade, after: MatchStatus, action: ActivityEntry['action'], userId: string, reason?: string) {
    const before = trade.matchStatus
    trade.matchStatus = after
    if (reason) trade.exceptionReason = reason
    else delete trade.exceptionReason
    if (after !== 'MISMATCHED' && after !== 'FAILED') mismatches.delete(trade.id.tradeId)
    // Append-only: who, when, before and after.
    activityLog.push({ at: new Date(scheduler.now()).toISOString(), tradeId: trade.id.tradeId, action, userId, before, after })
    for (const l of [...settlementListeners]) l({ tradeId: trade.id.tradeId, status: after, ...(reason ? { exceptionReason: reason } : {}) })
    notifyTrades()
  }

  const REASONS = ['Rate differs', 'Amount differs', 'Value date differs'] as const
  function breakTrade(trade: Trade, action: ActivityEntry['action'], local: Rng) {
    const reason = local.pick(REASONS)
    mismatches.set(trade.id.tradeId, describeMismatch(trade, reason, local))
    setMatchStatus(trade, 'MISMATCHED', action, 'system', reason)
  }

  /** A new trade is UNMATCHED, then MATCHED after 3–8s; one in six becomes MISMATCHED instead. */
  function startMatching(trade: Trade, allowMismatch: boolean) {
    const local = rng.fork(`match/${trade.id.tradeId}/${activityLog.length}`)
    const willBreak = allowMismatch && local.chance(MISMATCH_RATE)
    later(local.int(MATCH_MIN_MS, MATCH_MAX_MS), () => {
      if (trade.matchStatus !== 'UNMATCHED') return
      if (willBreak) breakTrade(trade, 'AUTO_MISMATCH', local)
      else setMatchStatus(trade, 'MATCHED', 'AUTO_MATCH', 'system')
    })
  }

  // The seeded exception queue gets its field-by-field detail up front.
  for (const t of tradeList) {
    if (t.matchStatus === 'MISMATCHED') mismatches.set(t.id.tradeId, describeMismatch(t, t.exceptionReason, rng.fork(`seeded/${t.id.tradeId}`)))
  }

  const trades: TradeService = {
    list: async () => tradeList.map((t) => ({ ...t })),
    get: async (tradeId) => {
      const found = tradeList.find((t) => t.id.tradeId === tradeId)
      return found && { ...found }
    },
    execute: async ({ order, lpId, rate, method, arrivalMid }) => {
      const known = orderList.find((o) => o.id.orderId === order.id.orderId)
      const trade: Trade = {
        type: 'harbor.fxTrade',
        id: { tradeId: `T-${String(++tradeSeq).padStart(6, '0')}`, orderId: order.id.orderId },
        pair: order.pair,
        side: order.side,
        amount: order.amount,
        rate: roundRate(order.pair, rate),
        counterparty: lpId,
        method,
        executedAt: new Date(scheduler.now()).toISOString(),
        valueDate: order.valueDate,
        account: order.account,
        arrivalMid: arrivalMid ?? known?.arrivalMid ?? prices.latest(order.pair).mid,
        matchStatus: 'UNMATCHED',
      }
      tradeList.push(trade)
      if (known) await orders.setStatus(known.id.orderId, 'FILLED')
      notifyTrades()
      startMatching(trade, true)
      return { ...trade }
    },
    record: async (trade) => {
      if (tradeList.some((t) => t.id.tradeId === trade.id.tradeId)) return
      const copy = { ...trade }
      tradeList.push(copy)
      notifyTrades()
      if (copy.matchStatus === 'UNMATCHED') startMatching(copy, true)
    },
    subscribe: (listener) => {
      tradeListeners.add(listener)
      return () => void tradeListeners.delete(listener)
    },
  }

  const requireException = (tradeId: string) => {
    const trade = findTrade(tradeId)
    if (trade.matchStatus !== 'MISMATCHED' && trade.matchStatus !== 'FAILED') throw new Error(`Trade ${tradeId} is not an exception`)
    return trade
  }
  const settlement: SettlementService = {
    status: async (tradeId) => tradeList.find((t) => t.id.tradeId === tradeId)?.matchStatus,
    exceptions: async () => [...mismatches.values()].map((m) => ({ ...m, fields: m.fields.map((f) => ({ ...f })) })),
    acceptTheirs: async (tradeId, userId) => setMatchStatus(requireException(tradeId), 'MATCHED', 'ACCEPT_THEIRS', userId),
    resend: async (tradeId, userId) => {
      const trade = requireException(tradeId)
      setMatchStatus(trade, 'UNMATCHED', 'RESEND', userId)
      // A corrected resend always matches.
      startMatching(trade, false)
    },
    escalate: async (tradeId, userId) => {
      const trade = requireException(tradeId)
      const detail = mismatches.get(tradeId)
      if (detail) detail.escalated = true
      activityLog.push({ at: new Date(scheduler.now()).toISOString(), tradeId, action: 'ESCALATE', userId, before: trade.matchStatus, after: trade.matchStatus })
    },
    forceMismatch: async (tradeId) => {
      const trade = findTrade(tradeId)
      breakTrade(trade, 'FORCED_MISMATCH', rng.fork(`forced/${tradeId}/${activityLog.length}`))
    },
    activity: async () => activityLog.map((a) => ({ ...a })),
    subscribe: (listener) => {
      settlementListeners.add(listener)
      return () => void settlementListeners.delete(listener)
    },
  }

  /* ---------- TCA ---------- */
  const select = (filter: TcaFilter = {}) =>
    tradeList.filter((t) => (!filter.pair || t.pair === filter.pair) && (!filter.from || t.executedAt >= filter.from) && (!filter.to || t.executedAt <= filter.to))
  const weighted = (items: Trade[]): number => {
    const notional = items.reduce((sum, t) => sum + t.amount, 0)
    return notional === 0 ? 0 : Number((items.reduce((sum, t) => sum + slippageBps(t) * t.amount, 0) / notional).toFixed(2))
  }
  const bucket = (items: Trade[], keyOf: (t: Trade) => string): CostBucket[] => {
    const groups = new Map<string, Trade[]>()
    for (const t of items) groups.set(keyOf(t), [...(groups.get(keyOf(t)) ?? []), t])
    return [...groups].map(([key, group]) => ({ key, trades: group.length, avgBps: weighted(group) })).sort((a, b) => a.key.localeCompare(b.key))
  }
  const tca: TcaService = {
    slippageBps,
    series: async (filter) => select(filter).map((t) => ({ tradeId: t.id.tradeId, executedAt: t.executedAt, bps: slippageBps(t), pair: t.pair })).sort((a, b) => a.executedAt.localeCompare(b.executedAt)),
    byCounterparty: async (filter) => bucket(select(filter), (t) => t.counterparty),
    byMethod: async (filter) => bucket(select(filter), (t) => t.method),
    byHour: async (filter) => bucket(select(filter), (t) => t.executedAt.slice(11, 13)),
    worst: async (count, filter) =>
      select(filter)
        .map((trade) => ({ trade: { ...trade }, bps: slippageBps(trade) }))
        .sort((a, b) => b.bps - a.bps)
        .slice(0, count),
    dayCost: async () => {
      const today = new Date(scheduler.now()).toISOString().slice(0, 10)
      const from = new Date(scheduler.now() - 30 * 86_400_000).toISOString().slice(0, 10)
      const todays = tradeList.filter((t) => t.executedAt.slice(0, 10) === today)
      const window = tradeList.filter((t) => t.executedAt.slice(0, 10) >= from && t.executedAt.slice(0, 10) < today)
      return { todayBps: todays.length ? weighted(todays) : null, todayTrades: todays.length, thirtyDayBps: weighted(window) }
    },
  }

  return {
    dataset,
    prices,
    orders,
    quotes,
    trades,
    settlement,
    tca,
    dispose: () => {
      for (const handle of timers) scheduler.clearTimeout(handle)
      timers.clear()
      prices.stop()
      orderListeners.clear()
      tradeListeners.clear()
      settlementListeners.clear()
    },
  }
}
