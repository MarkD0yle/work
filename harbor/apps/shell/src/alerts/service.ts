import type { Alert, AlertInput, AlertStatus, AlertSummary, Severity } from '@harbor/schemas'

/** One line per change to an alert: who, when, before and after. Append-only. */
export interface AlertAuditEntry {
  seq: number
  at: string
  alertId: string
  userId: string
  change: 'published' | 'updated' | 'read' | 'actioned' | 'dismissed'
  before: AlertStatus | null
  after: AlertStatus
  title: string
}

export interface AlertServiceOptions {
  now?: () => Date
  newId?: () => string
  /** Who is signed in; recorded against every change. */
  getUserId: () => string
  /** Called for each newly published or re-raised critical alert (the host shows a toast). */
  onCritical?: (alert: Alert) => void
  /** Called when an alert stops being open (the host removes its toast). */
  onClosed?: (alert: Alert) => void
}

const OPEN: readonly AlertStatus[] = ['unread', 'read']
const RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 }

/**
 * The shell's alert centre. Apps publish through the agent; the bell, drawer,
 * toasts and alerts tile all read from here. Plain class, no UI, so it is
 * testable on its own.
 */
export class AlertService {
  private readonly options: AlertServiceOptions
  private alerts: Alert[] = []
  private snapshot: readonly Alert[] = []
  private readonly auditLog: AlertAuditEntry[] = []
  private auditSnapshot: readonly AlertAuditEntry[] = []
  private readonly listeners = new Set<() => void>()

  constructor(options: AlertServiceOptions) {
    this.options = options
  }

  private now(): string {
    return (this.options.now?.() ?? new Date()).toISOString()
  }

  private record(alert: Alert, change: AlertAuditEntry['change'], before: AlertStatus | null): void {
    this.auditLog.push(Object.freeze({ seq: this.auditLog.length + 1, at: this.now(), alertId: alert.id, userId: this.options.getUserId(), change, before, after: alert.status, title: alert.title }))
  }

  private commit(): void {
    // Most severe first, then newest first.
    this.snapshot = Object.freeze([...this.alerts].sort((a, b) => RANK[a.severity] - RANK[b.severity] || b.createdAt.localeCompare(a.createdAt)))
    this.auditSnapshot = Object.freeze([...this.auditLog])
    for (const listener of [...this.listeners]) listener()
  }

  /** Add an alert. Re-publishing an open alert with the same source and key updates it in place. */
  publish(sourceAppId: string, input: AlertInput): Alert {
    const existing = input.key ? this.alerts.find((a) => a.sourceAppId === sourceAppId && a.key === input.key && OPEN.includes(a.status)) : undefined
    if (existing) {
      const before = existing.status
      const updated: Alert = { ...existing, ...input, status: 'unread', createdAt: this.now() }
      this.alerts = this.alerts.map((a) => (a === existing ? updated : a))
      this.record(updated, 'updated', before)
      this.commit()
      if (updated.severity === 'critical') this.options.onCritical?.(updated)
      return updated
    }
    const alert: Alert = { ...input, id: this.options.newId?.() ?? crypto.randomUUID(), createdAt: this.now(), sourceAppId, status: 'unread' }
    this.alerts = [...this.alerts, alert]
    this.record(alert, 'published', null)
    this.commit()
    if (alert.severity === 'critical') this.options.onCritical?.(alert)
    return alert
  }

  private move(ids: readonly string[], to: AlertStatus, from: readonly AlertStatus[]): number {
    let changed = 0
    this.alerts = this.alerts.map((alert) => {
      if (!ids.includes(alert.id) || !from.includes(alert.status)) return alert
      const next: Alert = { ...alert, status: to }
      this.record(next, to as AlertAuditEntry['change'], alert.status)
      if (!OPEN.includes(to)) this.options.onClosed?.(next)
      changed++
      return next
    })
    if (changed) this.commit()
    return changed
  }

  /** Mark alerts as seen. Only unread alerts change. */
  markRead(ids: readonly string[]): number {
    return this.move(ids, 'read', ['unread'])
  }

  /** The alert's action was taken. */
  markActioned(id: string): boolean {
    return this.move([id], 'actioned', OPEN) === 1
  }

  /** Dismiss alerts. Already dismissed ones are left alone. */
  dismiss(ids: readonly string[]): number {
    return this.move(ids, 'dismissed', ['unread', 'read', 'actioned'])
  }

  get(id: string): Alert | undefined {
    return this.alerts.find((a) => a.id === id)
  }

  /** Every alert that has not been dismissed, most severe then newest first. Stable between changes. */
  list(): readonly Alert[] {
    return this.snapshot
  }

  /** Open alerts per severity. */
  summary(): AlertSummary {
    const summary: AlertSummary = { info: 0, warning: 0, critical: 0 }
    for (const a of this.alerts) if (OPEN.includes(a.status)) summary[a.severity]++
    return summary
  }

  unreadCount(): number {
    return this.alerts.filter((a) => a.status === 'unread').length
  }

  audit(): readonly AlertAuditEntry[] {
    return this.auditSnapshot
  }

  /** Alerts and their full change history, for export. */
  exportJson(): string {
    return JSON.stringify({ alerts: this.alerts, audit: this.auditLog }, null, 2)
  }

  /** Forget the alerts (user switch or sign-out). The audit trail is kept. */
  clear(): void {
    for (const alert of this.alerts) if (OPEN.includes(alert.status)) this.options.onClosed?.(alert)
    this.alerts = []
    this.commit()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }
}
