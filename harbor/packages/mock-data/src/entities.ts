import type { FxOrderContext, FxTradeContext, SettlementContext, Side } from '@harbor/schemas'
import { PAIRS, addBusinessDays, roundRate, startOfUtcDay, toIsoDate, valueDate, type PairSpec, type Tenor } from './pairs.ts'
import { createRng, hashString, type Rng } from './rng.ts'

/* All names below are invented. No real fund, bank or company is referenced. */

export interface Fund {
  code: string
  name: string
  baseCurrency: string
  aumUsdM: number
}

export interface LiquidityProvider {
  id: string
  name: string
  /** Full bid-offer spread in pips at normal size. */
  spreadPips: number
  /** Shift of both sides away from mid, in pips. Positive = quotes high. */
  skewPips: number
  /** Probability of declining an RFQ. */
  declineRate: number
  /** Historical share of RFQs this LP won, 0–1. */
  hitRate: number
}

export interface Order extends FxOrderContext {
  createdAt: string
  /** Mid when the order reached the desk. */
  arrivalMid: number
  /** Mock user id of the trader the order is assigned to. */
  traderId: string
}

export type MatchStatus = SettlementContext['matchStatus']

export interface Trade extends FxTradeContext {
  matchStatus: MatchStatus
  exceptionReason?: string
}

export interface MoneyMarketFund {
  id: string
  name: string
  currency: string
  yield7dPct: number
  aumUsdBn: number
  rating: 'AAAm' | 'AAm' | 'Am'
  /** Dealing cut-off as HH:MM in the fund's local market time. */
  cutOff: string
  cutOffZone: 'New York' | 'London' | 'Dublin' | 'Singapore'
}

export interface Beneficiary {
  id: string
  name: string
  country: string
  currency: string
  bankName: string
  accountMasked: string
}

export interface ResearchNote {
  id: string
  title: string
  pairs: string[]
  author: string
  publishedAt: string
  summary: string
  body: string
}

export interface Dataset {
  seed: string
  /** The business date the data is generated for (ISO date). */
  asOf: string
  funds: Fund[]
  liquidityProviders: LiquidityProvider[]
  orders: Order[]
  trades: Trade[]
  moneyMarketFunds: MoneyMarketFund[]
  beneficiaries: Beneficiary[]
  researchNotes: ResearchNote[]
  /** Hash of everything above: equal fingerprints mean identical data. */
  fingerprint: string
}

export const COUNTS = { funds: 6, liquidityProviders: 8, orders: 40, trades: 400, moneyMarketFunds: 30, beneficiaries: 20, researchNotes: 25, historyDays: 90 } as const

const TRADER_IDS = ['u-trader', 'u-trader', 'u-trader', 'u-admin'] as const

function weightedPair(rng: Rng): PairSpec {
  const total = PAIRS.reduce((sum, p) => sum + p.weight, 0)
  let roll = rng.float() * total
  for (const p of PAIRS) {
    roll -= p.weight
    if (roll < 0) return p
  }
  return PAIRS[0] as PairSpec
}

const AMOUNTS_M = [1, 2, 3, 5, 5, 8, 10, 10, 15, 20, 25, 40, 50, 75, 100] as const

function makeFunds(rng: Rng): Fund[] {
  const names = ['Global Equity', 'Core Bond', 'Emerging Markets', 'Balanced Growth', 'Short Duration', 'Real Assets']
  const currencies = ['USD', 'USD', 'EUR', 'GBP', 'USD', 'EUR']
  return names.map((name, i) => ({
    code: `FUND-${String.fromCharCode(65 + i)}`,
    name: `Larkfield ${name} Fund`,
    baseCurrency: currencies[i] ?? 'USD',
    aumUsdM: rng.int(8, 120) * 50,
  }))
}

