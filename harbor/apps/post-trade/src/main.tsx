import { useCallback, useEffect, useMemo, useState } from 'react'
import { mountApp, useApp, useContextListener, useIntentListener, useTrades } from '@harbor/app-kit'
import { formatRate, type ActivityEntry, type MatchStatus, type MismatchDetail, type Trade } from '@harbor/mock-data'
import type { DevCommandContext, FxTradeContext, SettlementContext } from '@harbor/schemas'
import { AmountCell, Badge, Button, DataGrid, EmptyState, Select, SideLabel, Skeleton, StatusPill, formatAmount, toast, type ColDef, type PillTone } from '@harbor/ui'
import '@harbor/tokens/tokens.css'
import '@harbor/ui/ui.css'
import '@harbor/app-kit/app-kit.css'
import './app.css'

const TONE: Record<MatchStatus, PillTone> = { UNMATCHED: 'info', MATCHED: 'positive', MISMATCHED: 'critical', CONFIRMED: 'positive', SETTLED: 'neutral', FAILED: 'critical' }
const STATUSES: MatchStatus[] = ['UNMATCHED', 'MATCHED', 'MISMATCHED', 'CONFIRMED', 'SETTLED', 'FAILED']
const FIELD_LABEL: Record<string, string> = { rate: 'Rate', amount: 'Amount', valueDate: 'Value date', counterparty: 'Counterparty' }
const ACTION_LABEL: Record<ActivityEntry['action'], string> = {
  ACCEPT_THEIRS: 'Accepted their details',
  RESEND: 'Resent',
  ESCALATE: 'Escalated',
  AUTO_MATCH: 'Matched',
  AUTO_MISMATCH: 'Mismatch found',
  FORCED_MISMATCH: 'Mismatch forced (dev)',
}

