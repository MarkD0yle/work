import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __PAGES_ADDED_AT__: JSON.stringify(pageAddedTimes()),
  },
})
