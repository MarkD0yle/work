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
  const pinned = directory.filter((r) => r.kind === 'app' && canLaunch(user, r))
  const running = new Set(Object.values(panels).map((p) => p.appId))

  return (
    <nav className={`hs-rail${expanded ? ' is-expanded' : ''}`} aria-label="Apps" data-region="rail">
      <button type="button" className="hs-rail__item" aria-expanded={expanded} aria-label={expanded ? 'Collapse app rail' : 'Expand app rail'} title={expanded ? 'Collapse' : 'Expand'} onClick={() => shell.set({ railExpanded: !expanded })}>
        <span className="hs-glyph">
          <Icon name="menu" />
        </span>
        {expanded && <span className="hs-rail__label">Apps</span>}
      </button>
      <ul>
        {pinned.map((app) => (
          <li key={app.appId}>
            <button
              type="button"
              className="hs-rail__item"
              data-app={app.appId}
              aria-label={`${app.title}${running.has(app.appId) ? ' (running)' : ''}`}
              title={`${app.title} — click to focus or open, Shift-click for a new panel`}
              onClick={(e) => void focusOrOpen(app.appId, e.shiftKey)}
            >
              <AppGlyph app={app} running={running.has(app.appId)} />
              {expanded && <span className="hs-rail__label">{app.title}</span>}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className={`hs-rail__item${libraryOpen ? ' is-active' : ''}`} aria-label="All apps" title="All apps (Widget Library)" onClick={() => shell.set({ libraryOpen: !libraryOpen })}>
        <span className="hs-glyph">
          <Icon name="grid" />
        </span>
        {expanded && <span className="hs-rail__label">All apps</span>}
      </button>
    </nav>
  )
}
