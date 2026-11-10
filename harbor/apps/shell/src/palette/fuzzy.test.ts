import { describe, expect, it } from 'vitest'
import { fuzzyScore, rank } from './fuzzy.ts'

const items = ['Open FX Execution', 'Open Pre-Trade', 'Focus Post-Trade', 'Execute order 10432 · BUY 25m EURUSD', 'View TCA for EURUSD', 'View news for EURUSD', 'View news for USDJPY', 'Switch to FX Trading', 'Open Widget Library']
const top = (query: string, limit = 3) => rank(items, query, (t) => t, limit)

describe('fuzzy matching', () => {
  it('matches every word, in any order, as subsequences', () => {
    expect(fuzzyScore('news eurusd', 'View news for EURUSD')).not.toBeNull()
    expect(fuzzyScore('eurusd news', 'View news for EURUSD')).not.toBeNull()
    expect(fuzzyScore('fxex', 'Open FX Execution')).not.toBeNull()
    expect(fuzzyScore('news gbpusd', 'View news for EURUSD')).toBeNull()
    expect(fuzzyScore('zzz', 'Open Pre-Trade')).toBeNull()
    expect(fuzzyScore('', 'anything')).toBe(0)
    expect(fuzzyScore('   ', 'anything')).toBe(0)
  })

  it('ranks intact words and word starts above scattered letters', () => {
    expect(top('tca')[0]).toBe('View TCA for EURUSD')
    expect(top('10432')[0]).toBe('Execute order 10432 · BUY 25m EURUSD')
    expect(top('news eurusd')[0]).toBe('View news for EURUSD')
    expect(top('news jpy')[0]).toBe('View news for USDJPY')
    expect(top('pre')[0]).toBe('Open Pre-Trade')
    expect(top('lib')[0]).toBe('Open Widget Library')
    expect(fuzzyScore('trade', 'Open Pre-Trade')).toBeGreaterThan(fuzzyScore('trde', 'Open Pre-Trade') ?? 0)
    expect(fuzzyScore('fx', 'Open FX Execution')).toBeGreaterThan(fuzzyScore('fx', 'Switch to FX Trading') ?? 0)
  })

  it('keeps the given order for an empty query and honours the limit', () => {
    expect(top('', 2)).toEqual(items.slice(0, 2))
    expect(top('e', 4)).toHaveLength(4)
    expect(top('nothing matches this')).toEqual([])
    // Equal scores keep their original order.
    expect(rank(['ab', 'ab'], 'ab', (t) => t, 5)).toEqual(['ab', 'ab'])
  })
})
