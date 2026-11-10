import {
  PROTOCOL,
  type AlertInput,
  type AlertSummary,
  type Severity,
  type ShellShortcut,
  type AppIdentifier,
  type AppIntent,
  type Appearance,
  type ClientTransport,
  type Context,
  type EventMessage,
  type ImplementationMetadata,
  type IntentResolution,
  type MethodName,
  type Methods,
  type ResponseMessage,
  type UserChannel,
  type UserInfo,
} from '@harbor/schemas'

export interface Listener {
  unsubscribe(): Promise<void>
}
export interface ContextMetadata {
  source?: AppIdentifier
}
export type ContextHandler = (context: Context, metadata: ContextMetadata) => void
export type IntentHandler = (context: Context, metadata: ContextMetadata) => void

export interface Channel {
  readonly id: string
  readonly type: 'app'
  broadcast(context: Context): Promise<void>
  addContextListener(contextType: string | null, handler: ContextHandler): Promise<Listener>
}

/** Error thrown for a failed request. `code` is an FDC3-style error string. */
export class HarborError extends Error {
  readonly code: string
  constructor(code: string, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

/** FDC3-shaped API (method names follow the current FDC3 DesktopAgent), plus a few Harbor extras. */
export interface HarborClient {
  getInfo(): Promise<ImplementationMetadata>
  getUserInfo(): Promise<UserInfo>
  getUserChannels(): Promise<UserChannel[]>
  getCurrentChannel(): Promise<string | null>
  joinUserChannel(channelId: string): Promise<void>
  leaveCurrentChannel(): Promise<void>
  broadcast(context: Context): Promise<void>
  addContextListener(contextType: string | null, handler: ContextHandler): Promise<Listener>
  addIntentListener(intent: string, handler: IntentHandler): Promise<Listener>
  findIntent(intent: string, context?: Context): Promise<AppIntent>
  raiseIntent(intent: string, context: Context, app?: AppIdentifier): Promise<IntentResolution>
  open(app: AppIdentifier, context?: Context): Promise<AppIdentifier>
  getOrCreateChannel(channelId: string): Promise<Channel>
  /** Harbor extra: the shell changed this panel's channel link. */
  onChannelChanged(handler: (channelId: string | null) => void): () => void
  /** Harbor extra: raise an alert in the shell. Resolves to the alert's id. */
  publishAlert(alert: AlertInput): Promise<string>
  /** Harbor extra: open alerts per severity, and changes to them. */
  getAlertSummary(): Promise<AlertSummary>
  onAlertSummaryChanged(handler: (summary: AlertSummary) => void): () => void
  /** Harbor extra: open the shell's alert drawer, optionally filtered to one severity. */
  showAlerts(severity?: Severity): Promise<void>
  /** Harbor extra: pass a shell keyboard shortcut up to the shell. */
  shortcut(name: ShellShortcut): Promise<void>
  /** Harbor extra: the shell's mock market connection. */
  getConnection(): Promise<boolean>
  onConnectionChanged(handler: (connected: boolean) => void): () => void
  /** Harbor extra: this app's panel was shown or hidden. */
  onVisibilityChanged(handler: (visible: boolean) => void): () => void
  /** Harbor extra: theme or density changed in the shell. */
  onAppearanceChanged(handler: (appearance: Appearance) => void): () => void
  close(): void
}

let counter = 0
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++counter).toString(36)}`

export function createClient(transport: ClientTransport, options: { requestTimeoutMs?: number } = {}): HarborClient {
  // Intents may wait on a user choice in the resolver, so the default is generous.
  const timeoutMs = options.requestTimeoutMs ?? 120_000
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>()
  const contextHandlers = new Map<string, ContextHandler>()
  const intentHandlers = new Map<string, IntentHandler>()
  const channelHandlers = new Set<(channelId: string | null) => void>()
  const appearanceHandlers = new Set<(appearance: Appearance) => void>()
  const connectionHandlers = new Set<(connected: boolean) => void>()
  const alertHandlers = new Set<(summary: AlertSummary) => void>()
  const visibilityHandlers = new Set<(visible: boolean) => void>()
  let closed = false

  transport.onMessage((message: ResponseMessage | EventMessage) => {
    if (message.kind === 'response') {
      const entry = pending.get(message.id)
      if (!entry) return
      pending.delete(message.id)
      clearTimeout(entry.timer)
      if (message.ok) entry.resolve(message.result)
      else entry.reject(new HarborError(message.error ?? 'Error', message.message))
      return
    }
    switch (message.event) {
      case 'context':
        contextHandlers.get(message.listenerId)?.(message.context, { source: message.source })
        break
      case 'intent':
        intentHandlers.get(message.listenerId)?.(message.context, { source: message.source })
        break
      case 'channelChanged':
        for (const h of channelHandlers) h(message.channelId)
        break
      case 'appearance':
        for (const h of appearanceHandlers) h(message.appearance)
        break
      case 'connection':
        for (const h of connectionHandlers) h(message.connected)
        break
      case 'visibility':
        for (const h of visibilityHandlers) h(message.visible)
        break
      case 'alertSummary':
        for (const h of alertHandlers) h(message.summary)
        break
    }
  })

  function request<M extends MethodName>(method: M, params: Methods[M]['params']): Promise<Methods[M]['result']> {
    if (closed) return Promise.reject(new HarborError('Disconnected', 'The client is closed'))
    return new Promise((resolve, reject) => {
      const id = nextId('req')
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new HarborError('Timeout', `${method} timed out`))
      }, timeoutMs)
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer })
      transport.post({ protocol: PROTOCOL, kind: 'request', id, method, params })
    })
  }

  async function listen(contextType: string | null, handler: ContextHandler, channelId?: string): Promise<Listener> {
    const listenerId = nextId('ctx')
    // Register the handler first: the agent may replay context before it replies.
    contextHandlers.set(listenerId, handler)
    try {
      await request('addContextListener', { listenerId, contextType, ...(channelId ? { channelId } : {}) })
    } catch (error) {
      contextHandlers.delete(listenerId)
      throw error
    }
    return {
      unsubscribe: async () => {
        contextHandlers.delete(listenerId)
        await request('removeListener', { listenerId })
      },
    }
  }

  return {
    getInfo: () => request('getInfo', {}),
    getUserInfo: () => request('getUserInfo', {}),
    getUserChannels: () => request('getUserChannels', {}),
    getCurrentChannel: () => request('getCurrentChannel', {}),
    joinUserChannel: async (channelId) => void (await request('joinUserChannel', { channelId })),
    leaveCurrentChannel: async () => void (await request('leaveCurrentChannel', {})),
    broadcast: async (context) => void (await request('broadcast', { context })),
    addContextListener: (contextType, handler) => listen(contextType, handler),
    addIntentListener: async (intent, handler) => {
      const listenerId = nextId('int')
      intentHandlers.set(listenerId, handler)
      try {
        await request('addIntentListener', { listenerId, intent })
      } catch (error) {
        intentHandlers.delete(listenerId)
        throw error
      }
      return {
        unsubscribe: async () => {
          intentHandlers.delete(listenerId)
          await request('removeListener', { listenerId })
        },
      }
    },
    findIntent: (intent, context) => request('findIntent', { intent, ...(context ? { context } : {}) }),
    raiseIntent: (intent, context, app) => request('raiseIntent', { intent, context, ...(app ? { app } : {}) }),
    open: (app, context) => request('open', { app, ...(context ? { context } : {}) }),
    getOrCreateChannel: async (channelId) => {
      const created = await request('getOrCreateChannel', { channelId })
      return {
        id: created.id,
        type: 'app',
        broadcast: async (context) => void (await request('broadcast', { context, channelId: created.id })),
        addContextListener: (contextType, handler) => listen(contextType, handler, created.id),
      }
    },
    onChannelChanged: (handler) => {
      channelHandlers.add(handler)
      return () => void channelHandlers.delete(handler)
    },
    publishAlert: async (alert) => (await request('publishAlert', { alert })).id,
    getAlertSummary: () => request('getAlertSummary', {}),
    onAlertSummaryChanged: (handler) => {
      alertHandlers.add(handler)
      return () => void alertHandlers.delete(handler)
    },
    showAlerts: async (severity) => void (await request('showAlerts', severity ? { severity } : {})),
    shortcut: async (name) => void (await request('shortcut', { name })),
    getConnection: async () => (await request('getConnection', {})).connected,
    onConnectionChanged: (handler) => {
      connectionHandlers.add(handler)
      return () => void connectionHandlers.delete(handler)
    },
    onVisibilityChanged: (handler) => {
      visibilityHandlers.add(handler)
      return () => void visibilityHandlers.delete(handler)
    },
    onAppearanceChanged: (handler) => {
      appearanceHandlers.add(handler)
      return () => void appearanceHandlers.delete(handler)
    },
    close: () => {
      closed = true
      for (const entry of pending.values()) {
        clearTimeout(entry.timer)
        entry.reject(new HarborError('Disconnected', 'The client was closed'))
      }
      pending.clear()
      transport.close()
    },
  }
}
