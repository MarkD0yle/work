import { useEffect, useState } from 'react'
import { mountApp, useApp, useIntentListener, useNow } from '@harbor/app-kit'
import { RATE_LOCK_MS, canDecide, conversionRate, type Beneficiary, type Payment } from '@harbor/mock-data'
import { AmountCell, Badge, Button, EmptyState, Input, NumberInput, Select, StatusPill, Ticket, formatAmount, toast, type PillTone } from '@harbor/ui'
import '@harbor/tokens/tokens.css'
import '@harbor/ui/ui.css'
import '@harbor/app-kit/app-kit.css'
import './app.css'

const STATUS: Record<Payment['status'], { tone: PillTone; label: string }> = {
  PENDING_APPROVAL: { tone: 'warning', label: 'Awaiting approval' },
  APPROVED: { tone: 'positive', label: 'Approved and sent' },
  REJECTED: { tone: 'critical', label: 'Rejected' },
}

/* Payments are kept in this app's own storage so a second user can approve
 * what the first one made. Apps own their own state; the shell never sees it. */
function usePayments(seed: string) {
  const key = `harbor.payments.${seed}`
  const [payments, setPayments] = useState<Payment[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? '[]') as Payment[]
    } catch {
      return []
    }
  })
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(payments))
  }, [key, payments])
  return [payments, setPayments] as const
}

