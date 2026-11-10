export interface PairSpec {
  pair: string
  base: string
  quote: string
  /** A plausible reference mid; the day's opening price is derived from it. */
  referenceMid: number
  /** Decimal places shown: 5 for most pairs, 3 for JPY pairs. */
  decimals: number
  /** One pip in price terms. */
  pip: number
  /** Business days from trade date to spot value date. */
  spotLag: number
  /** Relative weight when generating orders and trades. */
  weight: number
}

const spec = (pair: string, referenceMid: number, weight: number): PairSpec => {
  const jpy = pair.endsWith('JPY')
  return {
    pair,
    base: pair.slice(0, 3),
    quote: pair.slice(3),
    referenceMid,
    decimals: jpy ? 3 : 5,
    pip: jpy ? 0.01 : 0.0001,
    spotLag: pair === 'USDCAD' ? 1 : 2,
    weight,
  }
}

export const PAIRS: readonly PairSpec[] = [
  spec('EURUSD', 1.0842, 10),
  spec('GBPUSD', 1.2715, 7),
  spec('USDJPY', 151.42, 7),
  spec('USDCHF', 0.8831, 3),
  spec('AUDUSD', 0.6548, 4),
  spec('USDCAD', 1.3672, 4),
  spec('NZDUSD', 0.5987, 2),
  spec('EURGBP', 0.8527, 3),
  spec('EURJPY', 164.17, 3),
  spec('USDMXN', 17.085, 2),
  spec('USDSGD', 1.3441, 2),
  spec('USDZAR', 18.412, 1),
]

export function pairSpec(pair: string): PairSpec {
  const found = PAIRS.find((p) => p.pair === pair)
  if (!found) throw new Error(`Unknown pair ${pair}`)
  return found
}

export function roundRate(pair: string, rate: number): number {
  return Number(rate.toFixed(pairSpec(pair).decimals))
}

export interface RateParts {
  /** Leading digits, e.g. `1.08`. */
  big: string
  /** The two pip digits, shown larger. */
  pips: string
  /** The fractional pip digit. */
  fraction: string
}

/** Split a rate for display: fixed decimals per pair, pip digits separated out. */
export function rateParts(pair: string, rate: number): RateParts {
  const text = rate.toFixed(pairSpec(pair).decimals)
  return { big: text.slice(0, -3), pips: text.slice(-3, -1), fraction: text.slice(-1) }
}

export function formatRate(pair: string, rate: number): string {
  return rate.toFixed(pairSpec(pair).decimals)
}

/* ---------- dates (UTC, weekends skipped, no holiday calendar) ---------- */

const DAY_MS = 86_400_000
export const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10)
export const startOfUtcDay = (ms: number): number => Math.floor(ms / DAY_MS) * DAY_MS
const isWeekend = (date: Date) => date.getUTCDay() === 0 || date.getUTCDay() === 6

export function addBusinessDays(from: Date, days: number): Date {
  const date = new Date(startOfUtcDay(from.getTime()))
  const step = days < 0 ? -1 : 1
  let remaining = Math.abs(days)
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + step)
    if (!isWeekend(date)) remaining--
  }
  return date
}

/** Roll forward to a business day if the date falls on a weekend. */
export function nextBusinessDay(from: Date): Date {
  const date = new Date(startOfUtcDay(from.getTime()))
  while (isWeekend(date)) date.setUTCDate(date.getUTCDate() + 1)
  return date
}

export type Tenor = 'SPOT' | 'TOM' | '1W' | '1M' | '3M' | 'BROKEN'

/** Spot is T+2 business days (T+1 for USDCAD). Forward tenors run from spot. */
export function valueDate(pair: string, tradeDate: Date, tenor: Tenor = 'SPOT', brokenDays = 0): string {
  const trade = nextBusinessDay(tradeDate)
  const spot = addBusinessDays(trade, pairSpec(pair).spotLag)
  const shifted = new Date(spot)
  switch (tenor) {
    case 'SPOT':
      return toIsoDate(spot)
    case 'TOM':
      return toIsoDate(addBusinessDays(trade, 1))
    case '1W':
      shifted.setUTCDate(shifted.getUTCDate() + 7)
      break
    case '1M':
      shifted.setUTCMonth(shifted.getUTCMonth() + 1)
      break
    case '3M':
      shifted.setUTCMonth(shifted.getUTCMonth() + 3)
      break
    case 'BROKEN':
      shifted.setUTCDate(shifted.getUTCDate() + brokenDays)
      break
  }
  return toIsoDate(nextBusinessDay(shifted))
}
