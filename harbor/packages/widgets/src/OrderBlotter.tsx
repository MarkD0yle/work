import { useEffect, useMemo, useState } from 'react'
import { HarborError } from '@harbor/agent-client'
import { useContextListener, useNow, useOrders, useSession } from '@harbor/app-kit'
import { ALL_PAIRS, type Order } from '@harbor/mock-data'
import { ORDER_STATUSES, type FxOrderContext, type OrderFilterContext } from '@harbor/schemas'
import { AmountCell, Button, Checkbox, DataGrid, Select, SideLabel, Skeleton, StatusPill, formatAge, toast, type ColDef, type PillTone } from '@harbor/ui'
import { ORDERS_CHANNEL, type WidgetProps } from './types.ts'

type StatusFilter = 'OPEN' | 'ALL' | Order['status']
const OPEN: readonly Order['status'][] = ['NEW', 'WORKING', 'PARTIAL']
const STATUS_TONE: Record<Order['status'], PillTone> = { NEW: 'info', WORKING: 'warning', PARTIAL: 'warning', FILLED: 'positive', CANCELLED: 'neutral' }
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'OPEN', label: 'Open orders' },
  { value: 'NEW', label: 'Awaiting execution' },
  { value: 'WORKING', label: 'Working' },
  { value: 'PARTIAL', label: 'Partially filled' },
  { value: 'FILLED', label: 'Filled' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'ALL', label: 'All statuses' },
]

/** Only the context fields leave the blotter; desk-side fields stay behind. */
function toContext(order: Order): FxOrderContext {
  const { createdAt: _createdAt, arrivalMid: _arrivalMid, traderId: _traderId, ...context } = order
  return context
}

type Row = Order & { age: string }