function Payments() {
  const { client, services, user, connected } = useApp()
  const { beneficiaries, funds: accounts, seed } = services.dataset
  const [payments, setPayments] = usePayments(seed)
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null)
  const [amount, setAmount] = useState<number | null>(null)
  const [accountCode, setAccountCode] = useState(accounts[0]?.code ?? '')
  const [reference, setReference] = useState('')
  const [lock, setLock] = useState<{ rate: number; expiresAt: number; pair: string } | null>(null)
  const [formKey, setFormKey] = useState(0)
  const now = useNow(1000)

  useIntentListener(client, 'harbor.SendPayment', (context) => {
    const wanted = [(context.id as { BENEFICIARY_ID?: unknown } | undefined)?.BENEFICIARY_ID, context.name].filter((v): v is string => typeof v === 'string')
    const match = beneficiaries.find((b) => wanted.includes(b.id) || wanted.includes(b.name))
    if (match) choose(match)
    else toast({ tone: 'warning', title: 'That organization is not a saved beneficiary' })
  })

  const account = accounts.find((a) => a.code === accountCode) ?? accounts[0]
  const needsFx = Boolean(beneficiary && account && beneficiary.currency !== account.baseCurrency)
  const lockPair = beneficiary && account ? `${account.baseCurrency}${beneficiary.currency}` : ''
  const lockValid = lock !== null && lock.pair === lockPair && lock.expiresAt > now
  const canSubmit = Boolean(beneficiary && account && amount !== null && reference.trim() && (!needsFx || lockValid) && connected)

  function choose(next: Beneficiary) {
    setBeneficiary(next)
    setAmount(null)
    setLock(null)
    setFormKey((k) => k + 1)
  }
  const lockRate = () => {
    if (!beneficiary || !account) return
    const rate = conversionRate(account.baseCurrency, beneficiary.currency, (pair) => services.prices.latest(pair).mid)
    if (rate === null) {
      toast({ tone: 'warning', title: `No rate available for ${account.baseCurrency} to ${beneficiary.currency}` })
      return
    }
    setLock({ rate, expiresAt: Date.now() + RATE_LOCK_MS, pair: lockPair })
  }
  const submit = () => {
    if (!beneficiary || !account || amount === null || !canSubmit) return
    const payment: Payment = {
      id: `PAY-${String(payments.length + 1).padStart(4, '0')}`,
      beneficiaryId: beneficiary.id,
      beneficiaryName: beneficiary.name,
      amount,
      currency: beneficiary.currency,
      debitAccount: account.code,
      debitCurrency: account.baseCurrency,
      rate: needsFx && lock ? lock.rate : 1,
      reference: reference.trim(),
      makerId: user.id,
      makerName: user.displayName,
      createdAt: new Date().toISOString(),
      status: 'PENDING_APPROVAL',
    }
    setPayments((list) => [payment, ...list])
    toast({ tone: 'positive', title: `${payment.id} sent for approval`, body: 'A second person must approve it before it is sent.' })
    setBeneficiary(null)
    setReference('')
    setLock(null)
  }
  const decide = (payment: Payment, status: 'APPROVED' | 'REJECTED') => {
    const allowed = canDecide(payment, user.id)
    if (!allowed.ok) {
      toast({ tone: 'warning', title: allowed.rule })
      return
    }
    setPayments((list) => list.map((p) => (p.id === payment.id ? { ...p, status, deciderId: user.id, deciderName: user.displayName, decidedAt: new Date().toISOString() } : p)))
    toast({ tone: status === 'APPROVED' ? 'positive' : 'info', title: `${payment.id} ${status === 'APPROVED' ? 'approved and sent' : 'rejected'}` })
  }

  return (
    <div className="ha-app" data-testid="payments">
      <div className="ha-toolbar">
        <h1 className="ha-toolbar__title">Payments</h1>
        <StatusPill tone="warning">{payments.filter((p) => p.status === 'PENDING_APPROVAL').length} awaiting approval</StatusPill>
        <span className="ha-toolbar__spacer" />
        <span className="ha-muted">Signed in as {user.displayName}</span>
      </div>
      <div className="ha-scroll ha-stack" role="region" aria-label="Payments content" tabIndex={0}>
        {beneficiary && account && (
          <Ticket
            key={formKey}
            title={`New payment to ${beneficiary.name}`}
            badge={<Badge>{beneficiary.country} · {beneficiary.currency}</Badge>}
            actions={
              <>
                <Button variant="primary" disabled={!canSubmit} onClick={submit} data-testid="payment-submit">
                  Submit for approval
                </Button>
                <Button variant="ghost" onClick={() => setBeneficiary(null)}>
                  Cancel
                </Button>
              </>
            }
          >
            <div className="py-form" data-testid="payment-form">
              <NumberInput label={`Amount (${beneficiary.currency})`} value={amount} onChange={setAmount} />
              <Select label="Debit account" value={account.code} onChange={(e) => setAccountCode(e.target.value)} options={accounts.map((a) => ({ value: a.code, label: `${a.code} · ${a.baseCurrency}` }))} />
              <Input label="Reference" value={reference} maxLength={35} onChange={(e) => setReference(e.target.value)} />
            </div>
            <p className="ha-muted">
              Pays {beneficiary.bankName}, account {beneficiary.accountMasked}.
            </p>
            {needsFx ? (
              <div className="py-fx" data-testid="payment-fx">
                <Button disabled={!connected} onClick={lockRate}>
                  {lockValid ? 'Re-lock rate' : 'Lock FX rate'}
                </Button>
                {lockValid && lock ? (
                  <span data-testid="payment-rate">
                    1 {account.baseCurrency} = <strong>{lock.rate.toFixed(lock.rate > 20 ? 3 : 5)}</strong> {beneficiary.currency}
                    {amount !== null && <> · debits about {formatAmount(amount / lock.rate)} {account.baseCurrency}</>} · held for {Math.ceil((lock.expiresAt - now) / 1000)}s
                  </span>
                ) : (
                  <span className="ha-muted">{lock && lock.pair === lockPair ? 'The locked rate expired. Lock it again to submit.' : `This payment converts ${account.baseCurrency} to ${beneficiary.currency}. Lock a rate before submitting.`}</span>
                )}
              </div>
            ) : (
              <p className="ha-muted">No conversion needed: the account is already in {beneficiary.currency}.</p>
            )}
          </Ticket>
        )}

        <section aria-label="Payments">
          {payments.length === 0 ? (
            <EmptyState title="No payments yet" body="Choose a beneficiary below to make one." />
          ) : (
            <table className="ha-table" data-testid="payment-queue">
              <caption>Payments</caption>
              <thead>
                <tr>
                  <th scope="col">Payment</th>
                  <th scope="col">Beneficiary</th>
                  <th scope="col" className="ha-num">Amount</th>
                  <th scope="col">From</th>
                  <th scope="col">Made by</th>
                  <th scope="col">Status</th>
                  <th scope="col">Decision</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const allowed = canDecide(p, user.id)
                  return (
                    <tr key={p.id} data-payment={p.id} data-status={p.status}>
                      <th scope="row">{p.id}</th>
                      <td>{p.beneficiaryName}</td>
                      <td className="ha-num"><AmountCell value={p.amount} currency={p.currency} /></td>
                      <td>{p.debitAccount}</td>
                      <td>{p.makerName}</td>
                      <td><StatusPill tone={STATUS[p.status].tone}>{STATUS[p.status].label}</StatusPill></td>
                      <td>
                        {p.status !== 'PENDING_APPROVAL' ? (
                          <span className="ha-muted">by {p.deciderName}</span>
                        ) : allowed.ok ? (
                          <span className="ha-row">
                            <Button variant="primary" onClick={() => decide(p, 'APPROVED')}>Approve</Button>
                            <Button onClick={() => decide(p, 'REJECTED')}>Reject</Button>
                          </span>
                        ) : (
                          <span className="py-rule" data-testid="payment-rule">{allowed.rule}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        <table className="ha-table" data-testid="beneficiaries">
          <caption>Beneficiaries</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Country</th>
              <th scope="col">Currency</th>
              <th scope="col">Bank</th>
              <th scope="col">Account</th>
              <th scope="col">
                <span className="hb-sr-only">Pay</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {beneficiaries.map((b) => (
              <tr key={b.id} className={b.id === beneficiary?.id ? 'is-selected' : ''} data-beneficiary={b.id}>
                <th scope="row">{b.name}</th>
                <td>{b.country}</td>
                <td>{b.currency}</td>
                <td>{b.bankName}</td>
                <td>{b.accountMasked}</td>
                <td>
                  <Button onClick={() => choose(b)}>Pay</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

mountApp(<Payments />)
