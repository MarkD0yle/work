import { canLaunch } from '@harbor/schemas'
import { Icon } from '@harbor/ui'
import { shell, useShell } from '../state.ts'
import { focusOrOpen } from '../workspaces/controller.ts'
import { AppGlyph } from './AppGlyph.tsx'

export function AppRail() {
  const user = useShell((s) => s.user)
  const directory = useShell((s) => s.directory)
  const panels = useShell((s) => s.panels)
  const expanded = useShell((s) => s.railExpanded)
  const libraryOpen = useShell((s) => s.libraryOpen)
  if (!user) return null
  // Entitlement filter first: an app the user cannot launch is simply not here.
  // Developer tools stay in the library; the rail is for the apps people work in.
  const pinned = directory.filter((r) => r.kind === 'app' && r.category !== 'Developer' && canLaunch(user, r))
  const running = new Set(Object.values(panels).map((p) => p.appId))

  return (
    <nav className={`hs-rail${expanded ? ' is-expanded' : ''}`} aria-label="Apps" data-region="rail">
      <button type="button" className="hs-rail__item" aria-expanded={expanded} title={expanded ? 'Collapse' : 'Expand'} onClick={() => shell.set({ railExpanded: !expanded })}>
        <span className="hs-glyph" aria-hidden="true">
          <Icon name="menu" />
        </span>
        <span className={expanded ? 'hs-rail__label' : 'hb-sr-only'}>{expanded ? 'Collapse app rail' : 'Expand app rail'}</span>
      </button>
      <ul>
        {pinned.map((app) => (
          <li key={app.appId}>
            <button type="button" className="hs-rail__item" data-app={app.appId} title={`${app.title} — click to focus or open, Shift-click for a new panel`} onClick={(e) => void focusOrOpen(app.appId, e.shiftKey)}>
              <AppGlyph app={app} running={running.has(app.appId)} />
              {/* The name is real text: visible when the rail is expanded, screen-reader-only when collapsed. */}
              <span className={expanded ? 'hs-rail__label' : 'hb-sr-only'}>
                {app.title}
                {running.has(app.appId) && <span className="hb-sr-only"> (running)</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className={`hs-rail__item${libraryOpen ? ' is-active' : ''}`} title="All apps (Widget Library)" aria-pressed={libraryOpen} onClick={() => shell.set({ libraryOpen: !libraryOpen })}>
        <span className="hs-glyph" aria-hidden="true">
          <Icon name="grid" />
        </span>
        <span className={expanded ? 'hs-rail__label' : 'hb-sr-only'}>All apps</span>
      </button>
    </nav>
  )
}
