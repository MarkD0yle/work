import type { Context } from './context.ts'
import type { UserChannel } from './channels.ts'
import type { UserInfo } from './user.ts'

/* Wire protocol between @harbor/agent-client and @harbor/agent. The same
 * messages travel over both transports (iframe postMessage and in-process). */

export const PROTOCOL = 'harbor/1'

export interface AppIdentifier {
  appId: string
  instanceId?: string
}

export interface ImplementationMetadata {
  fdc3Version: string
  provider: string
  providerVersion: string
  optionalFeatures: { OriginatingAppMetadata: boolean; UserChannelMembershipAPIs: boolean }
  appMetadata: { appId: string; instanceId: string; title: string; listensFor: Record<string, { contexts: string[] }> }
}

export interface AppIntent {
  intent: { name: string }
  apps: { appId: string; title: string }[]
}

export interface IntentResolution {
  source: AppIdentifier
  intent: string
}

export type Theme = 'light' | 'dark'
export type Density = 'compact' | 'comfortable'
export interface Appearance {
  theme: Theme
  density: Density
}

/** Request methods and their params/results. */
export interface Methods {
  getInfo: { params: Record<string, never>; result: ImplementationMetadata }
  getUserInfo: { params: Record<string, never>; result: UserInfo }
  getUserChannels: { params: Record<string, never>; result: UserChannel[] }
  getCurrentChannel: { params: Record<string, never>; result: string | null }
  joinUserChannel: { params: { channelId: string }; result: null }
  leaveCurrentChannel: { params: Record<string, never>; result: null }
  /** `channelId` set = app channel; omitted = the caller's current user channel. */
  broadcast: { params: { context: Context; channelId?: string }; result: null }
  addContextListener: { params: { listenerId: string; contextType: string | null; channelId?: string }; result: null }
  addIntentListener: { params: { listenerId: string; intent: string }; result: null }
  removeListener: { params: { listenerId: string }; result: null }
  getOrCreateChannel: { params: { channelId: string }; result: { id: string; type: 'app' } }
  findIntent: { params: { intent: string; context?: Context }; result: AppIntent }
  raiseIntent: { params: { intent: string; context: Context; app?: AppIdentifier }; result: IntentResolution }
  open: { params: { app: AppIdentifier; context?: Context }; result: AppIdentifier }
}
export type MethodName = keyof Methods

export interface RequestMessage<M extends MethodName = MethodName> {
  protocol: typeof PROTOCOL
  kind: 'request'
  id: string
  method: M
  params: Methods[M]['params']
}

export interface ResponseMessage {
  protocol: typeof PROTOCOL
  kind: 'response'
  id: string
  ok: boolean
  result?: unknown
  /** FDC3-style error code, e.g. `NoAppsFound`. */
  error?: string
  message?: string
}

export type AgentEvent =
  | { event: 'context'; listenerId: string; context: Context; source?: AppIdentifier }
  | { event: 'intent'; listenerId: string; intent: string; context: Context; source?: AppIdentifier }
  | { event: 'channelChanged'; channelId: string | null }
  | { event: 'appearance'; appearance: Appearance }

export type EventMessage = { protocol: typeof PROTOCOL; kind: 'event' } & AgentEvent

/** Iframe handshake: the app says hello, the shell answers with its identity. */
export interface HelloMessage {
  protocol: typeof PROTOCOL
  kind: 'hello'
}
export interface HandshakeMessage {
  protocol: typeof PROTOCOL
  kind: 'handshake'
  appId: string
  instanceId: string
  appearance: Appearance
}

export type ClientToAgent = RequestMessage | HelloMessage
export type AgentToClient = ResponseMessage | EventMessage | HandshakeMessage

/** A duplex message pipe. Both transports implement this. */
export interface Transport<Out, In> {
  post(message: Out): void
  onMessage(handler: (message: In) => void): void
  close(): void
}
export type ClientTransport = Transport<RequestMessage, ResponseMessage | EventMessage>
export type AgentTransport = Transport<ResponseMessage | EventMessage, RequestMessage>

export function isProtocolMessage(data: unknown): data is { protocol: typeof PROTOCOL; kind: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { protocol?: unknown }).protocol === PROTOCOL &&
    typeof (data as { kind?: unknown }).kind === 'string'
  )
}

/** Error codes, following FDC3's error enums where one fits. */
export const AgentError = {
  NoAppsFound: 'NoAppsFound',
  AppNotFound: 'AppNotFound',
  UserCancelled: 'UserCancelledResolution',
  ResolverTimeout: 'ResolverTimeout',
  IntentDeliveryFailed: 'IntentDeliveryFailed',
  MalformedContext: 'MalformedContext',
  NoChannelFound: 'NoChannelFound',
  AccessDenied: 'AccessDenied',
  MalformedMessage: 'MalformedMessage',
} as const
export type AgentErrorCode = (typeof AgentError)[keyof typeof AgentError]
