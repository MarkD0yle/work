import {
  AgentError,
  PROTOCOL,
  USER_CHANNELS,
  canLaunch,
  canRaise,
  contextIdLabel,
  findUserChannel,
  SHELL_SHORTCUTS,
  handlesIntent,
  parseAlertInput,
  validateContext,
  type AgentErrorCode,
  type AgentEvent,
  type AgentTransport,
  type AlertInput,
  type AlertSummary,
  type Severity,
  type ShellShortcut,
  type AppIdentifier,
  type AppIntent,
  type Appearance,
  type Context,
  type DirectoryRecord,
  type ImplementationMetadata,
  type IntentResolution,
  type MethodName,
  type Methods,
  type RequestMessage,
  type UserInfo,
} from '@harbor/schemas'
import { InteropLog } from './log.ts'

export const AGENT_VERSION = '0.4.0'
/** The FDC3 version whose API names this agent follows. */
export const FDC3_VERSION = '3.0'

export class AgentFault extends Error {
  readonly code: AgentErrorCode
  constructor(code: AgentErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

export interface ResolveRequest {
  intent: string
  context: Context
  candidates: DirectoryRecord[]
}

/** Everything the agent needs from its host (the shell). */
export interface AgentHooks {
  getUser(): UserInfo
  getAppearance(): Appearance
  /** Mock market connection state; defaults to connected. */
  isConnected?(): boolean
  /** The host's alert centre. Without these hooks, publishing an alert is refused. */
  publishAlert?(sourceAppId: string, alert: AlertInput): string
  getAlertSummary?(): AlertSummary
  showAlerts?(filter: { severity?: Severity }): void
  /** A shell shortcut was pressed inside an app. */
  onShortcut?(name: ShellShortcut, instanceId: string): void
  /** Focus a running instance of the app or open a new one. Returns its instance id. */
  ensureInstance(appId: string, options: { newInstance: boolean }): Promise<string>
  /** Ask the user to pick between two or more handlers. `null` = cancelled. */
  resolveIntent(request: ResolveRequest): Promise<{ appId: string; remember: boolean } | null>
  /** Zero handlers: the host shows "Nothing can handle this". */
  onNoHandler?(intent: string, context: Context): void
  /** An app changed its own channel through the API; the host persists it. */
  onChannelChanged?(instanceId: string, channelId: string | null): void
}

export interface AgentOptions {
  directory: () => readonly DirectoryRecord[]
  hooks: AgentHooks
  log?: InteropLog
  /** How long a routed intent waits for the target app to add its listener. */
  deliveryTimeoutMs?: number
}

interface ContextListener {
  contextType: string | null
  /** Set for app-channel listeners; undefined = follows the user channel. */
  channelId?: string
}

interface Instance {
  instanceId: string
  appId: string
  transport: AgentTransport
  channelId: string | null
  contextListeners: Map<string, ContextListener>
  intentListeners: Map<string, string>
}

interface StoredContext {
  context: Context
  source: AppIdentifier
  seq: number
}

interface PendingIntent {
  intent: string
  context: Context
  source: AppIdentifier
  done: () => void
  fail: (fault: AgentFault) => void
  timer: ReturnType<typeof setTimeout>
}

const label = (id: AppIdentifier) => `${id.appId}#${id.instanceId ?? '?'}`

export class Agent {
  readonly log: InteropLog
  private readonly options: AgentOptions
  private readonly instances = new Map<string, Instance>()
  private readonly channels = new Map<string, Map<string, StoredContext>>()
  private readonly appChannels = new Set<string>()
  private readonly pendingIntents = new Map<string, PendingIntent[]>()
  private readonly pendingContexts = new Map<string, { context: Context; source: AppIdentifier }[]>()
  private readonly remembered = new Map<string, string>()
  private seq = 0

  constructor(options: AgentOptions) {
    this.options = options
    this.log = options.log ?? new InteropLog()
  }

  /* ---------- host-facing API ---------- */

  findApp(appId: string): DirectoryRecord | undefined {
    return this.options.directory().find((r) => r.appId === appId)
  }

  isRegistered(instanceId: string): boolean {
    return this.instances.has(instanceId)
  }

  /** Connect an app, widget or tile instance. Re-registering replaces the old connection. */
  registerInstance(input: { instanceId: string; appId: string; channelId: string | null; transport: AgentTransport }): void {
    this.instances.get(input.instanceId)?.transport.close()
    const instance: Instance = {
      ...input,
      channelId: findUserChannel(input.channelId) ? input.channelId : null,
      contextListeners: new Map(),
      intentListeners: new Map(),
    }
    this.instances.set(input.instanceId, instance)
    input.transport.onMessage((message) => {
      void this.handle(instance, message)
    })
  }

  unregisterInstance(instanceId: string): void {
    const instance = this.instances.get(instanceId)
    if (!instance) return
    instance.transport.close()
    this.instances.delete(instanceId)
  }

  /** Change a panel's user channel link (driven by the panel chrome). */
  setInstanceChannel(instanceId: string, channelId: string | null): void {
    const instance = this.instances.get(instanceId)
    if (!instance) return
    this.changeChannel(instance, channelId, false)
  }

  /** Push the current theme and density to every connected instance. */
  broadcastAppearance(appearance: Appearance): void {
    for (const instance of this.instances.values()) this.emit(instance, { event: 'appearance', appearance })
  }

  /** Tell an instance its panel was shown or hidden, so it can pause work nobody can see. */
  setInstanceVisible(instanceId: string, visible: boolean): void {
    const instance = this.instances.get(instanceId)
    if (instance) this.emit(instance, { event: 'visibility', visible })
  }

  /** Sizes of the agent's internal tables. Used by leak tests: closing everything must bring these back to zero. */
  stats(): { instances: number; contextListeners: number; intentListeners: number; pendingIntents: number; pendingContexts: number } {
    const all = [...this.instances.values()]
    return {
      instances: all.length,
      contextListeners: all.reduce((n, i) => n + i.contextListeners.size, 0),
      intentListeners: all.reduce((n, i) => n + i.intentListeners.size, 0),
      pendingIntents: [...this.pendingIntents.values()].reduce((n, q) => n + q.length, 0),
      pendingContexts: [...this.pendingContexts.values()].reduce((n, q) => n + q.length, 0),
    }
  }

  /** Tell every instance the (mock) market connection went down or came back. */
  broadcastConnection(connected: boolean): void {
    for (const instance of this.instances.values()) this.emit(instance, { event: 'connection', connected })
  }

  /** Push fresh alert counts to every instance (the alerts tile listens for these). */
  broadcastAlertSummary(summary: AlertSummary): void {
    for (const instance of this.instances.values()) this.emit(instance, { event: 'alertSummary', summary })
  }

  /** Raise an intent as the shell itself (alert actions, command palette). */
  raiseIntentFromHost(intent: string, context: Context): Promise<IntentResolution> {
    return this.raiseIntent({ appId: 'shell', instanceId: 'shell' }, { intent, context })
  }

  appearance(): Appearance {
    return this.options.hooks.getAppearance()
  }

  clearRememberedChoices(): void {
    this.remembered.clear()
  }

  /* ---------- request handling ---------- */

  private async handle(instance: Instance, message: RequestMessage): Promise<void> {
    const id = typeof message?.id === 'string' ? message.id : ''
    try {
      if (message?.kind !== 'request' || !id || typeof message.method !== 'string' || !(message.method in this.methods)) {
        throw new AgentFault(AgentError.MalformedMessage, 'Unknown or malformed request')
      }
      const params = (message.params ?? {}) as never
      const result = await this.methods[message.method](instance, params)
      instance.transport.post({ protocol: PROTOCOL, kind: 'response', id, ok: true, result })
    } catch (error) {
      const fault = error instanceof AgentFault ? error : new AgentFault(AgentError.MalformedMessage, String(error))
      instance.transport.post({ protocol: PROTOCOL, kind: 'response', id, ok: false, error: fault.code, message: fault.message })
    }
  }

  private readonly methods: {
    [M in MethodName]: (instance: Instance, params: Methods[M]['params']) => Methods[M]['result'] | Promise<Methods[M]['result']>
  } = {
    getInfo: (instance) => this.getInfo(instance),
    getUserInfo: () => structuredClone(this.options.hooks.getUser()),
    getConnection: () => ({ connected: this.options.hooks.isConnected?.() ?? true }),
    shortcut: (instance, params) => {
      if (!SHELL_SHORTCUTS.includes(params?.name)) throw new AgentFault(AgentError.MalformedMessage, 'Unknown shortcut')
      this.options.hooks.onShortcut?.(params.name, instance.instanceId)
      return null
    },
    publishAlert: (instance, params) => this.publishAlert(instance, params?.alert),
    getAlertSummary: () => this.options.hooks.getAlertSummary?.() ?? { info: 0, warning: 0, critical: 0 },
    showAlerts: (_instance, params) => {
      const severity = params?.severity
      this.options.hooks.showAlerts?.(severity === 'info' || severity === 'warning' || severity === 'critical' ? { severity } : {})
      return null
    },
    getUserChannels: () => USER_CHANNELS.map((c) => ({ ...c, displayMetadata: { ...c.displayMetadata } })),
    getCurrentChannel: (instance) => instance.channelId,
    joinUserChannel: (instance, { channelId }) => {
      if (!findUserChannel(channelId)) throw new AgentFault(AgentError.NoChannelFound, `No user channel "${channelId}"`)
      this.changeChannel(instance, channelId, true)
      return null
    },
    leaveCurrentChannel: (instance) => {
      this.changeChannel(instance, null, true)
      return null
    },
    broadcast: (instance, params) => {
      this.broadcast(instance, params.context, params.channelId)
      return null
    },
    addContextListener: (instance, params) => {
      this.addContextListener(instance, params)
      return null
    },
    addIntentListener: (instance, { listenerId, intent }) => {
      if (typeof listenerId !== 'string' || typeof intent !== 'string') {
        throw new AgentFault(AgentError.MalformedMessage, 'listenerId and intent are required')
      }
      instance.intentListeners.set(listenerId, intent)
      this.flushPendingIntents(instance)
      return null
    },
    removeListener: (instance, { listenerId }) => {
      instance.contextListeners.delete(listenerId)
      instance.intentListeners.delete(listenerId)
      return null
    },
    getOrCreateChannel: (_instance, { channelId }) => {
      if (typeof channelId !== 'string' || !channelId) throw new AgentFault(AgentError.MalformedMessage, 'channelId is required')
      if (findUserChannel(channelId)) throw new AgentFault(AgentError.AccessDenied, 'That id belongs to a user channel')
      this.appChannels.add(channelId)
      return { id: channelId, type: 'app' }
    },
    findIntent: (_instance, { intent, context }) => this.findIntent(intent, context),
    raiseIntent: (instance, params) => this.raiseIntent(this.identify(instance), params),
    open: (instance, params) => this.open(this.identify(instance), params),
  }

  private identify(instance: Instance): AppIdentifier {
    return { appId: instance.appId, instanceId: instance.instanceId }
  }

  private getInfo(instance: Instance): ImplementationMetadata {
    const record = this.findApp(instance.appId)
    const listensFor: Record<string, { contexts: string[] }> = {}
    for (const [intent, value] of Object.entries(record?.interop.intents.listensFor ?? {})) {
      listensFor[intent] = { contexts: [...value.contexts] }
    }
    return {
      fdc3Version: FDC3_VERSION,
      provider: 'Harbor',
      providerVersion: AGENT_VERSION,
      optionalFeatures: { OriginatingAppMetadata: true, UserChannelMembershipAPIs: true },
      appMetadata: { appId: instance.appId, instanceId: instance.instanceId, title: record?.title ?? instance.appId, listensFor },
    }
  }

  /* ---------- alerts ---------- */

  private publishAlert(instance: Instance, raw: unknown): { id: string } {
    const source = this.identify(instance)
    const parsed = parseAlertInput(raw)
    const publish = this.options.hooks.publishAlert
    if (!parsed.ok || !publish) {
      const detail = parsed.ok ? 'this host has no alert centre' : parsed.error
      this.log.append({ kind: 'error', from: label(source), to: 'alerts', type: 'alert', id: '', detail })
      throw new AgentFault(AgentError.MalformedMessage, detail)
    }
    // The context will later be handed to an intent, so it must be a valid context now.
    const context = parsed.value.context === undefined ? undefined : this.checkContext(parsed.value.context, source)
    const id = publish(instance.appId, { ...parsed.value, ...(context ? { context } : {}) })
    this.log.append({ kind: 'alert', from: label(source), to: 'alerts', type: parsed.value.severity, id: context ? contextIdLabel(context) : '', detail: parsed.value.title, userId: this.options.hooks.getUser().id })
    return { id }
  }

  /* ---------- channels and context ---------- */

  private emit(instance: Instance, event: AgentEvent): void {
    instance.transport.post({ protocol: PROTOCOL, kind: 'event', ...event })
  }

  private checkContext(context: unknown, from: AppIdentifier): Context {
    const checked = validateContext(context)
    if (!checked.ok) {
      const type = typeof (context as { type?: unknown })?.type === 'string' ? (context as { type: string }).type : '(invalid)'
      this.log.append({ kind: 'error', from: label(from), to: '-', type, id: '', detail: checked.error })
      throw new AgentFault(AgentError.MalformedContext, checked.error)
    }
    return checked.value
  }

  private changeChannel(instance: Instance, channelId: string | null, byApp: boolean): void {
    if (instance.channelId === channelId) return
    instance.channelId = channelId
    this.log.append({
      kind: 'channel',
      from: label(this.identify(instance)),
      to: channelId ?? '-',
      type: channelId ? 'join' : 'leave',
      id: '',
      userId: this.options.hooks.getUser().id,
    })
    this.emit(instance, { event: 'channelChanged', channelId })
    if (byApp) this.options.hooks.onChannelChanged?.(instance.instanceId, channelId)
    if (channelId) {
      for (const [listenerId, listener] of instance.contextListeners) {
        if (listener.channelId === undefined) this.replay(instance, listenerId, listener.contextType, channelId)
      }
    }
  }

  /** Late joiners get the channel's most recent context of each matching type. */
  private replay(instance: Instance, listenerId: string, contextType: string | null, channelId: string): void {
    const stored = [...(this.channels.get(channelId)?.values() ?? [])]
      .filter((s) => (contextType === null || s.context.type === contextType) && s.source.instanceId !== instance.instanceId)
      .sort((a, b) => a.seq - b.seq)
    for (const s of stored) this.emit(instance, { event: 'context', listenerId, context: s.context, source: s.source })
  }

  private addContextListener(instance: Instance, params: Methods['addContextListener']['params']): void {
    const { listenerId, contextType, channelId } = params
    if (typeof listenerId !== 'string' || (contextType !== null && typeof contextType !== 'string')) {
      throw new AgentFault(AgentError.MalformedMessage, 'listenerId and contextType are required')
    }
    if (channelId !== undefined && !this.appChannels.has(channelId)) {
      throw new AgentFault(AgentError.NoChannelFound, `No app channel "${channelId}"`)
    }
    instance.contextListeners.set(listenerId, { contextType, channelId })
    const target = channelId ?? instance.channelId
    if (target) this.replay(instance, listenerId, contextType, target)
    if (channelId === undefined) this.flushPendingContexts(instance)
  }

  private broadcast(instance: Instance, rawContext: unknown, appChannelId?: string): void {
    const source = this.identify(instance)
    const context = this.checkContext(rawContext, source)
    if (appChannelId !== undefined && !this.appChannels.has(appChannelId)) {
      throw new AgentFault(AgentError.NoChannelFound, `No app channel "${appChannelId}"`)
    }
    const channelId = appChannelId ?? instance.channelId
    // FDC3: broadcasting while not joined to a channel is a no-op.
    if (!channelId) return
    let store = this.channels.get(channelId)
    if (!store) this.channels.set(channelId, (store = new Map()))
    store.set(context.type, { context, source, seq: ++this.seq })
    this.log.append({
      kind: 'broadcast',
      from: label(source),
      to: channelId,
      type: context.type,
      id: contextIdLabel(context),
      userId: this.options.hooks.getUser().id,
    })
    for (const other of this.instances.values()) {
      if (other === instance) continue
      for (const [listenerId, listener] of other.contextListeners) {
        const listening = appChannelId !== undefined ? listener.channelId === appChannelId : listener.channelId === undefined && other.channelId === channelId
        if (listening && (listener.contextType === null || listener.contextType === context.type)) {
          this.emit(other, { event: 'context', listenerId, context, source })
        }
      }
    }
  }

  /* ---------- intents and open ---------- */

  private candidates(intent: string, contextType: string | undefined, user: UserInfo): DirectoryRecord[] {
    return this.options
      .directory()
      .filter((r) => (contextType === undefined ? r.interop.intents.listensFor[intent] !== undefined : handlesIntent(r, intent, contextType)))
      .filter((r) => canLaunch(user, r))
  }

  private findIntent(intent: string, context?: Context): AppIntent {
    const user = this.options.hooks.getUser()
    const apps = this.candidates(intent, context?.type, user)
    if (apps.length === 0) throw new AgentFault(AgentError.NoAppsFound, `Nothing can handle ${intent}`)
    return { intent: { name: intent }, apps: apps.map((r) => ({ appId: r.appId, title: r.title })) }
  }

  private async raiseIntent(source: AppIdentifier, params: Methods['raiseIntent']['params']): Promise<IntentResolution> {
    const { intent } = params
    const user = this.options.hooks.getUser()
    if (typeof intent !== 'string' || !intent) throw new AgentFault(AgentError.MalformedMessage, 'intent is required')
    const deny = (detail: string) => {
      this.log.append({ kind: 'denied', from: label(source), to: params.app?.appId ?? '-', type: intent, id: '', detail, userId: user.id })
      return new AgentFault(AgentError.AccessDenied, detail)
    }
    if (!canRaise(user, intent)) throw deny(`${user.displayName} is not entitled to raise ${intent}`)
    const context = this.checkContext(params.context, source)

    let candidates = this.candidates(intent, context.type, user)
    if (params.app) candidates = candidates.filter((r) => r.appId === params.app?.appId)
    if (candidates.length === 0) {
      this.log.append({ kind: 'error', from: label(source), to: '-', type: intent, id: contextIdLabel(context), detail: 'no handler', userId: user.id })
      this.options.hooks.onNoHandler?.(intent, context)
      throw new AgentFault(AgentError.NoAppsFound, 'Nothing can handle this')
    }

    let chosen = candidates[0] as DirectoryRecord
    if (candidates.length > 1) {
      const key = `${user.id}:${intent}`
      const remembered = candidates.find((r) => r.appId === this.remembered.get(key))
      if (remembered) {
        chosen = remembered
      } else {
        const choice = await this.options.hooks.resolveIntent({ intent, context, candidates })
        const picked = choice && candidates.find((r) => r.appId === choice.appId)
        if (!choice || !picked) throw new AgentFault(AgentError.UserCancelled, 'No handler was chosen')
        if (choice.remember) this.remembered.set(key, picked.appId)
        chosen = picked
      }
    }

    const requested = params.app?.instanceId
    const instanceId =
      requested && this.instances.get(requested)?.appId === chosen.appId
        ? requested
        : await this.options.hooks.ensureInstance(chosen.appId, { newInstance: false })
    const target: AppIdentifier = { appId: chosen.appId, instanceId }
    await this.deliverIntent(instanceId, intent, context, source)
    this.log.append({ kind: 'intent', from: label(source), to: label(target), type: intent, id: contextIdLabel(context), detail: context.type, userId: user.id })
    return { source: target, intent }
  }

  /** Deliver now if the target is listening; otherwise wait for its listener. */
  private deliverIntent(instanceId: string, intent: string, context: Context, source: AppIdentifier): Promise<void> {
    const instance = this.instances.get(instanceId)
    const listenerId = instance && [...instance.intentListeners].find(([, name]) => name === intent)?.[0]
    if (instance && listenerId) {
      this.emit(instance, { event: 'intent', listenerId, intent, context, source })
      return Promise.resolve()
    }
    return new Promise<void>((resolve, reject) => {
      const queue = this.pendingIntents.get(instanceId) ?? []
      this.pendingIntents.set(instanceId, queue)
      const pending: PendingIntent = {
        intent,
        context,
        source,
        done: resolve,
        fail: reject,
        timer: setTimeout(() => {
          queue.splice(queue.indexOf(pending), 1)
          if (queue.length === 0) this.pendingIntents.delete(instanceId)
          this.log.append({ kind: 'error', from: label(source), to: instanceId, type: intent, id: contextIdLabel(context), detail: 'target never listened' })
          reject(new AgentFault(AgentError.IntentDeliveryFailed, `The app did not accept ${intent} in time`))
        }, this.options.deliveryTimeoutMs ?? 10_000),
      }
      queue.push(pending)
    })
  }

  private flushPendingIntents(instance: Instance): void {
    const queue = this.pendingIntents.get(instance.instanceId)
    if (!queue) return
    for (const pending of [...queue]) {
      const listenerId = [...instance.intentListeners].find(([, name]) => name === pending.intent)?.[0]
      if (!listenerId) continue
      clearTimeout(pending.timer)
      queue.splice(queue.indexOf(pending), 1)
      this.emit(instance, { event: 'intent', listenerId, intent: pending.intent, context: pending.context, source: pending.source })
      pending.done()
    }
    if (queue.length === 0) this.pendingIntents.delete(instance.instanceId)
  }

  private flushPendingContexts(instance: Instance): void {
    const queue = this.pendingContexts.get(instance.instanceId)
    if (!queue) return
    for (const item of [...queue]) {
      const listenerId = [...instance.contextListeners].find(
        ([, l]) => l.channelId === undefined && (l.contextType === null || l.contextType === item.context.type),
      )?.[0]
      if (!listenerId) continue
      queue.splice(queue.indexOf(item), 1)
      this.emit(instance, { event: 'context', listenerId, context: item.context, source: item.source })
    }
    if (queue.length === 0) this.pendingContexts.delete(instance.instanceId)
  }

  private async open(source: AppIdentifier, params: Methods['open']['params']): Promise<AppIdentifier> {
    const user = this.options.hooks.getUser()
    const appId = params.app?.appId
    const record = typeof appId === 'string' ? this.findApp(appId) : undefined
    // An app the user cannot launch is reported exactly like one that does not exist.
    if (!record || !canLaunch(user, record)) {
      this.log.append({
        kind: record ? 'denied' : 'error',
        from: label(source),
        to: String(appId),
        type: 'open',
        id: '',
        detail: record ? 'not entitled' : 'not in directory',
        userId: user.id,
      })
      throw new AgentFault(record ? AgentError.AccessDenied : AgentError.AppNotFound, `Cannot open "${String(appId)}"`)
    }
    const context = params.context === undefined ? undefined : this.checkContext(params.context, source)
    const instanceId = await this.options.hooks.ensureInstance(record.appId, { newInstance: false })
    const target: AppIdentifier = { appId: record.appId, instanceId }
    if (context) {
      const queue = this.pendingContexts.get(instanceId) ?? []
      this.pendingContexts.set(instanceId, queue)
      const item = { context, source }
      queue.push(item)
      // A context nobody ever listens for must not sit in memory for good.
      setTimeout(() => {
        const at = queue.indexOf(item)
        if (at >= 0) queue.splice(at, 1)
        if (queue.length === 0 && this.pendingContexts.get(instanceId) === queue) this.pendingContexts.delete(instanceId)
      }, this.options.deliveryTimeoutMs ?? 10_000)
      const instance = this.instances.get(instanceId)
      if (instance) this.flushPendingContexts(instance)
    }
    this.log.append({ kind: 'open', from: label(source), to: label(target), type: context?.type ?? 'open', id: context ? contextIdLabel(context) : '', userId: user.id })
    return target
  }
}
