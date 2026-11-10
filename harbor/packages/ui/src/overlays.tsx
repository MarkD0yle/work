import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon.tsx'
import { IconButton } from './controls.tsx'

/* ---------- Dialog and Drawer (native <dialog>: focus trap, Escape and inertness for free) ---------- */

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

function Modal({ open, onClose, title, children, footer, className }: ModalProps & { className: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    else if (!open && el.open) el.close()
  }, [open])
  if (!open) return null
  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="hb-modal__frame">
        <header className="hb-modal__header">
          <h2 id={titleId}>{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </header>
        <div className="hb-modal__body">{children}</div>
        {footer && <footer className="hb-modal__footer">{footer}</footer>}
      </div>
    </dialog>
  )
}

export function Dialog(props: ModalProps) {
  return <Modal {...props} className="hb-dialog" />
}

export function Drawer(props: ModalProps & { side?: 'left' | 'right' }) {
  const { side = 'right', ...rest } = props
  return <Modal {...rest} className={`hb-drawer hb-drawer--${side}`} />
}

/* ---------- Menu (anchored popover with arrow-key navigation) ---------- */

export interface MenuItem {
  id: string
  label: ReactNode
  onSelect: () => void
  disabled?: boolean
  danger?: boolean
  checked?: boolean
  /** Draw a divider above this item. */
  separated?: boolean
}

export interface MenuProps {
  label: string
  trigger: ReactNode
  items: MenuItem[]
  triggerClassName?: string
  align?: 'start' | 'end'
  header?: ReactNode
  /** The trigger's visible content already names it, so do not override that with `label` (which still names the menu). */
  namedByContent?: boolean
}

export function Menu({ label, trigger, items, triggerClassName = 'hb-icon-button', align = 'start', header, namedByContent = false }: MenuProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  // The trigger is held in state (not a ref) because the portal target is derived from it.
  const [anchorEl, setTrigger] = useState<HTMLButtonElement | null>(null)
  const list = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !anchorEl || !list.current) return
    const view = anchorEl.ownerDocument.defaultView
    const anchor = anchorEl.getBoundingClientRect()
    const menu = list.current.getBoundingClientRect()
    const maxLeft = (view?.innerWidth ?? 0) - menu.width - 4
    const left = Math.max(4, Math.min(align === 'end' ? anchor.right - menu.width : anchor.left, maxLeft))
    const below = anchor.bottom + 2
    const top = below + menu.height > (view?.innerHeight ?? 0) ? Math.max(4, anchor.top - menu.height - 2) : below
    setPosition({ top, left })
    list.current.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])')?.focus()
  }, [open, align, anchorEl])

  useEffect(() => {
    if (!open) return
    const doc = anchorEl?.ownerDocument
    const onDown = (e: MouseEvent) => {
      if (!list.current?.contains(e.target as Node) && !anchorEl?.contains(e.target as Node)) setOpen(false)
    }
    doc?.addEventListener('mousedown', onDown)
    return () => doc?.removeEventListener('mousedown', onDown)
  }, [open, anchorEl])

  const close = (refocus: boolean) => {
    setOpen(false)
    setPosition(null)
    if (refocus) anchorEl?.focus()
  }
  const focusItem = (delta: number | 'first' | 'last') => {
    const nodes = [...(list.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? [])]
    const index = nodes.indexOf(nodes[0]?.ownerDocument.activeElement as HTMLElement)
    const next = delta === 'first' ? 0 : delta === 'last' ? nodes.length - 1 : (index + delta + nodes.length) % nodes.length
    nodes[next]?.focus()
  }

  return (
    <>
      <button
        ref={setTrigger}
        type="button"
        className={triggerClassName}
        aria-label={namedByContent ? undefined : label}
        title={namedByContent ? undefined : label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
      >
        {trigger}
      </button>
      {open &&
        anchorEl &&
        createPortal(
          <div
            ref={list}
            role="menu"
            aria-label={label}
            className="hb-menu"
            style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden' }}
            onKeyDown={(e) => {
              const moves: Record<string, number | 'first' | 'last'> = { ArrowDown: 1, ArrowUp: -1, Home: 'first', End: 'last' }
              const move = moves[e.key]
              if (e.key === 'Escape') close(true)
              else if (e.key === 'Tab') close(false)
              else if (move !== undefined) {
                e.preventDefault()
                focusItem(move)
              }
            }}
          >
            {header && <div className="hb-menu__header">{header}</div>}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={item.checked}
                disabled={item.disabled}
                className={`hb-menu__item${item.danger ? ' is-danger' : ''}${item.separated ? ' is-separated' : ''}`}
                onClick={() => {
                  close(true)
                  item.onSelect()
                }}
              >
                <span className="hb-menu__check">{item.checked && <Icon name="check" size={12} />}</span>
                {item.label}
              </button>
            ))}
          </div>,
          // Portal into the trigger's own document so menus work inside popout windows.
          anchorEl.ownerDocument.body,
        )}
    </>
  )
}

