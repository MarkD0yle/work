import { migrateWorkspace, type ValidationResult, type WorkspaceFile } from '@harbor/schemas'

/**
 * Where workspaces live. Async on purpose: a server-backed implementation can
 * replace the IndexedDB one with no shell changes (that is how cross-device
 * sync would be added).
 */
export interface WorkspaceStore {
  list(ownerId: string): Promise<WorkspaceFile[]>
  get(ownerId: string, id: string): Promise<WorkspaceFile | undefined>
  save(file: WorkspaceFile): Promise<void>
  delete(ownerId: string, id: string): Promise<void>
  /** Serialise one workspace as the contents of a `.harbor.json` file. */
  export(ownerId: string, id: string): Promise<string>
  /** Validate and add a workspace from file contents. It gets a fresh id and the importing owner. */
  import(ownerId: string, json: string): Promise<ValidationResult<WorkspaceFile>>
  /** Files that failed validation or could not be laid out. Kept so they can be exported. */
  listQuarantined(ownerId: string): Promise<QuarantinedFile[]>
  quarantine(ownerId: string, id: string, raw: unknown, reason: string): Promise<void>
}

export interface QuarantinedFile {
  ownerId: string
  id: string
  reason: string
  at: string
  raw: unknown
}

/** Minimal key-value backend so the store logic is shared by IndexedDB and tests. */
export interface KeyValueBackend {
  entries(bucket: Bucket, prefix: string): Promise<unknown[]>
  get(bucket: Bucket, key: string): Promise<unknown>
  put(bucket: Bucket, key: string, value: unknown): Promise<void>
  delete(bucket: Bucket, key: string): Promise<void>
}
export type Bucket = 'workspaces' | 'quarantine'

const key = (ownerId: string, id: string) => `${ownerId}/${id}`

/** Parse the text of a `.harbor.json` file without saving it (used for the import preview). */
export function parseWorkspaceJson(json: string): ValidationResult<WorkspaceFile> {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' }
  }
  return migrateWorkspace(raw)
}

export class BackedWorkspaceStore implements WorkspaceStore {
  private readonly backend: KeyValueBackend
  private readonly newId: () => string
  private readonly now: () => Date

  constructor(backend: KeyValueBackend, newId: () => string = () => crypto.randomUUID(), now: () => Date = () => new Date()) {
    this.backend = backend
    this.newId = newId
    this.now = now
  }

  async list(ownerId: string): Promise<WorkspaceFile[]> {
    const raws = await this.backend.entries('workspaces', `${ownerId}/`)
    const files: WorkspaceFile[] = []
    for (const raw of raws) {
      const result = migrateWorkspace(raw)
      if (result.ok) {
        files.push(result.value)
        continue
      }
      // Never silently load or lose a bad file: move it aside.
      const id = typeof (raw as { id?: unknown })?.id === 'string' ? (raw as { id: string }).id : this.newId()
      await this.quarantine(ownerId, id, raw, result.error)
      await this.backend.delete('workspaces', key(ownerId, id))
    }
    return files.sort((a, b) => a.name.localeCompare(b.name))
  }

  async get(ownerId: string, id: string): Promise<WorkspaceFile | undefined> {
    const raw = await this.backend.get('workspaces', key(ownerId, id))
    if (raw === undefined) return undefined
    const result = migrateWorkspace(raw)
    return result.ok ? result.value : undefined
  }

  async save(file: WorkspaceFile): Promise<void> {
    const checked = migrateWorkspace(file)
    if (!checked.ok) throw new Error(checked.error)
    await this.backend.put('workspaces', key(file.ownerId, file.id), checked.value)
  }

  async delete(ownerId: string, id: string): Promise<void> {
    await this.backend.delete('workspaces', key(ownerId, id))
  }

  async export(ownerId: string, id: string): Promise<string> {
    const file = await this.get(ownerId, id)
    if (!file) throw new Error('Workspace not found')
    return JSON.stringify(file, null, 2)
  }

  async import(ownerId: string, json: string): Promise<ValidationResult<WorkspaceFile>> {
    const parsed = parseWorkspaceJson(json)
    if (!parsed.ok) return parsed
    // An import is a workspace in its own right, not a fork of a role template.
    const { templateOf: _templateOf, ...rest } = parsed.value
    const file: WorkspaceFile = { ...rest, id: this.newId(), ownerId, updatedAt: this.now().toISOString() }
    await this.save(file)
    return { ok: true, value: file }
  }

  async listQuarantined(ownerId: string): Promise<QuarantinedFile[]> {
    return (await this.backend.entries('quarantine', `${ownerId}/`)) as QuarantinedFile[]
  }

  async quarantine(ownerId: string, id: string, raw: unknown, reason: string): Promise<void> {
    const record: QuarantinedFile = { ownerId, id, reason, at: this.now().toISOString(), raw }
    await this.backend.put('quarantine', key(ownerId, id), record)
  }
}

export class MemoryBackend implements KeyValueBackend {
  readonly data: Record<Bucket, Map<string, unknown>> = { workspaces: new Map(), quarantine: new Map() }
  async entries(bucket: Bucket, prefix: string) {
    return [...this.data[bucket]].filter(([k]) => k.startsWith(prefix)).map(([, v]) => structuredClone(v))
  }
  async get(bucket: Bucket, k: string) {
    const value = this.data[bucket].get(k)
    return value === undefined ? undefined : structuredClone(value)
  }
  async put(bucket: Bucket, k: string, value: unknown) {
    this.data[bucket].set(k, structuredClone(value))
  }
  async delete(bucket: Bucket, k: string) {
    this.data[bucket].delete(k)
  }
}

export class IndexedDbBackend implements KeyValueBackend {
  private db: Promise<IDBDatabase> | undefined

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('harbor', 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore('workspaces')
        request.result.createObjectStore('quarantine')
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return this.db
  }

  private async run<T>(bucket: Bucket, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const request = work(db.transaction(bucket, mode).objectStore(bucket))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  entries(bucket: Bucket, prefix: string) {
    // "￿" sorts after every key that starts with the prefix.
    return this.run<unknown[]>(bucket, 'readonly', (s) => s.getAll(IDBKeyRange.bound(prefix, `${prefix}￿`)))
  }
  get(bucket: Bucket, k: string) {
    return this.run<unknown>(bucket, 'readonly', (s) => s.get(k))
  }
  async put(bucket: Bucket, k: string, value: unknown) {
    await this.run(bucket, 'readwrite', (s) => s.put(value, k))
  }
  async delete(bucket: Bucket, k: string) {
    await this.run(bucket, 'readwrite', (s) => s.delete(k))
  }
}
