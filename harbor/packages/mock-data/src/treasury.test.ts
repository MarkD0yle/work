import { describe, expect, it } from 'vitest'
import { CASH_POLICY, RATE_LOCK_MS, accountCash, canDecide, checkCashOrder, conversionRate, createDataset, nextCutOff, upcomingCutOffs, type MoneyMarketFund } from './index.ts'
import { AS_OF, T0 } from './testkit.ts'

const data = createDataset('harbor', AS_OF)
const account = { code: 'FUND-A', name: 'Test Fund', baseCurrency: 'USD', aumUsdM: 1000 }
const mmf = (rating: MoneyMarketFund['rating']): MoneyMarketFund => ({ id: 'MMF-01', name: 'Test Liquidity Fund', currency: 'USD', yield7dPct: 4.3, aumUsdBn: 10, rating, cutOff: '14:00', cutOffZone: 'New York' })

describe('cash policy', () => {
  it('an account can place 5% of its assets', () => {
    expect(accountCash(account)).toBe(50_000_000)
  })

  it('allows a subscription inside both limits and reports the resulting share', () => {
    expect(checkCashOrder({ account, fund: mmf('AAAm'), side: 'SUBSCRIBE', amount: 10_000_000, holding: 0 })).toEqual({ ok: true, pctAfter: 20 })
    expect(checkCashOrder({ account, fund: mmf('AAm'), side: 'SUBSCRIBE', amount: 12_500_000, holding: 0 })).toEqual({ ok: true, pctAfter: 25 })
  })

  it('blocks a breach and names the rule', () => {
    const concentration = checkCashOrder({ account, fund: mmf('AAAm'), side: 'SUBSCRIBE', amount: 10_000_000, holding: 5_000_000 })
    expect(concentration).toMatchObject({ ok: false, rule: 'Maximum 25% of cash in one fund' })
    if (!concentration.ok) expect(concentration.detail).toContain('30.0%')
    const rating = checkCashOrder({ account, fund: mmf('Am'), side: 'SUBSCRIBE', amount: 1_000_000, holding: 0 })
    expect(rating).toMatchObject({ ok: false, rule: 'Minimum rating AAm' })
    if (!rating.ok) expect(rating.detail).toContain('rated Am')
    expect(checkCashOrder({ account, fund: mmf('AAAm'), side: 'SUBSCRIBE', amount: 0, holding: 0 })).toMatchObject({ ok: false, rule: 'Amount required' })
    expect(CASH_POLICY).toEqual({ maxPctPerFund: 25, minRating: 'AAm' })
    // A stricter policy can be passed in.
    expect(checkCashOrder({ account, fund: mmf('AAm'), side: 'SUBSCRIBE', amount: 1_000_000, holding: 0 }, { maxPctPerFund: 25, minRating: 'AAAm' })).toMatchObject({ ok: false, rule: 'Minimum rating AAAm' })
  })

  it('redemptions ignore the buy rules but cannot exceed the holding', () => {
    expect(checkCashOrder({ account, fund: mmf('Am'), side: 'REDEEM', amount: 4_000_000, holding: 5_000_000 })).toEqual({ ok: true, pctAfter: 2 })
    expect(checkCashOrder({ account, fund: mmf('AAAm'), side: 'REDEEM', amount: 6_000_000, holding: 5_000_000 })).toMatchObject({ ok: false, rule: 'Cannot redeem more than is held' })
  })
})

describe('cut-offs', () => {
  // T0 is Tuesday 10 Nov 2026 14:00 UTC = 09:00 New York (EST), 14:00 London, 22:00 Singapore.
  it('finds the next cut-off in the fund own time zone', () => {
    expect(new Date(nextCutOff({ cutOff: '14:00', cutOffZone: 'New York' }, T0)).toISOString()).toBe('2026-11-10T19:00:00.000Z')
    expect(new Date(nextCutOff({ cutOff: '16:30', cutOffZone: 'London' }, T0)).toISOString()).toBe('2026-11-10T16:30:00.000Z')
    // Already past today: tomorrow.
    expect(new Date(nextCutOff({ cutOff: '13:00', cutOffZone: 'London' }, T0)).toISOString()).toBe('2026-11-11T13:00:00.000Z')
    expect(new Date(nextCutOff({ cutOff: '12:00', cutOffZone: 'Singapore' }, T0)).toISOString()).toBe('2026-11-11T04:00:00.000Z')
  })

  it('skips the weekend', () => {
    const fridayEvening = Date.UTC(2026, 10, 13, 22, 0)
    expect(new Date(nextCutOff({ cutOff: '14:00', cutOffZone: 'London' }, fridayEvening)).toISOString()).toBe('2026-11-16T14:00:00.000Z')
  })

  it('lists the next three distinct cut-offs, soonest first', () => {
    const next = upcomingCutOffs(data.moneyMarketFunds, T0)
    expect(next).toHaveLength(3)
    expect(next.map((n) => n.at)).toEqual([...next.map((n) => n.at)].sort((a, b) => a - b))
    for (const n of next) expect(n.at).toBeGreaterThan(T0)
    expect(new Set(next.map((n) => `${n.fund.currency}@${n.at}`)).size).toBe(3)
    expect(upcomingCutOffs(data.moneyMarketFunds, T0, 1)).toHaveLength(1)
  })
})

describe('payments', () => {
  it('the maker cannot approve their own payment; anyone else can, once', () => {
    const pending = { makerId: 'u-treasury', status: 'PENDING_APPROVAL' as const }
    expect(canDecide(pending, 'u-treasury')).toEqual({ ok: false, rule: 'Segregation of duties: the maker cannot approve their own payment.' })
    expect(canDecide(pending, 'u-ops')).toEqual({ ok: true })
    expect(canDecide({ makerId: 'u-treasury', status: 'APPROVED' }, 'u-ops')).toMatchObject({ ok: false, rule: 'This payment has already been decided.' })
    expect(RATE_LOCK_MS).toBe(30_000)
  })

  it('converts between currencies directly, inversely or through USD', () => {
    const mids: Record<string, number> = { EURUSD: 1.08, USDJPY: 150, EURGBP: 0.85, GBPUSD: 1.27, USDCAD: 1.36 }
    const mid = (pair: string) => mids[pair] ?? 1
    expect(conversionRate('USD', 'USD', mid)).toBe(1)
    expect(conversionRate('EUR', 'USD', mid)).toBe(1.08)
    expect(conversionRate('USD', 'EUR', mid)).toBeCloseTo(1 / 1.08, 10)
    expect(conversionRate('EUR', 'GBP', mid)).toBe(0.85)
    expect(conversionRate('GBP', 'JPY', mid)).toBeCloseTo(1.27 * 150, 10)
    expect(conversionRate('CAD', 'EUR', mid)).toBeCloseTo(1 / 1.36 / 1.08, 10)
    expect(conversionRate('USD', 'BRL', mid)).toBeNull()
    expect(conversionRate('BRL', 'EUR', mid)).toBeNull()
  })
})