/* ---------- Toasts ---------- */

export type ToastTone = 'info' | 'positive' | 'warning' | 'critical'
export interface ToastItem {
  id: number
  tone: ToastTone
  title: string
  body?: string
  /** One button on the toast, e.g. an alert's action. */
  action?: { label: string; onSelect: () => void }
  /** Called when the user closes the toast (not when it times out or is replaced). */
  onDismiss?: () => void
}

const MAX_TOASTS = 3
let toasts: ToastItem[] = []
let toastSeq = 0
const toastListeners = new Set<() => void>()
const publish = (next: ToastItem[]) => {
  toasts = next
  for (const l of toastListeners) l()
}

export function dismissToast(id: number): void {
  if (toasts.some((t) => t.id === id)) publish(toasts.filter((t) => t.id !== id))
}

/**
 * Show a toast. At most three are on screen. Critical toasts stay until
 * dismissed and are the last to make way; others leave after five seconds.
 */
export function toast(input: Omit<ToastItem, 'id' | 'tone'> & { tone?: ToastTone }): number {
  const item: ToastItem = { tone: 'info', ...input, id: ++toastSeq }
  const next = [...toasts, item]
  while (next.length > MAX_TOASTS) {
    const evict = next.findIndex((t) => t.tone !== 'critical' && t !== item)
    next.splice(evict >= 0 ? evict : 0, 1)
  }
  publish(next)
  if (item.tone !== 'critical') setTimeout(() => dismissToast(item.id), 5000)
  return item.id
}

const TONE_LABEL: Record<ToastTone, string> = { info: 'Info', positive: 'Done', warning: 'Warning', critical: 'Critical' }

export function ToastViewport() {
  const items = useSyncExternalStore(
    (l) => (toastListeners.add(l), () => void toastListeners.delete(l)),
    () => toasts,
  )
  return (
    <div className="hb-toasts" role="region" aria-label="Notifications" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`hb-toast hb-toast--${t.tone}`} role={t.tone === 'critical' ? 'alert' : 'status'}>
          <Icon name={t.tone === 'positive' ? 'check' : t.tone === 'info' ? 'info' : t.tone === 'critical' ? 'critical' : 'warning'} />
          <div className="hb-toast__text">
            <strong>
              <span className="hb-toast__tone">{TONE_LABEL[t.tone]}:</span> {t.title}
            </strong>
            {t.body && <span>{t.body}</span>}
          </div>
          {t.action && (
            <button
              type="button"
              className="hb-button hb-button--secondary"
              onClick={() => {
                dismissToast(t.id)
                t.action?.onSelect()
              }}
            >
              {t.action.label}
            </button>
          )}
          <IconButton
            icon="close"
            label="Dismiss"
            onClick={() => {
              dismissToast(t.id)
              t.onDismiss?.()
            }}
          />
        </div>
      ))}
    </div>
  )
}
