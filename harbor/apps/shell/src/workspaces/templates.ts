import type { PanelRecord, Role, WorkspaceFile } from '@harbor/schemas'

export interface TemplatePanel extends PanelRecord {
  /** Where to put this panel when the template is first laid out. */
  place?: { ref: string; direction: 'right' | 'below' | 'within' | 'above' | 'left'; height?: number }
}

/** A read-only role default. Editing one forks it into a saved workspace. */
export interface TemplateDef {
  id: string
  name: string
  role: Role
  panels: TemplatePanel[]
}

const BLUE = 'fdc3.channel.6'
const GREEN = 'fdc3.channel.4'
const WIDGETS = ['context-inspector', 'order-blotter', 'mock-data', 'ui-gallery']
const app = (panelId: string, appId: string, channelId: string | null, place?: TemplatePanel['place'], config: Record<string, unknown> = {}): TemplatePanel => ({
  panelId,
  kind: appId === 'tile-group' ? 'tileGroup' : WIDGETS.includes(appId) ? 'widget' : 'app',
  appId,
  channelId,
  config,
  place,
})

export const TEMPLATES: TemplateDef[] = [
  {
    // The core loop on one screen: tiles and blotter, decide, execute, then settle and measure.
    id: 'tpl:fx-trading',
    name: 'FX Trading',
    role: 'Trader',
    panels: [
      app('orders', 'order-blotter', BLUE),
      app('pretrade', 'pretrade', BLUE, { ref: 'orders', direction: 'right' }),
      app('fx-exec', 'fx-exec', BLUE, { ref: 'orders', direction: 'below' }),
      app('post-trade', 'post-trade', BLUE, { ref: 'pretrade', direction: 'below' }),
      app('tca', 'tca', BLUE, { ref: 'post-trade', direction: 'within' }),
      app('tiles', 'tile-group', BLUE, { ref: 'orders', direction: 'above', height: 150 }, { tiles: ['tile-orders-awaiting', 'tile-alerts', 'tile-unmatched', 'tile-day-cost', 'tile-rates'] }),
    ],
  },
  {
    id: 'tpl:overview',
    name: 'Overview',
    role: 'Portfolio Manager',
    panels: [
      app('orders', 'order-blotter', BLUE),
      app('pretrade', 'pretrade', BLUE, { ref: 'orders', direction: 'right' }),
      app('tca', 'tca', BLUE, { ref: 'orders', direction: 'below' }),
      app('research', 'research', BLUE, { ref: 'pretrade', direction: 'below' }),
    ],
  },
  {
    id: 'tpl:post-trade',
    name: 'Post-Trade',
    role: 'Operations',
    panels: [
      app('post-trade', 'post-trade', GREEN),
      app('tca', 'tca', GREEN, { ref: 'post-trade', direction: 'right' }),
      app('inspector', 'context-inspector', GREEN, { ref: 'tca', direction: 'below' }),
      app('tiles', 'tile-group', GREEN, { ref: 'post-trade', direction: 'above', height: 150 }, { tiles: ['tile-alerts', 'tile-unmatched', 'tile-day-cost'] }),
    ],
  },
  {
    id: 'tpl:cash-payments',
    name: 'Cash & Payments',
    role: 'Treasury',
    panels: [
      app('cash', 'cash', null),
      app('payments', 'payments', null, { ref: 'cash', direction: 'right' }),
      app('tiles', 'tile-group', null, { ref: 'cash', direction: 'above', height: 170 }, { tiles: ['tile-cutoffs', 'tile-alerts'] }),
    ],
  },
  {
    // The interop bench: the in-process inspector plus the probe app on two origins.
    id: 'tpl:admin',
    name: 'Admin',
    role: 'Admin',
    panels: [
      app('inspector', 'context-inspector', BLUE),
      app('probe-a', 'probe-a', BLUE, { ref: 'inspector', direction: 'right' }),
      app('probe-b', 'probe-b', BLUE, { ref: 'probe-a', direction: 'below' }),
    ],
  },
]

export const isTemplateId = (id: string) => id.startsWith('tpl:')

export function templateForRole(role: Role): TemplateDef {
  const found = TEMPLATES.find((t) => t.role === role)
  if (!found) throw new Error(`No template for role ${role}`)
  return found
}

/** A template as an unsaved workspace file. `layout: null` means "build from placements". */
export function materialise(template: TemplateDef, ownerId: string): WorkspaceFile {
  return {
    schemaVersion: 1,
    id: template.id,
    name: template.name,
    ownerId,
    updatedAt: new Date(0).toISOString(),
    layout: null,
    panels: template.panels.map(({ place: _place, ...record }) => ({ ...record, config: { ...record.config } })),
  }
}
