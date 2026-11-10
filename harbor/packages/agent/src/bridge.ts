import { PROTOCOL, isProtocolMessage, type AgentTransport, type EventMessage, type RequestMessage, type ResponseMessage } from '@harbor/schemas'
import type { Agent } from './agent.ts'

export interface WindowLike {
  postMessage(message: unknown, targetOrigin: string): void
}

export interface FrameRegistration {
  instanceId: string
  appId: string
  /** The iframe's current content window (it changes on reload). */
  getWindow(): WindowLike | null
  /** The panel's current channel link, read at each (re)connect. */
  getChannelId(): string | null
  onConnected?(): void
}

interface Connection {
  origin: string
  window: WindowLike
  receive: (message: RequestMessage) => void
}

export interface IncomingMessage {
  data: unknown
  origin: string
  source: unknown
}

/**
 * Connects sandboxed iframes to the agent over `postMessage`.
 *
 * Every message is checked: its source window must belong to a registered
 * frame, and its origin must be in that app's `allowedOrigins`. Anything else
 * is dropped and logged. Replies are posted with an explicit target origin.
 */
export class WindowBridge {
  private readonly agent: Agent
  private readonly frames = new Map<string, FrameRegistration>()
  private readonly connections = new Map<string, Connection>()

  constructor(agent: Agent) {
    this.agent = agent
  }

  attach(frame: FrameRegistration): () => void {
    this.frames.set(frame.instanceId, frame)
    return () => {
      if (this.frames.get(frame.instanceId) !== frame) return
      this.frames.delete(frame.instanceId)
      this.connections.delete(frame.instanceId)
      this.agent.unregisterInstance(frame.instanceId)
    }
  }

  /** Returns true when the message was accepted and routed. */
  handleMessage(event: IncomingMessage): boolean {
    if (event.source === null || event.source === undefined) return false
    const frame = [...this.frames.values()].find((f) => f.getWindow() === event.source)
    // Not from one of our frames (extensions, devtools, other widgets): not ours to judge.
    if (!frame || !isProtocolMessage(event.data)) return false

    const record = this.agent.findApp(frame.appId)
    const data = event.data as { kind: string; method?: unknown }
    const describe = data.kind === 'request' && typeof data.method === 'string' ? data.method : data.kind
    const drop = (detail: string) => {
      this.agent.log.append({ kind: 'dropped', from: event.origin, to: `${frame.appId}#${frame.instanceId}`, type: describe, id: '', detail })
      return false
    }
    if (!record) return drop('app is not in the directory')
    if (!record.allowedOrigins.includes(event.origin)) return drop('origin is not in allowedOrigins')

    if (data.kind === 'hello') {
      const target = event.source as WindowLike
      const origin = event.origin
      let receive: (message: RequestMessage) => void = () => {}
      const transport: AgentTransport = {
        post: (message: ResponseMessage | EventMessage) => {
          // Stop talking if the frame has since navigated or been replaced.
          if (this.connections.get(frame.instanceId)?.window === target) target.postMessage(message, origin)
        },
        onMessage: (handler) => {
          receive = handler
        },
        close: () => {},
      }
      this.connections.set(frame.instanceId, { origin, window: target, receive: (m) => receive(m) })
      this.agent.registerInstance({ instanceId: frame.instanceId, appId: frame.appId, channelId: frame.getChannelId(), transport })
      target.postMessage(
        { protocol: PROTOCOL, kind: 'handshake', appId: frame.appId, instanceId: frame.instanceId, appearance: this.agent.appearance() },
        origin,
      )
      frame.onConnected?.()
      return true
    }

    if (data.kind === 'request') {
      const connection = this.connections.get(frame.instanceId)
      if (!connection || connection.window !== event.source) return drop('request before handshake')
      if (connection.origin !== event.origin) return drop('origin changed since handshake')
      connection.receive(event.data as RequestMessage)
      return true
    }
    return drop('unexpected message kind')
  }
}
