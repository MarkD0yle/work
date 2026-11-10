import { useCallback, useEffect, useRef, useState } from 'react'
import { mountApp, useApp, useIntentListener } from '@harbor/app-kit'
import { ALL_PAIRS, QUOTE_LIFETIME_MS, formatRate, pairSpec, valueDate, type RfqHandle, type RfqQuote, type Trade } from '@harbor/mock-data'
import type { FxOrderContext, FxTradeContext } from '@harbor/schemas'
import { AmountCell, Badge, Button, Checkbox, Countdown, Dialog, EmptyState, KeyValueList, NumberInput, PriceCell, Select, SideLabel, StatusPill, Ticket, amountInWords, formatAmount, toast } from '@harbor/ui'
import '@harbor/tokens/tokens.css'
import '@harbor/ui/ui.css'
import '@harbor/app-kit/app-kit.css'
import './app.css'

type Phase = 'idle' | 'ticket' | 'quoting' | 'algo' | 'done'
const ALGO_SLICES = 3
const ALGO_SLICE_MS = 5000

/** Trades above this size need a second, explicit confirmation. Configurable per deployment with `?confirmOver=`. */
const confirmOver = Number(new URLSearchParams(window.location.search).get('confirmOver')) || 50_000_000

const toTradeContext = (trade: Trade): FxTradeContext => {
  const { matchStatus: _matchStatus, exceptionReason: _exceptionReason, ...context } = trade
  return context
}

/* FX Execution: the EXECUTE leg. An order that arrives by intent fills the
 * ticket and locks it, so nothing about the order is ever typed twice. */
