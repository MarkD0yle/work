import { createClient, type HarborClient } from '@harbor/agent-client'
import { parseDirectory, type Appearance, type DirectoryRecord, type FxOrderContext, type UserInfo } from '@harbor/schemas'
import { Agent, type AgentHooks, type ResolveRequest } from './agent.ts'
import { createDirectPair } from './direct.ts'

const app = (appId: string, entitlement: string, listensFor: Record<string, { contexts: string[] }>, origin = 'http://apps.test') => ({
  appId,
  title: appId,
  publisher: 'First-party',
  category: 'Test',
  type: 'web',
  details: { url: `${origin}/${appId}` },
  interop: { intents: { listensFor } },
  kind: 'app',
  allowedOrigins: [origin],
  requiredEntitlement: entitlement,
})

export const DIRECTORY: DirectoryRecord[] = parseDirectory({
  applications: [
    app('fx-exec', 'app.fx-exec', { 'harbor.ExecuteOrder': { contexts: ['harbor.fxOrder'] } }),
    app('pretrade', 'app.pretrade', { 'harbor.AnalyseOrder': { contexts: ['harbor.fxOrder'] } }),
    app('research', 'app.research', { ViewNews: { contexts: ['fdc3.instrument'] } }),
    app('partner-news', 'app.partner-news', { ViewNews: { contexts: ['fdc3.instrument'] } }, 'http://partner.test'),
    app('blotter', 'app.blotter', {}),
  ],
}).records

export const TRADER: UserInfo = {
  id: 'u-trader',
  displayName: 'Tess Trader',
  role: 'Trader',
  entitlements: { apps: ['app.fx-exec', 'app.pretrade', 'app.research', 'app.partner-news', 'app.blotter'], intents: ['*'] },
}
export const OPS: UserInfo = {
  id: 'u-ops',
  displayName: 'Omar Ops',
  role: 'Operations',
  entitlements: { apps: ['app.research', 'app.blotter'], intents: ['ViewNews'] },
}

export const ORDER: FxOrderContext = {
  type: 'harbor.fxOrder',
  id: { orderId: '10432' },
  pair: 'EURUSD',
  side: 'BUY',
  dealtCurrency: 'EUR',
  amount: 25_000_000,
  tenor: 'SPOT',
  valueDate: '2026-11-12',
  account: 'FUND-A',
  status: 'NEW',
}
export const EURUSD = { type: 'fdc3.instrument', id: { ticker: 'EURUSD' } }

export interface Kit {
  agent: Agent
  user: { current: UserInfo }
  appearance: Appearance
  launched: string[]
  resolveRequests: ResolveRequest[]
  noHandler: string[]
  channelChanges: [string, string | null][]
  /** What the resolver dialog will answer. */
  resolver: { answer: { appId: string; remember: boolean } | null }
  /** When false, `ensureInstance` returns an id without connecting anything. */
  autoConnect: { on: boolean; onLaunch?: (appId: string, instanceId: string) => void }
  connect(appId: string, instanceId: string, channelId?: string | null): HarborClient
}

export function makeKit(options: { deliveryTimeoutMs?: number } = {}): Kit {
  const kit = {
    user: { current: TRADER },
    appearance: { theme: 'dark', density: 'compact' } as Appearance,
    launched: [] as string[],
    resolveRequests: [] as ResolveRequest[],
    noHandler: [] as string[],
    channelChanges: [] as [string, string | null][],
    resolver: { answer: null as { appId: string; remember: boolean } | null },
    autoConnect: { on: false } as Kit['autoConnect'],
  }
  let n = 0
  const hooks: AgentHooks = {
    getUser: () => kit.user.current,
    getAppearance: () => kit.appearance,
    ensureInstance: async (appId) => {
      const instanceId = `${appId}-launched-${++n}`
      kit.launched.push(appId)
      kit.autoConnect.onLaunch?.(appId, instanceId)
      return instanceId
    },
    resolveIntent: async (request) => {
      kit.resolveRequests.push(request)
      return kit.resolver.answer
    },
    onNoHandler: (intent) => kit.noHandler.push(intent),
    onChannelChanged: (instanceId, channelId) => kit.channelChanges.push([instanceId, channelId]),
  }
  const agent = new Agent({ directory: () => DIRECTORY, hooks, deliveryTimeoutMs: options.deliveryTimeoutMs ?? 50 })
  const connect = (appId: string, instanceId: string, channelId: string | null = null) => {
    const pair = createDirectPair()
    agent.registerInstance({ instanceId, appId, channelId, transport: pair.agent })
    return createClient(pair.client, { requestTimeoutMs: 1000 })
  }
  return { ...kit, agent, connect }
}

/** Let queued microtask deliveries (and their replies) settle. */
export const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 5))
