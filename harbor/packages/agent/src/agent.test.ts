import { describe, expect, it, vi } from 'vitest'
import { PROTOCOL, type Context, type EventMessage, type RequestMessage, type ResponseMessage } from '@harbor/schemas'
import { HarborError } from '@harbor/agent-client'
import { AGENT_VERSION } from './agent.ts'
import { EURUSD, OPS, ORDER, makeKit, settle } from './testkit.ts'

const BLUE = 'fdc3.channel.6'
const GREEN = 'fdc3.channel.4'

async function code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return error instanceof HarborError ? error.code : `not-a-harbor-error: ${String(error)}`
  }
  return 'resolved'
}

describe('identity and metadata', () => {
  it('reports the agent version and the calling app identity', async () => {
    const kit = makeKit()
    const info = await kit.connect('fx-exec', 'p1').getInfo()
    expect(info.providerVersion).toBe(AGENT_VERSION)
    expect(info.provider).toBe('Harbor')
    expect(info.appMetadata).toMatchObject({ appId: 'fx-exec', instanceId: 'p1' })
    expect(info.appMetadata.listensFor['harbor.ExecuteOrder']).toEqual({ contexts: ['harbor.fxOrder'] })
  })

  it('returns user info without credentials, as a copy', async () => {
    const kit = makeKit()
    const user = await kit.connect('blotter', 'p1').getUserInfo()
    expect(user).toEqual(kit.user.current)
    expect(user).not.toBe(kit.user.current)
    expect(Object.keys(user).sort()).toEqual(['displayName', 'entitlements', 'id', 'role'])
  })

  it('lists eight user channels', async () => {
    const channels = await makeKit().connect('blotter', 'p1').getUserChannels()
    expect(channels).toHaveLength(8)
    expect(new Set(channels.map((c) => c.displayMetadata.glyph)).size).toBe(8)
  })
})