function makeLiquidityProviders(rng: Rng): LiquidityProvider[] {
  const names = ['Aldermoor', 'Brightwater', 'Corvane', 'Dunmere', 'Eastlake', 'Fennick', 'Garrow', 'Holloway']
  const raw = names.map((name, i) => ({
    id: `LP-${String(i + 1).padStart(2, '0')}`,
    name: `${name} Markets`,
    spreadPips: Number(rng.range(0.4, 1.8).toFixed(1)),
    skewPips: Number(rng.range(-0.3, 0.3).toFixed(2)),
    declineRate: 0.1,
    weight: rng.range(0.5, 1.5),
  }))
  // Tighter spreads win more often.
  const scores = raw.map((lp) => lp.weight / lp.spreadPips)
  const total = scores.reduce((a, b) => a + b, 0)
  return raw.map(({ weight: _weight, ...lp }, i) => ({ ...lp, hitRate: Number(((scores[i] ?? 0) / total).toFixed(3)) }))
}

/** A historical or arrival mid: the reference price moved by a small seeded amount. */
const mockMid = (spec: PairSpec, rng: Rng, spreadPct = 0.02) => roundRate(spec.pair, spec.referenceMid * (1 + rng.range(-spreadPct, spreadPct)))

function makeOrders(rng: Rng, funds: Fund[], asOfMs: number): Order[] {
  const tenors: Tenor[] = ['SPOT', 'SPOT', 'SPOT', 'SPOT', 'SPOT', 'TOM', '1W', '1M', '3M', 'BROKEN']
  const benchmarks = [undefined, 'ARRIVAL', 'ARRIVAL', 'WMR_4PM', 'TWAP'] as const
  const statuses = ['NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'WORKING', 'WORKING', 'PARTIAL'] as const
  return Array.from({ length: COUNTS.orders }, (_, i) => {
    // The first few orders are pinned to the majors so every seed has a EURUSD order to demo with.
    const spec = i < 3 ? (PAIRS[i] as PairSpec) : weightedPair(rng)
    const side: Side = rng.chance(0.5) ? 'BUY' : 'SELL'
    const tenor = i < 3 ? 'SPOT' : rng.pick(tenors)
    // Orders arrived between yesterday afternoon and early this morning (UTC).
    const createdAt = new Date(asOfMs - 18 * 3_600_000 + rng.int(0, 25 * 3600) * 1000)
    const benchmark = rng.pick(benchmarks)
    const order: Order = {
      type: 'harbor.fxOrder',
      id: { orderId: String(10401 + i) },
      pair: spec.pair,
      side,
      dealtCurrency: rng.chance(0.85) ? spec.base : spec.quote,
      amount: rng.pick(AMOUNTS_M) * 1_000_000,
      tenor,
      valueDate: valueDate(spec.pair, new Date(asOfMs), tenor, rng.int(9, 45)),
      account: rng.pick(funds).code,
      status: i < 3 ? 'NEW' : rng.pick(statuses),
      ...(benchmark ? { benchmark } : {}),
      createdAt: createdAt.toISOString(),
      arrivalMid: mockMid(spec, rng, 0.004),
      traderId: rng.pick(TRADER_IDS),
    }
    return order
  })
}

function makeTrades(rng: Rng, funds: Fund[], lps: LiquidityProvider[], asOfMs: number): Trade[] {
  const today = new Date(asOfMs)
  // The last 90 calendar days' business days, oldest first.
  const days: Date[] = []
  for (let back = COUNTS.historyDays; back >= 1; back--) {
    const day = new Date(asOfMs - back * 86_400_000)
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) days.push(day)
  }
  const methods = ['RFQ', 'RFQ', 'RFQ', 'RFQ', 'RFS', 'ALGO', 'ALGO'] as const
  const recentCutoff = addBusinessDays(today, -2).getTime()
  const trades = Array.from({ length: COUNTS.trades }, (_, i) => {
    const spec = weightedPair(rng)
    const day = rng.pick(days)
    // Dealt during the London/New York day, 07:00–20:59 UTC.
    const executedAt = new Date(day.getTime() + rng.int(7 * 3600, 21 * 3600 - 1) * 1000)
    const side: Side = rng.chance(0.5) ? 'BUY' : 'SELL'
    const lp = rng.pick(lps)
    const method = rng.pick(methods)
    const arrivalMid = mockMid(spec, rng)
    // Cost in bps: half the LP's spread, plus noise; algos are cheaper on average, busy hours cheaper than the edges.
    const hour = executedAt.getUTCHours()
    const edgeOfDay = hour < 8 || hour > 18 ? 0.6 : 0
    const halfSpreadBps = ((lp.spreadPips * spec.pip) / 2 / spec.referenceMid) * 10_000
    const costBps = halfSpreadBps * (method === 'ALGO' ? 0.5 : 1) + edgeOfDay + rng.gauss() * 0.7
    const rate = roundRate(spec.pair, arrivalMid * (1 + ((side === 'BUY' ? 1 : -1) * costBps) / 10_000))
    const recent = day.getTime() >= recentCutoff
    const trade: Trade = {
      type: 'harbor.fxTrade',
      id: { tradeId: '', orderId: String(9000 + i) },
      pair: spec.pair,
      side,
      amount: rng.pick(AMOUNTS_M) * 1_000_000,
      rate,
      counterparty: lp.id,
      method,
      executedAt: executedAt.toISOString(),
      valueDate: valueDate(spec.pair, day),
      account: rng.pick(funds).code,
      arrivalMid,
      matchStatus: recent ? rng.pick(['MATCHED', 'CONFIRMED', 'CONFIRMED'] as const) : 'SETTLED',
    }
    return trade
  })
  trades.sort((a, b) => a.executedAt.localeCompare(b.executedAt))
  trades.forEach((t, i) => (t.id = { ...t.id, tradeId: `T-${String(i + 1).padStart(6, '0')}` }))
  // A standing exception queue: the six most recent trades that are eligible.
  const reasons = ['Rate differs', 'Amount differs', 'Value date differs', 'Unknown counterparty reference']
  trades.slice(-12).filter((_, i) => i % 2 === 0).forEach((t, i) => {
    t.matchStatus = i === 5 ? 'FAILED' : 'MISMATCHED'
    t.exceptionReason = i === 5 ? 'Settlement instruction rejected' : (reasons[i % reasons.length] as string)
  })
  return trades
}

