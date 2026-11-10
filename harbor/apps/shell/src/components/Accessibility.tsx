import { useEffect, useState } from 'react'
import { Dialog, Kbd } from '@harbor/ui'
import { announcer } from '../announce.ts'
import { shell, useShell } from '../state.ts'

/** Where throttled announcements are spoken. Visually hidden; polite so it never interrupts. */
export function LiveRegion() {
  const [message, setMessage] = useState('')
  useEffect(() => announcer.subscribe(setMessage), [])
  return (
    <div className="hb-sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="live-region">
      {message}
    </div>
  )
}

const SHORTCUTS: { keys: string[]; does: string }[] = [
  { keys: ['Ctrl / ⌘', 'K'], does: 'Open the command palette: search apps, panels, workspaces, orders and actions' },
  { keys: ['?'], does: 'Show this list' },
  { keys: ['F6'], does: 'Move to the next region: top bar, app rail, workspace, status bar' },
  { keys: ['Shift', 'F6'], does: 'Move to the previous region' },
  { keys: ['Ctrl', 'Alt', '→ or ↓'], does: 'Focus the next panel' },
  { keys: ['Ctrl', 'Alt', '← or ↑'], does: 'Focus the previous panel' },
  { keys: ['Esc'], does: 'Close the open dialog, menu, drawer or the Widget Library' },
  { keys: ['Enter'], does: 'On a panel tab menu button: open the menu to split, move, float, pop out or close the panel' },
  { keys: ['↑', '↓'], does: 'In a menu, the palette or a grid: move between items or rows' },
  { keys: ['Enter'], does: 'In the Order Blotter: execute the selected order. In FX Execution: accept the best quote' },
]

/** The documented shortcut map. Opened with `?` from anywhere, including inside an app. */
export function ShortcutsDialog() {
  const open = useShell((s) => s.shortcutsOpen)
  return (
    <Dialog open={open} onClose={() => shell.set({ shortcutsOpen: false })} title="Keyboard shortcuts">
      <table className="hs-shortcuts" data-testid="shortcuts">
        <tbody>
          {SHORTCUTS.map((s) => (
            <tr key={s.does}>
              <th scope="row">
                {s.keys.map((k, i) => (
                  <span key={k}>
                    {i > 0 && ' + '}
                    <Kbd>{k}</Kbd>
                  </span>
                ))}
              </th>
              <td>{s.does}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hs-note-muted">These work from inside any app as well as from the shell.</p>
    </Dialog>
  )
}
