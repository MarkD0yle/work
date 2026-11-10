import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { DockviewReact, type DockviewApi, type DockviewReadyEvent, type IDockviewPanelHeaderProps, type IDockviewPanelProps } from 'dockview'
import { createDirectPair } from '@harbor/agent'
import { createClient, type HarborClient } from '@harbor/agent-client'
import { canLaunch, type DirectoryRecord } from '@harbor/schemas'
import { ChannelPicker, EmptyState, ErrorState, Icon, Menu, Skeleton, type MenuItem } from '@harbor/ui'
import { WIDGETS } from '@harbor/widgets'
import { agent, bridge } from '../interop.ts'
import { shell, useShell, type DevPanelState } from '../state.ts'
import { addPanel, attachLayout, closePanel, duplicatePanel, movePanelToWorkspace, reloadPanel, setPanelChannel } from '../workspaces/controller.ts'
import { AppGlyph } from './AppGlyph.tsx'
import { DRAG_TYPE } from './Library.tsx'

const CONNECT_TIMEOUT_MS = 8000
const HARBOR_THEME = { name: 'harbor', className: 'dockview-theme-harbor' }
let layoutApi: DockviewApi | null = null

/** Ctrl-Alt-arrows: move focus to the next or previous panel. */
export function focusAdjacentPanel(delta: 1 | -1): void {
  const panels = layoutApi?.panels ?? []
  if (panels.length === 0) return
  const index = panels.findIndex((p) => p.id === layoutApi?.activePanel?.id)
  const next = panels[(index + delta + panels.length) % panels.length]
  next?.api.setActive()
  next?.view.content.element.querySelector<HTMLElement>('.hs-panel')?.focus()
}

/* ---------- error boundary: an app crash never takes down the shell ---------- */

class PanelBoundary extends Component<{ children: ReactNode; onReload: () => void }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[panel crashed]', error, info.componentStack)
  }
  render() {
    if (this.state.error) return <ErrorState title="This panel crashed" body={this.state.error.message} onReload={this.props.onReload} />
    return this.props.children
  }
}

/* ---------- iframe apps ---------- */

function AppFrame({ panelId, app, location }: { panelId: string; app: DirectoryRecord; location: number }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const detach = bridge.attach({
      instanceId: panelId,
      appId: app.appId,
      getWindow: () => frame.contentWindow,
      getChannelId: () => shell.get().panels[panelId]?.channelId ?? null,
      onConnected: () => setStatus('ready'),
    })
    // Only this frame's own window may speak for it; the bridge then checks the origin.
    const onMessage = (event: MessageEvent) => {
      if (event.source === frame.contentWindow) bridge.handleMessage(event)
    }
    // A popped-out panel lives in another window, so follow the frame's document.
    let host: Window | null = null
    const bind = () => {
      const next = frame.ownerDocument.defaultView
      if (next === host) return
      host?.removeEventListener('message', onMessage)
      host = next
      host?.addEventListener('message', onMessage)
    }
    bind()
    frame.addEventListener('load', bind)
    // Moving to another window reloads the frame; rebinding can lag the app's first hello, which it retries.
    const rebind = setInterval(bind, 250)
    const timer = setTimeout(() => setStatus((s) => (s === 'loading' ? 'error' : s)), CONNECT_TIMEOUT_MS)
    return () => {
      clearTimeout(timer)
      clearInterval(rebind)
      frame.removeEventListener('load', bind)
      host?.removeEventListener('message', onMessage)
      detach()
    }
  }, [panelId, app.appId, location])

  return (
    <div className="hs-frame">
      {status === 'loading' && <Skeleton label={`Loading ${app.title}`} />}
      {status === 'error' && <ErrorState title={`${app.title} did not respond`} body="The app did not connect to the shell in time." onReload={() => reloadPanel(panelId)} />}
      <iframe
        ref={frameRef}
        title={app.title}
        src={app.details.url}
        sandbox="allow-scripts allow-same-origin allow-forms"
        className={status === 'ready' ? '' : 'is-hidden'}
        data-testid={`frame-${app.appId}`}
      />
    </div>
  )
}

/* ---------- in-process widgets and tiles ---------- */

