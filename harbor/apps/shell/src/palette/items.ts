import { realmServices } from '@harbor/app-kit'
import { ALL_PAIRS, type Order } from '@harbor/mock-data'
import { canLaunch, canRaise, handlesIntent, type Context } from '@harbor/schemas'
import { formatCompact } from '@harbor/ui'
import { raiseFromShell } from '../interop.ts'
import { setDensity, setTheme, shell } from '../state.ts'
import { addPanel, focusOrOpen, focusPanel, openWorkspace, workspaceEntries } from '../workspaces/controller.ts'

export interface PaletteItem {
  id: string
  group: string
  title: string
  /** Extra words to match on that are not shown. */
  keywords?: string
  run: () => void
}

/**
 * Everything the palette can do right now, for this user. Entitlements are
 * applied here as well as in the agent: an action the user cannot take is not
 * offered at all.
 */
export function buildPaletteItems(orders: readonly Order[]): PaletteItem[] {
  const { user, directory, panels, activeId, theme, density } = shell.get()
  if (!user) return []
  const entitled = directory.filter((r) => canLaunch(user, r))
  const titleOf = (appId: string) => directory.find((r) => r.appId === appId)?.title ?? appId
  /** Can this user raise the intent, and is there an app they can launch that handles it? */
  const available = (intent: string, contextType: string) => canRaise(user, intent) && entitled.some((r) => handlesIntent(r, intent, contextType))
  const items: PaletteItem[] = []

  for (const panel of Object.values(panels)) {
    items.push({ id: `focus:${panel.panelId}`, group: 'Open panels', title: `Focus ${titleOf(panel.appId)}`, run: () => focusPanel(panel.panelId) })
  }
  for (const w of workspaceEntries()) {
    if (w.id !== activeId) items.push({ id: `workspace:${w.id}`, group: 'Workspaces', title: `Switch to ${w.name}`, keywords: 'workspace', run: () => void openWorkspace(w.id) })
  }
  for (const app of entitled) {
    if (app.appId === 'tile-group') continue
    const group = app.kind === 'app' ? 'Apps' : app.kind === 'widget' ? 'Widgets' : 'Tiles'
    items.push({
      id: `open:${app.appId}`,
      group,
      title: `${app.kind === 'tile' ? 'Add tile' : 'Open'} ${app.title}`,
      keywords: `${app.category} ${app.description}`,
      run: () => void (app.kind === 'app' ? focusOrOpen(app.appId) : addPanel(app.appId)),
    })
  }

  const instrument = (pair: string): Context => ({ type: 'fdc3.instrument', id: { ticker: pair }, name: pair })
  if (entitled.some((r) => r.appId === 'order-blotter')) {
    for (const order of orders.filter((o) => o.status === 'NEW' || o.status === 'WORKING' || o.status === 'PARTIAL')) {
      const { createdAt: _createdAt, arrivalMid: _arrivalMid, traderId: _traderId, ...context } = order
      const summary = `${order.id.orderId} · ${order.side} ${formatCompact(order.amount)} ${order.pair}`
      if (available('harbor.ExecuteOrder', 'harbor.fxOrder')) items.push({ id: `execute:${order.id.orderId}`, group: 'Orders', title: `Execute order ${summary}`, run: () => raiseFromShell('harbor.ExecuteOrder', context) })
      if (available('harbor.AnalyseOrder', 'harbor.fxOrder')) items.push({ id: `analyse:${order.id.orderId}`, group: 'Orders', title: `Analyse order ${summary}`, run: () => raiseFromShell('harbor.AnalyseOrder', context) })
    }
  }
  for (const pair of ALL_PAIRS) {
    if (available('ViewAnalysis', 'fdc3.instrument')) items.push({ id: `tca:${pair}`, group: 'Instruments', title: `View TCA for ${pair}`, keywords: 'analysis cost slippage', run: () => raiseFromShell('ViewAnalysis', instrument(pair)) })
    if (available('ViewNews', 'fdc3.instrument')) items.push({ id: `news:${pair}`, group: 'Instruments', title: `View news for ${pair}`, keywords: 'research headlines', run: () => raiseFromShell('ViewNews', instrument(pair)) })
  }

  const { dataset } = realmServices()
  if (available('harbor.PlaceCash', 'fdc3.portfolio')) {
    for (const fund of dataset.funds) {
      items.push({ id: `cash:${fund.code}`, group: 'Treasury', title: `Place cash for ${fund.code}`, keywords: fund.name, run: () => raiseFromShell('harbor.PlaceCash', { type: 'fdc3.portfolio', id: { portfolioId: fund.code }, name: fund.name, positions: [] }) })
    }
  }
  if (available('harbor.SendPayment', 'fdc3.organization')) {
    for (const b of dataset.beneficiaries) {
      items.push({ id: `pay:${b.id}`, group: 'Treasury', title: `Send payment to ${b.name}`, keywords: `${b.country} ${b.currency}`, run: () => raiseFromShell('harbor.SendPayment', { type: 'fdc3.organization', id: { BENEFICIARY_ID: b.id }, name: b.name }) })
    }
  }

  items.push(
    { id: 'cmd:library', group: 'Commands', title: 'Open Widget Library', keywords: 'browse all apps add', run: () => shell.set({ libraryOpen: true }) },
    { id: 'cmd:alerts', group: 'Commands', title: 'Show alerts', keywords: 'bell notifications', run: () => shell.set({ alertsOpen: true, alertSeverity: null }) },
    { id: 'cmd:log', group: 'Commands', title: 'Open interop log', keywords: 'dev panel audit', run: () => shell.set({ logOpen: true }) },
    { id: 'cmd:theme', group: 'Commands', title: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`, run: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
    { id: 'cmd:density', group: 'Commands', title: `Switch to ${density === 'compact' ? 'comfortable' : 'compact'} density`, run: () => setDensity(density === 'compact' ? 'comfortable' : 'compact') },
  )
  return items
}