/** Open orders. Selecting a row shares it on the panel's channel; Analyse and Execute raise intents. */
export function OrderBlotter({ client }: WidgetProps) {
  const session = useSession(client)
  const loaded = useOrders(session?.services)

  const [mine, setMine] = useState(false)
  const [pair, setPair] = useState('ALL')
  const [status, setStatus] = useState<StatusFilter>('OPEN')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const now = useNow(30_000)

  // An execution anywhere on this channel fills the order here.
  useContextListener(client, 'harbor.fxTrade', (context) => {
    const orderId = (context.id as { orderId?: string } | undefined)?.orderId
    if (orderId) void session?.services.orders.setStatus(orderId, 'FILLED').catch(() => {})
  })

  // Tiles ask the blotter to filter over a named app channel.
  useEffect(() => {
    let live = true
    let off: (() => void) | undefined
    void client
      .getOrCreateChannel(ORDERS_CHANNEL)
      .then((channel) =>
        channel.addContextListener('harbor.orderFilter', (context) => {
          if (!live) return
          const filter = context as OrderFilterContext
          const first = filter.statuses?.length === 1 ? filter.statuses[0] : undefined
          setStatus(first && ORDER_STATUSES.includes(first) ? first : 'OPEN')
          setPair(filter.pair && ALL_PAIRS.includes(filter.pair) ? filter.pair : 'ALL')
        }),
      )
      .then((listener) => {
        off = () => void listener.unsubscribe().catch(() => {})
        if (!live) off()
      })
      .catch(() => {})
    return () => {
      live = false
      off?.()
    }
  }, [client])

  const source = useMemo(() => loaded ?? [], [loaded])
  const rows = useMemo<Row[]>(
    () =>
      source
        .filter((o) => (status === 'ALL' ? true : status === 'OPEN' ? OPEN.includes(o.status) : o.status === status))
        .filter((o) => pair === 'ALL' || o.pair === pair)
        .filter((o) => !mine || o.traderId === session?.user.id)
        .map((o) => ({ ...o, age: formatAge(o.createdAt, now) })),
    [source, status, pair, mine, now, session?.user.id],
  )

  const raise = async (intent: string, order: Order) => {
    try {
      await client.raiseIntent(intent, toContext(order))
    } catch (error) {
      const code = error instanceof HarborError ? error.code : ''
      // The agent already tells the user when nothing can handle an intent, and a cancelled choice needs no message.
      if (code === 'NoAppsFound' || code === 'UserCancelledResolution') return
      toast({ tone: 'warning', title: code === 'AccessDenied' ? 'You are not entitled to do that' : 'That could not be done', body: `${intent} for order ${order.id.orderId}` })
    }
  }
  const select = (order: Order) => {
    setSelectedId(order.id.orderId)
    void client.broadcast(toContext(order)).catch(() => {})
  }

  const columns = useMemo<ColDef<Row>[]>(
    () => [
      { headerName: 'Order', valueGetter: (p) => p.data?.id.orderId, width: 84 },
      { headerName: 'Account', field: 'account', width: 92 },
      { headerName: 'Pair', field: 'pair', width: 84 },
      { headerName: 'Side', field: 'side', width: 70, cellRenderer: (p: { data?: Row }) => (p.data ? <SideLabel side={p.data.side} /> : null) },
      {
        headerName: 'Amount',
        field: 'amount',
        width: 150,
        cellClass: 'hb-cell-num',
        headerClass: 'hb-cell-num',
        cellRenderer: (p: { data?: Row }) => (p.data ? <AmountCell value={p.data.amount} currency={p.data.dealtCurrency} /> : null),
      },
      { headerName: 'Tenor', field: 'tenor', width: 78 },
      { headerName: 'Value date', field: 'valueDate', width: 104 },
      {
        headerName: 'Status',
        field: 'status',
        width: 110,
        cellRenderer: (p: { data?: Row }) => (p.data ? <StatusPill tone={STATUS_TONE[p.data.status]}>{p.data.status}</StatusPill> : null),
      },
      { headerName: 'Age', field: 'age', width: 80, cellClass: 'hb-cell-num', headerClass: 'hb-cell-num', comparator: (_a, _b, a, b) => (a.data?.createdAt ?? '').localeCompare(b.data?.createdAt ?? '') },
      {
        headerName: 'Actions',
        sortable: false,
        width: 170,
        cellRenderer: (p: { data?: Row }) =>
          p.data ? (
            <span className="hw-row-actions">
              <Button variant="ghost" onClick={() => void raise('harbor.AnalyseOrder', p.data as Row)}>
                Analyse
              </Button>
              <Button variant="ghost" onClick={() => void raise('harbor.ExecuteOrder', p.data as Row)}>
                Execute
              </Button>
            </span>
          ) : null,
      },
    ],
    // `raise` only closes over the client, which is stable for the panel's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client],
  )

  if (!session || loaded === null) return <Skeleton label="Loading orders" />

  return (
    <div className="hw-blotter">
      <div className="hw-blotter__filters" role="group" aria-label="Quick filters">
        <Checkbox label="Mine" checked={mine} onChange={setMine} />
        <Select label="Pair" hideLabel value={pair} onChange={(e) => setPair(e.target.value)} options={[{ value: 'ALL', label: 'All pairs' }, ...ALL_PAIRS.map((p) => ({ value: p, label: p }))]} />
        <Select label="Status" hideLabel value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} options={STATUS_OPTIONS} />
        <span className="hw-blotter__count" data-testid="blotter-count">
          {rows.length} of {source.length} orders
        </span>
        <span className="hw-blotter__hint">Enter executes the selected order</span>
      </div>
      <div className="hw-blotter__grid">
        <DataGrid<Row>
          label="Open orders"
          rows={rows}
          columns={columns}
          rowId={(row) => row.id.orderId}
          selectedId={selectedId}
          onSelect={select}
          onActivate={(row) => void raise('harbor.ExecuteOrder', row)}
          emptyText="No orders match these filters"
        />
      </div>
    </div>
  )
}
