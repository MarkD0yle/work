/* The shell's audit trail: every state-changing action the shell itself
 * performs, with who, when, before and after. Append-only and exportable.
 * (Interop traffic is in the agent's interop log, alert changes in the alert
 * service, settlement actions in Post-Trade's activity log.) */

export interface AuditEntry {
  seq: number
  at: string
  userId: string
  action: string
  /** What was acted on: a workspace, a panel, the session. */
  target: string
  before: unknown
  after: unknown
}

export class AuditTrail {
  private readonly items: AuditEntry[] = []
  private readonly getUserId: () => string
  private readonly now: () => Date

  constructor(getUserId: () => string, now: () => Date = () => new Date()) {
    this.getUserId = getUserId
    this.now = now
  }

  record(action: string, target: string, before: unknown, after: unknown): AuditEntry {
    // Copies are frozen so later changes to the live objects cannot rewrite history.
    const entry: AuditEntry = Object.freeze({
      seq: this.items.length + 1,
      at: this.now().toISOString(),
      userId: this.getUserId(),
      action,
      target,
      before: before === undefined ? null : structuredClone(before),
      after: after === undefined ? null : structuredClone(after),
    })
    this.items.push(entry)
    return entry
  }

  entries(): readonly AuditEntry[] {
    return [...this.items]
  }

  exportJson(): string {
    return JSON.stringify(this.items, null, 2)
  }
}
