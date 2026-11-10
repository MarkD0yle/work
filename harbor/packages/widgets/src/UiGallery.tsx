import { useState, type ReactNode } from 'react'
import {
  AmountCell,
  Badge,
  Button,
  ChannelPicker,
  Checkbox,
  Combobox,
  Countdown,
  DataGrid,
  Dialog,
  Drawer,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  Kbd,
  KeyValueList,
  Menu,
  NumberInput,
  Popover,
  PriceCell,
  RadioGroup,
  Select,
  SideLabel,
  Skeleton,
  Sparkline,
  StatusPill,
  Switch,
  Tabs,
  Ticket,
  Tooltip,
  toast,
  type ColDef,
} from '@harbor/ui'
import type { WidgetProps } from './types.ts'

function Demo({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className="hw-gallery__demo" aria-label={name}>
      <h3>{name}</h3>
      <div className="hw-gallery__stage">{children}</div>
    </section>
  )
}

interface Row {
  id: string
  pair: string
  amount: number
}
const ROWS: Row[] = [
  { id: '1', pair: 'EURUSD', amount: 25_000_000 },
  { id: '2', pair: 'USDJPY', amount: 5_000_000 },
  { id: '3', pair: 'GBPUSD', amount: 10_000_000 },
]
const COLUMNS: ColDef<Row>[] = [
  { headerName: 'Pair', field: 'pair', width: 120 },
  { headerName: 'Amount', field: 'amount', width: 160, cellClass: 'hb-cell-num', headerClass: 'hb-cell-num', cellRenderer: (p: { data?: Row }) => (p.data ? <AmountCell value={p.data.amount} /> : null) },
]
const PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD'].map((p) => ({ value: p, label: p }))

/**
 * Developer tool: every shared component on one page, in its main states.
 * Switch theme and density from the profile menu to see them respond.
 * The panel chrome itself (title, icon, channel picker, menu) is the tab above.
 */
