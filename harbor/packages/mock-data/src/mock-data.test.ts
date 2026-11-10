import { describe, expect, it } from 'vitest'
import { FxOrderContextSchema, FxTradeContextSchema, PreTradeEstimateContextSchema } from '@harbor/schemas'
import {
  ALL_PAIRS,
  COUNTS,
  DEFAULT_SEED,
  MATCH_MAX_MS,
  MATCH_MIN_MS,
  PAIRS,
  PriceEngine,
  QUOTE_LIFETIME_MS,
  RFQ_REPLY_MAX_MS,
  RFQ_REPLY_MIN_MS,
  TICK_MAX_MS,
  TICK_MIN_MS,
  addBusinessDays,
  createDataset,
  createMockServices,
  createPriceStream,
  createRng,
  estimateOrder,
  LARGE_ORDER,
  formatRate,
  hashString,
  nextBusinessDay,
  pairSpec,
  quoteFor,
  rateParts,
  realScheduler,
  seedFromSearch,
  slippageBps,
  toIsoDate,
  valueDate,
  type PriceTick,
  type RfqQuote,
  type SettlementEvent,
} from './index.ts'
import { AS_OF, T0, fakeScheduler } from './testkit.ts'

const d = (iso: string) => new Date(`${iso}T00:00:00Z`)

describe('rng', () => {
  it('gives the same sequence for the same seed and a different one otherwise', () => {
    const a = createRng('s')
    const b = createRng('s')
    const c = createRng('t')
    const seqA = Array.from({ length: 50 }, () => a.float())
    expect(Array.from({ length: 50 }, () => b.float())).toEqual(seqA)
    expect(Array.from({ length: 50 }, () => c.float())).not.toEqual(seqA)
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true)
  })

  it('forks are independent of how much the parent has been used', () => {
    const fresh = createRng('s').fork('x').float()
    const used = createRng('s')
    for (let i = 0; i < 100; i++) used.float()
    expect(used.fork('x').float()).toBe(fresh)
    expect(createRng('s').fork('y').float()).not.toBe(fresh)
  })

  it('stays inside its bounds and is roughly fair', () => {
    const rng = createRng('bounds')
    const ints = Array.from({ length: 2000 }, () => rng.int(3, 7))
    expect(Math.min(...ints)).toBe(3)
    expect(Math.max(...ints)).toBe(7)
    const ranged = Array.from({ length: 500 }, () => rng.range(-2, 2))
    expect(ranged.every((v) => v >= -2 && v < 2)).toBe(true)
    const hits = Array.from({ length: 6000 }, () => rng.chance(1 / 6)).filter(Boolean).length
    expect(hits).toBeGreaterThan(850)
    expect(hits).toBeLessThan(1150)
    const g = Array.from({ length: 4000 }, () => rng.gauss())
    expect(Math.abs(g.reduce((a, b) => a + b, 0) / g.length)).toBeLessThan(0.1)
    expect(rng.pick(['only'])).toBe('only')
    expect(() => rng.pick([])).toThrow()
  })

  it('reads the seed from the query string', () => {
    expect(seedFromSearch('?seed=42')).toBe('42')
    expect(seedFromSearch('?app=tca&seed=demo-1')).toBe('demo-1')
    expect(seedFromSearch('')).toBe(DEFAULT_SEED)
    expect(seedFromSearch('?seed=')).toBe(DEFAULT_SEED)
    expect(seedFromSearch(`?seed=${'x'.repeat(200)}`)).toHaveLength(64)
    expect(hashString('a')).not.toBe(hashString('b'))
  })
})

