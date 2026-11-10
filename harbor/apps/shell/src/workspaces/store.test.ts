import { describe, expect, it } from 'vitest'
import type { WorkspaceFile } from '@harbor/schemas'
import { BackedWorkspaceStore, MemoryBackend, parseWorkspaceJson } from './store.ts'

const file = (id: string, ownerId = 'u1', name = 'FX Trading'): WorkspaceFile => ({
  schemaVersion: 1,
  id,
  name,
  ownerId,
  updatedAt: '2026-11-10T10:00:00.000Z',
  layout: { grid: { root: {} } },
  panels: [{ panelId: 'p1', kind: 'app', appId: 'fx-exec', channelId: 'fdc3.channel.6', config: { pair: 'EURUSD' } }],
})

function make() {
  const backend = new MemoryBackend()
  let n = 0
  const store = new BackedWorkspaceStore(backend, () => `new-${++n}`, () => new Date('2026-11-10T12:00:00.000Z'))
  return { backend, store }
}

describe('WorkspaceStore', () => {
  it('saves, lists per owner in name order, gets and deletes', async () => {
    const { store } = make()
    await store.save(file('b', 'u1', 'Zeta'))
    await store.save(file('a', 'u1', 'Alpha'))
    await store.save(file('c', 'u2'))
    expect((await store.list('u1')).map((f) => f.name)).toEqual(['Alpha', 'Zeta'])
    expect((await store.list('u2')).map((f) => f.id)).toEqual(['c'])
    expect(await store.get('u1', 'a')).toMatchObject({ id: 'a' })
    expect(await store.get('u2', 'a')).toBeUndefined()
    await store.delete('u1', 'a')
    expect(await store.get('u1', 'a')).toBeUndefined()
  })

  it('refuses to save an invalid file', async () => {
    const { store } = make()
    await expect(store.save({ ...file('a'), name: '' })).rejects.toThrow(/name/)
  })

  it('round-trips export and import with identical layout and channels', async () => {
    const { store } = make()
    const original = file('a')
    await store.save(original)
    const json = await store.export('u1', 'a')
    const imported = await store.import('u2', json)
    expect(imported.ok).toBe(true)
    if (!imported.ok) return
    expect(imported.value).toMatchObject({ id: 'new-1', ownerId: 'u2', updatedAt: '2026-11-10T12:00:00.000Z' })
    expect(imported.value.layout).toEqual(original.layout)
    expect(imported.value.panels).toEqual(original.panels)
    expect(await store.get('u2', 'new-1')).toBeDefined()
    await expect(store.export('u1', 'missing')).rejects.toThrow(/not found/)
  })

  it('rejects bad imports with a clear reason and saves nothing', async () => {
    const { store, backend } = make()
    expect(await store.import('u1', '{nope')).toEqual({ ok: false, error: 'This file is not valid JSON.' })
    const future = await store.import('u1', JSON.stringify({ ...file('a'), schemaVersion: 7 }))
    expect(future.ok).toBe(false)
    if (!future.ok) expect(future.error).toMatch(/version 7 is not supported/)
    expect(backend.data.workspaces.size).toBe(0)
    expect(parseWorkspaceJson(JSON.stringify(file('a'))).ok).toBe(true)
  })

  it('quarantines a corrupt stored file instead of loading or losing it', async () => {
    const { store, backend } = make()
    await store.save(file('good'))
    await backend.put('workspaces', 'u1/bad', { id: 'bad', schemaVersion: 1, name: 42 })
    await backend.put('workspaces', 'u1/anon', 'garbage')
    expect((await store.list('u1')).map((f) => f.id)).toEqual(['good'])
    const quarantined = await store.listQuarantined('u1')
    expect(quarantined.map((q) => q.id).sort()).toEqual(['bad', 'new-1'])
    expect(quarantined.find((q) => q.id === 'bad')?.raw).toEqual({ id: 'bad', schemaVersion: 1, name: 42 })
    expect(await store.get('u1', 'bad')).toBeUndefined()
    expect(backend.data.workspaces.has('u1/bad')).toBe(false)
  })
})
