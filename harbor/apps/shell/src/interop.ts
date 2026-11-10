import { Agent, WindowBridge } from '@harbor/agent'
import type { ShellShortcut } from '@harbor/schemas'
import { toast } from '@harbor/ui'
import { alerts, setAlertActionHandler } from './alerts/center.ts'
import { announcer } from './announce.ts'
import { shell } from './state.ts'
import { focusOrOpen, setPanelChannel } from './workspaces/controller.ts'

let shortcutHandler: (name: ShellShortcut) => void = () => {}
/** The shell's keyboard layer supplies how a forwarded shortcut is carried out. */
export function setShortcutHandler(handler: (name: ShellShortcut) => void): void {
  shortcutHandler = handler
}

/** The one agent for this shell. Apps, widgets and tiles all route through it. */
export const agent = new Agent({
  directory: () => shell.get().directory,
  hooks: {
    getUser: () => {
      const user = shell.get().user
      if (!user) throw new Error('No user is signed in')
      return user
    },
    getAppearance: () => ({ theme: shell.get().theme, density: shell.get().density }),
    isConnected: () => shell.get().connected,
    publishAlert: (sourceAppId, alert) => alerts.publish(sourceAppId, alert).id,
    getAlertSummary: () => alerts.summary(),
    showAlerts: ({ severity }) => shell.set({ alertsOpen: true, alertSeverity: severity ?? null }),
    onShortcut: (name) => shortcutHandler(name),
    ensureInstance: async (appId, { newInstance }) => focusOrOpen(appId, newInstance),
    resolveIntent: (request) =>
      new Promise((resolve) => {
        // A second raise while the dialog is open cancels the first.
        shell.get().resolver?.settle(null)
        shell.set({
          resolver: {
            request,
            settle: (choice) => {
              shell.set({ resolver: null })
              resolve(choice)
            },
          },
        })
      }),
    onNoHandler: (intent) => toast({ tone: 'warning', title: 'Nothing can handle this', body: intent }),
    onChannelChanged: (instanceId, channelId) => setPanelChannel(instanceId, channelId),
  },
})

export const bridge = new WindowBridge(agent)

// Screen-reader announcements for fills (seen as broadcasts) and critical alerts.
let announcedUpTo = 0
agent.log.subscribe(() => {
  const entries = agent.log.entries()
  for (const entry of entries.slice(announcedUpTo)) {
    if (entry.kind === 'broadcast' && entry.type === 'harbor.fxTrade') announcer.announce(`Trade ${entry.id} filled.`)
    if (entry.kind === 'alert' && entry.type === 'critical') announcer.announce(`Critical alert: ${entry.detail ?? ''}.`)
  }
  announcedUpTo = entries.length
})

// Tiles and apps follow alert counts through the agent.
alerts.subscribe(() => agent.broadcastAlertSummary(alerts.summary()))

/**
 * Carry out an alert's action: raise its intent with its context. The agent
 * opens the target app if it is closed and enforces entitlements as usual.
 */
export async function actOnAlert(alertId: string): Promise<void> {
  const alert = alerts.get(alertId)
  if (!alert?.action || alert.context === undefined) return
  try {
    await agent.raiseIntentFromHost(alert.action.intent, alert.context as Parameters<typeof agent.raiseIntentFromHost>[1])
    alerts.markActioned(alertId)
    shell.set({ alertsOpen: false })
  } catch (error) {
    const code = (error as { code?: string }).code
    // The agent already tells the user when nothing can handle an intent.
    if (code !== 'NoAppsFound' && code !== 'UserCancelledResolution') {
      toast({ tone: 'warning', title: code === 'AccessDenied' ? 'You are not entitled to do that' : `"${alert.action.label}" could not be done`, body: alert.title })
    }
  }
}
setAlertActionHandler((id) => void actOnAlert(id))

/** Raise an intent as the shell (command palette). Failures the user should know about become a toast. */
export function raiseFromShell(intent: string, context: Parameters<typeof agent.raiseIntentFromHost>[1]): void {
  agent.raiseIntentFromHost(intent, context).catch((error: unknown) => {
    const code = (error as { code?: string }).code
    if (code === 'NoAppsFound' || code === 'UserCancelledResolution') return
    toast({ tone: 'warning', title: code === 'AccessDenied' ? 'You are not entitled to do that' : 'That could not be done', body: intent })
  })
}

/** Dev panel: ask Post-Trade to turn its most recent healthy trade into a mismatch. */
export async function forceMismatch(): Promise<void> {
  try {
    await agent.raiseIntentFromHost('harbor.dev.ForceMismatch', { type: 'harbor.devCommand', command: 'forceMismatch' })
  } catch (error) {
    toast({ tone: 'warning', title: 'Could not force a mismatch', body: (error as { code?: string }).code ?? String(error) })
  }
}

// Dev builds expose the agent's table sizes so leak tests can check they return to baseline.
if (import.meta.env.DEV) (window as unknown as { __harbor?: unknown }).__harbor = { stats: () => agent.stats() }
