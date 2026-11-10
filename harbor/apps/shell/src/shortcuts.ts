import { useEffect } from 'react'
import { shell } from './state.ts'
import { focusAdjacentPanel } from './components/Layout.tsx'

const REGIONS = ['[data-region="topbar"]', '[data-region="rail"]', '[data-region="layout"]', '[data-region="statusbar"]']
const FOCUSABLE = 'button:not([disabled]), [href], input, select, [tabindex]:not([tabindex="-1"])'

/** Shell-level keys: Cmd/Ctrl-K opens the library, F6 cycles regions, Ctrl-Alt-arrows move between panels. */
export function useShellShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        shell.set({ libraryOpen: !shell.get().libraryOpen })
      } else if (e.key === 'F6') {
        e.preventDefault()
        const regions = REGIONS.map((selector) => document.querySelector<HTMLElement>(selector)).filter((el): el is HTMLElement => el !== null)
        const currentIndex = regions.findIndex((r) => r.contains(document.activeElement))
        const next = regions[(currentIndex + (e.shiftKey ? -1 : 1) + regions.length) % regions.length]
        ;(next?.querySelector<HTMLElement>(FOCUSABLE) ?? next)?.focus()
      } else if (e.ctrlKey && e.altKey && e.key.startsWith('Arrow')) {
        e.preventDefault()
        focusAdjacentPanel(e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
