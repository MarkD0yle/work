import { useEffect, useRef, useState } from 'react'
import { HarborError, type HarborClient } from '@harbor/agent-client'
import { findUserChannel, type Context, type FxOrderContext, type ImplementationMetadata, type UserInfo } from '@harbor/schemas'
import { createDataset, seedFromSearch } from '@harbor/mock-data'
import { Badge, Button, ChannelDot, EmptyState } from '@harbor/ui'

interface Received {
  key: number
  at: string
  via: 'context' | 'intent'
  label: string
  from: string
  context: Context
}

const PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD'] as const
let orderSeq = 10432

function sampleOrder(): FxOrderContext {
  const pair = PAIRS[orderSeq % PAIRS.length] ?? 'EURUSD'
  return {
    type: 'harbor.fxOrder',
    id: { orderId: String(orderSeq++) },
    pair,
    side: orderSeq % 2 ? 'BUY' : 'SELL',
    dealtCurrency: pair.slice(0, 3),
    amount: 25_000_000,
    tenor: 'SPOT',
    valueDate: '2026-11-12',
    account: 'FUND-A',
    status: 'NEW',
  }
}

const describe = (context: Context): string => {
  const id = context.id ? Object.values(context.id)[0] : undefined
  const pair = typeof context.pair === 'string' ? ` ${context.pair}` : ''
  return `${context.type}${typeof id === 'string' ? ` ${id}` : ''}${pair}`
}

/**
 * A small interop test surface. It is the Context Inspector widget
 * (in-process transport) and also the body of every placeholder app
 * (iframe transport), which is what proves "one API, two transports".
 */
export function InteropProbe({ client }: { client: HarborClient }) {
  const [info, setInfo] = useState<ImplementationMetadata | null>(null)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [channelId, setChannelId] = useState<string | null>(null)
  const [received, setReceived] = useState<Received[]>([])
  const [status, setStatus] = useState('')
  // Every app builds the mock data itself from the seed; equal fingerprints mean they all hold the same data.
  const [mock] = useState(() => {
    const seed = seedFromSearch(window.location.search)
    return { seed, fingerprint: createDataset(seed).fingerprint }
  })
  const lastOrder = useRef<FxOrderContext | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    let live = true
    const cleanups: (() => void)[] = []
    const push = (via: Received['via'], label: string, context: Context, from?: { appId: string }) => {
      if (!live) return
      if (context.type === 'harbor.fxOrder') lastOrder.current = context as FxOrderContext
      const item: Received = { key: ++seq.current, at: new Date().toLocaleTimeString('en-GB'), via, label, from: from?.appId ?? 'unknown', context }
      setReceived((items) => [item, ...items].slice(0, 30))
    }
    void (async () => {
      const [meta, who, channel] = await Promise.all([client.getInfo(), client.getUserInfo(), client.getCurrentChannel()])
      if (!live) return
      setInfo(meta)
      setUser(who)
      setChannelId(channel)
      cleanups.push(client.onChannelChanged((id) => live && setChannelId(id)))
      const contextListener = await client.addContextListener(null, (context, m) => push('context', describe(context), context, m.source))
      cleanups.push(() => void contextListener.unsubscribe().catch(() => {}))
      for (const intent of Object.keys(meta.appMetadata.listensFor)) {
        const listener = await client.addIntentListener(intent, (context, m) => push('intent', `${intent} · ${describe(context)}`, context, m.source))
        cleanups.push(() => void listener.unsubscribe().catch(() => {}))
      }
    })().catch((error) => live && setStatus(`Could not reach the agent: ${String(error)}`))
    return () => {
      live = false
      for (const cleanup of cleanups) cleanup()
    }
  }, [client])

  const run = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action()
      setStatus(`${label}: done`)
    } catch (error) {
      setStatus(`${label}: ${error instanceof HarborError ? `${error.code}${error.message !== error.code ? ` (${error.message})` : ''}` : String(error)}`)
    }
  }
  const order = () => lastOrder.current ?? (lastOrder.current = sampleOrder())
  const instrument = (): Context => ({ type: 'fdc3.instrument', id: { ticker: order().pair }, name: order().pair })
  const channel = findUserChannel(channelId)
  const handles = Object.keys(info?.appMetadata.listensFor ?? {})

  return (
    <div className="hw-probe">
      <header className="hw-probe__header">
        <div>
          <strong>{info?.appMetadata.title ?? 'Connecting…'}</strong>
          <span className="hw-probe__meta">
            {user ? `${user.displayName} · ${user.role}` : ''} {info ? `· agent ${info.providerVersion}` : ''}
          </span>
          <span className="hw-probe__meta" data-testid="probe-data">
            seed {mock.seed} · data {mock.fingerprint}
          </span>
        </div>
        <span className="hw-probe__channel" data-testid="probe-channel">
          <ChannelDot channelId={channelId} />
          {channel ? `${channel.displayMetadata.name} channel` : 'No channel'}
        </span>
      </header>

      <div className="hw-probe__handles">
        {handles.length > 0 ? handles.map((h) => <Badge key={h} tone="accent">handles {h}</Badge>) : <Badge>handles no intents</Badge>}
      </div>

      <div className="hw-probe__actions" role="group" aria-label="Send">
        <Button onClick={() => run('Broadcast order', () => client.broadcast((lastOrder.current = sampleOrder())))}>Broadcast new order</Button>
        <Button onClick={() => run('Broadcast instrument', () => client.broadcast(instrument()))}>Broadcast instrument</Button>
        <Button onClick={() => run('Analyse order', () => client.raiseIntent('harbor.AnalyseOrder', order()))}>Analyse order</Button>
        <Button variant="primary" onClick={() => run('Execute order', () => client.raiseIntent('harbor.ExecuteOrder', order()))}>
          Execute order
        </Button>
        <Button onClick={() => run('View news', () => client.raiseIntent('ViewNews', instrument()))}>View news</Button>
        <Button variant="ghost" onClick={() => run('Unhandled intent', () => client.raiseIntent('harbor.NoSuchIntent', instrument()))}>
          Raise unhandled intent
        </Button>
      </div>
      <p className="hw-probe__status" role="status" data-testid="probe-status">
        {status}
      </p>

      <div className="hw-probe__log" data-testid="probe-received">
        {received.length === 0 ? (
          <EmptyState title="Nothing received yet" body="Context broadcast on this panel's channel and intents routed to this app appear here." />
        ) : (
          <ul>
            {received.map((r) => (
              <li key={r.key}>
                <span className="hw-probe__time">{r.at}</span>
                <Badge tone={r.via === 'intent' ? 'positive' : 'neutral'}>{r.via}</Badge>
                <span className="hw-probe__label">{r.label}</span>
                <span className="hw-probe__from">from {r.from}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