function makeMoneyMarketFunds(rng: Rng): MoneyMarketFund[] {
  const houses = ['Larkfield', 'Stonebridge', 'Wexcombe', 'Ashdown', 'Pinemoor', 'Calder']
  const styles = ['Government Liquidity', 'Prime Liquidity', 'Treasury Reserve', 'Sterling Liquidity', 'Euro Liquidity']
  const zones: Record<string, MoneyMarketFund['cutOffZone']> = { USD: 'New York', GBP: 'London', EUR: 'Dublin', SGD: 'Singapore' }
  return Array.from({ length: COUNTS.moneyMarketFunds }, (_, i) => {
    const style = styles[i % styles.length] as string
    const currency = style.startsWith('Sterling') ? 'GBP' : style.startsWith('Euro') ? 'EUR' : rng.chance(0.1) ? 'SGD' : 'USD'
    const baseYield = { USD: 4.3, GBP: 4.1, EUR: 2.6, SGD: 2.9 }[currency] ?? 3
    return {
      id: `MMF-${String(i + 1).padStart(2, '0')}`,
      name: `${houses[Math.floor(i / styles.length) % houses.length]} ${style} Fund`,
      currency,
      yield7dPct: Number((baseYield + rng.range(-0.25, 0.25)).toFixed(2)),
      aumUsdBn: Number(rng.range(2, 95).toFixed(1)),
      rating: rng.pick(['AAAm', 'AAAm', 'AAAm', 'AAAm', 'AAm', 'Am'] as const),
      cutOff: `${String(rng.int(11, 17)).padStart(2, '0')}:${rng.pick(['00', '30'])}`,
      cutOffZone: zones[currency] ?? 'New York',
    }
  })
}

