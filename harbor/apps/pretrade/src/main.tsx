import { useEffect, useMemo, useState } from 'react'
import { HarborError } from '@harbor/agent-client'
import { mountApp, useApp, useContextListener, useIntentListener } from '@harbor/app-kit'
import { estimateOrder, pairSpec } from '@harbor/mock-data'
import type { FxOrderContext } from '@harbor/schemas'
import { AmountCell, Badge, Button, EmptyState, KeyValueList, SideLabel, StatusPill, formatBps, toast } from '@harbor/ui'
import '@harbor/tokens/tokens.css'
import '@harbor/ui/ui.css'
import '@harbor/app-kit/app-kit.css'
import './app.css'

/* Pre-Trade: the DECIDE leg. It never asks for an order to be typed in; it
 * waits for one to arrive on its channel or by intent. */
function PreTrade() {
  const { client, services } = useApp()
  const [order, setOrder] = useState<FxOrderContext | null>(null)
  const [filled, setFilled] = useState<string | null>(null)

  useContextListener(client, 'harbor.fxOrder', (context) => setOrder(context as FxOrderContext))
  useIntentListener(client, 'harbor.AnalyseOrder', (context) => setOrder(context as FxOrderContext))
  useContextListener(client, 'harbor.fxTrade', (context) => {
    const orderId = (context.id as { orderId?: string } | undefined)?.orderId
    if (orderId) setFilled(orderId)
  })

  const estimate = useMemo(() => {
    if (!order) return null
    try {
      return estimateOrder(services.dataset, order)
    } catch {
      return null
    }
  }, [order, services])

  // Share the estimate so other panels on the channel can use it.
  useEffect(() => {
    if (estimate) void client.broadcast(estimate.context).catch(() => {})
  }, [client, estimate])

  if (!order) return <EmptyState title="Select an order to see an estimate." body="Pick a row in the Order Blotter, or use its Analyse action." />
  if (!estimate) return <EmptyState icon="warning" title="No estimate for this order" body={`${order.pair} is not a pair this desk prices.`} />

  const isFilled = filled === order.id.orderId || order.status === 'FILLED' || order.status === 'CANCELLED'
  const execute = async (method: 'RFQ' | 'ALGO') => {
    try {
      // The method and the estimate travel with the order: nothing is re-keyed in FX Execution.
      await client.raiseIntent('harbor.ExecuteOrder', { ...order, execution: { method, estimate: estimate.context } })
    } catch (error) {
      const code = error instanceof HarborError ? error.code : ''
      if (code === 'NoAppsFound' || code === 'UserCancelledResolution') return
      toast({ tone: 'warning', title: code === 'AccessDenied' ? 'You are not entitled to execute orders' : 'The order could not be sent for execution' })
    }
  }
  const { context } = estimate
  const recommended = context.recommendedMethod

  return (
    <div className="ha-app" data-testid="pretrade">
      <div className="ha-scroll ha-stack" role="region" aria-label="Pre-Trade content" tabIndex={0}>
        <header className="ha-row">
          <h1 className="ha-toolbar__title">
            Order <span data-testid="estimate-order">{order.id.orderId}</span>
          </h1>
          <SideLabel side={order.side} />
          <AmountCell value={order.amount} currency={order.dealtCurrency} />
          <strong>{order.pair}</strong>
          {isFilled && <StatusPill tone="positive">No longer open</StatusPill>}
        </header>
        <KeyValueList
          items={[
            { label: 'Account', value: order.account },
            { label: 'Tenor', value: order.tenor },
            { label: 'Value date', value: order.valueDate },
            { label: 'Benchmark', value: order.benchmark ?? 'None' },
          ]}
        />

        <div className="pt-stats">
          <div className="ha-stat">
            <span className="ha-stat__label">Expected cost</span>
            <span className="ha-stat__value" data-testid="estimate-cost">
              {context.expectedCostBps.toFixed(2)} <span className="ha-stat__unit">bps</span>
            </span>
          </div>
          <div className="ha-stat">
            <span className="ha-stat__label">Liquidity</span>
            <span className="ha-stat__value" data-testid="estimate-liquidity" aria-label={`${context.liquidityScore} out of 5`}>
              {context.liquidityScore}
              <span className="ha-stat__unit"> / 5</span>
            </span>
            <span className="pt-meter" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={n <= context.liquidityScore ? 'is-on' : ''} />
              ))}
            </span>
          </div>
          <div className="ha-stat pt-stats__method">
            <span className="ha-stat__label">Recommended method</span>
            <span className="ha-stat__value" data-testid="estimate-method">
              {recommended === 'RFQ' ? 'RFQ' : 'Algo'}
            </span>
            <span className="ha-muted">{estimate.reason}</span>
          </div>
        </div>

        <table className="ha-table">
          <caption>Suggested counterparties for {order.pair}</caption>
          <thead>
            <tr>
              <th scope="col">Counterparty</th>
              <th scope="col" className="ha-num">Hit rate</th>
              <th scope="col" className="ha-num">Avg cost on {order.pair} (bps)</th>
            </tr>
          </thead>
          <tbody>
            {estimate.counterparties.map((c, i) => (
              <tr key={c.lpId}>
                <th scope="row">
                  {c.name} {i === 0 && <Badge tone="accent">Cheapest</Badge>}
                </th>
                <td className="ha-num">{(c.hitRate * 100).toFixed(1)}%</td>
                <td className="ha-num">{c.avgBps === null ? 'No history' : formatBps(c.avgBps)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="ha-muted">Costs are in {pairSpec(order.pair).quote} terms against arrival mid, from the last 90 days of trades.</p>
      </div>
      <div className="ha-toolbar pt-actions">
        <Button variant={recommended === 'RFQ' ? 'primary' : 'secondary'} disabled={isFilled} onClick={() => void execute('RFQ')}>
          Execute via RFQ
        </Button>
        <Button variant={recommended === 'ALGO' ? 'primary' : 'secondary'} disabled={isFilled} onClick={() => void execute('ALGO')}>
          Execute via Algo
        </Button>
      </div>
    </div>
  )
}

mountApp(<PreTrade />)
