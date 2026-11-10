/* Screen-reader announcements for things that happen without the user asking:
 * fills and critical alerts. Polite, and throttled so a burst of events does
 * not talk over the user. */

export interface AnnouncerOptions {
  /** Shortest time between two announcements. */
  minGapMs?: number
  /** Most messages allowed to wait; older ones are folded into a count. */
  maxQueued?: number
  now?: () => number
  setTimeout?: (callback: () => void, ms: number) => unknown
}

export interface Announcer {
  announce(message: string): void
  subscribe(listener: (message: string) => void): () => void
}

export function createAnnouncer(options: AnnouncerOptions = {}): Announcer {
  const minGapMs = options.minGapMs ?? 2000
  const maxQueued = options.maxQueued ?? 3
  const now = options.now ?? (() => Date.now())
  const later = options.setTimeout ?? ((callback, ms) => setTimeout(callback, ms))
  const listeners = new Set<(message: string) => void>()
  const queue: string[] = []
  let dropped = 0
  let lastAt = -Infinity
  let scheduled = false

  const flush = () => {
    scheduled = false
    const next = queue.shift()
    if (next === undefined) return
    const message = dropped > 0 && queue.length === 0 ? `${next} And ${dropped} more.` : next
    if (queue.length === 0) dropped = 0
    lastAt = now()
    for (const listener of [...listeners]) listener(message)
    if (queue.length > 0) schedule()
  }
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    later(flush, Math.max(0, lastAt + minGapMs - now()))
  }

  return {
    announce: (message) => {
      queue.push(message)
      while (queue.length > maxQueued) {
        queue.shift()
        dropped++
      }
      schedule()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}

export const announcer = createAnnouncer()