function makeBeneficiaries(rng: Rng): Beneficiary[] {
  const names = ['Orrin Logistics', 'Tallis Components', 'Vandermeer Supply', 'Kestrel Software', 'Marlowe Freight', 'Quillon Energy', 'Brackley Pharma', 'Solenne Textiles', 'Dravik Metals', 'Hartwell Foods']
  const places = [
    ['Germany', 'EUR'], ['United Kingdom', 'GBP'], ['Japan', 'JPY'], ['Canada', 'CAD'], ['Australia', 'AUD'],
    ['Switzerland', 'CHF'], ['Mexico', 'MXN'], ['Singapore', 'SGD'], ['South Africa', 'ZAR'], ['United States', 'USD'],
  ] as const
  const banks = ['Aldermoor Bank', 'Brightwater Trust', 'Corvane Banking Group', 'Dunmere Savings Bank']
  const suffixes = ['GmbH', 'Ltd', 'KK', 'Inc', 'Pty', 'AG', 'SA de CV', 'Pte', 'Pty', 'LLC']
  return Array.from({ length: COUNTS.beneficiaries }, (_, i) => {
    const place = places[i % places.length] as readonly [string, string]
    return {
      id: `BEN-${String(i + 1).padStart(3, '0')}`,
      name: `${names[(i * 3) % names.length]} ${suffixes[i % suffixes.length]}${i >= names.length ? ' (2)' : ''}`,
      country: place[0],
      currency: place[1],
      bankName: rng.pick(banks),
      accountMasked: `••••${rng.int(1000, 9999)}`,
    }
  })
}

function makeResearchNotes(rng: Rng, asOfMs: number): ResearchNote[] {
  const themes = [
    ['rate differentials widen', 'Policy divergence is doing most of the work.'],
    ['month-end rebalancing flows', 'Expect hedging demand into the fix.'],
    ['liquidity thins into the close', 'Top-of-book depth is down on the week.'],
    ['options market leans one way', 'Risk reversals have moved further than spot.'],
    ['data surprise resets expectations', 'Front-end pricing has shifted since the print.'],
  ] as const
  const authors = ['M. Okafor', 'S. Lindgren', 'R. Castellanos', 'J. Whitcombe']
  return Array.from({ length: COUNTS.researchNotes }, (_, i) => {
    const primary = weightedPair(rng)
    const pairs = rng.chance(0.3) ? [primary.pair, weightedPair(rng).pair].filter((p, n, all) => all.indexOf(p) === n) : [primary.pair]
    const theme = themes[i % themes.length] as readonly [string, string]
    return {
      id: `RN-${String(i + 1).padStart(3, '0')}`,
      title: `${primary.pair}: ${theme[0]}`,
      pairs,
      author: rng.pick(authors),
      publishedAt: new Date(asOfMs - rng.int(1, 14 * 24) * 3_600_000).toISOString(),
      summary: theme[1],
      body: `${theme[1]} This is mock commentary generated for ${pairs.join(' and ')}; it is not investment research.`,
    }
  }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

/**
 * Build the whole mock dataset. Pure: the same `seed` and `asOf` date always
 * give exactly the same result, on any machine.
 */
export function createDataset(seed: string, asOf: Date = new Date()): Dataset {
  const asOfMs = startOfUtcDay(asOf.getTime())
  const root = createRng(`${seed}/${toIsoDate(new Date(asOfMs))}`)
  const funds = makeFunds(root.fork('funds'))
  const liquidityProviders = makeLiquidityProviders(root.fork('lps'))
  const data = {
    seed,
    asOf: toIsoDate(new Date(asOfMs)),
    funds,
    liquidityProviders,
    orders: makeOrders(root.fork('orders'), funds, asOfMs),
    trades: makeTrades(root.fork('trades'), funds, liquidityProviders, asOfMs),
    moneyMarketFunds: makeMoneyMarketFunds(root.fork('mmfs')),
    beneficiaries: makeBeneficiaries(root.fork('beneficiaries')),
    researchNotes: makeResearchNotes(root.fork('research'), asOfMs),
  }
  return { ...data, fingerprint: hashString(JSON.stringify(data)).toString(16).padStart(8, '0') }
}