describe('user channels', () => {
  it('delivers a broadcast to listeners on the same channel only, never to the sender', async () => {
    const kit = makeKit()
    const a = kit.connect('blotter', 'a', BLUE)
    const b = kit.connect('pretrade', 'b', BLUE)
    const c = kit.connect('research', 'c', GREEN)
    const d = kit.connect('fx-exec', 'd', null)
    const got = { a: vi.fn(), b: vi.fn(), c: vi.fn(), d: vi.fn() }
    await Promise.all([
      a.addContextListener('harbor.fxOrder', got.a),
      b.addContextListener('harbor.fxOrder', got.b),
      c.addContextListener('harbor.fxOrder', got.c),
      d.addContextListener(null, got.d),
    ])
    await a.broadcast(ORDER)
    await settle()
    expect(got.b).toHaveBeenCalledWith(ORDER, { source: { appId: 'blotter', instanceId: 'a' } })
    expect(got.a).not.toHaveBeenCalled()
    expect(got.c).not.toHaveBeenCalled()
    expect(got.d).not.toHaveBeenCalled()
  })

  it('filters by context type; a null listener gets everything', async () => {
    const kit = makeKit()
    const a = kit.connect('blotter', 'a', BLUE)
    const b = kit.connect('pretrade', 'b', BLUE)
    const typed = vi.fn()
    const all = vi.fn()
    await b.addContextListener('fdc3.instrument', typed)
    await b.addContextListener(null, all)
    await a.broadcast(ORDER)
    await a.broadcast(EURUSD)
    await settle()
    expect(typed).toHaveBeenCalledTimes(1)
    expect(all).toHaveBeenCalledTimes(2)
  })

  it('replays the most recent context of each type to a late listener', async () => {
    const kit = makeKit()
    const a = kit.connect('blotter', 'a', BLUE)
    await a.broadcast({ ...ORDER, id: { orderId: 'old' } })
    await a.broadcast(ORDER)
    await a.broadcast(EURUSD)
    const late = kit.connect('pretrade', 'late', BLUE)
    const seen: Context[] = []
    await late.addContextListener(null, (c) => seen.push(c))
    await settle()
    expect(seen).toEqual([ORDER, EURUSD])
  })

  it('replays on join, and tells the app and the host about the change', async () => {
    const kit = makeKit()
    const a = kit.connect('blotter', 'a', BLUE)
    await a.broadcast(ORDER)
    const b = kit.connect('pretrade', 'b', null)
    const seen = vi.fn()
    const changed = vi.fn()
    b.onChannelChanged(changed)
    await b.addContextListener('harbor.fxOrder', seen)
    expect(seen).not.toHaveBeenCalled()
    await b.joinUserChannel(BLUE)
    await settle()
    expect(seen).toHaveBeenCalledTimes(1)
    expect(changed).toHaveBeenCalledWith(BLUE)
    expect(await b.getCurrentChannel()).toBe(BLUE)
    expect(kit.channelChanges).toEqual([['b', BLUE]])
    await b.leaveCurrentChannel()
    expect(await b.getCurrentChannel()).toBeNull()
  })

  it('lets the host move a panel between channels without echoing to the host', async () => {
    const kit = makeKit()
    const a = kit.connect('blotter', 'a', BLUE)
    const changed = vi.fn()
    a.onChannelChanged(changed)
    kit.agent.setInstanceChannel('a', GREEN)
    kit.agent.setInstanceChannel('a', GREEN)
    kit.agent.setInstanceChannel('missing', GREEN)
    await settle()
    expect(changed).toHaveBeenCalledTimes(1)
    expect(kit.channelChanges).toEqual([])
    expect(await a.getCurrentChannel()).toBe(GREEN)
  })

  it('treats a broadcast with no channel as a no-op and rejects unknown channels', async () => {
    const kit = makeKit()
    const a = kit.connect('blotter', 'a', 'not-a-channel')
    expect(await a.getCurrentChannel()).toBeNull()
    await a.broadcast(ORDER)
    expect(kit.agent.log.entries()).toHaveLength(0)
    expect(await code(a.joinUserChannel('nope'))).toBe('NoChannelFound')
  })

  it('rejects malformed context and logs why', async () => {
    const kit = makeKit()
    const a = kit.connect('blotter', 'a', BLUE)
    expect(await code(a.broadcast({ ...ORDER, amount: -1 }))).toBe('MalformedContext')
    expect(await code(a.broadcast({ nope: true } as unknown as Context))).toBe('MalformedContext')
    expect(kit.agent.log.entries().map((e) => e.kind)).toEqual(['error', 'error'])
  })

  it('stops delivering after unsubscribe', async () => {
    const kit = makeKit()
    const a = kit.connect('blotter', 'a', BLUE)
    const b = kit.connect('pretrade', 'b', BLUE)
    const seen = vi.fn()
    const listener = await b.addContextListener(null, seen)
    await listener.unsubscribe()
    await a.broadcast(ORDER)
    await settle()
    expect(seen).not.toHaveBeenCalled()
  })
})

describe('app channels', () => {
  it('carries a private stream independent of user channels', async () => {
    const kit = makeKit()
    const a = kit.connect('fx-exec', 'a', BLUE)
    const b = kit.connect('pretrade', 'b', GREEN)
    const chA = await a.getOrCreateChannel('quotes')
    const chB = await b.getOrCreateChannel('quotes')
    const userSeen = vi.fn()
    const appSeen = vi.fn()
    await b.addContextListener(null, userSeen)
    await chB.addContextListener('fdc3.instrument', appSeen)
    await chA.broadcast(EURUSD)
    await settle()
    expect(appSeen).toHaveBeenCalledTimes(1)
    expect(userSeen).not.toHaveBeenCalled()
    const late = vi.fn()
    await chB.addContextListener(null, late)
    await settle()
    expect(late).toHaveBeenCalledTimes(1)
  })

  it('refuses user channel ids and unknown app channels', async () => {
    const kit = makeKit()
    const a = kit.connect('fx-exec', 'a')
    expect(await code(a.getOrCreateChannel(BLUE))).toBe('AccessDenied')
    expect(await code(a.getOrCreateChannel(''))).toBe('MalformedMessage')
    const pair = (await a.getOrCreateChannel('real')) as { id: string }
    expect(pair.id).toBe('real')
  })
})

