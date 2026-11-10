import { useEffect, useId, useState, type ReactNode } from 'react'
import { formatAmount, parseAmount } from './format.ts'

/** A rate with fixed decimals and the two pip digits larger, as traders read it. */
export function PriceCell({ value, decimals, flash }: { value: number | undefined; decimals: number; flash?: 'up' | 'down' | 'none' }) {
  if (value === undefined) return <span className="hb-price is-empty">–</span>
  const text = value.toFixed(decimals)
  return (
    <span className={`hb-price${flash && flash !== 'none' ? ` hb-price--${flash}` : ''}`}>
      {text.slice(0, -3)}
      <span className="hb-price__pips">{text.slice(-3, -1)}</span>
      {text.slice(-1)}
    </span>
  )
}

/** Right-aligned amount with thousand separators and an optional currency. */
export function AmountCell({ value, currency }: { value: number; currency?: string }) {
  return (
    <span className="hb-amount">
      {formatAmount(value)}
      {currency && <span className="hb-amount__ccy"> {currency}</span>}
    </span>
  )
}

/** Buy/sell: a colour and a text label, never colour alone. */
export function SideLabel({ side }: { side: 'BUY' | 'SELL' }) {
  return <span className={`hb-side hb-side--${side.toLowerCase()}`}>{side}</span>
}

export type PillTone = 'neutral' | 'info' | 'positive' | 'warning' | 'critical'
const PILL_ICON: Record<PillTone, string> = { neutral: '○', info: '◔', positive: '✓', warning: '!', critical: '✕' }

/** Status with an icon and a label, so state never depends on colour alone. */
export function StatusPill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span className={`hb-pill hb-pill--${tone}`}>
      <span aria-hidden="true">{PILL_ICON[tone]}</span>
      {children}
    </span>
  )
}

export function KeyValueList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="hb-kv">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The one ticket layout: a titled block of fields with its actions underneath. */
export function Ticket({ title, badge, children, actions }: { title: string; badge?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  const headingId = useId()
  return (
    <section className="hb-ticket" aria-labelledby={headingId}>
      <header className="hb-ticket__header">
        <h2 id={headingId}>{title}</h2>
        {badge}
      </header>
      <div className="hb-ticket__body">{children}</div>
      {actions && <footer className="hb-ticket__actions">{actions}</footer>}
    </section>
  )
}

/** Time left on a quote: a draining ring with the seconds inside. */
export function Countdown({ expiresAt, totalMs, now = Date.now }: { expiresAt: number; totalMs: number; now?: () => number }) {
  const [left, setLeft] = useState(() => Math.max(0, expiresAt - now()))
  useEffect(() => {
    const timer = setInterval(() => setLeft(Math.max(0, expiresAt - now())), 100)
    return () => clearInterval(timer)
  }, [expiresAt, now])
  const fraction = Math.min(1, left / totalMs)
  const seconds = Math.ceil(left / 1000)
  // r=15.915 gives a circumference of 100, so the dash array is a percentage.
  return (
    <span className={`hb-countdown${seconds <= 3 ? ' is-urgent' : ''}`} role="timer" aria-label={`${seconds} seconds left`}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className="hb-countdown__track" cx="18" cy="18" r="15.915" />
        <circle className="hb-countdown__ring" cx="18" cy="18" r="15.915" strokeDasharray={`${fraction * 100} 100`} />
      </svg>
      <span>{seconds}</span>
    </span>
  )
}

export interface NumberInputProps {
  label: string
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
  placeholder?: string
}

/** Amount entry that understands `25m`, `500k`, `1.5b`. Shows the parsed value grouped once it is valid. */
export function NumberInput({ label, value, onChange, disabled, placeholder = 'e.g. 25m' }: NumberInputProps) {
  const id = useId()
  const [text, setText] = useState(value === null ? '' : formatAmount(value))
  const [touched, setTouched] = useState(false)
  const invalid = touched && text.trim() !== '' && parseAmount(text) === null
  return (
    <label className="hb-field" htmlFor={id}>
      <span className="hb-field__label">{label}</span>
      <input
        id={id}
        className="hb-input hb-input--number"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={text}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          setText(e.target.value)
          onChange(parseAmount(e.target.value))
        }}
        onBlur={() => {
          setTouched(true)
          const parsed = parseAmount(text)
          if (parsed !== null) setText(formatAmount(parsed))
        }}
      />
      {invalid && (
        <span className="hb-field__error" role="alert">
          Enter an amount such as 25m, 500k or 1.5b.
        </span>
      )}
    </label>
  )
}

/** A tiny trend line. Decorative: the number beside it carries the meaning. */
export function Sparkline({ values, width = 64, height = 18 }: { values: readonly number[]; width?: number; height?: number }) {
  if (values.length < 2) return <svg className="hb-sparkline" width={width} height={height} aria-hidden="true" />
  const min = Math.min(...values)
  const span = Math.max(...values) - min || 1
  const points = values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 1 - ((v - min) / span) * (height - 2)).toFixed(1)}`).join(' ')
  const rising = (values.at(-1) ?? 0) >= (values[0] ?? 0)
  return (
    <svg className={`hb-sparkline hb-sparkline--${rising ? 'up' : 'down'}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} />
    </svg>
  )
}
