import { Agent, WindowBridge } from '@harbor/agent'
import { toast } from '@harbor/ui'
import { shell } from './state.ts'
import { focusOrOpen, setPanelChannel } from './workspaces/controller.ts'

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