describe('pairs, precision and value dates', () => {
  it('has the twelve pairs with 5 dp, or 3 dp for JPY', () => {
    expect(PAIRS.map((p) => p.pair)).toEqual(['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD', 'EURGBP', 'EURJPY', 'USDMXN', 'USDSGD', 'USDZAR'])
    expect(ALL_PAIRS).toHaveLength(12)
    for (const p of PAIRS) expect(p.decimals, p.pair).toBe(p.pair.endsWith('JPY') ? 3 : 5)
    expect(() => pairSpec('XXXYYY')).toThrow(/Unknown pair/)
  })

  it('formats with fixed decimals and separates the pip digits', () => {
    expect(formatRate('EURUSD', 1.08)).toBe('1.08000')
    expect(formatRate('USDJPY', 151.4)).toBe('151.400')
    expect(rateParts('EURUSD', 1.08427)).toEqual({ big: '1.08', pips: '42', fraction: '7' })
    expect(rateParts('USDJPY', 151.426)).toEqual({ big: '151.', pips: '42', fraction: '6' })
  })

  it('spot is T+2 business days, USDCAD T+1, weekends skipped', () => {
    expect(valueDate('EURUSD', d('2026-11-10'))).toBe('2026-11-12') // Tue -> Thu
    expect(valueDate('USDCAD', d('2026-11-10'))).toBe('2026-11-11') // Tue -> Wed
    expect(valueDate('EURUSD', d('2026-11-12'))).toBe('2026-11-16') // Thu -> Mon
    expect(valueDate('EURUSD', d('2026-11-13'))).toBe('2026-11-17') // Fri -> Tue
    expect(valueDate('USDCAD', d('2026-11-13'))).toBe('2026-11-16') // Fri -> Mon
    expect(valueDate('EURUSD', d('2026-11-14'))).toBe('2026-11-18') // Sat trades as Mon
  })

  it('forward tenors run from spot and never land on a weekend', () => {
    expect(valueDate('EURUSD', d('2026-11-10'), 'TOM')).toBe('2026-11-11')
    expect(valueDate('EURUSD', d('2026-11-10'), '1W')).toBe('2026-11-19')
    expect(valueDate('EURUSD', d('2026-11-10'), '1M')).toBe('2026-12-14') // 12 Dec is a Saturday
    expect(valueDate('EURUSD', d('2026-11-10'), '3M')).toBe('2027-02-12')
    expect(valueDate('EURUSD', d('2026-11-10'), 'BROKEN', 10)).toBe('2026-11-23') // 22 Nov is a Sunday
    expect(toIsoDate(addBusinessDays(d('2026-11-09'), -1))).toBe('2026-11-06')
    expect(toIsoDate(nextBusinessDay(d('2026-11-15')))).toBe('2026-11-16')
  })
})

describe('dataset', () => {
  const data = createDataset('harbor', AS_OF)

  it('is identical for the same seed and date, and different for another seed', () => {
    const again = createDataset('harbor', new Date(T0 + 5 * 3_600_000))
    expect(again).toEqual(data)
    expect(again.fingerprint).toBe(data.fingerprint)
    expect(JSON.stringify(again)).toBe(JSON.stringify(data))
    const other = createDataset('other', AS_OF)
    expect(other.fingerprint).not.toBe(data.fingerprint)
    expect(other.orders).not.toEqual(data.orders)
    expect(createDataset('harbor', new Date(T0 + 86_400_000)).fingerprint).not.toBe(data.fingerprint)
  })

  it('has the seeded entity counts', () => {
    expect(data.funds).toHaveLength(COUNTS.funds)
    expect(data.liquidityProviders).toHaveLength(8)
    expect(data.orders).toHaveLength(40)
    expect(data.trades).toHaveLength(400)
    expect(data.moneyMarketFunds).toHaveLength(30)
    expect(data.beneficiaries).toHaveLength(20)
    expect(data.researchNotes).toHaveLength(25)
    for (const list of [data.funds.map((f) => f.code), data.orders.map((o) => o.id.orderId), data.trades.map((t) => t.id.tradeId), data.moneyMarketFunds.map((m) => m.id), data.beneficiaries.map((b) => b.id), data.researchNotes.map((n) => n.id)]) {
      expect(new Set(list).size).toBe(list.length)
    }
  })

  it('produces orders and trades that are valid contexts', () => {
    for (const order of data.orders) expect(FxOrderContextSchema.safeParse(order).success, order.id.orderId).toBe(true)
    for (const trade of data.trades) expect(FxTradeContextSchema.safeParse(trade).success, trade.id.tradeId).toBe(true)
  })

  it('orders are open, use known funds and pairs, and always include a EURUSD spot order', () => {
    const funds = new Set(data.funds.map((f) => f.code))
    for (const o of data.orders) {
      expect(['NEW', 'WORKING', 'PARTIAL']).toContain(o.status)
      expect(funds.has(o.account)).toBe(true)
      const spec = pairSpec(o.pair)
      expect([spec.base, spec.quote]).toContain(o.dealtCurrency)
      expect(o.valueDate >= data.asOf).toBe(true)
      expect([0, 6]).not.toContain(d(o.valueDate).getUTCDay())
    }
    expect(data.orders[0]).toMatchObject({ pair: 'EURUSD', tenor: 'SPOT', status: 'NEW', valueDate: '2026-11-12' })
    for (const seed of ['a', 'b', 'c']) expect(createDataset(seed, AS_OF).orders.some((o) => o.pair === 'EURUSD')).toBe(true)
  })

  it('trades cover the last 90 days on weekdays, in time order, at plausible cost', () => {
    const first = data.trades[0]?.executedAt ?? ''
    const last = data.trades.at(-1)?.executedAt ?? ''
    expect(first >= new Date(Date.parse(`${data.asOf}T00:00:00Z`) - 90 * 86_400_000).toISOString()).toBe(true)
    expect(last < `${data.asOf}T00:00:00.000Z`).toBe(true)
    expect([...data.trades].sort((a, b) => a.executedAt.localeCompare(b.executedAt))).toEqual(data.trades)
    const lps = new Set(data.liquidityProviders.map((lp) => lp.id))
    for (const t of data.trades) {
      expect([0, 6]).not.toContain(new Date(t.executedAt).getUTCDay())
      expect(lps.has(t.counterparty)).toBe(true)
      expect(Math.abs(slippageBps(t))).toBeLessThan(6)
      expect(t.valueDate).toBe(valueDate(t.pair, new Date(t.executedAt)))
    }
    const avg = data.trades.reduce((sum, t) => sum + slippageBps(t), 0) / data.trades.length
    expect(avg).toBeGreaterThan(0)
    expect(data.trades.filter((t) => t.matchStatus === 'MISMATCHED')).toHaveLength(5)
    expect(data.trades.filter((t) => t.matchStatus === 'FAILED')).toHaveLength(1)
    expect(data.trades.filter((t) => t.exceptionReason).length).toBe(6)
  })

  it('LP hit rates sum to one and every LP declines one RFQ in ten', () => {
    expect(data.liquidityProviders.reduce((sum, lp) => sum + lp.hitRate, 0)).toBeCloseTo(1, 2)
    for (const lp of data.liquidityProviders) {
      expect(lp.declineRate).toBe(0.1)
      expect(lp.spreadPips).toBeGreaterThan(0)
    }
  })
})

