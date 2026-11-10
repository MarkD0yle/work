import { useEffect, useMemo, useRef, useState } from 'react'
import { canLaunch, type DirectoryRecord } from '@harbor/schemas'
import { Badge, Button, EmptyState, IconButton, Input, Select, Tabs } from '@harbor/ui'
import { shell, useShell } from '../state.ts'
import { addPanel, openWorkspace, workspaceEntries } from '../workspaces/controller.ts'
import { AppGlyph } from './AppGlyph.tsx'

export const DRAG_TYPE = 'application/x-harbor-app'
type TabId = 'app' | 'widget' | 'tile' | 'workspace'

/**
 * The Widget Library. A non-modal side sheet rather than a modal dialog, so
 * a card can be dragged from it straight onto the layout.
 */
export function Library() {
  const open = useShell((s) => s.libraryOpen)
  const user = useShell((s) => s.user)
  const directory = useShell((s) => s.directory)
  const saved = useShell((s) => s.saved)
  const activeId = useShell((s) => s.activeId)
  const [tab, setTab] = useState<TabId>('app')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const search = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) search.current?.querySelector('input')?.focus()
  }, [open])

  // "Entitled only" is always on: unentitled apps are filtered out before anything else.
  const entitled = useMemo(() => (user ? directory.filter((r) => canLaunch(user, r)) : []), [directory, user])
  if (!open || !user) return null

  const q = query.trim().toLowerCase()
  const matches = (r: DirectoryRecord) =>
    (category === 'all' || r.category === category) && (!q || `${r.title} ${r.description} ${r.category} ${r.publisher}`.toLowerCase().includes(q))
  const byKind = (kind: DirectoryRecord['kind']) => entitled.filter((r) => r.kind === kind)
  const visible = tab === 'workspace' ? [] : byKind(tab).filter(matches)
  const categories = [...new Set(entitled.map((r) => r.category))].sort()
  // `saved` is read so the list refreshes when workspaces change.
  const workspaces = saved && workspaceEntries().filter((w) => !q || w.name.toLowerCase().includes(q))
  const close = () => shell.set({ libraryOpen: false })

  return (
    <aside className="hs-library" role="dialog" aria-label="Widget Library" data-testid="library" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <header className="hs-library__header">
        <h2>Widget Library</h2>
        <IconButton icon="close" label="Close library" onClick={close} />
      </header>
      <div className="hs-library__filters" ref={search}>
        <Input label="Search library" hideLabel placeholder="Search apps, widgets, tiles, workspaces" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select label="Category" hideLabel value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: 'all', label: 'All categories' }, ...categories.map((c) => ({ value: c, label: c }))]} />
      </div>
      <Tabs<TabId>
        label="Library sections"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'app', label: 'Apps', count: byKind('app').length },
          { id: 'widget', label: 'Widgets', count: byKind('widget').length },
          { id: 'tile', label: 'Tiles', count: byKind('tile').length },
          { id: 'workspace', label: 'Workspaces', count: workspaceEntries().length },
        ]}
      />
      <div className="hs-library__list" role="tabpanel">
        {tab === 'workspace' ? (
          workspaces.map((w) => (
            <article key={w.id} className="hs-card">
              <div className="hs-card__body">
                <h3>{w.name}</h3>
                <p>{w.isTemplate ? 'Role default. Editing it saves your own copy.' : 'Saved workspace.'}</p>
              </div>
              <Button disabled={w.id === activeId} onClick={() => void openWorkspace(w.id)}>
                {w.id === activeId ? 'Open now' : 'Open'}
              </Button>
            </article>
          ))
        ) : visible.length === 0 ? (
          <EmptyState title={tab === 'tile' && byKind('tile').length === 0 ? 'No tiles yet' : 'Nothing matches'} body={tab === 'tile' && byKind('tile').length === 0 ? 'Tiles arrive with the mock data and core apps.' : 'Try a different search or category.'} />
        ) : (
          visible.map((app) => (
            <article
              key={app.appId}
              className="hs-card"
              data-app={app.appId}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, app.appId)
                e.dataTransfer.effectAllowed = 'copy'
                shell.set({ dragging: true })
              }}
              onDragEnd={() => shell.set({ dragging: false })}
            >
              <AppGlyph app={app} />
              <div className="hs-card__body">
                <h3>
                  {app.title} <Badge tone={app.publisher === 'Partner' ? 'warning' : 'neutral'}>{app.publisher}</Badge>
                </h3>
                <p>{app.description}</p>
                <p className="hs-card__intents">
                  {Object.keys(app.interop.intents.listensFor).length > 0 ? `Handles ${Object.keys(app.interop.intents.listensFor).join(', ')}` : 'Handles no intents'}
                </p>
              </div>
              <Button icon="plus" aria-label={`Add ${app.title}`} onClick={() => addPanel(app.appId)}>
                Add
              </Button>
            </article>
          ))
        )}
      </div>
      <footer className="hs-library__footer">Showing only what you are entitled to. Drag a card onto the layout to place it yourself.</footer>
    </aside>
  )
}
