import { describe, expect, it } from 'vitest'
import { createAnnouncer } from './announce.ts'
import { AuditTrail } from './audit.ts'

function fakeClock() {
  let now = 0
  const timers: { at: number; run: () => void }[] = []
  return {
    now: () => now,
    setTimeout: (run: () => void, ms: number) => void timers.push({ at: now + ms, run }),
    advance: (ms: number) => {
      const end = now + ms
      for (;;) {
        const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0]
        if (!due) break
        timers.splice(timers.indexOf(due), 1)
        now = Math.max(now, due.at)
        due.run()
      }
      now = end
    },
  }
}

describe('announcer', () => {
  it('speaks the first message at once and spaces the rest out', () => {
    const clock = fakeClock()
    const announcer = createAnnouncer({ minGapMs: 2000, now: clock.now, setTimeout: clock.setTimeout })
    const heard: [number, string][] = []
    announcer.subscribe((m) => heard.push([clock.now(), m]))
    announcer.announce('Trade T-1 filled')
    announcer.announce('Critical alert: T-1 mismatched')
    clock.advance(0)
    expect(heard).toEqual([[0, 'Trade T-1 filled']])
    clock.advance(1999)
    expect(heard).toHaveLength(1)
    clock.advance(1)
    expect(heard[1]).toEqual([2000, 'Critical alert: T-1 mismatched'])
    // After a quiet spell the next one is immediate again.
    clock.advance(10_000)
    announcer.announce('Trade T-2 filled')
    clock.advance(0)
    expect(heard[2]).toEqual([12_000, 'Trade T-2 filled'])
  })

  it('folds a burst into a count instead of reading every event', () => {
    const clock = fakeClock()
    const announcer = createAnnouncer({ minGapMs: 1000, maxQueued: 2, now: clock.now, setTimeout: clock.setTimeout })
    const heard: string[] = []
    const off = announcer.subscribe((m) => heard.push(m))
    for (let i = 1; i <= 6; i++) announcer.announce(`Alert ${i}`)
    clock.advance(5000)
    expect(heard).toEqual(['Alert 5', 'Alert 6 And 4 more.'])
    off()
    announcer.announce('Unheard')
    clock.advance(5000)
    expect(heard).toHaveLength(2)
  })
})

describe('AuditTrail', () => {
  it('records who, when, before and after, append-only', () => {
    let user = 'u-trader'
    let tick = 0
    const trail = new AuditTrail(() => user, () => new Date(Date.UTC(2026, 10, 10, 14, 0, tick++)))
    const before = { channelId: 'fdc3.channel.6' }
    trail.record('panel.channel', 'pretrade', before, { channelId: 'fdc3.channel.4' })
    user = 'u-ops'
    trail.record('workspace.delete', 'FX Trading', { panels: 6 }, undefined)
    // Changing the live object afterwards does not change what was recorded.
    before.channelId = 'tampered'
    const entries = trail.entries()
    expect(entries).toEqual([
      { seq: 1, at: '2026-11-10T14:00:00.000Z', userId: 'u-trader', action: 'panel.channel', target: 'pretrade', before: { channelId: 'fdc3.channel.6' }, after: { channelId: 'fdc3.channel.4' } },
      { seq: 2, at: '2026-11-10T14:00:01.000Z', userId: 'u-ops', action: 'workspace.delete', target: 'FX Trading', before: { panels: 6 }, after: null },
    ])
    expect(Object.isFrozen(entries[0])).toBe(true)
    expect(JSON.parse(trail.exportJson())).toHaveLength(2)
    // The returned list is a copy: pushing to it does not touch the trail.
    ;(entries as unknown[]).push('x')
    expect(trail.entries()).toHaveLength(2)
  })
})
