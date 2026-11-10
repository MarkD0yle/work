import { describe, expect, it } from 'vitest'
import {
  USER_CHANNELS,
  canLaunch,
  canRaise,
  contextIdLabel,
  findUserChannel,
  handlesIntent,
  isProtocolMessage,
  migrateWorkspace,
  parseDirectory,
  parseAlertInput,
  isTypingTarget,
  shellShortcutFor,
  parseDirectoryRecord,
  validateContext,
  PROTOCOL,
  type UserInfo,
} from './index.ts'

const order = {
  type: 'harbor.fxOrder',
  id: { orderId: '1' },
  pair: 'EURUSD',
  side: 'BUY',
  dealtCurrency: 'EUR',
  amount: 1_000_000,
  tenor: 'SPOT',
  valueDate: '2026-11-12',
  account: 'FUND-A',
  status: 'NEW',
}
const trade = {
  type: 'harbor.fxTrade',
  id: { tradeId: 'T1', orderId: '1' },
  pair: 'EURUSD',
  side: 'SELL',
  amount: 5,
  rate: 1.0812,
  counterparty: 'LP-1',
  method: 'RFQ',
  executedAt: '2026-11-10T14:02:11.000Z',
  valueDate: '2026-11-12',
  account: 'FUND-A',
  arrivalMid: 1.0811,
}

describe('validateContext', () => {
  it('accepts every context type in the catalogue', () => {
    const good = [
      order,
      { ...order, benchmark: 'TWAP' },
      { ...order, execution: { method: 'RFQ', estimate: { type: 'harbor.preTradeEstimate', id: { orderId: '1' }, expectedCostBps: 1, recommendedMethod: 'RFQ', suggestedCounterparties: ['LP-01'], liquidityScore: 5 } } },
      { type: 'harbor.orderFilter', name: 'Awaiting execution', statuses: ['NEW'] },
      { type: 'harbor.devCommand', command: 'forceMismatch' },
      trade,
      { type: 'harbor.preTradeEstimate', id: { orderId: '1' }, expectedCostBps: 1.2, recommendedMethod: 'RFQ', suggestedCounterparties: ['LP-1'], liquidityScore: 4 },
      { type: 'harbor.settlement', id: { tradeId: 'T1' }, matchStatus: 'MISMATCHED', exceptionReason: 'rate' },
      { type: 'fdc3.instrument', id: { ticker: 'EURUSD' }, name: 'Euro / US Dollar', extra: true },
      { type: 'fdc3.portfolio', positions: [] },
      { type: 'fdc3.organization', id: { LEI: 'X' } },
      { type: 'fdc3.timeRange', startTime: '2026-11-01T00:00:00.000Z' },
      { type: 'acme.custom', anything: 1 },
    ]
    for (const context of good) expect(validateContext(context), JSON.stringify(context)).toMatchObject({ ok: true })
  })

  it('rejects bad values with a readable reason', () => {
    const bad: [unknown, RegExp][] = [
      [null, /root/],
      [{ id: {} }, /type/],
      [{ ...order, amount: 0 }, /amount/],
      [{ ...order, pair: 'EUR/USD' }, /pair/],
      [{ ...order, valueDate: '12/11/2026' }, /valueDate/],
      [{ ...order, side: 'HOLD' }, /side/],
      [{ ...order, execution: { method: 'VOICE' } }, /execution/],
      [{ type: 'harbor.orderFilter', statuses: ['OPEN'] }, /statuses/],
      [{ ...trade, executedAt: 'yesterday' }, /executedAt/],
      [{ type: 'harbor.preTradeEstimate', id: { orderId: '1' }, expectedCostBps: 1, recommendedMethod: 'RFQ', suggestedCounterparties: [], liquidityScore: 6 }, /liquidityScore/],
      [{ type: 'harbor.settlement', id: { tradeId: 'T1' }, matchStatus: 'LOST' }, /matchStatus/],
      [{ type: 'fdc3.timeRange' }, /startTime or endTime/],
      [{ type: 'fdc3.instrument' }, /id/],
      [{ type: 'harbor.madeUp' }, /unknown Harbor context type/],
    ]
    for (const [context, reason] of bad) {
      const result = validateContext(context)
      expect(result.ok, JSON.stringify(context)).toBe(false)
      if (!result.ok) expect(result.error).toMatch(reason)
    }
  })

  it('labels a context by its first id', () => {
    expect(contextIdLabel({ type: 'x', id: { orderId: '10432' } })).toBe('10432')
    expect(contextIdLabel({ type: 'x', id: { n: 7 } })).toBe('7')
    expect(contextIdLabel({ type: 'x' })).toBe('')
    expect(contextIdLabel({ type: 'x', id: { nested: {} } })).toBe('')
  })
})

