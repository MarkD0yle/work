import type { Fund, MoneyMarketFund } from './entities.ts'
import { PAIRS } from './pairs.ts'

/* ---------- cash: investment policy ---------- */

export interface CashPolicy {
  /** No more than this share of an account's cash may sit in one fund. */
  maxPctPerFund: number
  /** Funds rated below this may not be bought. */
  minRating: MoneyMarketFund['rating']
}
export const CASH_POLICY: CashPolicy = { maxPctPerFund: 25, minRating: 'AAm' }

const RATING_RANK: Record<MoneyMarketFund['rating'], number> = { AAAm: 3, AAm: 2, Am: 1 }

/** Cash an account has available to place: a fixed 5% of its assets. Amounts are treated as USD-equivalent. */
export function accountCash(account: Fund): number {
  return account.aumUsdM * 1_000_000 * 0.05
}

export interface CashOrder {
  account: Fund
  fund: MoneyMarketFund
  side: 'SUBSCRIBE' | 'REDEEM'
  amount: number
  /** What the account already holds in this fund. */
  holding: number
}

export type PolicyResult = { ok: true; pctAfter: number } | { ok: false; rule: string; detail: string }

/** Check a subscription or redemption against the policy. A breach names the rule that was broken. */
export function checkCashOrder(order: CashOrder, policy: CashPolicy = CASH_POLICY): PolicyResult {
  const cash = accountCash(order.account)
  if (!(order.amount > 0)) return { ok: false, rule: 'Amount required', detail: 'Enter an amount greater than zero.' }
  if (order.side === 'REDEEM') {
    if (order.amount > order.holding) {
      return { ok: false, rule: 'Cannot redeem more than is held', detail: `${order.account.code} holds ${order.holding.toLocaleString('en-US')} in this fund.` }
    }
    return { ok: true, pctAfter: ((order.holding - order.amount) / cash) * 100 }
  }
  if (RATING_RANK[order.fund.rating] < RATING_RANK[policy.minRating]) {
    return { ok: false, rule: `Minimum rating ${policy.minRating}`, detail: `${order.fund.name} is rated ${order.fund.rating}.` }
  }
  const pctAfter = ((order.holding + order.amount) / cash) * 100
  if (pctAfter > policy.maxPctPerFund) {
    return { ok: false, rule: `Maximum ${policy.maxPctPerFund}% of cash in one fund`, detail: `This would put ${pctAfter.toFixed(1)}% of ${order.account.code}'s cash in ${order.fund.name}.` }
  }
  return { ok: true, pctAfter }
}

/* ---------- cut-offs ---------- */

const ZONES: Record<MoneyMarketFund['cutOffZone'], string> = { 'New York': 'America/New_York', London: 'Europe/London', Dublin: 'Europe/Dublin', Singapore: 'Asia/Singapore' }

/** The wall-clock time in a zone, expressed as if it were UTC. */
function wallClock(ms: number, zone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<string, number>
  return Date.UTC(parts.year as number, (parts.month as number) - 1, parts.day as number, parts.hour as number, parts.minute as number, parts.second as number)
}

/** When a fund's next dealing cut-off falls, as an epoch time. Weekends are skipped. */
export function nextCutOff(fund: Pick<MoneyMarketFund, 'cutOff' | 'cutOffZone'>, nowMs: number): number {
  const zone = ZONES[fund.cutOffZone]
  const local = wallClock(nowMs, zone)
  const offset = local - Math.floor(nowMs / 1000) * 1000
  const [hours, minutes] = fund.cutOff.split(':').map(Number) as [number, number]
  const day = new Date(local)
  let candidate = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hours, minutes)
  const weekend = (ms: number) => [0, 6].includes(new Date(ms).getUTCDay())
  while (candidate <= local || weekend(candidate)) candidate += 86_400_000
  return candidate - offset
}

export interface UpcomingCutOff {
  fund: MoneyMarketFund
  at: number
}

/** The next `count` distinct cut-off times across funds, soonest first. One fund per distinct time and currency. */
export function upcomingCutOffs(funds: readonly MoneyMarketFund[], nowMs: number, count = 3): UpcomingCutOff[] {
  const seen = new Set<string>()
  return funds
    .map((fund) => ({ fund, at: nextCutOff(fund, nowMs) }))
    .sort((a, b) => a.at - b.at || a.fund.id.localeCompare(b.fund.id))
    .filter(({ fund, at }) => {
      const key = `${fund.currency}@${at}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, count)
}

/* ---------- payments ---------- */

export type PaymentStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'

export interface Payment {
  id: string
  beneficiaryId: string
  beneficiaryName: string
  amount: number
  currency: string
  debitAccount: string
  debitCurrency: string
  /** Units of the payment currency per one unit of the debit currency, locked when the payment was made. */
  rate: number
  reference: string
  makerId: string
  makerName: string
  createdAt: string
  status: PaymentStatus
  deciderId?: string
  deciderName?: string
  decidedAt?: string
}

/** How long a locked FX rate stays good. */
export const RATE_LOCK_MS = 30_000

/** Two-step approval with segregation of duties: whoever made a payment cannot approve or reject it. */
export function canDecide(payment: Pick<Payment, 'makerId' | 'status'>, userId: string): { ok: true } | { ok: false; rule: string } {
  if (payment.status !== 'PENDING_APPROVAL') return { ok: false, rule: 'This payment has already been decided.' }
  if (payment.makerId === userId) return { ok: false, rule: 'Segregation of duties: the maker cannot approve their own payment.' }
  return { ok: true }
}

/**
 * How many units of `to` one unit of `from` buys, from mids for the twelve
 * pairs. Uses the direct pair, its inverse, or goes through USD.
 */
export function conversionRate(from: string, to: string, mid: (pair: string) => number): number | null {
  if (from === to) return 1
  const has = (pair: string) => PAIRS.some((p) => p.pair === pair)
  if (has(from + to)) return mid(from + to)
  if (has(to + from)) return 1 / mid(to + from)
  if (from !== 'USD' && to !== 'USD') {
    const first = conversionRate(from, 'USD', mid)
    const second = conversionRate('USD', to, mid)
    return first !== null && second !== null ? first * second : null
  }
  return null
}
