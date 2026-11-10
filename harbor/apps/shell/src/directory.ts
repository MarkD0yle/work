import { parseDirectory, type DirectoryRecord } from '@harbor/schemas'
import { shell } from './state.ts'

/**
 * Load the App Directory. This JSON file is the only place apps are declared:
 * the launcher, library, resolver, entitlement checks, origin checks and the
 * frame-src policy are all derived from it.
 */
let loading: Promise<void> | null = null

/** Load the directory once per page; repeat calls share the same load. */
export function loadDirectory(): Promise<void> {
  loading ??= fetchDirectory()
  return loading
}

async function fetchDirectory(): Promise<void> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}directory.json`, { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const parsed = parseDirectory(await response.json())
    const records = parsed.records.map(resolveRecord)
    const errors = parsed.errors
    for (const e of errors) console.warn(`[directory] skipped record ${e.appId ?? e.index}: ${e.error}`)
    applyFramePolicy(records.flatMap((r) => r.allowedOrigins))
    shell.set({
      directory: records,
      directoryErrors: errors.map((e) => `${e.appId ?? `record ${e.index}`}: ${e.error}`),
      directoryLoaded: true,
    })
  } catch (error) {
    shell.set({ directory: [], directoryErrors: [`The App Directory could not be loaded (${String(error)}).`], directoryLoaded: true })
  }
}

/**
 * A hosted build serves every app from the shell's own host under a path, so
 * its directory uses relative URLs and the origin "self". Resolve both against
 * the page here. Absolute URLs and real origins pass through unchanged.
 */
function resolveRecord(record: DirectoryRecord): DirectoryRecord {
  if (record.kind !== 'app') return record
  return {
    ...record,
    details: { ...record.details, url: new URL(record.details.url, window.location.href).href },
    allowedOrigins: record.allowedOrigins.map((o) => (o === 'self' ? window.location.origin : o)),
  }
}

/** CSP: only origins named in the directory may be framed. */
function applyFramePolicy(origins: string[]): void {
  const meta = document.createElement('meta')
  meta.httpEquiv = 'Content-Security-Policy'
  meta.content = `frame-src ${[...new Set(origins)].join(' ') || "'none'"}`
  document.head.append(meta)
}
