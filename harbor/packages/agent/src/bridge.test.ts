import { describe, expect, it, vi } from 'vitest'
import { PROTOCOL, type AgentToClient } from '@harbor/schemas'
import { WindowBridge } from './bridge.ts'
import { ORDER, makeKit, settle } from './testkit.ts'

const GOOD = 'http://apps.test'
const EVIL = 'http://evil.test'

function fakeWindow() {
  const posted: { message: AgentToClient; origin: string }[] = []
  return { posted, postMessage: (message: unknown, origin: string) => void posted.push({ message: message as AgentToClient, origin }) }
}

function setup(appId = 'fx-exec') {
  const kit = makeKit()
  const bridge = new WindowBridge(kit.agent)
  const win = fakeWindow()
  const onConnected = vi.fn()
  const frame = { current: win as ReturnType<typeof fakeWindow> | null }
  const detach = bridge.attach({ instanceId: 'p1', appId, getWindow: () => frame.current, getChannelId: () => 'fdc3.channel.6', onConnected })
  const hello = (origin = GOOD, source: unknown = win) => bridge.handleMessage({ data: { protocol: PROTOCOL, kind: 'hello' }, origin, source })
  const request = (method: string, params: unknown, origin = GOOD, source: unknown = win) =>
    bridge.handleMessage({ data: { protocol: PROTOCOL, kind: 'request', id: `r-${method}`, method, params }, origin, source })
  return { kit, bridge, win, frame, detach, hello, request, onConnected }
}

describe('WindowBridge', () => {
  it('handshakes with an allowed origin and replies only to that origin', async () => {
    const t = setup()
    expect(t.hello()).toBe(true)
    expect(t.onConnected).toHaveBeenCalledTimes(1)
    expect(t.win.posted[0]).toEqual({
      origin: GOOD,
      message: { protocol: PROTOCOL, kind: 'handshake', appId: 'fx-exec', instanceId: 'p1', appearance: t.kit.appearance },
    })
    expect(t.request('getCurrentChannel', {})).toBe(true)
    await settle()
    expect(t.win.posted[1]).toMatchObject({ origin: GOOD, message: { kind: 'response', ok: true, result: 'fdc3.channel.6' } })
  })

  it('drops and logs a hello from an origin that is not in allowedOrigins', () => {
    const t = setup()
    expect(t.hello(EVIL)).toBe(false)
    expect(t.win.posted).toHaveLength(0)
    expect(t.kit.agent.isRegistered('p1')).toBe(false)
    expect(t.kit.agent.log.entries().at(-1)).toMatchObject({ kind: 'dropped', from: EVIL, to: 'fx-exec#p1', type: 'hello', detail: 'origin is not in allowedOrigins' })
  })

  it('checks the origin on every message, not just the handshake', async () => {
    const t = setup()
    t.hello()
    const other = t.kit.connect('pretrade', 'p2', 'fdc3.channel.6')
    const seen = vi.fn()
    await other.addContextListener(null, seen)
    expect(t.request('broadcast', { context: ORDER }, EVIL)).toBe(false)
    await settle()
    expect(seen).not.toHaveBeenCalled()
    expect(t.kit.agent.log.entries().at(-1)).toMatchObject({ kind: 'dropped', from: EVIL, type: 'broadcast' })
    expect(t.request('broadcast', { context: ORDER })).toBe(true)
    await settle()
    expect(seen).toHaveBeenCalledTimes(1)
  })

  it('drops a request made before any handshake, and unknown message kinds', () => {
    const t = setup()
    expect(t.request('getInfo', {})).toBe(false)
    expect(t.kit.agent.log.entries().at(-1)).toMatchObject({ kind: 'dropped', detail: 'request before handshake' })
    t.hello()
    expect(t.bridge.handleMessage({ data: { protocol: PROTOCOL, kind: 'response' }, origin: GOOD, source: t.win })).toBe(false)
  })

  it('drops a request whose origin differs from the handshake origin even if both are allowed', () => {
    const t = setup()
    const record = t.kit.agent.findApp('fx-exec')
    record?.allowedOrigins.push('http://second.test')
    t.hello()
    expect(t.request('getInfo', {}, 'http://second.test')).toBe(false)
    expect(t.kit.agent.log.entries().at(-1)).toMatchObject({ detail: 'origin changed since handshake' })
    record?.allowedOrigins.pop()
  })

  it('ignores messages that are not ours without logging', () => {
    const t = setup()
    expect(t.hello(GOOD, fakeWindow())).toBe(false)
    expect(t.hello(GOOD, null)).toBe(false)
    expect(t.bridge.handleMessage({ data: { some: 'other protocol' }, origin: GOOD, source: t.win })).toBe(false)
    expect(t.kit.agent.log.entries()).toHaveLength(0)
  })

  it('drops everything for an app that is missing from the directory', () => {
    const t = setup('ghost-app')
    expect(t.hello()).toBe(false)
    expect(t.kit.agent.log.entries().at(-1)).toMatchObject({ kind: 'dropped', detail: 'app is not in the directory' })
  })

  it('re-handshakes after a reload and stops talking to the old window', async () => {
    const t = setup()
    t.hello()
    const reloaded = fakeWindow()
    t.frame.current = reloaded
    expect(t.hello(GOOD, reloaded)).toBe(true)
    expect(t.request('getInfo', {}, GOOD, t.win)).toBe(false)
    expect(t.request('getInfo', {}, GOOD, reloaded)).toBe(true)
    await settle()
    expect(t.win.posted).toHaveLength(1)
    expect(reloaded.posted).toHaveLength(2)
  })

  it('unregisters the instance on detach', async () => {
    const t = setup()
    t.hello()
    expect(t.kit.agent.isRegistered('p1')).toBe(true)
    t.detach()
    t.detach()
    expect(t.kit.agent.isRegistered('p1')).toBe(false)
    expect(t.hello()).toBe(false)
    t.kit.agent.broadcastAppearance({ theme: 'light', density: 'compact' })
    await settle()
    expect(t.win.posted).toHaveLength(1)
  })
})