export function UiGallery(_props: WidgetProps) {
  const [text, setText] = useState('')
  const [amount, setAmount] = useState<number | null>(25_000_000)
  const [pair, setPair] = useState('EURUSD')
  const [combo, setCombo] = useState<string | null>(null)
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
  const [checked, setChecked] = useState(true)
  const [on, setOn] = useState(false)
  const [tab, setTab] = useState<'one' | 'two' | 'three'>('one')
  const [channel, setChannel] = useState<string | null>('fdc3.channel.6')
  const [dialog, setDialog] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [expiresAt] = useState(() => Date.now() + 60_000)

  return (
    <div className="hw-gallery" data-testid="ui-gallery">
      <Demo name="Button">
        <Button variant="primary">Primary</Button>
        <Button>Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button icon="download">With icon</Button>
        <Button disabled>Disabled</Button>
      </Demo>
      <Demo name="IconButton">
        <IconButton icon="bell" label="Alerts" />
        <IconButton icon="search" label="Search" active />
        <IconButton icon="close" label="Close" disabled />
      </Demo>
      <Demo name="Input">
        <Input label="Reference" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type here" />
        <Input label="With an error" defaultValue="abc" error="Enter a number." />
        <Input label="Disabled" defaultValue="Locked" disabled />
      </Demo>
      <Demo name="NumberInput">
        <NumberInput label="Amount (try 25m, 500k, 1.5b)" value={amount} onChange={setAmount} />
        <span className="hw-gallery__note">Parsed: {amount === null ? 'not a valid amount' : amount.toLocaleString('en-US')}</span>
      </Demo>
      <Demo name="Select">
        <Select label="Pair" value={pair} onChange={(e) => setPair(e.target.value)} options={PAIRS} />
      </Demo>
      <Demo name="Combobox">
        <Combobox label="Find a pair" options={PAIRS} value={combo} onChange={setCombo} placeholder="Type to filter" />
        <span className="hw-gallery__note">Chosen: {combo ?? 'nothing'}</span>
      </Demo>
      <Demo name="Checkbox, Radio and Switch">
        <Checkbox label="Mine only" checked={checked} onChange={setChecked} />
        <RadioGroup label="Side" value={side} onChange={setSide} options={[{ value: 'BUY', label: 'Buy' }, { value: 'SELL', label: 'Sell' }]} />
        <Switch label="Simulate disconnect" checked={on} onChange={setOn} />
      </Demo>
      <Demo name="Tabs">
        <Tabs label="Example tabs" value={tab} onChange={setTab} items={[{ id: 'one', label: 'Apps', count: 9 }, { id: 'two', label: 'Widgets', count: 4 }, { id: 'three', label: 'Tiles', count: 6 }]} />
      </Demo>
      <Demo name="Tooltip and Popover">
        <Tooltip text="Shown on hover and on focus">
          <Button>Hover or focus me</Button>
        </Tooltip>
        <Popover label="Quote details" trigger="Open popover">
          <p style={{ margin: 0 }}>A small non-modal panel. Escape closes it.</p>
        </Popover>
      </Demo>
      <Demo name="Menu and ChannelPicker">
        <Menu label="Example menu" namedByContent triggerClassName="hb-button hb-button--secondary" trigger="Open menu" items={[{ id: 'a', label: 'Split right', onSelect: () => {} }, { id: 'b', label: 'Disabled item', disabled: true, onSelect: () => {} }, { id: 'c', label: 'Close', danger: true, separated: true, onSelect: () => {} }]} />
        <ChannelPicker subject="this demo" channelId={channel} onChange={setChannel} />
      </Demo>
      <Demo name="Dialog and Drawer">
        <Button onClick={() => setDialog(true)}>Open dialog</Button>
        <Button onClick={() => setDrawer(true)}>Open drawer</Button>
        <Dialog open={dialog} onClose={() => setDialog(false)} title="Example dialog" footer={<Button variant="primary" onClick={() => setDialog(false)}>Done</Button>}>
          Focus is trapped inside until it closes. Escape closes it.
        </Dialog>
        <Drawer open={drawer} onClose={() => setDrawer(false)} title="Example drawer">
          A side sheet for longer content.
        </Drawer>
      </Demo>
      <Demo name="Toast">
        <Button onClick={() => toast({ title: 'For your information' })}>Info</Button>
        <Button onClick={() => toast({ tone: 'positive', title: 'Saved' })}>Positive</Button>
        <Button onClick={() => toast({ tone: 'warning', title: 'Check this' })}>Warning</Button>
        <Button onClick={() => toast({ tone: 'critical', title: 'Needs attention', body: 'Stays until dismissed.', action: { label: 'Resolve', onSelect: () => {} } })}>Critical with action</Button>
      </Demo>
      <Demo name="Badge and StatusPill">
        <Badge>Neutral</Badge>
        <Badge tone="accent">Accent</Badge>
        <Badge tone="positive">Positive</Badge>
        <Badge tone="warning">Warning</Badge>
        <Badge tone="critical">Critical</Badge>
        <StatusPill tone="info">New</StatusPill>
        <StatusPill tone="positive">Matched</StatusPill>
        <StatusPill tone="warning">Working</StatusPill>
        <StatusPill tone="critical">Mismatched</StatusPill>
        <StatusPill tone="neutral">Settled</StatusPill>
      </Demo>
      <Demo name="PriceCell, AmountCell, SideLabel, Sparkline, Countdown, Kbd">
        <PriceCell value={1.08427} decimals={5} />
        <PriceCell value={151.426} decimals={3} />
        <PriceCell value={undefined} decimals={5} />
        <AmountCell value={25_000_000} currency="EUR" />
        <SideLabel side="BUY" />
        <SideLabel side="SELL" />
        <Sparkline values={[1, 3, 2, 5, 4, 6, 8]} />
        <Sparkline values={[8, 6, 7, 4, 5, 2, 1]} />
        <Countdown expiresAt={expiresAt} totalMs={60_000} />
        <span>
          <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd>
        </span>
      </Demo>
      <Demo name="Ticket and KeyValueList">
        <Ticket title="Buy EURUSD" badge={<Badge tone="accent">Locked to order 10401</Badge>} actions={<Button variant="primary">Send RFQ</Button>}>
          <KeyValueList items={[{ label: 'Pair', value: 'EURUSD' }, { label: 'Side', value: <SideLabel side="BUY" /> }, { label: 'Amount', value: <AmountCell value={10_000_000} currency="EUR" /> }, { label: 'Value date', value: '2026-11-12' }]} />
        </Ticket>
      </Demo>
      <Demo name="DataGrid">
        <div className="hw-gallery__grid">
          <DataGrid<Row> label="Example grid" rows={ROWS} columns={COLUMNS} rowId={(r) => r.id} selectedId={selected} onSelect={(r) => setSelected(r.id)} />
        </div>
      </Demo>
      <Demo name="Skeleton, EmptyState and ErrorState">
        <div className="hw-gallery__state"><Skeleton lines={3} /></div>
        <div className="hw-gallery__state"><EmptyState title="Nothing to show" body="An empty panel says why." /></div>
        <div className="hw-gallery__state"><ErrorState body="An error offers a way out." onReload={() => {}} /></div>
      </Demo>
    </div>
  )
}
