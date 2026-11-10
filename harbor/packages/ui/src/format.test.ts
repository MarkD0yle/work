import { describe, expect, it } from 'vitest'
import { amountInWords, formatAge, formatAmount, formatBps, formatCompact, parseAmount } from './format.ts'

describe('amount entry', () => {
  it('accepts trader shorthand', () => {
    expect(parseAmount('25m')).toBe(25_000_000)
    expect(parseAmount('500k')).toBe(500_000)
    expect(parseAmount('1.5b')).toBe(1_500_000_000)
    expect(parseAmount('2bn')).toBe(2_000_000_000)
    expect(parseAmount('10MM')).toBe(10_000_000)
    expect(parseAmount(' 2,500,000 ')).toBe(2_500_000)
    expect(parseAmount('.5m')).toBe(500_000)
    expect(parseAmount('1234.56')).toBe(1234.56)
  })

  it('rejects anything that is not a positive amount', () => {
    for (const bad of ['', 'abc', '-5m', '0', '5x', '1.2.3', 'm', '5 m k']) expect(parseAmount(bad), bad).toBeNull()
  })
})

describe('display', () => {
  it('groups thousands and shortens', () => {
    expect(formatAmount(25_000_000)).toBe('25,000,000')
    expect(formatAmount(1234.5)).toBe('1,234.5')
    expect(formatCompact(25_000_000)).toBe('25m')
    expect(formatCompact(1_500_000_000)).toBe('1.5bn')
    expect(formatCompact(500_000)).toBe('500k')
    expect(formatCompact(750)).toBe('750')
  })

  it('writes amounts in words', () => {
    expect(amountInWords(75_000_000, 'EUR')).toBe('seventy-five million EUR')
    expect(amountInWords(1_500_000_000, 'USD')).toBe('one billion five hundred million USD')
    expect(amountInWords(100_000_000, 'GBP')).toBe('one hundred million GBP')
    expect(amountInWords(2_345_678, 'USD')).toBe('two million three hundred and forty-five thousand six hundred and seventy-eight USD')
    expect(amountInWords(20_000, 'JPY')).toBe('twenty thousand JPY')
    expect(amountInWords(13, 'USD')).toBe('thirteen USD')
    expect(amountInWords(0, 'USD')).toBe('zero USD')
  })

  it('formats ages and basis points', () => {
    const now = Date.parse('2026-11-10T14:00:00Z')
    expect(formatAge('2026-11-10T13:59:15Z', now)).toBe('45s')
    expect(formatAge('2026-11-10T13:48:00Z', now)).toBe('12m')
    expect(formatAge('2026-11-10T10:55:00Z', now)).toBe('3h 05m')
    expect(formatAge('2026-11-08T10:00:00Z', now)).toBe('2d')
    expect(formatAge('2026-11-10T15:00:00Z', now)).toBe('0s')
    expect(formatBps(1.234)).toBe('+1.23')
    expect(formatBps(-0.5)).toBe('-0.50')
    expect(formatBps(0)).toBe('0.00')
  })
})
