/* Number entry and display helpers shared by every app. */

const MULTIPLIERS: Record<string, number> = { k: 1e3, m: 1e6, mm: 1e6, b: 1e9, bn: 1e9 }

/** Parse trader shorthand: `25m`, `500k`, `1.5b`, `2,500,000`. Returns null when it is not a positive amount. */
export function parseAmount(text: string): number | null {
  const match = /^([0-9]*\.?[0-9]+)\s*(k|mm|m|bn|b)?$/i.exec(text.trim().replace(/,/g, ''))
  if (!match) return null
  const value = Number(match[1]) * (match[2] ? (MULTIPLIERS[match[2].toLowerCase()] ?? 1) : 1)
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null
}

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** Thousand separators, at most two decimals. */
export function formatAmount(value: number): string {
  return grouped.format(value)
}

/** Short form for tight spaces: 25m, 1.5bn, 500k. */
export function formatCompact(value: number): string {
  const abs = Math.abs(value)
  const short = (n: number, suffix: string) => `${Number(n.toFixed(2))}${suffix}`
  if (abs >= 1e9) return short(value / 1e9, 'bn')
  if (abs >= 1e6) return short(value / 1e6, 'm')
  if (abs >= 1e3) return short(value / 1e3, 'k')
  return String(value)
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function belowThousand(n: number): string {
  const parts: string[] = []
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} hundred`)
    n %= 100
    if (n > 0) parts.push('and')
  }
  if (n >= 20) parts.push(n % 10 ? `${TENS[Math.floor(n / 10)]}-${ONES[n % 10]}` : (TENS[n / 10] as string))
  else if (n > 0 || parts.length === 0) parts.push(ONES[n] as string)
  return parts.join(' ')
}

/** A whole amount in words, for the large-trade confirmation: "seventy-five million EUR". */
export function amountInWords(value: number, currency: string): string {
  let rest = Math.round(value)
  if (rest === 0) return `zero ${currency}`
  const parts: string[] = []
  for (const [size, name] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']] as const) {
    if (rest >= size) {
      parts.push(`${belowThousand(Math.floor(rest / size))} ${name}`)
      rest %= size
    }
  }
  if (rest > 0) parts.push(belowThousand(rest))
  return `${parts.join(' ')} ${currency}`
}

/** How long ago, compactly: 45s, 12m, 3h 05m, 2d. */
export function formatAge(fromIso: string, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - Date.parse(fromIso)) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`
  return `${Math.floor(hours / 24)}d`
}

export function formatBps(bps: number): string {
  return `${bps > 0 ? '+' : ''}${bps.toFixed(2)}`
}
