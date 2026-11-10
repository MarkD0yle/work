import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

/** A set of mutually exclusive choices. Native radios, so arrow keys and grouping work as expected. */
export function RadioGroup<T extends string>({ label, value, onChange, options, disabled }: { label: string; value: T; onChange: (value: T) => void; options: { value: T; label: string }[]; disabled?: boolean }) {
  const name = useId()
  return (
    <fieldset className="hb-radio-group" disabled={disabled}>
      <legend className="hb-field__label">{label}</legend>
      {options.map((option) => (
        <label key={option.value} className="hb-checkbox">
          <input type="radio" name={name} value={option.value} checked={option.value === value} onChange={() => onChange(option.value)} />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  )
}

/** A short hint shown on hover and on keyboard focus. The hint is also the element's accessible description. */
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const id = useId()
  return (
    <span className="hb-tooltip" aria-describedby={id}>
      {children}
      <span role="tooltip" id={id} className="hb-tooltip__text">
        {text}
      </span>
    </span>
  )
}

/** A button that opens a small non-modal panel beside it. Escape or a click outside closes it. */
export function Popover({ label, trigger, children }: { label: string; trigger: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const doc = root.current?.ownerDocument
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    doc?.addEventListener('mousedown', onDown)
    return () => doc?.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <span
      ref={root}
      className="hb-popover"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          setOpen(false)
          button.current?.focus()
        }
      }}
    >
      <button ref={button} type="button" className="hb-button hb-button--secondary" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open && (
        <div role="dialog" aria-label={label} className="hb-popover__panel">
          {children}
        </div>
      )}
    </span>
  )
}

export interface ComboboxOption {
  value: string
  label: string
}

/** A text field that filters a list of options as you type. Arrow keys move, Enter picks, Escape closes. */
export function Combobox({ label, options, value, onChange, placeholder }: { label: string; options: ComboboxOption[]; value: string | null; onChange: (value: string | null) => void; placeholder?: string }) {
  const id = useId()
  const selected = options.find((o) => o.value === value)
  const [text, setText] = useState(selected?.label ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const shown = options.filter((o) => o.label.toLowerCase().includes(text.trim().toLowerCase()))
  const current = Math.min(active, Math.max(0, shown.length - 1))
  const pick = (option: ComboboxOption | undefined) => {
    if (!option) return
    setText(option.label)
    setOpen(false)
    onChange(option.value)
  }
  return (
    <div className="hb-field hb-combobox">
      <label className="hb-field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="hb-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[current] ? `${id}-${current}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
          setActive(0)
          if (e.target.value === '') onChange(null)
        }}
        onFocus={() => setOpen(true)}
        // Delayed so a click on an option lands before the list goes away.
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((current + 1) % Math.max(1, shown.length))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((current - 1 + shown.length) % Math.max(1, shown.length))
          } else if (e.key === 'Enter' && open) {
            e.preventDefault()
            pick(shown[current])
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation()
            setOpen(false)
          }
        }}
      />
      {open && (
        <ul id={`${id}-list`} role="listbox" aria-label={label} className="hb-combobox__list">
          {shown.length === 0 ? (
            <li className="hb-combobox__empty">No matches</li>
          ) : (
            shown.map((option, index) => (
              <li key={option.value} id={`${id}-${index}`} role="option" aria-selected={index === current} className={index === current ? 'is-active' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(option)}>
                {option.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
