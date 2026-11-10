import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { realmServices } from '@harbor/app-kit'
import type { Order } from '@harbor/mock-data'
import { Icon, Kbd } from '@harbor/ui'
import { rank } from '../palette/fuzzy.ts'
import { buildPaletteItems, type PaletteItem } from '../palette/items.ts'
import { shell, useShell } from '../state.ts'

const LIMIT = 12

function Palette() {
  const dialog = useRef<HTMLDialogElement>(null)
  const listId = useId()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [orders, setOrders] = useState<Order[]>([])
  // Read so the list is rebuilt if these change while the palette is open.
  const panels = useShell((s) => s.panels)
  const saved = useShell((s) => s.saved)

  useEffect(() => {
    dialog.current?.showModal()
    let live = true
    void realmServices().orders.list().then((list) => live && setOrders(list))
    return () => {
      live = false
    }
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- panels and saved are deliberate rebuild triggers
  const items = useMemo(() => buildPaletteItems(orders), [orders, panels, saved])
  const results = useMemo(() => rank(items, query, (item) => `${item.title} ${item.group} ${item.keywords ?? ''}`, LIMIT), [items, query])
  const current = Math.min(active, Math.max(0, results.length - 1))
  const close = () => shell.set({ paletteOpen: false })
  const run = (item: PaletteItem | undefined) => {
    if (!item) return
    close()
    item.run()
  }

  return (
    <dialog
      ref={dialog}
      className="hs-palette"
      aria-label="Command palette"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => {
        if (e.target === dialog.current) close()
      }}
    >
      <div className="hs-palette__input">
        <Icon name="search" />
        <input
          type="text"
          role="combobox"
          aria-label="Search apps, panels, workspaces, orders and actions"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[current] ? `${listId}-${current}` : undefined}
          aria-autocomplete="list"
          placeholder="Type to search: an app, an order number, “news eurusd”…"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((current + 1) % Math.max(1, results.length))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((current - 1 + results.length) % Math.max(1, results.length))
            } else if (e.key === 'Home') {
              e.preventDefault()
              setActive(0)
            } else if (e.key === 'End') {
              e.preventDefault()
              setActive(results.length - 1)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              run(results[current])
            }
          }}
        />
      </div>
      <ul id={listId} role="listbox" aria-label="Results" className="hs-palette__list" data-testid="palette-results">
        {results.map((item, index) => (
          <li
            key={item.id}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === current}
            className={index === current ? 'is-active' : ''}
            onMouseMove={() => setActive(index)}
            onClick={() => run(item)}
          >
            <span>{item.title}</span>
            <span className="hs-palette__group">{item.group}</span>
          </li>
        ))}
        {results.length === 0 && <li className="hs-palette__empty">Nothing matches “{query}”.</li>}
      </ul>
      <footer className="hs-palette__footer">
        <span>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> to move
        </span>
        <span>
          <Kbd>Enter</Kbd> to run
        </span>
        <span>
          <Kbd>Esc</Kbd> to close
        </span>
        <span className="hs-palette__count">
          {results.length} of {items.length}
        </span>
      </footer>
    </dialog>
  )
}

/** Cmd/Ctrl-K. Fully keyboard driven; only offers what this user is entitled to do. */
export function CommandPalette() {
  const open = useShell((s) => s.paletteOpen)
  // Mounted only while open, so each opening starts with an empty query.
  return open ? <Palette /> : null
}