function FxExecution() {
  const { client, services, connected } = useApp()
  const lps = services.dataset.liquidityProviders
  const [phase, setPhase] = useState<Phase>('idle')
  const [order, setOrder] = useState<FxOrderContext | null>(null)
  const [locked, setLocked] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [quotes, setQuotes] = useState<RfqQuote[]>([])
  const [confirming, setConfirming] = useState<string | null>(null)
  const [slices, setSlices] = useState<number[]>([])
  const [fill, setFill] = useState<Trade | null>(null)
  const [draft, setDraft] = useState({ pair: 'EURUSD', side: 'BUY' as 'BUY' | 'SELL', amount: null as number | null, account: services.dataset.funds[0]?.code ?? '' })
  const rfq = useRef<RfqHandle | null>(null)
  const algoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manualSeq = useRef(0)

  const stopWork = useCallback(() => {
    rfq.current?.cancel()
    rfq.current = null
    if (algoTimer.current) clearTimeout(algoTimer.current)
    algoTimer.current = null
  }, [])
  useEffect(() => stopWork, [stopWork])

  const book = useCallback(
    async (forOrder: FxOrderContext, lpId: string, rate: number, method: Trade['method']) => {
      stopWork()
      const trade = await services.trades.execute({ order: forOrder, lpId, rate, method })
      setFill(trade)
      setPhase('done')
      setConfirming(null)
      // Everyone on the channel learns of the fill: the blotter, Post-Trade and TCA.
      void client.broadcast(toTradeContext(trade)).catch(() => {})
      const lpName = lps.find((lp) => lp.id === lpId)?.name ?? lpId
      toast({ tone: 'positive', title: `Filled ${trade.side} ${formatAmount(trade.amount)} ${trade.pair}`, body: `${formatRate(trade.pair, trade.rate)} with ${lpName} · trade ${trade.id.tradeId}` })
    },
    [client, lps, services, stopWork],
  )

  const sendRfq = useCallback(
    (forOrder: FxOrderContext, lpIds: string[]) => {
      stopWork()
      setQuotes(lpIds.map((lpId) => ({ lpId, status: 'PENDING' })))
      setPhase('quoting')
      // Quotes re-price on every tick; hand React the latest set at most once per animation frame.
      let latest: RfqQuote[] | null = null
      let frame = 0
      const handle = services.quotes.requestQuotes({ orderId: forOrder.id.orderId, pair: forOrder.pair, lpIds }, (next) => {
        latest = next
        frame ||= requestAnimationFrame(() => {
          frame = 0
          if (latest) setQuotes(latest)
        })
      })
      rfq.current = {
        quotes: handle.quotes,
        cancel: () => {
          if (frame) cancelAnimationFrame(frame)
          handle.cancel()
        },
      }
    },
    [services, stopWork],
  )

  /** Algo stub: three equal slices at the prevailing mid, five seconds apart. */
  const startAlgo = useCallback(
    (forOrder: FxOrderContext, lpId: string) => {
      stopWork()
      setSlices([])
      setPhase('algo')
      const taken: number[] = []
      const step = () => {
        taken.push(services.prices.latest(forOrder.pair).mid)
        setSlices([...taken])
        if (taken.length < ALGO_SLICES) {
          algoTimer.current = setTimeout(step, ALGO_SLICE_MS)
          return
        }
        void book(forOrder, lpId, taken.reduce((a, b) => a + b, 0) / taken.length, 'ALGO')
      }
      algoTimer.current = setTimeout(step, ALGO_SLICE_MS)
    },
    [book, services, stopWork],
  )

  useIntentListener(client, 'harbor.ExecuteOrder', (context) => {
    const incoming = context as FxOrderContext
    const suggested = incoming.execution?.estimate?.suggestedCounterparties.filter((id) => lps.some((lp) => lp.id === id)) ?? []
    const lpIds = suggested.length > 0 ? suggested : lps.map((lp) => lp.id)
    setOrder(incoming)
    setLocked(true)
    setPicked(lpIds)
    setFill(null)
    setConfirming(null)
    // The sender already chose how to work it, so start straight away.
    if (incoming.execution?.method === 'RFQ') sendRfq(incoming, lpIds)
    else if (incoming.execution?.method === 'ALGO') startAlgo(incoming, lpIds[0] as string)
    else {
      stopWork()
      setPhase('ticket')
    }
  })

  const dealRate = (quote: RfqQuote) => (order?.side === 'BUY' ? quote.offer : quote.bid)
  const live = quotes.filter((q) => q.status === 'QUOTED' && dealRate(q) !== undefined)
  // Best for the client: the lowest offer when buying, the highest bid when selling.
  const best = live.reduce<RfqQuote | null>((winner, q) => {
    if (!winner) return q
    const a = dealRate(q) as number
    const b = dealRate(winner) as number
    return (order?.side === 'BUY' ? a < b : a > b) ? q : winner
  }, null)

  const accept = useCallback(
    (lpId: string, confirmed = false) => {
      if (!order) return
      const quote = (rfq.current?.quotes() ?? []).find((q) => q.lpId === lpId)
      const rate = quote?.status === 'QUOTED' ? (order.side === 'BUY' ? quote.offer : quote.bid) : undefined
      if (rate === undefined) {
        setConfirming(null)
        toast({ tone: 'warning', title: 'That quote is no longer available' })
        return
      }
      if (order.amount > confirmOver && !confirmed) {
        setConfirming(lpId)
        return
      }
      void book(order, lpId, rate, 'RFQ')
    },
    [book, order],
  )

  // Enter accepts the best live quote.
  const bestId = best?.lpId
  useEffect(() => {
    if (phase !== 'quoting' || !bestId || confirming) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || (e.target instanceof HTMLElement && e.target.closest('button, input, select, dialog'))) return
      e.preventDefault()
      accept(bestId)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, bestId, confirming, accept])

  const startManual = () => {
    if (draft.amount === null) return
    const spec = pairSpec(draft.pair)
    const manual: FxOrderContext = {
      type: 'harbor.fxOrder',
      id: { orderId: `M-${++manualSeq.current}` },
      pair: draft.pair,
      side: draft.side,
      dealtCurrency: spec.base,
      amount: draft.amount,
      tenor: 'SPOT',
      valueDate: valueDate(draft.pair, new Date()),
      account: draft.account,
      status: 'NEW',
    }
    setOrder(manual)
    setLocked(false)
    setPicked(lps.map((lp) => lp.id))
    setFill(null)
    setPhase('ticket')
  }
  const reset = () => {
    stopWork()
    setOrder(null)
    setFill(null)
    setPhase('idle')
  }

  if (phase === 'idle' || !order) {
    return (
      <div className="ha-app" data-testid="fx-exec">
        <div className="ha-scroll ha-stack" role="region" aria-label="FX Execution content" tabIndex={0}>
          <EmptyState title="Waiting for an order" body="Use Execute in the Order Blotter or Pre-Trade and the ticket arrives filled in. Or start a new ticket below." />
          <Ticket title="New ticket">
            <div className="fx-form">
              <Select label="Pair" value={draft.pair} onChange={(e) => setDraft({ ...draft, pair: e.target.value })} options={ALL_PAIRS.map((p) => ({ value: p, label: p }))} />
              <Select label="Side" value={draft.side} onChange={(e) => setDraft({ ...draft, side: e.target.value as 'BUY' | 'SELL' })} options={[{ value: 'BUY', label: 'BUY' }, { value: 'SELL', label: 'SELL' }]} />
              <NumberInput label={`Amount (${pairSpec(draft.pair).base})`} value={draft.amount} onChange={(amount) => setDraft({ ...draft, amount })} />
              <Select label="Account" value={draft.account} onChange={(e) => setDraft({ ...draft, account: e.target.value })} options={services.dataset.funds.map((f) => ({ value: f.code, label: `${f.code} · ${f.name}` }))} />
              <Button variant="primary" disabled={draft.amount === null} onClick={startManual}>
                Continue
              </Button>
            </div>
          </Ticket>
        </div>
      </div>
    )
  }

  const spec = pairSpec(order.pair)
  const lpName = (id: string) => lps.find((lp) => lp.id === id)?.name ?? id
  const estimate = order.execution?.estimate
  const noneLive = phase === 'quoting' && quotes.length > 0 && quotes.every((q) => q.status === 'DECLINED' || q.status === 'EXPIRED')

  return (
    <div className="ha-app" data-testid="fx-exec">
      <div className="ha-scroll ha-stack" role="region" aria-label="FX Execution content" tabIndex={0}>
        <Ticket
          title={`${order.side === 'BUY' ? 'Buy' : 'Sell'} ${order.pair}`}
          badge={locked ? <Badge tone="accent">Locked to order {order.id.orderId}</Badge> : <Badge>Manual ticket {order.id.orderId}</Badge>}
        >
          <div data-testid="ticket" data-locked={locked}>
            <KeyValueList
              items={[
                { label: 'Order', value: <span data-testid="ticket-order">{order.id.orderId}</span> },
                { label: 'Pair', value: <span data-testid="ticket-pair">{order.pair}</span> },
                { label: 'Side', value: <SideLabel side={order.side} /> },
                { label: 'Amount', value: <span data-testid="ticket-amount"><AmountCell value={order.amount} currency={order.dealtCurrency} /></span> },
                { label: 'Tenor', value: order.tenor },
                { label: 'Value date', value: <span data-testid="ticket-value-date">{order.valueDate}</span> },
                { label: 'Account', value: <span data-testid="ticket-account">{order.account}</span> },
                { label: 'Expected cost', value: estimate ? `${estimate.expectedCostBps.toFixed(2)} bps` : 'No estimate' },
              ]}
            />
          </div>
        </Ticket>

        {phase === 'ticket' && (
          <Ticket
            title="Counterparties"
            actions={
              <>
                <Button variant="primary" disabled={picked.length === 0 || !connected} onClick={() => sendRfq(order, picked)}>
                  Send RFQ to {picked.length}
                </Button>
                <Button disabled={picked.length === 0 || !connected} onClick={() => startAlgo(order, picked[0] as string)}>
                  Work with algo
                </Button>
                <Button variant="ghost" onClick={reset}>
                  Cancel
                </Button>
              </>
            }
          >
            <div className="fx-lps">
              {lps.map((lp) => (
                <Checkbox key={lp.id} label={lp.name} checked={picked.includes(lp.id)} onChange={(on) => setPicked(on ? [...picked, lp.id] : picked.filter((id) => id !== lp.id))} />
              ))}
            </div>
          </Ticket>
        )}

        {phase === 'quoting' && (
          <Ticket
            title={`Quotes · you ${order.side === 'BUY' ? 'pay the offer' : 'receive the bid'}`}
            badge={!connected ? <StatusPill tone="critical">Disconnected</StatusPill> : undefined}
            actions={
              <>
                <Button variant="primary" disabled={!best || !connected} onClick={() => best && accept(best.lpId)} data-testid="accept-best">
                  Accept best{best ? ` · ${lpName(best.lpId)}` : ''}
                </Button>
                {noneLive && <Button onClick={() => sendRfq(order, picked)}>Re-quote</Button>}
                <Button variant="ghost" onClick={reset}>
                  Cancel
                </Button>
                <span className="ha-muted">Enter accepts the best quote</span>
              </>
            }
          >
            <table className="ha-table" data-testid="quotes">
              <thead>
                <tr>
                  <th scope="col">Counterparty</th>
                  <th scope="col" className="ha-num">Bid</th>
                  <th scope="col" className="ha-num">Offer</th>
                  <th scope="col">Time left</th>
                  <th scope="col">
                    <span className="hb-sr-only">Accept</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => {
                  const isBest = best?.lpId === q.lpId
                  return (
                    <tr key={q.lpId} className={isBest ? 'is-best' : ''} data-status={q.status} data-best={isBest || undefined}>
                      <th scope="row">
                        {lpName(q.lpId)} {isBest && <Badge tone="accent">Best</Badge>}
                      </th>
                      {q.status === 'QUOTED' ? (
                        <>
                          <td className={`ha-num${order.side === 'SELL' ? ' fx-deal-side' : ''}`}><PriceCell value={q.bid} decimals={spec.decimals} /></td>
                          <td className={`ha-num${order.side === 'BUY' ? ' fx-deal-side' : ''}`}><PriceCell value={q.offer} decimals={spec.decimals} /></td>
                          <td>{q.expiresAt !== undefined && <Countdown expiresAt={q.expiresAt} totalMs={QUOTE_LIFETIME_MS} />}</td>
                          <td>
                            <Button disabled={!connected} onClick={() => accept(q.lpId)}>Accept</Button>
                          </td>
                        </>
                      ) : (
                        <td colSpan={4}>
                          <StatusPill tone={q.status === 'PENDING' ? 'info' : q.status === 'DECLINED' ? 'neutral' : 'warning'}>
                            {q.status === 'PENDING' ? 'Waiting for a price' : q.status === 'DECLINED' ? 'Declined to quote' : 'Quote expired'}
                          </StatusPill>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Ticket>
        )}

        {phase === 'algo' && (
          <Ticket title="Working with algo" actions={<Button variant="ghost" onClick={reset}>Cancel</Button>}>
            <div className="ha-stack">
              <div className="fx-progress" role="progressbar" aria-label="Algo progress" aria-valuemin={0} aria-valuemax={ALGO_SLICES} aria-valuenow={slices.length}>
                <span style={{ width: `${(slices.length / ALGO_SLICES) * 100}%` }} />
              </div>
              <p className="ha-muted" data-testid="algo-status">
                Slice {Math.min(slices.length + 1, ALGO_SLICES)} of {ALGO_SLICES} · {formatAmount(order.amount / ALGO_SLICES)} {order.dealtCurrency} each
                {slices.length > 0 && ` · filled so far at ${slices.map((s) => formatRate(order.pair, s)).join(', ')}`}
              </p>
            </div>
          </Ticket>
        )}

        {phase === 'done' && fill && (
          <Ticket
            title="Filled"
            badge={<StatusPill tone="positive">Trade {fill.id.tradeId}</StatusPill>}
            actions={
              <>
                <Button onClick={() => void client.raiseIntent('harbor.ViewSettlement', toTradeContext(fill)).catch(() => {})}>View settlement</Button>
                <Button onClick={() => void client.raiseIntent('ViewAnalysis', toTradeContext(fill)).catch(() => {})}>View analysis</Button>
                <Button variant="ghost" onClick={reset}>
                  Done
                </Button>
              </>
            }
          >
            <div data-testid="fill">
              <KeyValueList
                items={[
                  { label: 'Rate', value: <PriceCell value={fill.rate} decimals={spec.decimals} /> },
                  { label: 'Counterparty', value: lpName(fill.counterparty) },
                  { label: 'Method', value: fill.method },
                  { label: 'Arrival mid', value: formatRate(fill.pair, fill.arrivalMid) },
                  { label: 'Slippage', value: `${services.tca.slippageBps(fill).toFixed(2)} bps` },
                  { label: 'Executed', value: new Date(fill.executedAt).toLocaleTimeString('en-GB') },
                ]}
              />
            </div>
          </Ticket>
        )}
      </div>

      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Confirm large trade"
        footer={
          <>
            <Button onClick={() => setConfirming(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => confirming && accept(confirming, true)} data-testid="confirm-trade">
              Confirm trade
            </Button>
          </>
        }
      >
        <p>
          You are about to {order.side === 'BUY' ? 'buy' : 'sell'} <strong data-testid="confirm-words">{amountInWords(order.amount, order.dealtCurrency)}</strong> ({formatAmount(order.amount)} {order.dealtCurrency}) of {order.pair}
          {confirming ? ` with ${lpName(confirming)}` : ''}.
        </p>
        <p className="ha-muted">Trades over {formatAmount(confirmOver)} need this second step. The rate is the live quote at the moment you confirm.</p>
      </Dialog>
    </div>
  )
}

mountApp(<FxExecution />)
