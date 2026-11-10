import { useMemo, useState } from 'react'
import { mountApp, useApp, useIntentListener, useNow } from '@harbor/app-kit'
import { CASH_POLICY, accountCash, checkCashOrder, nextCutOff, type MoneyMarketFund } from '@harbor/mock-data'
import { AmountCell, Badge, Button, EmptyState, KeyValueList, NumberInput, Select, StatusPill, Ticket, formatAmount, toast } from '@harbor/ui'
import '@harbor/tokens/tokens.css'
import '@harbor/ui/ui.css'
import '@harbor/app-kit/app-kit.css'
import './app.css'

const MAX_COMPARE = 4

function countdown(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`
}

interface Placed {
  key: number
  at: string
  account: string
  fund: string
  side: 'SUBSCRIBE' | 'REDEEM'
  amount: number
  currency: string
}

/* Cash: a money-market fund portal. Compare funds, then subscribe or redeem inside the investment policy. */
function Cash() {
  const { client, services, connected } = useApp()
  const { moneyMarketFunds: funds, funds: accounts } = services.dataset
  const now = useNow(30_000)
  const [currency, setCurrency] = useState('ALL')
  const [compare, setCompare] = useState<string[]>([])
  const [fundId, setFundId] = useState<string | null>(null)
  const [accountCode, setAccountCode] = useState(accounts[0]?.code ?? '')
  const [side, setSide] = useState<'SUBSCRIBE' | 'REDEEM'>('SUBSCRIBE')
  const [amount, setAmount] = useState<number | null>(null)
  const [ticketKey, setTicketKey] = useState(0)
  /** Holdings by `account/fund`, built up by orders placed in this session. */
  const [holdings, setHoldings] = useState<Record<string, number>>({})
  const [placed, setPlaced] = useState<Placed[]>([])

  // "Place cash for this portfolio" from elsewhere on the desktop selects the account.
  useIntentListener(client, 'harbor.PlaceCash', (context) => {
    const wanted = [(context.id as { portfolioId?: unknown } | undefined)?.portfolioId, context.name].filter((v): v is string => typeof v === 'string')
    const match = accounts.find((a) => wanted.includes(a.code) || wanted.includes(a.name))
    if (match) setAccountCode(match.code)
    else toast({ tone: 'warning', title: 'That portfolio is not one of this desk’s accounts' })
  })

  const shown = useMemo(() => funds.filter((f) => currency === 'ALL' || f.currency === currency).sort((a, b) => b.yield7dPct - a.yield7dPct), [funds, currency])
  const currencies = useMemo(() => [...new Set(funds.map((f) => f.currency))].sort(), [funds])
  const fund = funds.find((f) => f.id === fundId) ?? null
  const account = accounts.find((a) => a.code === accountCode) ?? accounts[0]
  const holding = fund && account ? (holdings[`${account.code}/${fund.id}`] ?? 0) : 0
  const check = fund && account && amount !== null ? checkCashOrder({ account, fund, side, amount, holding }) : null
  const compared = compare.map((id) => funds.find((f) => f.id === id)).filter((f): f is MoneyMarketFund => f !== undefined)

  /** Dealing in a fund starts a fresh ticket, so nothing carries over from the last one. */
  const deal = (id: string) => {
    setFundId(id)
    setSide('SUBSCRIBE')
    setAmount(null)
    setTicketKey((k) => k + 1)
  }
  const toggleCompare = (id: string) => setCompare((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.length < MAX_COMPARE ? [...list, id] : list))
  const submit = () => {
    if (!fund || !account || amount === null || !check?.ok) return
    const key = `${account.code}/${fund.id}`
    setHoldings((h) => ({ ...h, [key]: (h[key] ?? 0) + (side === 'SUBSCRIBE' ? amount : -amount) }))
    setPlaced((list) => [{ key: Date.now(), at: new Date().toLocaleTimeString('en-GB'), account: account.code, fund: fund.name, side, amount, currency: fund.currency }, ...list])
    toast({ tone: 'positive', title: `${side === 'SUBSCRIBE' ? 'Subscribed' : 'Redeemed'} ${formatAmount(amount)} ${fund.currency}`, body: `${fund.name} for ${account.code}` })
    setAmount(null)
    setTicketKey((k) => k + 1)
  }

  return (
    <div className="ha-app" data-testid="cash">
      <div className="ha-toolbar">
        <h1 className="ha-toolbar__title">Cash</h1>
        <Select label="Currency" hideLabel value={currency} onChange={(e) => setCurrency(e.target.value)} options={[{ value: 'ALL', label: 'All currencies' }, ...currencies.map((c) => ({ value: c, label: c }))]} />
        <span className="ha-muted">
          {shown.length} funds · compare up to {MAX_COMPARE} ({compare.length} chosen)
        </span>
        <span className="ha-toolbar__spacer" />
        <span className="ha-muted">
          Policy: max {CASH_POLICY.maxPctPerFund}% per fund · minimum rating {CASH_POLICY.minRating}
        </span>
      </div>

      <div className="ha-scroll ha-stack" role="region" aria-label="Cash content" tabIndex={0}>
        {compared.length > 0 && (
          <section className="ca-compare" aria-label="Fund comparison" data-testid="compare">
            {compared.map((f) => (
              <article key={f.id} className="ca-compare__card">
                <header>
                  <strong>{f.name}</strong>
                  <Button variant="ghost" aria-label={`Remove ${f.name} from comparison`} onClick={() => toggleCompare(f.id)}>
                    Remove
                  </Button>
                </header>
                <KeyValueList
                  items={[
                    { label: '7-day yield', value: `${f.yield7dPct.toFixed(2)}%` },
                    { label: 'Fund size', value: `${f.aumUsdBn.toFixed(1)}bn` },
                    { label: 'Rating', value: f.rating },
                    { label: 'Cut-off', value: `${f.cutOff} ${f.cutOffZone}` },
                  ]}
                />
              </article>
            ))}
          </section>
        )}

        {fund && account && (
          <Ticket
            key={ticketKey}
            title={`${side === 'SUBSCRIBE' ? 'Subscribe to' : 'Redeem from'} ${fund.name}`}
            badge={<Badge>{fund.currency} · {fund.rating}</Badge>}
            actions={
              <>
                <Button variant="primary" disabled={!check?.ok || !connected} onClick={submit} data-testid="cash-submit">
                  {side === 'SUBSCRIBE' ? 'Subscribe' : 'Redeem'}
                </Button>
                <Button variant="ghost" onClick={() => setFundId(null)}>
                  Cancel
                </Button>
                {!connected && <StatusPill tone="critical">Disconnected: dealing is paused</StatusPill>}
              </>
            }
          >
            <div className="ca-form" data-testid="cash-ticket">
              <Select label="Account" value={account.code} onChange={(e) => setAccountCode(e.target.value)} options={accounts.map((a) => ({ value: a.code, label: `${a.code} · ${a.name}` }))} />
              <Select label="Action" value={side} onChange={(e) => setSide(e.target.value as typeof side)} options={[{ value: 'SUBSCRIBE', label: 'Subscribe' }, { value: 'REDEEM', label: 'Redeem' }]} />
              <NumberInput label={`Amount (${fund.currency})`} value={amount} onChange={setAmount} />
            </div>
            <p className="ha-muted">
              {account.code} has {formatAmount(accountCash(account))} of cash to place and holds {formatAmount(holding)} in this fund.
            </p>
            {check && !check.ok && (
              <p className="ca-breach" role="alert" data-testid="cash-breach">
                <strong>Policy breach: {check.rule}.</strong> {check.detail}
              </p>
            )}
            {check?.ok && (
              <p className="ca-ok" data-testid="cash-ok">
                Within policy: {check.pctAfter.toFixed(1)}% of {account.code}&rsquo;s cash would be in this fund.
              </p>
            )}
          </Ticket>
        )}

        {shown.length === 0 ? (
          <EmptyState title="No funds in this currency" body="Choose another currency to see funds." />
        ) : (
          <table className="ha-table" data-testid="cash-funds">
            <thead>
              <tr>
                <th scope="col">Compare</th>
                <th scope="col">Fund</th>
                <th scope="col">Currency</th>
                <th scope="col" className="ha-num">7-day yield</th>
                <th scope="col" className="ha-num">Fund size (bn)</th>
                <th scope="col">Rating</th>
                <th scope="col">Cut-off</th>
                <th scope="col" className="ha-num">Closes in</th>
                <th scope="col">
                  <span className="hb-sr-only">Deal</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((f) => (
                <tr key={f.id} className={f.id === fundId ? 'is-selected' : ''} data-fund={f.id} data-rating={f.rating}>
                  <td>
                    {/* The label is the hit area: a bare checkbox is smaller than the 24px minimum. */}
                    <label className="ca-check">
                      <input type="checkbox" aria-label={`Compare ${f.name}`} checked={compare.includes(f.id)} disabled={!compare.includes(f.id) && compare.length >= MAX_COMPARE} onChange={() => toggleCompare(f.id)} />
                    </label>
                  </td>
                  <th scope="row">{f.name}</th>
                  <td>{f.currency}</td>
                  <td className="ha-num">{f.yield7dPct.toFixed(2)}%</td>
                  <td className="ha-num">{f.aumUsdBn.toFixed(1)}</td>
                  <td>{f.rating}</td>
                  <td>
                    {f.cutOff} {f.cutOffZone}
                  </td>
                  <td className="ha-num">{countdown(nextCutOff(f, now) - now)}</td>
                  <td>
                    <Button onClick={() => deal(f.id)}>Deal</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {placed.length > 0 && (
          <table className="ha-table" data-testid="cash-placed">
            <caption>Placed this session</caption>
            <tbody>
              {placed.map((p) => (
                <tr key={p.key}>
                  <td className="ha-muted">{p.at}</td>
                  <td>{p.account}</td>
                  <td>{p.side === 'SUBSCRIBE' ? 'Subscribed' : 'Redeemed'}</td>
                  <td className="ha-num"><AmountCell value={p.amount} currency={p.currency} /></td>
                  <td>{p.fund}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

mountApp(<Cash />)
