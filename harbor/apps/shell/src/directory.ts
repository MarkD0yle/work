import { parseDirectory } from '@harbor/schemas'
import { shell } from './state.ts'

/**
 * Load the App Directory. This JSON file is the only place apps are declared:
 * the launcher, library, resolver, entitlement checks, origin checks and the
 * frame-src policy are all derived from it.
 */
export async function loadDirectory(): Promise<void> {
  try {
    const response = await fetch('/directory.json', { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const { records, errors } = parseDirectory(await response.json())
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

/** CSP: only origins named in the directory may be framed. */
function applyFramePolicy(origins: string[]): void {
  const meta = document.createElement('meta')
  meta.httpEquiv = 'Content-Security-Policy'
  meta.content = `frame-src ${[...new Set(origins)].join(' ') || "'none'"}`
  document.head.append(meta)
}
