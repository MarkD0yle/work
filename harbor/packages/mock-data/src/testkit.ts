import type { Scheduler } from './scheduler.ts'

/** A manual clock: timers fire only when the test advances time. */
export function fakeScheduler(startMs: number): Scheduler & { advance(ms: number): void; pending(): number } {
  let now = startMs
  let nextId = 0
  const timers = new Map<number, { at: number; callback: () => void }>()
  return {
    now: () => now,
    setTimeout: (callback, delayMs) => {
      timers.set(++nextId, { at: now + delayMs, callback })
      return nextId
    },
    clearTimeout: (handle) => void timers.delete(handle as number),
    pending: () => timers.size,
    advance: (ms) => {
      const end = now + ms
      for (;;) {
        const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]
        if (!due) break
        timers.delete(due[0])
        now = Math.max(now, due[1].at)
        due[1].callback()
      }
      now = end
    },
  }
}

/** Tuesday 10 November 2026, 14:00 UTC. */
export const T0 = Date.UTC(2026, 10, 10, 14, 0, 0)
export const AS_OF = new Date(T0)
