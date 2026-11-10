import type { PanelRecord, Role, WorkspaceFile } from '@harbor/schemas'

export interface TemplatePanel extends PanelRecord {
  /** Where to put this panel when the template is first laid out. */
  place?: { ref: string; direction: 'right' | 'below' | 'within' }
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
const app = (panelId: string, appId: string, channelId: string | null, place?: TemplatePanel['place']): TemplatePanel => ({
  panelId,
  kind: appId === 'context-inspector' ? 'widget' : 'app',
  appId,
  channelId,
  config: {},
  place,
})

/* Until Phase 6 ships the real blotter and tiles, the Context Inspector
 * stands in for them so each template still has a context source. */
export const TEMPLATES: TemplateDef[] = [
  {
    id: 'tpl:fx-trading',
    name: 'FX Trading',
    role: 'Trader',
    panels: [
      app('orders', 'context-inspector', BLUE),
      app('pretrade', 'pretrade', BLUE, { ref: 'orders', direction: 'right' }),
      app('fx-exec', 'fx-exec', BLUE, { ref: 'orders', direction: 'below' }),
      app('post-trade', 'post-trade', BLUE, { ref: 'pretrade', direction: 'below' }),
      app('tca', 'tca', BLUE, { ref: 'post-trade', direction: 'within' }),
    ],
  },
  {
    id: 'tpl:overview',
    name: 'Overview',
    role: 'Portfolio Manager',
    panels: [
      app('inspector', 'context-inspector', BLUE),
      app('tca', 'tca', BLUE, { ref: 'inspector', direction: 'right' }),
      app('research', 'research', BLUE, { ref: 'tca', direction: 'below' }),
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
    ],
  },
  {
    id: 'tpl:cash-payments',
    name: 'Cash & Payments',
    role: 'Treasury',
    panels: [app('cash', 'cash', null), app('payments', 'payments', null, { ref: 'cash', direction: 'right' })],
  },
  {
    id: 'tpl:admin',
    name: 'Admin',
    role: 'Admin',
    panels: [
      app('inspector', 'context-inspector', BLUE),
      app('research', 'research', BLUE, { ref: 'inspector', direction: 'right' }),
      app('partner-news', 'partner-news', BLUE, { ref: 'research', direction: 'below' }),
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
