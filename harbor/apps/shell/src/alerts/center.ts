import type { Alert } from '@harbor/schemas'
import { dismissToast, toast } from '@harbor/ui'
import { shell } from '../state.ts'
import { AlertService } from './service.ts'

const toastIds = new Map<string, number>()
let act: (alertId: string) => void = () => {}

/** The agent wiring supplies how an alert's action is carried out. */
export function setAlertActionHandler(handler: (alertId: string) => void): void {
  act = handler
}

/** Critical alerts also appear as a toast that stays until it is dealt with. */
function showToast(alert: Alert): void {
  const previous = toastIds.get(alert.id)
  if (previous !== undefined) dismissToast(previous)
  const id = toast({
    tone: 'critical',
    title: alert.title,
    body: alert.body,
    ...(alert.action ? { action: { label: alert.action.label, onSelect: () => act(alert.id) } } : {}),
    // Closing the toast is not dismissing the alert: it stays in the drawer, marked as seen.
    onDismiss: () => alerts.markRead([alert.id]),
  })
  toastIds.set(alert.id, id)
}

export const alerts = new AlertService({
  getUserId: () => shell.get().user?.id ?? 'signed-out',
  onCritical: showToast,
  onClosed: (alert) => {
    const id = toastIds.get(alert.id)
    if (id !== undefined) dismissToast(id)
    toastIds.delete(alert.id)
  },
})
