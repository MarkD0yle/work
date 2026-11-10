import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { connect, type HarborClient } from '@harbor/agent-client'
import './wirefeed.css'

/* "Wirefeed": a stand-in for a third-party app. It is deliberately NOT built
 * on Harbor's design system or mock-data package. It has its own look, its own
 * content and its own origin, and depends on one thing only: the agent client.
 * That is all a partner needs to be hosted and to join channels. */

const PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD', 'EURGBP', 'EURJPY', 'USDMXN', 'USDSGD', 'USDZAR']
const TEMPLATES = [
  'steadies as traders wait for central bank speakers',
  'slips after softer-than-forecast survey data',
  'firms on month-end demand, desks say',
  'options expiries seen pinning the pair near the figure',
  'volatility gauge eases to a two-week low',
]

interface Headline {
  id: string
  pair: string
  text: string
  minutesAgo: number
}

/** The partner's own (invented) feed: a fixed set of headlines per pair. */
const FEED: Headline[] = PAIRS.flatMap((pair, p) =>
  [0, 1, 2].map((n) => ({
    id: `${pair}-${n}`,
    pair,
    text: `${pair.slice(0, 3)}/${pair.slice(3)} ${TEMPLATES[(p + n * 2) % TEMPLATES.length]}`,
    minutesAgo: 4 + ((p * 7 + n * 23) % 170),
  })),
).sort((a, b) => a.minutesAgo - b.minutesAgo)

const tickerOf = (context: { id?: Record<string, unknown> }): string | null => {
  const ticker = context.id?.ticker
  return typeof ticker === 'string' && PAIRS.includes(ticker) ? ticker : null
}

function Wirefeed() {
  const [client, setClient] = useState<HarborClient | null>(null)
  const [failed, setFailed] = useState(false)
  const [pair, setPair] = useState<string | null>(null)
  const [channel, setChannel] = useState<string | null>(null)
  const [reader, setReader] = useState('')

  useEffect(() => {
    let live = true
    connect().then(
      (c) => (live ? setClient(c) : c.close()),
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (!client) return
    let live = true
    const follow = (context: { id?: Record<string, unknown> }) => {
      const ticker = tickerOf(context)
      if (live && ticker) setPair(ticker)
    }
    const offChannel = client.onChannelChanged((id) => live && setChannel(id))
    void client.getCurrentChannel().then((id) => live && setChannel(id))
    void client.getUserInfo().then((user) => live && setReader(user.displayName))
    // Deferred a tick so a dev-mode double mount registers once (see @harbor/app-kit).
    const timer = setTimeout(() => {
      if (!live) return
      void client.addContextListener('fdc3.instrument', follow)
      void client.addIntentListener('ViewNews', follow)
    }, 0)
    return () => {
      live = false
      clearTimeout(timer)
      offChannel()
    }
  }, [client])

  if (window.parent === window) return <p className="wf-note">Wirefeed is designed to be embedded in a host desktop.</p>
  if (failed) return <p className="wf-note">Wirefeed could not reach its host. Reload the panel to try again.</p>
  if (!client) return <p className="wf-note">Connecting…</p>

  const shown = FEED.filter((h) => pair === null || h.pair === pair)
  const choose = (next: string) => {
    setPair(next)
    void client.broadcast({ type: 'fdc3.instrument', id: { ticker: next }, name: next }).catch(() => {})
  }

  return (
    <div className="wf" data-testid="partner-news">
      <header className="wf-masthead">
        <span className="wf-logo">Wirefeed</span>
        <span className="wf-meta">
          {reader && `Licensed to ${reader} · `}
          <span data-testid="partner-channel">{channel ? 'linked to host channel' : 'not linked to a channel'}</span>
        </span>
      </header>
      <div className="wf-bar">
        <span data-testid="partner-filter">{pair ? `Headlines for ${pair.slice(0, 3)}/${pair.slice(3)}` : 'All headlines'}</span>
        {pair && (
          <button type="button" onClick={() => setPair(null)}>
            Show all
          </button>
        )}
      </div>
      <ol className="wf-list" data-testid="partner-headlines">
        {shown.map((h) => (
          <li key={h.id}>
            <time>{h.minutesAgo < 60 ? `${h.minutesAgo}m ago` : `${Math.floor(h.minutesAgo / 60)}h ago`}</time>
            <button type="button" className="wf-tag" onClick={() => choose(h.pair)}>
              {h.pair}
            </button>
            <span>{h.text}</span>
          </li>
        ))}
      </ol>
      <footer className="wf-foot">Mock headlines for demonstration. Not real news.</footer>
    </div>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Wirefeed />
    </StrictMode>,
  )
}
