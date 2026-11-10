import { useMemo, useState } from 'react'
import { mountApp, useApp, useContextListener, useIntentListener } from '@harbor/app-kit'
import { ALL_PAIRS } from '@harbor/mock-data'
import type { Context } from '@harbor/schemas'
import { Button, EmptyState, Select } from '@harbor/ui'
import '@harbor/tokens/tokens.css'
import '@harbor/ui/ui.css'
import '@harbor/app-kit/app-kit.css'
import './app.css'

const tickerOf = (context: Context): string | null => {
  const ticker = (context.id as { ticker?: unknown } | undefined)?.ticker
  return typeof ticker === 'string' && ALL_PAIRS.includes(ticker) ? ticker : null
}

/* Research: a reader for notes tagged by currency pair. It follows the pair selected elsewhere on its channel. */
function Research() {
  const { client, services } = useApp()
  const notes = services.dataset.researchNotes
  const [pair, setPair] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const focus = (context: Context) => {
    const ticker = tickerOf(context)
    if (ticker) {
      setPair(ticker)
      setOpenId(null)
    }
  }
  useContextListener(client, 'fdc3.instrument', focus)
  useIntentListener(client, 'ViewNews', focus)

  const shown = useMemo(() => notes.filter((n) => pair === null || n.pairs.includes(pair)), [notes, pair])
  const open = shown.find((n) => n.id === openId) ?? shown[0]
  // Choosing a pair here tells the rest of the channel, the same as choosing it anywhere else.
  const choosePair = (next: string | null) => {
    setPair(next)
    setOpenId(null)
    if (next) void client.broadcast({ type: 'fdc3.instrument', id: { ticker: next }, name: next }).catch(() => {})
  }

  return (
    <div className="ha-app" data-testid="research">
      <div className="ha-toolbar">
        <h1 className="ha-toolbar__title">Research</h1>
        <Select label="Pair" hideLabel value={pair ?? 'ALL'} onChange={(e) => choosePair(e.target.value === 'ALL' ? null : e.target.value)} options={[{ value: 'ALL', label: 'All pairs' }, ...ALL_PAIRS.map((p) => ({ value: p, label: p }))]} />
        <span className="ha-muted" data-testid="research-count">
          {shown.length} {shown.length === 1 ? 'note' : 'notes'}
          {pair ? ` on ${pair}` : ''}
        </span>
        <span className="ha-toolbar__spacer" />
        <span className="ha-muted">Mock commentary, not investment research</span>
      </div>
      {shown.length === 0 || !open ? (
        <EmptyState title={`Nothing published on ${pair}`} body="Choose another pair, or clear the filter to see every note." action={<Button onClick={() => choosePair(null)}>Show all notes</Button>} />
      ) : (
        <div className="rs-reader">
          <ul className="rs-list" aria-label="Notes">
            {shown.map((n) => (
              <li key={n.id}>
                <button type="button" className={`rs-item${n.id === open.id ? ' is-open' : ''}`} aria-current={n.id === open.id} onClick={() => setOpenId(n.id)}>
                  <strong>{n.title}</strong>
                  <span>
                    {n.author} · {n.publishedAt.slice(0, 10)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <article className="rs-note" data-testid="research-note" aria-label="Selected note" tabIndex={0}>
            <h2>{open.title}</h2>
            <p className="ha-muted">
              {open.author} · published {open.publishedAt.slice(0, 16).replace('T', ' ')} UTC
            </p>
            <div className="ha-row" aria-label="Pairs in this note">
              {open.pairs.map((p) => (
                <Button key={p} variant={p === pair ? 'primary' : 'secondary'} onClick={() => choosePair(p)}>
                  {p}
                </Button>
              ))}
            </div>
            <p className="rs-note__summary">{open.summary}</p>
            <p>{open.body}</p>
          </article>
        </div>
      )}
    </div>
  )
}

mountApp(<Research />)
