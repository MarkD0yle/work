import { describe, expect, it, vi } from 'vitest'
import type { Alert, AlertInput } from '@harbor/schemas'
import { AlertService } from './service.ts'

function make() {
  let n = 0
  let clock = Date.parse('2026-11-10T14:00:00Z')
  const critical: Alert[] = []
  const closed: string[] = []
  const user = { id: 'u-ops' }
  const service = new AlertService({
    now: () => new Date((clock += 1000)),
    newId: () => `a-${++n}`,
    getUserId: () => user.id,
    onCritical: (a) => critical.push(a),
    onClosed: (a) => closed.push(a.id),
  })
  return { service, critical, closed, user }
}

const mismatch: AlertInput = { severity: 'critical', title: 'Trade T-1 mismatched', body: 'Rate differs', context: { type: 'harbor.fxTrade' }, action: { label: 'Resolve', intent: 'harbor.ViewSettlement' }, key: 'T-1' }
const info: AlertInput = { severity: 'info', title: 'Cut-off in 10 minutes' }
const warning: AlertInput = { severity: 'warning', title: 'Quote stream slow' }

describe('AlertService', () => {
  it('publishes alerts as unread and orders them by severity, then newest first', () => {
    const { service, critical } = make()
    service.publish('cash', info)
    service.publish('post-trade', mismatch)
    service.publish('fx-exec', warning)
    service.publish('post-trade', { ...mismatch, key: 'T-2', title: 'Trade T-2 mismatched' })
    expect(service.list().map((a) => a.title)).toEqual(['Trade T-2 mismatched', 'Trade T-1 mismatched', 'Quote stream slow', 'Cut-off in 10 minutes'])
    expect(service.list().every((a) => a.status === 'unread')).toBe(true)
    expect(service.list()[1]).toMatchObject({ id: 'a-2', sourceAppId: 'post-trade', createdAt: '2026-11-10T14:00:03.000Z' })
    expect(service.summary()).toEqual({ critical: 2, warning: 1, info: 1 })
    expect(service.unreadCount()).toBe(4)
    // Only critical alerts ask the host for a toast.
    expect(critical.map((a) => a.id)).toEqual(['a-2', 'a-4'])
  })

  it('updates an open alert with the same source and key instead of duplicating it', () => {
    const { service, critical } = make()
    const first = service.publish('post-trade', mismatch)
    service.markRead([first.id])
    const again = service.publish('post-trade', { ...mismatch, body: 'Amount differs' })
    expect(again.id).toBe(first.id)
    expect(service.list()).toHaveLength(1)
    expect(service.get(first.id)).toMatchObject({ body: 'Amount differs', status: 'unread' })
    expect(critical).toHaveLength(2)
    // Same key from another app, or with no key at all, is a different alert.
    service.publish('tca', mismatch)
    service.publish('post-trade', { ...mismatch, key: undefined })
    expect(service.list()).toHaveLength(3)
    // Once dismissed, the same key raises a fresh alert.
    service.dismiss([first.id])
    expect(service.publish('post-trade', mismatch).id).not.toBe(first.id)
  })

  it('moves alerts through read, actioned and dismissed, and tells the host when one closes', () => {
    const { service, closed } = make()
    const a = service.publish('post-trade', mismatch)
    const b = service.publish('cash', info)
    expect(service.markRead([a.id, b.id, 'missing'])).toBe(2)
    expect(service.markRead([a.id])).toBe(0)
    expect(service.unreadCount()).toBe(0)
    expect(service.summary()).toEqual({ critical: 1, warning: 0, info: 1 })

    expect(service.markActioned(a.id)).toBe(true)
    expect(service.markActioned(a.id)).toBe(false)
    expect(service.get(a.id)?.status).toBe('actioned')
    expect(service.summary().critical).toBe(0)
    expect(closed).toEqual([a.id])

    expect(service.dismiss([a.id, b.id])).toBe(2)
    expect(service.dismiss([a.id])).toBe(0)
    expect(closed).toEqual([a.id, a.id, b.id])
    expect(service.list().map((x) => x.status)).toEqual(['dismissed', 'dismissed'])
  })

  it('keeps an append-only audit of who changed what, with before and after', () => {
    const { service, user } = make()
    const a = service.publish('post-trade', mismatch)
    user.id = 'u-trader'
    service.markRead([a.id])
    service.markActioned(a.id)
    service.dismiss([a.id])
    const audit = service.audit()
    expect(audit.map((e) => [e.change, e.before, e.after, e.userId])).toEqual([
      ['published', null, 'unread', 'u-ops'],
      ['read', 'unread', 'read', 'u-trader'],
      ['actioned', 'read', 'actioned', 'u-trader'],
      ['dismissed', 'actioned', 'dismissed', 'u-trader'],
    ])
    expect(audit.map((e) => e.seq)).toEqual([1, 2, 3, 4])
    expect(Object.isFrozen(audit[0])).toBe(true)
    const exported = JSON.parse(service.exportJson()) as { alerts: unknown[]; audit: unknown[] }
    expect(exported.alerts).toHaveLength(1)
    expect(exported.audit).toHaveLength(4)
    // Clearing alerts on sign-out does not erase the trail.
    service.clear()
    expect(service.list()).toHaveLength(0)
    expect(service.audit()).toHaveLength(4)
  })

  it('gives stable snapshots and notifies subscribers only on change', () => {
    const { service, closed } = make()
    const listener = vi.fn()
    const off = service.subscribe(listener)
    const empty = service.list()
    const a = service.publish('cash', info)
    const one = service.list()
    expect(empty).not.toBe(one)
    expect(service.list()).toBe(one)
    expect(service.markRead(['missing'])).toBe(0)
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    service.dismiss([a.id])
    expect(listener).toHaveBeenCalledTimes(1)
    service.publish('cash', warning)
    service.clear()
    expect(closed).toHaveLength(2)
  })
})
