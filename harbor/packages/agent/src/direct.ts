import type { AgentTransport, ClientTransport, EventMessage, RequestMessage, ResponseMessage } from '@harbor/schemas'

/**
 * In-process transport for widgets and tiles. Messages are structured-cloned
 * and delivered on a microtask, so in-process callers get the same isolation
 * and ordering guarantees as iframe apps: no shared object references and no
 * synchronous re-entrancy into the agent.
 */
export function createDirectPair(): { client: ClientTransport; agent: AgentTransport } {
  let toAgent: ((m: RequestMessage) => void) | undefined
  let toClient: ((m: ResponseMessage | EventMessage) => void) | undefined
  let open = true
  const deliver = <T>(get: () => ((m: T) => void) | undefined, message: T) => {
    const copy = structuredClone(message)
    queueMicrotask(() => {
      if (open) get()?.(copy)
    })
  }
  const close = () => {
    open = false
  }
  return {
    client: {
      post: (m) => deliver(() => toAgent, m),
      onMessage: (h) => {
        toClient = h
      },
      close,
    },
    agent: {
      post: (m) => deliver(() => toClient, m),
      onMessage: (h) => {
        toAgent = h
      },
      close,
    },
  }
}