/* Post-Trade: the SETTLE leg. Trades arrive from the channel; nothing is keyed in. */
function PostTrade() {
  const { client, services, user } = useApp()
  const trades = useTrades(services)
  const [details, setDetails] = useState<MismatchDetail[]>([])
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [filter, setFilter] = useState<'ALL' | 'EXCEPTIONS' | MatchStatus>('ALL')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refresh = useCallback(() => {
    void services.settlement.exceptions().then(setDetails)
    void services.settlement.activity().then(setActivity)
  }, [services])

  useEffect(() => {
    refresh()
    return services.settlement.subscribe((event) => {
      refresh()
      // Tell the rest of the desktop where the trade now stands.
      const context: SettlementContext = { type: 'harbor.settlement', id: { tradeId: event.tradeId }, matchStatus: event.status, ...(event.exceptionReason ? { exceptionReason: event.exceptionReason } : {}) }
      void client.broadcast(context).catch(() => {})
      // A break needs a person: raise an alert whose action brings them straight back to this trade.
      if (event.status !== 'MISMATCHED' && event.status !== 'FAILED') return
      void services.trades.get(event.tradeId).then((trade) => {
        if (!trade) return
        const { matchStatus: _matchStatus, exceptionReason: _exceptionReason, ...tradeContext } = trade
        return client.publishAlert({
          severity: 'critical',
          title: `Trade ${trade.id.tradeId} ${event.status === 'FAILED' ? 'failed to settle' : 'mismatched'}`,
          body: `${trade.side} ${formatAmount(trade.amount)} ${trade.pair} with ${trade.counterparty}: ${event.exceptionReason ?? 'details differ'}`.slice(0, 140),
          context: tradeContext,
          action: { label: 'Resolve', intent: 'harbor.ViewSettlement' },
          // One alert per trade, however many Post-Trade panels are open.
          key: `settlement:${trade.id.tradeId}`,
        })
      }).catch(() => {})
    })
  }, [client, refresh, services])

  // A fill anywhere on the channel starts matching here.
  const take = useCallback((context: FxTradeContext) => services.trades.record({ ...context, matchStatus: 'UNMATCHED' }), [services])
  useContextListener(client, 'harbor.fxTrade', (context) => void take(context as FxTradeContext))
  useIntentListener(client, 'harbor.ViewSettlement', (context) => {
    const trade = context as FxTradeContext
    void take(trade).then(() => {
      setFilter('ALL')
      setSelectedId(trade.id.tradeId)
    })
  })

  // Dev panel: break the most recent healthy trade (or a named one).
  useIntentListener(client, 'harbor.dev.ForceMismatch', (context) => {
    const wanted = (context as DevCommandContext).tradeId
    void services.trades.list().then((list) => {
      const healthy = list.filter((t) => t.matchStatus !== 'MISMATCHED' && t.matchStatus !== 'FAILED').sort((a, b) => b.executedAt.localeCompare(a.executedAt))
      const target = wanted ? list.find((t) => t.id.tradeId === wanted) : healthy[0]
      if (target) return services.settlement.forceMismatch(target.id.tradeId)
    })
  })

  // Bring the selected exception into view (e.g. after an alert's Resolve action).
  useEffect(() => {
    if (selectedId) document.querySelector(`[data-trade="${selectedId}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selectedId, details])

  const rows = useMemo(() => {
    const list = [...(trades ?? [])].sort((a, b) => b.executedAt.localeCompare(a.executedAt))
    if (filter === 'ALL') return list
    if (filter === 'EXCEPTIONS') return list.filter((t) => t.matchStatus === 'MISMATCHED' || t.matchStatus === 'FAILED')
    return list.filter((t) => t.matchStatus === filter)
  }, [trades, filter])

  const columns = useMemo<ColDef<Trade>[]>(
    () => [
      { headerName: 'Trade', valueGetter: (p) => p.data?.id.tradeId, width: 100 },
      { headerName: 'Executed', valueGetter: (p) => p.data?.executedAt.slice(0, 16).replace('T', ' '), width: 140 },
      { headerName: 'Pair', field: 'pair', width: 84 },
      { headerName: 'Side', field: 'side', width: 70, cellRenderer: (p: { data?: Trade }) => (p.data ? <SideLabel side={p.data.side} /> : null) },
      { headerName: 'Amount', field: 'amount', width: 130, cellClass: 'hb-cell-num', headerClass: 'hb-cell-num', cellRenderer: (p: { data?: Trade }) => (p.data ? <AmountCell value={p.data.amount} /> : null) },
      { headerName: 'Rate', field: 'rate', width: 100, cellClass: 'hb-cell-num', headerClass: 'hb-cell-num', valueFormatter: (p) => (p.data ? formatRate(p.data.pair, p.data.rate) : '') },
      { headerName: 'Counterparty', field: 'counterparty', width: 116 },
      { headerName: 'Value date', field: 'valueDate', width: 104 },
      { headerName: 'Status', field: 'matchStatus', width: 130, cellRenderer: (p: { data?: Trade }) => (p.data ? <StatusPill tone={TONE[p.data.matchStatus]}>{p.data.matchStatus}</StatusPill> : null) },
      { headerName: 'Exception', field: 'exceptionReason', flex: 1, minWidth: 160 },
    ],
    [],
  )

  if (!trades) return <Skeleton label="Loading trades" />

  const queue = trades.filter((t) => t.matchStatus === 'MISMATCHED' || t.matchStatus === 'FAILED').sort((a, b) => b.executedAt.localeCompare(a.executedAt))
  const count = (status: MatchStatus) => trades.filter((t) => t.matchStatus === status).length
  const act = async (label: string, work: () => Promise<void>) => {
    try {
      await work()
      toast({ tone: 'positive', title: label })
    } catch (error) {
      toast({ tone: 'warning', title: 'That could not be done', body: error instanceof Error ? error.message : String(error) })
    }
    refresh()
  }

  return (
    <div className="ha-app" data-testid="post-trade">
      <div className="ha-toolbar">
        <h1 className="ha-toolbar__title">Post-Trade</h1>
        <StatusPill tone="info">{count('UNMATCHED')} unmatched</StatusPill>
        <StatusPill tone="critical">{queue.length} exceptions</StatusPill>
        <span className="ha-toolbar__spacer" />
        <Select
          label="Show"
          hideLabel
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          options={[{ value: 'ALL', label: `All trades (${trades.length})` }, { value: 'EXCEPTIONS', label: `Exceptions (${queue.length})` }, ...STATUSES.map((s) => ({ value: s, label: `${s} (${count(s)})` }))]}
        />
      </div>

      <section className="st-queue" aria-label="Exception queue" data-testid="exception-queue">
        {queue.length === 0 ? (
          <p className="ha-muted">No exceptions. Mismatched and failed trades appear here.</p>
        ) : (
          queue.map((trade) => {
            const detail = details.find((d) => d.tradeId === trade.id.tradeId)
            return (
              <article key={trade.id.tradeId} className={`st-exception${selectedId === trade.id.tradeId ? ' is-selected' : ''}`} data-trade={trade.id.tradeId}>
                <header>
                  <strong>{trade.id.tradeId}</strong>
                  <SideLabel side={trade.side} />
                  <AmountCell value={trade.amount} /> {trade.pair}
                  <StatusPill tone="critical">{trade.matchStatus}</StatusPill>
                  {detail?.escalated && <Badge tone="warning">Escalated</Badge>}
                </header>
                <p className="st-exception__reason">{trade.exceptionReason}</p>
                {detail && (
                  <table className="ha-table">
                    <thead>
                      <tr>
                        <th scope="col">Field</th>
                        <th scope="col">Ours</th>
                        <th scope="col">Theirs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.fields.map((f) => (
                        <tr key={f.field} className={f.differs ? 'is-differs' : ''}>
                          <th scope="row">
                            {FIELD_LABEL[f.field] ?? f.field}
                            {f.differs && <span className="hb-sr-only"> (differs)</span>}
                          </th>
                          <td>{f.ours}</td>
                          <td>
                            {f.theirs} {f.differs && <span aria-hidden="true">≠</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="ha-row">
                  {trade.matchStatus === 'MISMATCHED' && (
                    <Button onClick={() => void act(`Accepted their details for ${trade.id.tradeId}`, () => services.settlement.acceptTheirs(trade.id.tradeId, user.id))}>Accept theirs</Button>
                  )}
                  <Button onClick={() => void act(`Resent ${trade.id.tradeId}`, () => services.settlement.resend(trade.id.tradeId, user.id))}>Resend</Button>
                  <Button disabled={detail?.escalated} onClick={() => void act(`Escalated ${trade.id.tradeId}`, () => services.settlement.escalate(trade.id.tradeId, user.id))}>
                    Escalate
                  </Button>
                </div>
              </article>
            )
          })
        )}
      </section>

      <div className="ha-fill">
        <DataGrid<Trade> label="Trades" rows={rows} columns={columns} rowId={(t) => t.id.tradeId} selectedId={selectedId} onSelect={(t) => setSelectedId(t.id.tradeId)} emptyText="No trades with this status" />
      </div>

      <details className="st-activity">
        <summary>Activity log ({activity.length})</summary>
        {activity.length === 0 ? (
          <EmptyState title="No activity yet" body="Matches, mismatches and every action taken on an exception are recorded here." />
        ) : (
          <ol data-testid="activity-log">
            {[...activity].reverse().map((a, i) => (
              <li key={`${a.at}-${a.tradeId}-${i}`}>
                <span className="ha-muted">{a.at.slice(11, 19)}</span> <strong>{a.tradeId}</strong> {ACTION_LABEL[a.action]} <span className="ha-muted">by {a.userId} · {a.before} → {a.after}</span>
              </li>
            ))}
          </ol>
        )}
      </details>
    </div>
  )
}

mountApp(<PostTrade />)