describe('intents', () => {
  it('routes directly to a single running handler', async () => {
    const kit = makeKit()
    const blotter = kit.connect('blotter', 'b1')
    const exec = kit.connect('fx-exec', 'x1')
    const got = vi.fn()
    await exec.addIntentListener('harbor.ExecuteOrder', got)
    const resolution = await blotter.raiseIntent('harbor.ExecuteOrder', ORDER, { appId: 'fx-exec', instanceId: 'x1' })
    await settle()
    expect(resolution).toEqual({ source: { appId: 'fx-exec', instanceId: 'x1' }, intent: 'harbor.ExecuteOrder' })
    expect(got).toHaveBeenCalledWith(ORDER, { source: { appId: 'blotter', instanceId: 'b1' } })
    expect(kit.resolveRequests).toHaveLength(0)
    expect(kit.agent.log.entries().at(-1)).toMatchObject({ kind: 'intent', from: 'blotter#b1', to: 'fx-exec#x1', type: 'harbor.ExecuteOrder', id: '10432' })
  })

  it('opens the app when it is not running and delivers once it listens', async () => {
    const kit = makeKit({ deliveryTimeoutMs: 500 })
    const blotter = kit.connect('blotter', 'b1')
    const got = vi.fn()
    kit.autoConnect.onLaunch = (appId, instanceId) => {
      // The app boots some time after the panel is created.
      setTimeout(() => void kit.connect(appId, instanceId).addIntentListener('harbor.ExecuteOrder', got), 20)
    }
    const resolution = await blotter.raiseIntent('harbor.ExecuteOrder', ORDER)
    await settle()
    expect(kit.launched).toEqual(['fx-exec'])
    expect(resolution.source.appId).toBe('fx-exec')
    expect(got).toHaveBeenCalledTimes(1)
  })

  it('fails with IntentDeliveryFailed when the target never listens', async () => {
    const kit = makeKit({ deliveryTimeoutMs: 20 })
    const blotter = kit.connect('blotter', 'b1')
    expect(await code(blotter.raiseIntent('harbor.ExecuteOrder', ORDER))).toBe('IntentDeliveryFailed')
    expect(kit.agent.log.entries().at(-1)).toMatchObject({ kind: 'error', detail: 'target never listened' })
  })

  it('reports zero handlers to the host and the caller', async () => {
    const kit = makeKit()
    const blotter = kit.connect('blotter', 'b1')
    expect(await code(blotter.raiseIntent('harbor.Unknown', ORDER))).toBe('NoAppsFound')
    // Right intent, wrong context type.
    expect(await code(blotter.raiseIntent('ViewNews', ORDER))).toBe('NoAppsFound')
    expect(kit.noHandler).toEqual(['harbor.Unknown', 'ViewNews'])
  })

  it('asks the resolver when two apps can handle it, and honours "remember"', async () => {
    const kit = makeKit()
    const blotter = kit.connect('blotter', 'b1')
    const news = kit.connect('partner-news', 'n1')
    const got = vi.fn()
    await news.addIntentListener('ViewNews', got)
    kit.autoConnect.onLaunch = () => {}
    // The shell would return the running instance; emulate that.
    const original = kit.agent['options'].hooks.ensureInstance
    kit.agent['options'].hooks.ensureInstance = async (appId, o) => (appId === 'partner-news' ? 'n1' : original(appId, o))

    kit.resolver.answer = { appId: 'partner-news', remember: true }
    await blotter.raiseIntent('ViewNews', EURUSD)
    expect(kit.resolveRequests).toHaveLength(1)
    expect(kit.resolveRequests[0]?.candidates.map((c) => c.appId)).toEqual(['research', 'partner-news'])

    await blotter.raiseIntent('ViewNews', EURUSD)
    expect(kit.resolveRequests).toHaveLength(1)
    await settle()
    expect(got).toHaveBeenCalledTimes(2)

    kit.agent.clearRememberedChoices()
    kit.resolver.answer = null
    expect(await code(blotter.raiseIntent('ViewNews', EURUSD))).toBe('UserCancelledResolution')
    kit.resolver.answer = { appId: 'not-a-candidate', remember: false }
    expect(await code(blotter.raiseIntent('ViewNews', EURUSD))).toBe('UserCancelledResolution')
  })

  it('finds intents, filtered by entitlement', async () => {
    const kit = makeKit()
    const blotter = kit.connect('blotter', 'b1')
    expect((await blotter.findIntent('ViewNews', EURUSD)).apps.map((a) => a.appId)).toEqual(['research', 'partner-news'])
    expect((await blotter.findIntent('ViewNews')).apps).toHaveLength(2)
    kit.user.current = OPS
    expect((await blotter.findIntent('ViewNews', EURUSD)).apps.map((a) => a.appId)).toEqual(['research'])
    expect(await code(blotter.findIntent('harbor.ExecuteOrder', ORDER))).toBe('NoAppsFound')
  })

  it('lets the shell raise an intent itself', async () => {
    const kit = makeKit()
    const exec = kit.connect('fx-exec', 'x1')
    const got = vi.fn()
    await exec.addIntentListener('harbor.ExecuteOrder', got)
    kit.agent['options'].hooks.ensureInstance = async () => 'x1'
    await kit.agent.raiseIntentFromHost('harbor.ExecuteOrder', ORDER)
    await settle()
    expect(got).toHaveBeenCalledWith(ORDER, { source: { appId: 'shell', instanceId: 'shell' } })
  })

  it('rejects a raise with a bad context or no intent name', async () => {
    const kit = makeKit()
    const blotter = kit.connect('blotter', 'b1')
    expect(await code(blotter.raiseIntent('harbor.ExecuteOrder', { ...ORDER, pair: 'eurusd' }))).toBe('MalformedContext')
    expect(await code(blotter.raiseIntent('', ORDER))).toBe('MalformedMessage')
  })
})

