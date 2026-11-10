import { useEffect } from 'react'
import { isTypingTarget, shellShortcutFor, type ShellShortcut } from '@harbor/schemas'
import { shell } from './state.ts'
import { focusAdjacentPanel } from './components/Layout.tsx'

const REGIONS = ['[data-region="topbar"]', '[data-region="rail"]', '[data-region="layout"]', '[data-region="statusbar"]']
const FOCUSABLE = 'button:not([disabled]), [href], input, select, [tabindex]:not([tabindex="-1"])'

/** Carry out a shell shortcut, whether it was pressed in the shell or forwarded from an app. */
export function runShortcut(name: ShellShortcut): void {
  if (name === 'help') {
    shell.set({ shortcutsOpen: !shell.get().shortcutsOpen })
  } else if (name === 'commandPalette') {
    shell.set({ paletteOpen: !shell.get().paletteOpen })
  } else if (name === 'nextRegion' || name === 'previousRegion') {
    const regions = REGIONS.map((selector) => document.querySelector<HTMLElement>(selector)).filter((el): el is HTMLElement => el !== null)
    // Focus inside an app's iframe counts as being in the layout region.
    const currentIndex = regions.findIndex((r) => r.contains(document.activeElement))
    const next = regions[(currentIndex + (name === 'nextRegion' ? 1 : -1) + regions.length) % regions.length]
    ;(next?.querySelector<HTMLElement>(FOCUSABLE) ?? next)?.focus()
  } else {
    focusAdjacentPanel(name === 'nextPanel' ? 1 : -1)
  }
}

/** Shell-level keys: Cmd/Ctrl-K opens the command palette, Escape closes the library, F6 cycles regions, Ctrl-Alt-arrows move between panels. */
export function useShellShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const shortcut = shellShortcutFor(e, isTypingTarget(e.target))
      if (shortcut) {
        e.preventDefault()
        runShortcut(shortcut)
      } else if (e.key === 'Escape' && shell.get().libraryOpen && !document.querySelector('dialog[open]')) {
        // The library is a side sheet, not a modal, so Escape must work wherever focus is.
        shell.set({ libraryOpen: false })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
