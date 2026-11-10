import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { Icon, type IconName } from './Icon.tsx'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  icon?: IconName
}

export function Button({ variant = 'secondary', icon, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={cx('hb-button', `hb-button--${variant}`, className)} {...rest}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  )
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  /** Required: icon-only buttons need an accessible name. */
  label: string
  active?: boolean
}

export function IconButton({ icon, label, active, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} title={label} className={cx('hb-icon-button', active && 'is-active', className)} {...rest}>
      <Icon name={icon} />
    </button>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hideLabel?: boolean
  error?: string
}

export function Input({ label, hideLabel, error, id, className, ...rest }: InputProps) {
  const inputId = id ?? `in-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <label className={cx('hb-field', className)} htmlFor={inputId}>
      <span className={hideLabel ? 'hb-sr-only' : 'hb-field__label'}>{label}</span>
      <input id={inputId} className="hb-input" aria-invalid={error ? true : undefined} {...rest} />
      {error && (
        <span className="hb-field__error" role="alert">
          {error}
        </span>
      )}
    </label>
  )
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  hideLabel?: boolean
  options: { value: string; label: string }[]
}

export function Select({ label, hideLabel, options, className, ...rest }: SelectProps) {
  return (
    <label className={cx('hb-field', className)}>
      <span className={hideLabel ? 'hb-sr-only' : 'hb-field__label'}>{label}</span>
      <select className="hb-input" {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Switch({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} className="hb-switch" onClick={() => onChange(!checked)}>
      <span className="hb-switch__track" aria-hidden="true">
        <span className="hb-switch__thumb" />
      </span>
      <span>{label}</span>
      <span className="hb-switch__state">{checked ? 'On' : 'Off'}</span>
    </button>
  )
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="hb-checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export interface TabItem<T extends string> {
  id: T
  label: string
  count?: number
}

/** Tab list with roving focus: arrows move, Home/End jump. */
export function Tabs<T extends string>({ items, value, onChange, label }: { items: TabItem<T>[]; value: T; onChange: (id: T) => void; label: string }) {
  const move = (delta: number | 'first' | 'last', target: HTMLElement) => {
    const index = items.findIndex((i) => i.id === value)
    const next = delta === 'first' ? 0 : delta === 'last' ? items.length - 1 : (index + delta + items.length) % items.length
    const item = items[next]
    if (!item) return
    onChange(item.id)
    const buttons = target.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')
    buttons?.[next]?.focus()
  }
  return (
    <div role="tablist" aria-label={label} className="hb-tabs">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === value}
          tabIndex={item.id === value ? 0 : -1}
          className="hb-tab"
          onClick={() => onChange(item.id)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') move(1, e.currentTarget)
            else if (e.key === 'ArrowLeft') move(-1, e.currentTarget)
            else if (e.key === 'Home') move('first', e.currentTarget)
            else if (e.key === 'End') move('last', e.currentTarget)
          }}
        >
          {item.label}
          {item.count !== undefined && <span className="hb-tab__count">{item.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warning' | 'critical' | 'positive' }) {
  return <span className={`hb-badge hb-badge--${tone}`}>{children}</span>
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="hb-kbd">{children}</kbd>
}

export function Skeleton({ lines = 4, label = 'Loading' }: { lines?: number; label?: string }) {
  return (
    <div className="hb-skeleton" role="status" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="hb-skeleton__line" style={{ width: `${90 - ((i * 17) % 45)}%` }} />
      ))}
    </div>
  )
}

export function EmptyState({ title, body, icon = 'info', action }: { title: string; body?: string; icon?: IconName; action?: ReactNode }) {
  return (
    <div className="hb-state">
      <Icon name={icon} size={24} />
      <p className="hb-state__title">{title}</p>
      {body && <p className="hb-state__body">{body}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', body, onReload }: { title?: string; body?: string; onReload?: () => void }) {
  return (
    <div className="hb-state hb-state--error" role="alert">
      <Icon name="warning" size={24} />
      <p className="hb-state__title">{title}</p>
      {body && <p className="hb-state__body">{body}</p>}
      {onReload && (
        <Button icon="reload" onClick={onReload}>
          Reload
        </Button>
      )}
    </div>
  )
}