describe('entitlements are enforced by the agent, not just the UI', () => {
  it('denies raising an intent the user may not raise', async () => {
    const kit = makeKit()
    kit.user.current = OPS
    const blotter = kit.connect('blotter', 'b1')
    expect(await code(blotter.raiseIntent('harbor.ExecuteOrder', ORDER))).toBe('AccessDenied')
    expect(kit.launched).toEqual([])
    expect(kit.agent.log.entries().at(-1)).toMatchObject({ kind: 'denied', type: 'harbor.ExecuteOrder', userId: 'u-ops' })
  })

  it('never offers an unentitled app in the resolver: one candidate left routes directly', async () => {
    const kit = makeKit({ deliveryTimeoutMs: 20 })
    kit.user.current = OPS
    const blotter = kit.connect('blotter', 'b1')
    await code(blotter.raiseIntent('ViewNews', EURUSD))
    expect(kit.resolveRequests).toHaveLength(0)
    expect(kit.launched).toEqual(['research'])
    // Targeting the unentitled app explicitly finds nothing.
    expect(await code(blotter.raiseIntent('ViewNews', EURUSD, { appId: 'partner-news' }))).toBe('NoAppsFound')
  })

  it('denies open for unentitled apps and unknown apps', async () => {
    const kit = makeKit()
    kit.user.current = OPS
    const blotter = kit.connect('blotter', 'b1')
    expect(await code(blotter.open({ appId: 'fx-exec' }))).toBe('AccessDenied')
    expect(await code(blotter.open({ appId: 'ghost' }))).toBe('AppNotFound')
    expect(kit.launched).toEqual([])
    expect(kit.agent.log.entries().map((e) => e.kind)).toEqual(['denied', 'error'])
  })
})

describe('open', () => {
  it('opens an app and hands it the context once it listens', async () => {
    const kit = makeKit()
    const blotter = kit.connect('blotter', 'b1')
    const seen = vi.fn()
    kit.autoConnect.onLaunch = (appId, instanceId) => {
      setTimeout(() => void kit.connect(appId, instanceId).addContextListener('harbor.fxOrder', seen), 10)
    }
    const target = await blotter.open({ appId: 'pretrade' }, ORDER)
    expect(target.appId).toBe('pretrade')
    await new Promise((r) => setTimeout(r, 40))
    expect(seen).toHaveBeenCalledWith(ORDER, { source: { appId: 'blotter', instanceId: 'b1' } })
    expect(kit.agent.log.entries().at(-1)).toMatchObject({ kind: 'open', type: 'harbor.fxOrder', id: '10432' })
  })

  it('delivers straight away to an already listening instance, and opens without context', async () => {
    const kit = makeKit()
    const blotter = kit.connect('blotter', 'b1')
    const pre = kit.connect('pretrade', 'p1')
    const seen = vi.fn()
    await pre.addContextListener(null, seen)
    kit.agent['options'].hooks.ensureInstance = async () => 'p1'
    await blotter.open({ appId: 'pretrade' }, ORDER)
    await blotter.open({ appId: 'pretrade' })
    await settle()
    expect(seen).toHaveBeenCalledTimes(1)
    expect(await code(blotter.open({ appId: 'pretrade' }, { type: '' }))).toBe('MalformedContext')
  })
})