describe('channels', () => {
  it('has eight uniquely named channels with letter fallbacks', () => {
    expect(USER_CHANNELS).toHaveLength(8)
    expect(new Set(USER_CHANNELS.map((c) => c.id)).size).toBe(8)
    expect(findUserChannel('fdc3.channel.6')?.displayMetadata).toMatchObject({ name: 'Blue', glyph: 'B' })
    expect(findUserChannel(null)).toBeUndefined()
    expect(findUserChannel('nope')).toBeUndefined()
  })
})

const record = {
  appId: 'fx-exec',
  title: 'FX Execution',
  publisher: 'First-party',
  category: 'Trading',
  type: 'web',
  details: { url: 'http://localhost:5174/' },
  interop: { intents: { listensFor: { 'harbor.ExecuteOrder': { contexts: ['harbor.fxOrder'] } } } },
  kind: 'app',
  allowedOrigins: ['http://localhost:5174'],
  requiredEntitlement: 'app.fx-exec',
}

describe('directory', () => {
  it('parses records and fills defaults', () => {
    const { records, errors } = parseDirectory({ applications: [record, { ...record, appId: 'tile-a', kind: 'tile', allowedOrigins: undefined, interop: undefined }] })
    expect(errors).toEqual([])
    expect(records).toHaveLength(2)
    expect(records[1]?.interop.intents.listensFor).toEqual({})
    expect(records[0]?.icons).toEqual([])
  })

  it('skips bad records without losing good ones', () => {
    const { records, errors } = parseDirectory({
      applications: [record, { ...record, appId: 'Bad Id' }, record, { ...record, appId: 'no-origins', allowedOrigins: [] }, 42],
    })
    expect(records.map((r) => r.appId)).toEqual(['fx-exec'])
    expect(errors.map((e) => e.index)).toEqual([1, 2, 3, 4])
    expect(errors[1]?.error).toMatch(/duplicate/)
    expect(errors[2]?.error).toMatch(/allowedOrigins/)
  })

  it('rejects a file that is not a directory', () => {
    expect(parseDirectory({ apps: [] }).errors[0]?.index).toBe(-1)
  })

  it('validates a single record and matches intents by context type', () => {
    const parsed = parseDirectoryRecord(record)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(handlesIntent(parsed.value, 'harbor.ExecuteOrder', 'harbor.fxOrder')).toBe(true)
      expect(handlesIntent(parsed.value, 'harbor.ExecuteOrder', 'fdc3.instrument')).toBe(false)
      expect(handlesIntent(parsed.value, 'ViewNews', 'fdc3.instrument')).toBe(false)
    }
    expect(parseDirectoryRecord({}).ok).toBe(false)
  })
})

describe('entitlements', () => {
  const user: UserInfo = { id: 'u', displayName: 'U', role: 'Operations', entitlements: { apps: ['app.post-trade'], intents: ['ViewNews'] } }
  it('checks launch and raise separately', () => {
    const parsed = parseDirectoryRecord(record)
    if (!parsed.ok) throw new Error('fixture')
    expect(canLaunch(user, parsed.value)).toBe(false)
    expect(canLaunch({ ...user, entitlements: { apps: ['app.fx-exec'], intents: [] } }, parsed.value)).toBe(true)
    expect(canRaise(user, 'ViewNews')).toBe(true)
    expect(canRaise(user, 'harbor.ExecuteOrder')).toBe(false)
    expect(canRaise({ ...user, entitlements: { apps: [], intents: ['*'] } }, 'anything')).toBe(true)
  })
})

const workspace = {
  schemaVersion: 1,
  id: 'w1',
  name: 'FX Trading',
  ownerId: 'u-trader',
  updatedAt: '2026-11-10T14:02:11.000Z',
  layout: { grid: {} },
  panels: [{ panelId: 'p1', kind: 'app', appId: 'fx-exec', channelId: 'fdc3.channel.6', config: {} }],
}