function WidgetHost({ panelId, app }: { panelId: string; app: DirectoryRecord }) {
  const [client, setClient] = useState<HarborClient | null>(null)
  const config = useShell((s) => s.panels[panelId]?.config)
  const Widget = WIDGETS[app.appId]

  useEffect(() => {
    // Same client API as iframe apps, over the direct transport.
    const pair = createDirectPair()
    agent.registerInstance({ instanceId: panelId, appId: app.appId, channelId: shell.get().panels[panelId]?.channelId ?? null, transport: pair.agent })
    const created = createClient(pair.client)
    const ready = setTimeout(() => setClient(created), 0)
    return () => {
      clearTimeout(ready)
      setClient(null)
      created.close()
      agent.unregisterInstance(panelId)
    }
  }, [panelId, app.appId])

  if (!Widget) return <ErrorState title={`${app.title} is not installed`} body="The directory lists this widget but this build does not include it." />
  if (!client) return <Skeleton label={`Loading ${app.title}`} />
  return <Widget client={client} config={config ?? {}} />
}

/* ---------- panel body ---------- */

function PanelHost({ api }: IDockviewPanelProps) {
  const panelId = api.id
  const panel = useShell((s) => s.panels[panelId])
  const user = useShell((s) => s.user)
  const directory = useShell((s) => s.directory)
  const connected = useShell((s) => s.connected)
  const lastUpdated = useShell((s) => s.lastUpdated)
  const nonce = useShell((s) => s.reloadNonce[panelId] ?? 0)
  const dev = useShell((s) => s.devState[panelId])
  const channelId = panel?.channelId ?? null
  // Bumped when the panel moves between the grid, a floating group and a popout window.
  const [location, setLocation] = useState(0)
  useEffect(() => {
    const subscription = api.onDidLocationChange(() => setLocation((n) => n + 1))
    return () => subscription.dispose()
  }, [api])

  // The panel chrome owns the channel link; keep the agent in step with it.
  useEffect(() => {
    agent.setInstanceChannel(panelId, channelId)
  }, [panelId, channelId, nonce])

  if (!panel || !user) return null
  const app = directory.find((r) => r.appId === panel.appId)
  const reload = () => reloadPanel(panelId)

  let body: ReactNode
  if (!app) body = <ErrorState title="App not found" body={`"${panel.appId}" is not in the App Directory.`} />
  else if (!canLaunch(user, app)) body = <EmptyState icon="lock" title="No access" body="You are not entitled to this app. Ask an administrator if you need it." />
  else if (dev === 'loading') body = <Skeleton />
  else if (dev === 'empty') body = <EmptyState title="Nothing to show" body="This panel has no data for the current selection." />
  else if (dev === 'error') body = <ErrorState body="A simulated error." onReload={reload} />
  else if (panel.kind === 'app') body = <AppFrame key={nonce} panelId={panelId} app={app} location={location} />
  else body = <WidgetHost key={nonce} panelId={panelId} app={app} />

  return (
    <section className="hs-panel" aria-label={app?.title ?? panel.appId} tabIndex={-1} data-panel={panelId} data-app={panel.appId}>
      {!connected && (
        <div className="hs-stale" role="status">
          <Icon name="warning" size={14} /> Disconnected — data may be stale. Last updated {new Date(lastUpdated).toLocaleTimeString('en-GB')}.
        </div>
      )}
      <div className="hs-panel__body">
        <PanelBoundary key={nonce} onReload={reload}>
          {body}
        </PanelBoundary>
      </div>
    </section>
  )
}

/* ---------- panel chrome (identical for every panel) ---------- */

const DEV_STATES: { id: DevPanelState | 'ready'; label: string }[] = [
  { id: 'ready', label: 'Dev: show ready' },
  { id: 'loading', label: 'Dev: show loading' },
  { id: 'empty', label: 'Dev: show empty' },
  { id: 'error', label: 'Dev: show error' },
]