describe('lifecycle and robustness', () => {
  it('answers malformed requests with an error instead of throwing', async () => {
    const kit = makeKit()
    const replies: (ResponseMessage | EventMessage)[] = []
    let send: (m: RequestMessage) => void = () => {}
    kit.agent.registerInstance({
      instanceId: 'raw',
      appId: 'blotter',
      channelId: null,
      transport: { post: (m) => replies.push(m), onMessage: (h) => (send = h), close: () => {} },
    })
    send({ protocol: PROTOCOL, kind: 'request', id: 'r1', method: 'explode' as never, params: {} })
    send({ protocol: PROTOCOL, kind: 'request', id: 'r2', method: 'addIntentListener', params: {} as never })
    send({ protocol: PROTOCOL, kind: 'request', id: 'r3', method: 'addContextListener', params: { listenerId: 'l', contextType: null, channelId: 'missing' } })
    send({ protocol: PROTOCOL, kind: 'request', id: 'r4', method: 'addContextListener', params: {} as never })
    send({ protocol: PROTOCOL, kind: 'request', id: 'r5', method: 'broadcast', params: { context: { type: 'x.y' }, channelId: 'missing' } })
    send(null as never)
    await settle()
    expect(replies.map((r) => (r.kind === 'response' ? r.error : 'event'))).toEqual([
      'MalformedMessage',
      'MalformedMessage',
      'NoChannelFound',
      'MalformedMessage',
      'NoChannelFound',
      'MalformedMessage',
    ])
  })

  it('survives an app going away: unregistered instances get nothing and others carry on', async () => {
    const kit = makeKit()
    const a = kit.connect('blotter', 'a', BLUE)
    const b = kit.connect('pretrade', 'b', BLUE)
    const c = kit.connect('research', 'c', BLUE)
    const seenB = vi.fn()
    const seenC = vi.fn()
    await b.addContextListener(null, seenB)
    await c.addContextListener(null, seenC)
    kit.agent.unregisterInstance('b')
    kit.agent.unregisterInstance('b')
    expect(kit.agent.isRegistered('b')).toBe(false)
    await a.broadcast(ORDER)
    await settle()
    expect(seenB).not.toHaveBeenCalled()
    expect(seenC).toHaveBeenCalledTimes(1)
  })

  it('replaces the old connection when an instance re-registers (iframe reload)', async () => {
    const kit = makeKit()
    const a = kit.connect('blotter', 'a', BLUE)
    const first = kit.connect('pretrade', 'b', BLUE)
    const stale = vi.fn()
    await first.addContextListener(null, stale)
    const second = kit.connect('pretrade', 'b', BLUE)
    const fresh = vi.fn()
    await second.addContextListener('fdc3.instrument', fresh)
    await a.broadcast(EURUSD)
    await settle()
    expect(stale).not.toHaveBeenCalled()
    expect(fresh).toHaveBeenCalledTimes(1)
  })

  it('pushes appearance changes to every instance', async () => {
    const kit = makeKit()
    const a = kit.connect('blotter', 'a')
    const seen = vi.fn()
    a.onAppearanceChanged(seen)
    kit.agent.broadcastAppearance({ theme: 'light', density: 'comfortable' })
    await settle()
    expect(seen).toHaveBeenCalledWith({ theme: 'light', density: 'comfortable' })
    expect(kit.agent.appearance()).toEqual(kit.appearance)
  })

  it('reports the connection state and pushes changes to every instance', async () => {
    const kit = makeKit()
    const a = kit.connect('blotter', 'a')
    expect(await a.getConnection()).toBe(true)
    kit.agent['options'].hooks.isConnected = () => false
    expect(await a.getConnection()).toBe(false)
    const seen = vi.fn()
    const off = a.onConnectionChanged(seen)
    kit.agent.broadcastConnection(false)
    await settle()
    expect(seen).toHaveBeenCalledWith(false)
    off()
    kit.agent.broadcastConnection(true)
    await settle()
    expect(seen).toHaveBeenCalledTimes(1)
  })

  it('keeps an append-only, exportable log with stable snapshots', async () => {
    const kit = makeKit()
    const a = kit.connect('blotter', 'a', BLUE)
    const notified = vi.fn()
    const off = kit.agent.log.subscribe(notified)
    const before = kit.agent.log.entries()
    await a.broadcast(ORDER)
    const after = kit.agent.log.entries()
    expect(before).toHaveLength(0)
    expect(after).toHaveLength(1)
    expect(kit.agent.log.entries()).toBe(after)
    expect(Object.isFrozen(after[0])).toBe(true)
    expect(JSON.parse(kit.agent.log.exportJson())[0]).toMatchObject({ seq: 1, kind: 'broadcast', from: 'blotter#a', to: BLUE, type: 'harbor.fxOrder', id: '10432' })
    off()
    await a.broadcast(ORDER)
    expect(notified).toHaveBeenCalledTimes(1)
  })
})

