import { z } from 'zod'
import { formatIssues, type ValidationResult } from './context.ts'

export const SeveritySchema = z.enum(['info', 'warning', 'critical'])
export type Severity = z.infer<typeof SeveritySchema>
export const SEVERITIES: readonly Severity[] = ['critical', 'warning', 'info']

/** What an app sends when it publishes an alert. The shell adds the rest. */
export const AlertInputSchema = z
  .object({
    severity: SeveritySchema,
    title: z.string().min(1).max(60),
    body: z.string().max(140).optional(),
    /** Any context object; handed to the action's intent. */
    context: z.unknown().optional(),
    action: z.object({ label: z.string().min(1).max(24), intent: z.string().min(1) }).optional(),
    /** Publishing again with the same key updates the open alert instead of adding another. */
    key: z.string().min(1).max(80).optional(),
  })
  .refine((a) => !a.action || a.context !== undefined, { message: 'an alert with an action needs a context to act on', path: ['context'] })
export type AlertInput = z.infer<typeof AlertInputSchema>

export type AlertStatus = 'unread' | 'read' | 'actioned' | 'dismissed'

export interface Alert {
  id: string
  createdAt: string
  severity: Severity
  sourceAppId: string
  title: string
  body?: string
  context?: unknown
  action?: { label: string; intent: string }
  status: AlertStatus
  key?: string
}

/** Open alerts (not yet actioned or dismissed) per severity. */
export type AlertSummary = Record<Severity, number>

export function parseAlertInput(input: unknown): ValidationResult<AlertInput> {
  const parsed = AlertInputSchema.safeParse(input)
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: formatIssues(parsed.error) }
}