function PanelTab({ api, containerApi }: IDockviewPanelHeaderProps) {
  const panelId = api.id
  const panel = useShell((s) => s.panels[panelId])
  const app = useShell((s) => s.directory.find((r) => r.appId === panel?.appId))
  const saved = useShell((s) => s.saved)
  const activeId = useShell((s) => s.activeId)
  if (!panel) return <span className="hs-tab">{api.title}</span>
  const title = app?.title ?? panel.appId
  const group = api.group
  const groups = containerApi.groups
  const alone = group.panels.length < 2
  const dock = containerApi.getPanel(panelId)

  const items: MenuItem[] = [
    { id: 'split-right', label: 'Split right', disabled: alone, onSelect: () => api.moveTo({ group, position: 'right' }) },
    { id: 'split-down', label: 'Split down', disabled: alone, onSelect: () => api.moveTo({ group, position: 'bottom' }) },
    {
      id: 'next-group',
      label: 'Move to next group',
      disabled: groups.length < 2,
      onSelect: () => {
        const next = groups[(groups.indexOf(group) + 1) % groups.length]
        if (next) api.moveTo({ group: next })
      },
    },
    { id: 'float', label: 'Float', onSelect: () => dock && containerApi.addFloatingGroup(dock) },
    { id: 'popout', label: 'Pop out', onSelect: () => dock && void containerApi.addPopoutGroup(dock, { popoutUrl: '/popout.html' }) },
    { id: 'duplicate', label: 'Duplicate', separated: true, onSelect: () => duplicatePanel(panelId) },
    { id: 'reload', label: 'Reload', onSelect: () => reloadPanel(panelId) },
    ...saved
      .filter((w) => w.id !== activeId)
      .map((w) => ({ id: `move-${w.id}`, label: `Move to "${w.name}"`, onSelect: () => void movePanelToWorkspace(panelId, w.id) })),
    ...(import.meta.env.DEV
      ? DEV_STATES.map((s, i) => ({
          id: `dev-${s.id}`,
          label: s.label,
          separated: i === 0,
          onSelect: () => shell.set({ devState: { ...shell.get().devState, [panelId]: s.id === 'ready' ? undefined : s.id } }),
        }))
      : []),
    { id: 'close', label: 'Close', danger: true, separated: true, onSelect: () => closePanel(panelId) },
  ]

  return (
    <div className="hs-tab" data-testid={`tab-${panelId}`} data-app={panel.appId}>
      <AppGlyph app={app} />
      <span className="hs-tab__title">{title}</span>
      <ChannelPicker subject={title} channelId={panel.channelId} onChange={(channelId) => setPanelChannel(panelId, channelId)} />
      <Menu label={`${title} menu`} trigger={<Icon name="more" size={14} />} items={items} triggerClassName="hb-icon-button hs-tab__menu" />
    </div>
  )
}

function Watermark() {
  return (
    <EmptyState
      icon="grid"
      title="This workspace is empty"
      body="Open an app from the rail, or press Cmd/Ctrl-K to browse the Widget Library."
    />
  )
}

const COMPONENTS = { panel: PanelHost }

export function Layout() {
  const dragging = useShell((s) => s.dragging)
  const detach = useRef<(() => void) | null>(null)

  useEffect(
    () => () => {
      detach.current?.()
      layoutApi = null
    },
    [],
  )

  const onReady = (event: DockviewReadyEvent) => {
    layoutApi = event.api
    // Accept cards dragged from the Widget Library.
    event.api.onUnhandledDragOverEvent((e) => {
      if (e.nativeEvent.dataTransfer?.types.includes(DRAG_TYPE)) e.accept()
    })
    detach.current = attachLayout(event.api)
  }

  return (
    <main className={`hs-layout${dragging ? ' is-dragging' : ''}`} data-region="layout" aria-label="Workspace">
      <DockviewReact
        theme={HARBOR_THEME}
        components={COMPONENTS}
        defaultTabComponent={PanelTab}
        watermarkComponent={Watermark}
        defaultRenderer="always"
        popoutUrl="/popout.html"
        onReady={onReady}
        onDidDrop={(e) => {
          const appId = e.nativeEvent.dataTransfer?.getData(DRAG_TYPE)
          shell.set({ dragging: false })
          if (!appId) return
          const direction = { top: 'above', bottom: 'below', left: 'left', right: 'right', center: 'within' }[e.position] as 'above' | 'below' | 'left' | 'right' | 'within'
          addPanel(appId, e.group ? { position: { referenceGroup: e.group, direction } } : {})
        }}
      />
    </main>
  )
}