describe('alerts', () => {
  const mismatch = { severity: 'critical' as const, title: 'Trade T-1 mismatched', body: 'Rate differs', context: ORDER, action: { label: 'Resolve', intent: 'harbor.ExecuteOrder' }, key: 'T-1' }

  it('hands a valid alert to the host with its source app, and logs it', async () => {
    const kit = makeKit()
    const published: [string, unknown][] = []
    kit.agent['options'].hooks.publishAlert = (appId, alert) => {
      published.push([appId, alert])
      return 'a-1'
    }
    const app = kit.connect('pretrade', 'p1')
    expect(await app.publishAlert(mismatch)).toBe('a-1')
    expect(published).toEqual([['pretrade', mismatch]])
    expect(kit.agent.log.entries().at(-1)).toMatchObject({ kind: 'alert', from: 'pretrade#p1', type: 'critical', id: '10432', detail: 'Trade T-1 mismatched' })
    expect(await app.publishAlert({ severity: 'info', title: 'No context needed' })).toBe('a-1')
  })

  it('refuses malformed alerts, bad contexts, and hosts with no alert centre', async () => {
    const kit = makeKit()
    const app = kit.connect('pretrade', 'p1')
    expect(await code(app.publishAlert(mismatch))).toBe('MalformedMessage')
    kit.agent['options'].hooks.publishAlert = () => 'a-1'
    expect(await code(app.publishAlert({ ...mismatch, title: 'x'.repeat(61) }))).toBe('MalformedMessage')
    expect(await code(app.publishAlert({ ...mismatch, body: 'x'.repeat(141) }))).toBe('MalformedMessage')
    expect(await code(app.publishAlert({ ...mismatch, severity: 'fatal' as never }))).toBe('MalformedMessage')
    expect(await code(app.publishAlert({ severity: 'info', title: 'Action without context', action: { label: 'Go', intent: 'X' } }))).toBe('MalformedMessage')
    expect(await code(app.publishAlert({ ...mismatch, context: { ...ORDER, amount: -1 } }))).toBe('MalformedContext')
    expect(await code(app.publishAlert(undefined as never))).toBe('MalformedMessage')
    expect(kit.agent.log.entries().filter((e) => e.kind === 'alert')).toHaveLength(0)
  })

  it('serves the alert summary, pushes changes, and asks the host to show alerts', async () => {
    const kit = makeKit()
    const app = kit.connect('blotter', 'b1')
    expect(await app.getAlertSummary()).toEqual({ info: 0, warning: 0, critical: 0 })
    kit.agent['options'].hooks.getAlertSummary = () => ({ info: 1, warning: 0, critical: 2 })
    expect(await app.getAlertSummary()).toEqual({ info: 1, warning: 0, critical: 2 })
    const seen = vi.fn()
    const off = app.onAlertSummaryChanged(seen)
    kit.agent.broadcastAlertSummary({ info: 0, warning: 0, critical: 3 })
    await settle()
    expect(seen).toHaveBeenCalledWith({ info: 0, warning: 0, critical: 3 })
    off()

    const shown: unknown[] = []
    await app.showAlerts('critical')
    kit.agent['options'].hooks.showAlerts = (filter) => shown.push(filter)
    await app.showAlerts('critical')
    await app.showAlerts()
    await app.showAlerts('bogus' as never)
    expect(shown).toEqual([{ severity: 'critical' }, {}, {}])
  })
})

