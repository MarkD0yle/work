import {
  PROTOCOL,
  isProtocolMessage,
  type Appearance,
  type ClientTransport,
  type EventMessage,
  type HandshakeMessage,
  type ResponseMessage,
} from '@harbor/schemas'
import { createClient, HarborError, type HarborClient } from './client.ts'

export function applyAppearance(appearance: Appearance, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = appearance.theme
  root.dataset.density = appearance.density
}

/**
 * Connect an iframe app to the shell's agent. The app says hello to its
 * parent until the shell answers; from then on it only posts to that window
 * and only listens to the shell at the origin that answered.
 */
export function connect(options: { timeoutMs?: number } = {}): Promise<HarborClient> {
  const parent = window.parent
  if (parent === window) return Promise.reject(new HarborError('AgentNotFound', 'This app is not hosted in a Harbor shell'))
  /* A popped-out panel is hosted by a bare popout window, but the agent still
   * lives in the shell that opened it, so replies arrive from the host's
   * opener. Those two windows are the only senders this app listens to. */
  const fromShell = (source: MessageEventSource | null): boolean => {
    if (source === null) return false
    if (source === parent) return true
    try {
      return parent.opener !== null && source === parent.opener
    } catch {
      return false
    }
  }
  return new Promise((resolve, reject) => {
    const hello = () => parent.postMessage({ protocol: PROTOCOL, kind: 'hello' }, '*')
    const retry = setInterval(hello, 250)
    const giveUp = setTimeout(() => {
      clearInterval(retry)
      window.removeEventListener('message', onHandshake)
      reject(new HarborError('AgentNotFound', 'The shell did not answer'))
    }, options.timeoutMs ?? 10_000)

    function onHandshake(event: MessageEvent) {
      if (!fromShell(event.source) || !isProtocolMessage(event.data) || event.data.kind !== 'handshake') return
      clearInterval(retry)
      clearTimeout(giveUp)
      window.removeEventListener('message', onHandshake)
      const handshake = event.data as HandshakeMessage
      const shellOrigin = event.origin
      applyAppearance(handshake.appearance)

      let handler: ((message: ResponseMessage | EventMessage) => void) | undefined
      const onMessage = (e: MessageEvent) => {
        if (!fromShell(e.source) || e.origin !== shellOrigin || !isProtocolMessage(e.data)) return
        if (e.data.kind === 'response' || e.data.kind === 'event') handler?.(e.data as ResponseMessage | EventMessage)
      }
      window.addEventListener('message', onMessage)
      const transport: ClientTransport = {
        post: (message) => parent.postMessage(message, shellOrigin),
        onMessage: (h) => {
          handler = h
        },
        close: () => window.removeEventListener('message', onMessage),
      }
      const client = createClient(transport)
      client.onAppearanceChanged((appearance) => applyAppearance(appearance))
      resolve(client)
    }
    window.addEventListener('message', onHandshake)
    hello()
  })
}
