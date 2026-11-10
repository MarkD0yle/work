import { useOrders, useSession } from '@harbor/app-kit'
import type { OrderFilterContext } from '@harbor/schemas'
import { Skeleton, formatCompact } from '@harbor/ui'
import { ORDERS_CHANNEL, type WidgetProps } from './types.ts'

/** Tile: how many orders are waiting to be executed, and their notional by currency. Click to filter the blotter. */
export function OrdersAwaitingTile({ client }: WidgetProps) {
  const session = useSession(client)
  const orders = useOrders(session?.services)

  if (!orders) return <Skeleton lines={2} label="Loading orders" />
  const waiting = orders.filter((o) => o.status === 'NEW')
  const byCurrency = new Map<string, number>()
  for (const o of waiting) byCurrency.set(o.dealtCurrency, (byCurrency.get(o.dealtCurrency) ?? 0) + o.amount)
  const notional = [...byCurrency].sort((a, b) => b[1] - a[1])

  const filterBlotter = async () => {
    const filter: OrderFilterContext = { type: 'harbor.orderFilter', name: 'Awaiting execution', statuses: ['NEW'] }
    const channel = await client.getOrCreateChannel(ORDERS_CHANNEL)
    await channel.broadcast(filter)
  }

  return (
    <button type="button" className="hw-tile" data-testid="tile-orders-awaiting" title="Show these orders in the blotter" onClick={() => void filterBlotter().catch(() => {})}>
      <span className="hw-tile__label">Orders awaiting execution</span>
      <span className="hw-tile__value" data-testid="tile-orders-count">
        {waiting.length}
      </span>
      <span className="hw-tile__detail">
        {notional.length === 0
          ? 'Nothing waiting'
          : notional
              .slice(0, 4)
              .map(([currency, amount]) => `${formatCompact(amount)} ${currency}`)
              .join(' · ')}
        {notional.length > 4 ? ` · +${notional.length - 4} more` : ''}
      </span>
    </button>
  )
}