describe('price stream', () => {
  it('is a pure function of seed, pair and time: two engines agree, in any query order', () => {
    const a = new PriceEngine('harbor')
    const b = new PriceEngine('harbor')
    const times = [T0, T0 + 1500, T0 + 60_000, T0 + 3_600_000]
    const fromA = times.map((t) => a.tick('EURUSD', t))
    // b is asked out of order, and about another pair in between.
    b.tick('USDJPY', T0 + 999)
    const late = b.tick('EURUSD', T0 + 3_600_000)
    const early = b.tick('EURUSD', T0)
    expect(late).toEqual(fromA[3])
    expect(early).toEqual(fromA[0])
    expect(new PriceEngine('other').tick('EURUSD', T0).mid).not.toBe(fromA[0]?.mid)
  })

  it('ticks every 250–1000ms as a small random walk around the open', () => {
    const engine = new PriceEngine('harbor')
    let at = T0
    let previous = engine.tick('EURUSD', at)
    const gaps: number[] = []
    for (let i = 0; i < 500; i++) {
      const next = engine.nextTickAt('EURUSD', at)
      const tick = engine.tick('EURUSD', next)
      gaps.push(tick.at - previous.at)
      expect(tick.seq).toBe(previous.seq + 1)
      expect(Math.abs(tick.mid - previous.mid)).toBeLessThan(0.0002)
      previous = tick
      at = next
    }
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(TICK_MIN_MS)
    expect(Math.max(...gaps)).toBeLessThanOrEqual(TICK_MAX_MS)
    expect(Math.abs(previous.changePct)).toBeLessThan(3)
    expect(previous.mid.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(5)
    expect(engine.tick('USDJPY', T0).mid.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3)
  })

  it('starts a new sequence at each UTC day', () => {
    const engine = new PriceEngine('harbor')
    const endOfDay = Date.UTC(2026, 10, 10, 23, 59, 59, 900)
    const before = engine.tick('EURUSD', endOfDay)
    expect(engine.nextTickAt('EURUSD', endOfDay)).toBeLessThanOrEqual(Date.UTC(2026, 10, 11))
    const after = engine.tick('EURUSD', Date.UTC(2026, 10, 11, 0, 0, 5))
    expect(after.seq).toBeLessThan(before.seq)
    expect(after.open).not.toBe(before.open)
  })

  it('each LP quotes mid ± half its spread, shifted by its skew', () => {
    const q = quoteFor('EURUSD', 1.085, { id: 'LP-01', spreadPips: 1, skewPips: 0.2 })
    expect(q).toEqual({ lpId: 'LP-01', bid: 1.08497, offer: 1.08507 })
    expect(quoteFor('USDJPY', 151.4, { id: 'LP-02', spreadPips: 2, skewPips: 0 })).toEqual({ lpId: 'LP-02', bid: 151.39, offer: 151.41 })
  })

  it('delivers ticks to subscribers, pauses when disconnected, and leaves no timers behind', () => {
    const clock = fakeScheduler(T0)
    const data = createDataset('harbor', AS_OF)
    const stream = createPriceStream({ seed: 'harbor', liquidityProviders: data.liquidityProviders, scheduler: clock })
    const eur: PriceTick[] = []
    const all: PriceTick[] = []
    const offEur = stream.subscribe(['EURUSD'], (t) => eur.push(t))
    const offAll = stream.subscribe(['EURUSD', 'USDJPY'], (t) => all.push(t))
    clock.advance(10_000)
    expect(eur.length).toBeGreaterThanOrEqual(10)
    expect(eur.length).toBeLessThanOrEqual(40)
    expect(all.length).toBeGreaterThan(eur.length)
    expect(eur.map((t) => t.seq)).toEqual([...eur.map((t) => t.seq)].sort((a, b) => a - b))
    expect(stream.latest('EURUSD').seq).toBe(eur.at(-1)?.seq)
    const quotes = stream.quotes('EURUSD')
    expect(quotes).toHaveLength(8)
    for (const q of quotes) expect(q.offer).toBeGreaterThan(q.bid)

    stream.setConnected(false)
    expect(stream.connected).toBe(false)
    const seen = eur.length
    clock.advance(5000)
    expect(eur.length).toBe(seen)
    stream.setConnected(true)
    clock.advance(2000)
    expect(eur.length).toBeGreaterThan(seen)
    // The stream kept moving while disconnected.
    expect((eur.at(-1)?.seq ?? 0) - (eur[seen - 1]?.seq ?? 0)).toBeGreaterThan(8)

    // Suspending (a hidden panel) pauses delivery without touching the connection state.
    stream.setSuspended(true)
    const beforeSuspend = eur.length
    clock.advance(3000)
    expect(eur.length).toBe(beforeSuspend)
    expect(stream.connected).toBe(true)
    stream.setSuspended(false)
    clock.advance(2000)
    expect(eur.length).toBeGreaterThan(beforeSuspend)

    offEur()
    expect(clock.pending()).toBe(2)
    offAll()
    expect(clock.pending()).toBe(0)
    stream.subscribe(['GBPUSD'], () => {})
    stream.stop()
    expect(clock.pending()).toBe(0)
    expect(() => stream.subscribe(['NOPE12'], () => {})).toThrow()
  })

  it('has a real-time scheduler for production use', () => {
    expect(Math.abs(realScheduler.now() - Date.now())).toBeLessThan(50)
    let fired = false
    const handle = realScheduler.setTimeout(() => (fired = true), 5)
    realScheduler.clearTimeout(handle)
    expect(fired).toBe(false)
  })
})

describe('services', () => {
  const make = (seed = 'harbor') => {
    const clock = fakeScheduler(T0)
    return { clock, services: createMockServices({ seed, scheduler: clock }) }
  }

  it('same seed gives identical service data; orders can be read and updated', async () => {
    const a = make()
    const b = make()
    expect(await a.services.orders.list()).toEqual(await b.services.orders.list())
    expect(await a.services.trades.list()).toEqual(await b.services.trades.list())
    expect(a.services.dataset.fingerprint).toBe(b.services.dataset.fingerprint)
    expect(make('zzz').services.dataset.fingerprint).not.toBe(a.services.dataset.fingerprint)

    const seen: number[] = []
    const off = a.services.orders.subscribe((orders) => seen.push(orders.filter((o) => o.status === 'CANCELLED').length))
    expect((await a.services.orders.setStatus('10401', 'CANCELLED')).status).toBe('CANCELLED')
    expect((await a.services.orders.get('10401'))?.status).toBe('CANCELLED')
    expect(await a.services.orders.get('nope')).toBeUndefined()
    await expect(a.services.orders.setStatus('nope', 'NEW')).rejects.toThrow(/Unknown order/)
    off()
    await a.services.orders.setStatus('10402', 'CANCELLED')
    expect(seen).toEqual([1])
    // Callers get copies: mutating a result does not change the service.
    const list = await a.services.orders.list()
    ;(list[5] as { status: string }).status = 'FILLED'
    expect((await a.services.orders.list())[5]?.status).not.toBe('FILLED')
  })

  it('RFQ: each LP replies in 200–1500ms, about one in ten declines, quotes stream then expire after 10s', () => {
    const { clock, services } = make()
    const lpIds = services.dataset.liquidityProviders.map((lp) => lp.id)
    const replyTimes: number[] = []
    let declined = 0
    let quoted = 0
    for (let n = 0; n < 60; n++) {
      const start = clock.now()
      const replied = new Set<string>()
      let last: RfqQuote[] = []
      const handle = services.quotes.requestQuotes({ orderId: `o-${n}`, pair: 'EURUSD', lpIds }, (quotes) => {
        last = quotes
        for (const q of quotes) {
          if (q.status !== 'PENDING' && !replied.has(q.lpId)) {
            replied.add(q.lpId)
            replyTimes.push(clock.now() - start)
          }
        }
      })
      expect(handle.quotes().every((q) => q.status === 'PENDING')).toBe(true)
      clock.advance(RFQ_REPLY_MAX_MS)
      expect(replied.size).toBe(8)
      declined += last.filter((q) => q.status === 'DECLINED').length
      quoted += last.filter((q) => q.status === 'QUOTED').length
      for (const q of last.filter((x) => x.status === 'QUOTED')) {
        expect(q.offer).toBeGreaterThan(q.bid as number)
        expect((q.expiresAt as number) - start).toBeGreaterThanOrEqual(RFQ_REPLY_MIN_MS + QUOTE_LIFETIME_MS)
        expect((q.expiresAt as number) - start).toBeLessThanOrEqual(RFQ_REPLY_MAX_MS + QUOTE_LIFETIME_MS)
      }
      if (n === 0) {
        // Live quotes follow the market.
        const before = JSON.stringify(last)
        clock.advance(4000)
        expect(JSON.stringify(last)).not.toBe(before)
        expect(last.filter((q) => q.status === 'QUOTED').length).toBe(quoted)
        clock.advance(QUOTE_LIFETIME_MS)
        expect(last.every((q) => q.status === 'EXPIRED' || q.status === 'DECLINED')).toBe(true)
        expect(last.filter((q) => q.status === 'EXPIRED').every((q) => q.bid === undefined)).toBe(true)
      }
      handle.cancel()
    }
    expect(Math.min(...replyTimes)).toBeGreaterThanOrEqual(RFQ_REPLY_MIN_MS)
    expect(Math.max(...replyTimes)).toBeLessThanOrEqual(RFQ_REPLY_MAX_MS)
    expect(declined / (declined + quoted)).toBeGreaterThan(0.05)
    expect(declined / (declined + quoted)).toBeLessThan(0.16)
    expect(clock.pending()).toBe(0)
  })

  it('RFQ: the same request on the same seed gets the same replies; cancel silences it; unknown LPs are ignored', () => {
    const run = () => {
      const { clock, services } = make()
      const updates: RfqQuote[][] = []
      services.quotes.requestQuotes({ orderId: '10401', pair: 'GBPUSD', lpIds: ['LP-01', 'LP-02', 'LP-03', 'LP-99'] }, (q) => updates.push(q))
      clock.advance(3000)
      return updates
    }
    const first = run()
    expect(run()).toEqual(first)
    expect(first.at(-1)).toHaveLength(3)

    const { clock, services } = make()
    let calls = 0
    const handle = services.quotes.requestQuotes({ orderId: 'x', pair: 'EURUSD', lpIds: ['LP-01'] }, () => calls++)
    handle.cancel()
    clock.advance(20_000)
    expect(calls).toBe(0)
  })

  it('executing books a trade, fills the order and starts matching: UNMATCHED, then MATCHED after 3–8s', async () => {
    const { clock, services } = make()
    const order = (await services.orders.get('10401'))!
    const events: SettlementEvent[] = []
    const tradeCounts: number[] = []
    services.settlement.subscribe((e) => events.push(e))
    const offTrades = services.trades.subscribe((t) => tradeCounts.push(t.length))
    const trade = await services.trades.execute({ order, lpId: 'LP-03', rate: 1.084271, method: 'RFQ' })
    expect(trade).toMatchObject({ id: { tradeId: 'T-000401', orderId: '10401' }, pair: 'EURUSD', counterparty: 'LP-03', matchStatus: 'UNMATCHED', rate: 1.08427, arrivalMid: order.arrivalMid, valueDate: order.valueDate })
    expect(FxTradeContextSchema.safeParse(trade).success).toBe(true)
    expect((await services.orders.get('10401'))?.status).toBe('FILLED')
    expect(tradeCounts.at(-1)).toBe(401)
    expect(await services.settlement.status(trade.id.tradeId)).toBe('UNMATCHED')

    clock.advance(MATCH_MIN_MS - 1)
    expect(events).toHaveLength(0)
    clock.advance(MATCH_MAX_MS)
    expect(events).toHaveLength(1)
    expect(['MATCHED', 'MISMATCHED']).toContain(events[0]?.status)
    expect((await services.trades.get(trade.id.tradeId))?.matchStatus).toBe(events[0]?.status)
    expect(await services.trades.get('nope')).toBeUndefined()
    expect(await services.settlement.status('nope')).toBeUndefined()
    offTrades()

    // An order the service has never seen still executes, using the live mid as arrival.
    const foreign = await services.trades.execute({ order: { ...order, id: { orderId: 'ext-1' } }, lpId: 'LP-01', rate: 1.08, method: 'ALGO' })
    expect(foreign.arrivalMid).toBe(services.prices.latest('EURUSD').mid)
    expect((await services.trades.execute({ order, lpId: 'LP-01', rate: 1.08, method: 'RFS', arrivalMid: 1.07 })).arrivalMid).toBe(1.07)
  })

  it('about one new trade in six becomes MISMATCHED, each with a field-by-field difference', async () => {
    const { clock, services } = make()
    const order = (await services.orders.get('10401'))!
    const count = 300
    for (let i = 0; i < count; i++) await services.trades.execute({ order: { ...order, id: { orderId: `bulk-${i}` } }, lpId: 'LP-01', rate: 1.0843, method: 'RFQ' })
    clock.advance(MATCH_MAX_MS)
    const fresh = (await services.trades.list()).slice(-count)
    const broken = fresh.filter((t) => t.matchStatus === 'MISMATCHED')
    expect(fresh.every((t) => t.matchStatus === 'MATCHED' || t.matchStatus === 'MISMATCHED')).toBe(true)
    expect(broken.length / count).toBeGreaterThan(0.1)
    expect(broken.length / count).toBeLessThan(0.24)
    const exceptions = await services.settlement.exceptions()
    for (const t of broken) {
      const detail = exceptions.find((e) => e.tradeId === t.id.tradeId)
      expect(detail?.fields.filter((f) => f.differs)).toHaveLength(1)
      expect(t.exceptionReason).toBeTruthy()
    }
    // The five seeded mismatches are in the queue too.
    expect(exceptions).toHaveLength(broken.length + 5)
    expect(new Set(exceptions.flatMap((e) => e.fields.filter((f) => f.differs).map((f) => f.field))).size).toBeGreaterThanOrEqual(3)
  })

  it('exceptions can be forced, accepted, resent and escalated, and every action is logged', async () => {
    const { clock, services } = make()
    const order = (await services.orders.get('10402'))!
    const trade = await services.trades.execute({ order, lpId: 'LP-02', rate: order.arrivalMid, method: 'RFQ' })
    const id = trade.id.tradeId
    const events: SettlementEvent[] = []
    const off = services.settlement.subscribe((e) => events.push(e))

    await services.settlement.forceMismatch(id)
    expect(events.at(-1)).toMatchObject({ tradeId: id, status: 'MISMATCHED' })
    expect(events.at(-1)?.exceptionReason).toBeTruthy()
    // The pending auto-match must not overwrite the forced mismatch.
    clock.advance(MATCH_MAX_MS)
    expect(await services.settlement.status(id)).toBe('MISMATCHED')

    await services.settlement.escalate(id, 'u-ops')
    expect((await services.settlement.exceptions()).find((e) => e.tradeId === id)?.escalated).toBe(true)
    expect(await services.settlement.status(id)).toBe('MISMATCHED')

    await services.settlement.resend(id, 'u-ops')
    expect(await services.settlement.status(id)).toBe('UNMATCHED')
    clock.advance(MATCH_MAX_MS)
    expect(await services.settlement.status(id)).toBe('MATCHED')
    expect((await services.settlement.exceptions()).some((e) => e.tradeId === id)).toBe(false)
    expect((await services.trades.get(id))?.exceptionReason).toBeUndefined()

    await services.settlement.forceMismatch(id)
    await services.settlement.acceptTheirs(id, 'u-ops')
    expect(await services.settlement.status(id)).toBe('MATCHED')
    await expect(services.settlement.acceptTheirs(id, 'u-ops')).rejects.toThrow(/not an exception/)
    await expect(services.settlement.forceMismatch('nope')).rejects.toThrow(/Unknown trade/)

    const log = (await services.settlement.activity()).filter((a) => a.tradeId === id)
    expect(log.map((a) => a.action)).toEqual(['FORCED_MISMATCH', 'ESCALATE', 'RESEND', 'AUTO_MATCH', 'FORCED_MISMATCH', 'ACCEPT_THEIRS'])
    expect(log[2]).toMatchObject({ userId: 'u-ops', before: 'MISMATCHED', after: 'UNMATCHED', at: new Date(T0 + MATCH_MAX_MS).toISOString() })
    off()
    await services.settlement.forceMismatch(id)
    expect(events.filter((e) => e.tradeId === id)).toHaveLength(5)
  })

  it('records a trade executed elsewhere once, and matches it', async () => {
    const { clock, services } = make()
    const template = (await services.trades.list())[0]!
    const incoming = { ...template, id: { tradeId: 'T-900001', orderId: 'x' }, matchStatus: 'UNMATCHED' as const }
    await services.trades.record(incoming)
    await services.trades.record(incoming)
    expect((await services.trades.list()).filter((t) => t.id.tradeId === 'T-900001')).toHaveLength(1)
    clock.advance(MATCH_MAX_MS)
    expect(await services.settlement.status('T-900001')).not.toBe('UNMATCHED')
    await services.trades.record({ ...incoming, id: { tradeId: 'T-900002', orderId: 'y' }, matchStatus: 'SETTLED' })
    clock.advance(MATCH_MAX_MS)
    expect(await services.settlement.status('T-900002')).toBe('SETTLED')
  })

  it('TCA: slippage is a cost when you buy above or sell below arrival', async () => {
    expect(slippageBps({ side: 'BUY', rate: 1.0011, arrivalMid: 1.001 })).toBeCloseTo(1, 1)
    expect(slippageBps({ side: 'SELL', rate: 1.0011, arrivalMid: 1.001 })).toBeCloseTo(-1, 1)
    expect(slippageBps({ side: 'SELL', rate: 1.0009, arrivalMid: 1.001 })).toBeCloseTo(1, 1)

    const { services } = make()
    const { tca } = services
    expect(tca.slippageBps({ side: 'BUY', rate: 2, arrivalMid: 2 })).toBe(0)
    const series = await tca.series()
    expect(series).toHaveLength(400)
    expect(series.map((s) => s.executedAt)).toEqual([...series.map((s) => s.executedAt)].sort())
    const eur = await tca.series({ pair: 'EURUSD' })
    expect(eur.length).toBeGreaterThan(20)
    expect(eur.every((s) => s.pair === 'EURUSD')).toBe(true)
    const windowed = await tca.series({ from: '2026-11-01T00:00:00.000Z', to: '2026-11-05T23:59:59.999Z' })
    expect(windowed.length).toBeGreaterThan(0)
    expect(windowed.length).toBeLessThan(60)

    const byLp = await tca.byCounterparty()
    expect(byLp).toHaveLength(8)
    expect(byLp.reduce((sum, b) => sum + b.trades, 0)).toBe(400)
    const byMethod = Object.fromEntries((await tca.byMethod()).map((b) => [b.key, b.avgBps]))
    expect(Object.keys(byMethod).sort()).toEqual(['ALGO', 'RFQ', 'RFS'])
    expect(byMethod.ALGO).toBeLessThan(byMethod.RFQ as number)
    const byHour = await tca.byHour()
    expect(byHour.map((b) => b.key)).toEqual([...byHour.map((b) => b.key)].sort())
    expect(byHour.every((b) => Number(b.key) >= 7 && Number(b.key) <= 20)).toBe(true)

    const worst = await tca.worst(10)
    expect(worst).toHaveLength(10)
    expect(worst.map((w) => w.bps)).toEqual([...worst.map((w) => w.bps)].sort((a, b) => b - a))
    expect(worst[0]?.bps).toBe(Math.max(...series.map((s) => s.bps)))
    expect(await tca.byCounterparty({ pair: 'USDZAR', from: '2099-01-01T00:00:00.000Z' })).toEqual([])
  })

  it('TCA: day cost compares today with the previous 30 days and picks up a new trade at once', async () => {
    const { services } = make()
    const before = await services.tca.dayCost()
    expect(before).toMatchObject({ todayBps: null, todayTrades: 0 })
    expect(before.thirtyDayBps).toBeGreaterThan(0)
    const order = (await services.orders.get('10401'))!
    await services.trades.execute({ order: { ...order, side: 'BUY' }, lpId: 'LP-01', rate: order.arrivalMid * 1.0002, method: 'RFQ' })
    const after = await services.tca.dayCost()
    expect(after.todayTrades).toBe(1)
    expect(after.todayBps).toBeCloseTo(2, 0)
    expect(after.thirtyDayBps).toBe(before.thirtyDayBps)
    expect((await services.tca.series()).at(-1)?.tradeId).toBe('T-000401')
  })

  it('dispose stops every timer', async () => {
    const { clock, services } = make()
    const order = (await services.orders.get('10401'))!
    await services.trades.execute({ order, lpId: 'LP-01', rate: 1.08, method: 'RFQ' })
    services.quotes.requestQuotes({ orderId: '10401', pair: 'EURUSD', lpIds: ['LP-01', 'LP-02'] }, () => {})
    services.prices.subscribe(['USDJPY'], () => {})
    expect(clock.pending()).toBeGreaterThan(3)
    services.dispose()
    expect(clock.pending()).toBe(0)
  })
})

describe('pre-trade estimate', () => {
  const data = createDataset('harbor', AS_OF)
  const base = data.orders[0]!

  it('is deterministic and a valid context for every seeded order', () => {
    for (const order of data.orders) {
      const estimate = estimateOrder(data, order)
      expect(estimateOrder(data, order)).toEqual(estimate)
      expect(PreTradeEstimateContextSchema.safeParse(estimate.context).success, order.id.orderId).toBe(true)
      expect(estimate.context.id.orderId).toBe(order.id.orderId)
      expect(estimate.context.expectedCostBps).toBeGreaterThan(0)
      expect(estimate.counterparties).toHaveLength(5)
      expect(estimate.context.suggestedCounterparties).toEqual(estimate.counterparties.map((c) => c.lpId))
      expect(estimate.reason.length).toBeGreaterThan(20)
    }
  })

  it('recommends RFQ for normal size and an algo for large or illiquid orders', () => {
    const small = estimateOrder(data, { ...base, pair: 'EURUSD', amount: 10_000_000 })
    const large = estimateOrder(data, { ...base, pair: 'EURUSD', amount: LARGE_ORDER })
    const huge = estimateOrder(data, { ...base, pair: 'EURUSD', amount: 250_000_000 })
    const exotic = estimateOrder(data, { ...base, pair: 'USDZAR', dealtCurrency: 'USD', amount: 5_000_000 })
    expect(small.context).toMatchObject({ recommendedMethod: 'RFQ', liquidityScore: 5 })
    expect(small.reason).toMatch(/dealer appetite/)
    expect(large.context).toMatchObject({ recommendedMethod: 'ALGO', liquidityScore: 4 })
    expect(large.reason).toMatch(/Large/)
    expect(huge.context.liquidityScore).toBe(3)
    expect(exotic.context).toMatchObject({ recommendedMethod: 'ALGO', liquidityScore: 2 })
    expect(exotic.reason).toMatch(/thin/)
    // Bigger and thinner costs more.
    expect(large.context.expectedCostBps).toBeGreaterThan(small.context.expectedCostBps)
    expect(huge.context.expectedCostBps).toBeGreaterThan(large.context.expectedCostBps)
  })

  it('ranks suggested counterparties by their cost on that pair', () => {
    const { counterparties } = estimateOrder(data, base)
    const costs = counterparties.map((c) => c.avgBps).filter((v): v is number => v !== null)
    expect(costs).toEqual([...costs].sort((a, b) => a - b))
    for (const c of counterparties) expect(c.hitRate).toBeGreaterThan(0)
  })
})
