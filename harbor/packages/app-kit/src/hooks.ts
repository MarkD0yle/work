import { useEffect, useRef, useState } from 'react'
import type { ContextHandler, HarborClient, IntentHandler } from '@harbor/agent-client'
import type { MockServices, Order, Trade } from '@harbor/mock-data'
import type { UserInfo } from '@harbor/schemas'
import { realmServices } from './realm.ts'

/** Subscribe to a context type on the panel's channel for as long as the component lives. */
export function useContextListener(client: HarborClient, contextType: string | null, handler: ContextHandler): void {
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })
  useEffect(() => {
    let live = true
    let unsubscribe: (() => void) | undefined
    // Registering is deferred a tick so a mount that is immediately torn down
    // (React StrictMode in dev) never registers at all. Otherwise the agent
    // could hand a queued context or intent to a listener that is already dead.
    void Promise.resolve()
      .then(() => (live ? client.addContextListener(contextType, (context, metadata) => live && latest.current(context, metadata)) : null))
      .then((listener) => {
        if (!listener) return
        const off = () => void listener.unsubscribe().catch(() => {})
        if (live) unsubscribe = off
        else off()
      })
      .catch(() => {})
    return () => {
      live = false
      unsubscribe?.()
    }
  }, [client, contextType])
}

/** Handle an intent for as long as the component lives. */
export function useIntentListener(client: HarborClient, intent: string, handler: IntentHandler): void {
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })
  useEffect(() => {
    let live = true
    let unsubscribe: (() => void) | undefined
    void Promise.resolve()
      .then(() => (live ? client.addIntentListener(intent, (context, metadata) => live && latest.current(context, metadata)) : null))
      .then((listener) => {
        if (!listener) return
        const off = () => void listener.unsubscribe().catch(() => {})
        if (live) unsubscribe = off
        else off()
      })
      .catch(() => {})
    return () => {
      live = false
      unsubscribe?.()
    }
  }, [client, intent])
}

export interface Session {
  services: MockServices
  user: UserInfo
  connected: boolean
}

/**
 * What every app, widget and tile needs before it can render: the realm's
 * services, who the user is, and whether the (mock) market connection is up.
 * The price stream is paused while disconnected.
 */
export function useSession(client: HarborClient): Session | null {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [connected, setConnected] = useState(true)
  useEffect(() => {
    let live = true
    const apply = (value: boolean) => {
      if (!live) return
      realmServices().prices.setConnected(value)
      setConnected(value)
    }
    const off = client.onConnectionChanged(apply)
    void client.getUserInfo().then((u) => live && setUser(u), () => {})
    void client.getConnection().then(apply, () => {})
    return () => {
      live = false
      off()
    }
  }, [client])
  return user ? { services: realmServices(), user, connected } : null
}

/** The current time, refreshed on an interval (for ages and countdowns). */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

/** Live list of orders from the realm's OrderService. Null until first loaded. */
export function useOrders(services: MockServices | undefined): Order[] | null {
  const [orders, setOrders] = useState<Order[] | null>(null)
  useEffect(() => {
    if (!services) return
    let live = true
    const refresh = () => void services.orders.list().then((list) => live && setOrders(list))
    refresh()
    const off = services.orders.subscribe(refresh)
    return () => {
      live = false
      off()
    }
  }, [services])
  return orders
}

/** Live list of trades from the realm's TradeService. Null until first loaded. */
export function useTrades(services: MockServices | undefined): Trade[] | null {
  const [trades, setTrades] = useState<Trade[] | null>(null)
  useEffect(() => {
    if (!services) return
    let live = true
    const refresh = () => void services.trades.list().then((list) => live && setTrades(list))
    refresh()
    const off = services.trades.subscribe(refresh)
    return () => {
      live = false
      off()
    }
  }, [services])
  return trades
}
