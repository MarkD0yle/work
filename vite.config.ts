import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { buildPageIntel } from './scripts/pageIntel.ts'

/* Map each src/pages slug to the unix time it was first added, so the
 * gallery can offer a "Recent" sort. Git's first-add date is the source of
 * truth; files not yet committed fall back to their on-disk birthtime. */
function pageAddedTimes(): Record<string, number> {
  const root = process.cwd()
  const dir = join(root, 'src/pages')
  const map: Record<string, number> = {}
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.tsx')) continue
    map[f.replace(/\.tsx$/, '')] = Math.floor(statSync(join(dir, f)).birthtimeMs / 1000)
  }
  try {
    const out = execSync(
      'git log --diff-filter=A --format=COMMIT:%at --name-only -- src/pages',
      { cwd: root, encoding: 'utf8' },
    )
    // Log is newest-first; letting older entries overwrite means the
    // earliest add wins for files that were deleted and re-added.
    let ts = 0
    for (const line of out.split('\n')) {
      if (line.startsWith('COMMIT:')) {
        ts = Number(line.slice('COMMIT:'.length))
      } else {
        const m = line.match(/^src\/pages\/(.+)\.tsx$/)
        if (m && m[1] in map) map[m[1]] = ts
      }
    }
  } catch {
    // git unavailable — keep filesystem birthtimes
  }
  return map
}

/* Expose the build-time source scan (scripts/pageIntel.ts) to the app as
 * `virtual:page-intel`. A virtual module, not `define`, so the JSON is
 * emitted once instead of being inlined at every reference. Computed when
 * the dev server starts; restart it to refresh. */
function pageIntelPlugin(): Plugin {
  const id = 'virtual:page-intel'
  const resolved = '\0' + id
  return {
    name: 'page-intel',
    resolveId(source) {
      return source === id ? resolved : undefined
    },
    load(loadId) {
      if (loadId !== resolved) return undefined
      return `export const intel = ${JSON.stringify(buildPageIntel())};`
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), pageIntelPlugin()],
  define: {
    __PAGES_ADDED_AT__: JSON.stringify(pageAddedTimes()),
  },
})