describe('shell shortcuts', () => {
  it('passes a known shortcut from an app to the host and refuses anything else', async () => {
    const kit = makeKit()
    const seen: [string, string][] = []
    const app = kit.connect('pretrade', 'p1')
    await app.shortcut('commandPalette')
    kit.agent['options'].hooks.onShortcut = (name, instanceId) => seen.push([name, instanceId])
    await app.shortcut('commandPalette')
    await app.shortcut('nextPanel')
    expect(seen).toEqual([['commandPalette', 'p1'], ['nextPanel', 'p1']])
    expect(await code(app.shortcut('formatDisk' as never))).toBe('MalformedMessage')
  })
})

describe('visibility and leaks', () => {
  it('tells one instance when its panel is shown or hidden', async () => {
    const kit = makeKit()
    const a = kit.connect('pretrade', 'a')
    const b = kit.connect('research', 'b')
    const seenA = vi.fn()
    const seenB = vi.fn()
    const off = a.onVisibilityChanged(seenA)
    b.onVisibilityChanged(seenB)
    kit.agent.setInstanceVisible('a', false)
    kit.agent.setInstanceVisible('missing', false)
    await settle()
    expect(seenA).toHaveBeenCalledWith(false)
    expect(seenB).not.toHaveBeenCalled()
    off()
    kit.agent.setInstanceVisible('a', true)
    await settle()
    expect(seenA).toHaveBeenCalledTimes(1)
  })

  it('returns to empty tables after many instances come and go', async () => {
    const kit = makeKit({ deliveryTimeoutMs: 20 })
    const empty = { instances: 0, contextListeners: 0, intentListeners: 0, pendingIntents: 0, pendingContexts: 0 }
    expect(kit.agent.stats()).toEqual(empty)
    for (let i = 0; i < 200; i++) {
      const client = kit.connect('fx-exec', `p-${i}`, BLUE)
      await client.addContextListener(null, () => {})
      await client.addIntentListener('harbor.ExecuteOrder', () => {})
      const listener = await client.addContextListener('harbor.fxOrder', () => {})
      if (i % 2) await listener.unsubscribe()
      if (i === 0) expect(kit.agent.stats()).toMatchObject({ instances: 1, contextListeners: 2, intentListeners: 1 })
      kit.agent.unregisterInstance(`p-${i}`)
    }
    expect(kit.agent.stats()).toEqual(empty)
  })

  it('does not keep intents or contexts queued for an app that never listens', async () => {
    const kit = makeKit({ deliveryTimeoutMs: 20 })
    const blotter = kit.connect('blotter', 'b1')
    void blotter.raiseIntent('harbor.ExecuteOrder', ORDER).catch(() => {})
    await blotter.open({ appId: 'pretrade' }, ORDER)
    await settle()
    expect(kit.agent.stats()).toMatchObject({ pendingIntents: 1, pendingContexts: 1 })
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(kit.agent.stats()).toMatchObject({ pendingIntents: 0, pendingContexts: 0 })
    expect(kit.agent['pendingIntents'].size).toBe(0)
    expect(kit.agent['pendingContexts'].size).toBe(0)
  })

  it('clears a queue once its intent or context has been delivered', async () => {
    const kit = makeKit({ deliveryTimeoutMs: 500 })
    const blotter = kit.connect('blotter', 'b1')
    kit.autoConnect.onLaunch = (appId, instanceId) => {
      setTimeout(() => {
        const client = kit.connect(appId, instanceId)
        void client.addIntentListener('harbor.ExecuteOrder', () => {})
        void client.addContextListener(null, () => {})
      }, 10)
    }
    await blotter.raiseIntent('harbor.ExecuteOrder', ORDER)
    await blotter.open({ appId: 'pretrade' }, ORDER)
    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(kit.agent['pendingIntents'].size).toBe(0)
    expect(kit.agent['pendingContexts'].size).toBe(0)
  })
})