describe('migrateWorkspace', () => {
  it('loads a current-version file', () => {
    const result = migrateWorkspace(workspace)
    expect(result).toMatchObject({ ok: true, value: { name: 'FX Trading' } })
  })

  it('rejects unknown versions with a clear message, never loading them', () => {
    for (const schemaVersion of [2, 0, 99]) {
      const result = migrateWorkspace({ ...workspace, schemaVersion })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toMatch(/not supported/)
    }
  })

  it('rejects things that are not workspace files', () => {
    const bad: [unknown, RegExp][] = [
      ['text', /expected a JSON object/],
      [[], /expected a JSON object/],
      [{}, /schemaVersion is missing/],
      [{ ...workspace, schemaVersion: '1' }, /schemaVersion is missing/],
      [{ ...workspace, name: '' }, /name/],
      [{ ...workspace, panels: [workspace.panels[0], workspace.panels[0]] }, /unique/],
      [{ ...workspace, panels: [{ ...workspace.panels[0], kind: 'gadget' }] }, /kind/],
    ]
    for (const [input, reason] of bad) {
      const result = migrateWorkspace(input)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toMatch(reason)
    }
  })
})

describe('protocol', () => {
  it('recognises protocol messages only', () => {
    expect(isProtocolMessage({ protocol: PROTOCOL, kind: 'hello' })).toBe(true)
    expect(isProtocolMessage({ protocol: 'other', kind: 'hello' })).toBe(false)
    expect(isProtocolMessage({ protocol: PROTOCOL })).toBe(false)
    expect(isProtocolMessage(null)).toBe(false)
    expect(isProtocolMessage('hello')).toBe(false)
  })
})

describe('alerts', () => {
  it('accepts a well-formed alert and enforces the length limits', () => {
    expect(parseAlertInput({ severity: 'critical', title: 'Trade mismatched', body: 'Rate differs', context: order, action: { label: 'Resolve', intent: 'harbor.ViewSettlement' }, key: 'T-1' }).ok).toBe(true)
    expect(parseAlertInput({ severity: 'info', title: 'Cut-off in 10 minutes' }).ok).toBe(true)
    const bad: [unknown, RegExp][] = [
      [{ severity: 'info', title: '' }, /title/],
      [{ severity: 'info', title: 'x'.repeat(61) }, /title/],
      [{ severity: 'info', title: 'ok', body: 'x'.repeat(141) }, /body/],
      [{ severity: 'urgent', title: 'ok' }, /severity/],
      [{ severity: 'info', title: 'ok', action: { label: 'Go', intent: 'X' } }, /needs a context/],
      [{ severity: 'info', title: 'ok', context: order, action: { label: 'x'.repeat(25), intent: 'X' } }, /label/],
      [null, /root/],
    ]
    for (const [input, reason] of bad) {
      const result = parseAlertInput(input)
      expect(result.ok, JSON.stringify(input)).toBe(false)
      if (!result.ok) expect(result.error).toMatch(reason)
    }
  })
})

describe('shell shortcuts', () => {
  const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods })
  it('recognises the shell shortcuts and nothing else', () => {
    expect(shellShortcutFor(key('k', { ctrlKey: true }))).toBe('commandPalette')
    expect(shellShortcutFor(key('K', { metaKey: true }))).toBe('commandPalette')
    expect(shellShortcutFor(key('F6'))).toBe('nextRegion')
    expect(shellShortcutFor(key('F6', { shiftKey: true }))).toBe('previousRegion')
    expect(shellShortcutFor(key('ArrowRight', { ctrlKey: true, altKey: true }))).toBe('nextPanel')
    expect(shellShortcutFor(key('ArrowDown', { ctrlKey: true, altKey: true }))).toBe('nextPanel')
    expect(shellShortcutFor(key('ArrowLeft', { ctrlKey: true, altKey: true }))).toBe('previousPanel')
    expect(shellShortcutFor(key('ArrowUp', { ctrlKey: true, altKey: true }))).toBe('previousPanel')
    expect(shellShortcutFor(key('?', { shiftKey: true }))).toBe('help')
    expect(shellShortcutFor(key('?', { shiftKey: true }), true)).toBeNull()
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true)
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true)
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
    for (const other of [key('k'), key('k', { ctrlKey: true, altKey: true }), key('ArrowRight', { ctrlKey: true }), key('Enter'), key('F5')]) expect(shellShortcutFor(other)).toBeNull()
  })
})
