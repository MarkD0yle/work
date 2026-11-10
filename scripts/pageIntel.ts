import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

/* Page intel — a build-time scan of every screen in src/pages.
 *
 * Drift Radar and Brief Builder need to know what each screen's source looks
 * like (how big it is, how far it has drifted from the house rules) and which
 * patterns exist. Shipping 2.6 MB of raw source to the browser for that would
 * be wasteful, so vite.config.ts runs this once and exposes the small result
 * as the `virtual:page-intel` module.
 *
 * Many pages are thin wrappers around src/features or src/components, so the
 * scan follows relative imports into those two folders. It stops at the
 * pattern library and ui folders: those are shared building blocks, not part
 * of any one screen.
 *
 * The counts are regex estimates, not a parser. Treat them as "worth a look". */

export type PageIntel = {
  /** Files that make up the screen (the page plus what it imports). */
  files: number
  lines: number
  drift: { radius: number; hex: number; inlineStyle: number }
}

export type Intel = {
  generatedAt: number
  /** Component names exported by src/components/patterns/index.ts. */
  patterns: string[]
  pages: Record<string, PageIntel>
}

const EXTENSIONS = ['.tsx', '.ts', '/index.ts', '/index.tsx']
// Only UI code counts towards a screen. Data and helpers in src/lib hold
// things like chart palettes, which are not drift.
const FOLLOW_DIRS = ['src/components', 'src/features']
const STOP_DIRS = ['src/components/patterns', 'src/components/ui']
const MAX_DEPTH = 4

const IMPORT_RE = /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g
// A Tailwind radius utility: `rounded`, `rounded-md`, `rounded-t-lg`,
// `rounded-[6px]`. `rounded-none` and `rounded-full` never match, because the
// zero-radius rule allows them.
const RADIUS_RE =
  /(?<![\w-])rounded(?:-(?:tl|tr|bl|br|ss|se|es|ee|[trblse]))?(?:-(?:xs|sm|md|lg|xl|[2-4]xl|\[[^\]\s]+\]))?(?![\w-])/g
// The bare word also turns up in prose ("rounded corners"). Count it only
// when what follows looks like the end of a class list or another class.
const CLASS_CONTEXT_RE = /^(?:["'`]|\s+(?!corner)[a-z[!-])/
const HEX_RE = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g
const INLINE_STYLE_RE = /style=\{\{/g

function resolveImport(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec)
  if (existsSync(base) && statSync(base).isFile()) return base
  for (const ext of EXTENSIONS) {
    const candidate = base + ext
    if (existsSync(candidate)) return candidate
  }
  return null
}

function collectFiles(root: string, entry: string): string[] {
  const seen = new Set<string>([entry])
  let frontier = [entry]
  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth++) {
    const next: string[] = []
    for (const file of frontier) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(IMPORT_RE)) {
        const target = resolveImport(file, match[1])
        if (!target || seen.has(target)) continue
        if (!/\.tsx?$/.test(target)) continue
        const rel = relative(root, target).replace(/\\/g, '/')
        if (!FOLLOW_DIRS.some((dir) => rel.startsWith(dir + '/'))) continue
        if (STOP_DIRS.some((dir) => rel.startsWith(dir + '/'))) continue
        seen.add(target)
        next.push(target)
      }
    }
    frontier = next
  }
  return [...seen]
}

function count(source: string, re: RegExp): number {
  return source.match(re)?.length ?? 0
}

function scanFile(file: string) {
  const source = readFileSync(file, 'utf8')
  let radius = 0
  for (const match of source.matchAll(RADIUS_RE)) {
    const after = source.slice(match.index + match[0].length, match.index + match[0].length + 16)
    if (match[0] !== 'rounded' || CLASS_CONTEXT_RE.test(after)) radius += 1
  }
  return {
    lines: source.split('\n').length,
    radius,
    hex: count(source, HEX_RE),
    inlineStyle: count(source, INLINE_STYLE_RE),
  }
}

function patternNames(root: string): string[] {
  const file = join(root, 'src/components/patterns/index.ts')
  if (!existsSync(file)) return []
  const names = new Set<string>()
  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of match[1].split(',')) {
      const raw = part.trim()
      if (!raw || raw.startsWith('type ')) continue
      const name = raw.split(/\s+as\s+/).pop()!.trim()
      // Components only: capitalised, and not an ALL_CAPS constant.
      if (/^[A-Z][a-z]/.test(name)) names.add(name)
    }
  }
  return [...names].sort()
}

export function buildPageIntel(root: string = process.cwd()): Intel {
  const dir = join(root, 'src/pages')
  const pages: Record<string, PageIntel> = {}
  const cache = new Map<string, ReturnType<typeof scanFile>>()
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.tsx')) continue
    const files = collectFiles(root, join(dir, name))
    const total: PageIntel = {
      files: files.length,
      lines: 0,
      drift: { radius: 0, hex: 0, inlineStyle: 0 },
    }
    for (const file of files) {
      let scan = cache.get(file)
      if (!scan) {
        scan = scanFile(file)
        cache.set(file, scan)
      }
      total.lines += scan.lines
      total.drift.radius += scan.radius
      total.drift.hex += scan.hex
      total.drift.inlineStyle += scan.inlineStyle
    }
    pages[name.replace(/\.tsx$/, '')] = total
  }
  return {
    generatedAt: Math.floor(Date.now() / 1000),
    patterns: patternNames(root),
    pages,
  }
}
