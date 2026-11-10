export type InteropLogKind = 'broadcast' | 'intent' | 'open' | 'channel' | 'alert' | 'dropped' | 'denied' | 'error'

export interface InteropLogEntry {
  seq: number
  time: string
  kind: InteropLogKind
  /** Who acted: `appId#instanceId`, or an origin for dropped messages. */
  from: string
  /** Where it went: a channel id, an `appId#instanceId`, or `-`. */
  to: string
  /** Context type, intent name or message kind. */
  type: string
  /** Business id of the context (order id, trade id, ...) when there is one. */
  id: string
  detail?: string
  userId?: string
}

export type InteropLogInput = Omit<InteropLogEntry, 'seq' | 'time'>

/** Append-only, in-memory record of everything the agent routed or refused. */
export class InteropLog {
  private readonly items: InteropLogEntry[] = []
  private readonly listeners = new Set<() => void>()
  private snapshot: readonly InteropLogEntry[] = []
  private readonly now: () => Date

  constructor(now: () => Date = () => new Date()) {
    this.now = now
  }

  append(input: InteropLogInput): InteropLogEntry {
    const entry: InteropLogEntry = Object.freeze({ ...input, seq: this.items.length + 1, time: this.now().toISOString() })
    this.items.push(entry)
    this.snapshot = Object.freeze([...this.items])
    for (const listener of this.listeners) listener()
    return entry
  }

  /** A stable snapshot; the reference only changes when an entry is appended. */
  entries(): readonly InteropLogEntry[] {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  exportJson(): string {
    return JSON.stringify(this.items, null, 2)
  }
}
