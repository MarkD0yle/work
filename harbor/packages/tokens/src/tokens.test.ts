import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { tokens } from './index.ts'

const root = join(import.meta.dirname, '../../..')
const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'coverage') continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(css|tsx?)$/.test(name) && !name.endsWith('.test.ts')) out.push(path)
  }
  return out
}

describe('tokens', () => {
  it('every TS token name exists in tokens.css', () => {
    const names = JSON.stringify(tokens).match(/--[a-z0-9-]+/g) ?? []
    expect(names.length).toBeGreaterThan(30)
    for (const name of names) expect(css, name).toContain(`${name}:`)
  })

  it('no hard-coded colours outside tokens.css', () => {
    const offenders: string[] = []
    for (const file of [...walk(join(root, 'packages')), ...walk(join(root, 'apps'))]) {
      if (file.endsWith('tokens.css')) continue
      const text = readFileSync(file, 'utf8')
      const hits = text.match(/#[0-9a-fA-F]{3,8}\b(?![\w-])|\brgba?\(|\bhsla?\(/g)
      // `#` followed by hex can also be an id selector or URL fragment; only flag CSS colour positions.
      const real = (hits ?? []).filter((h) => !h.startsWith('#') || new RegExp(`:[^;{]*${h}`).test(text))
      if (real.length) offenders.push(`${file}: ${real.join(', ')}`)
    }
    expect(offenders).toEqual([])
  })

  it('components never read primitive tokens', () => {
    const primitive = /var\(--(gray|blue|teal|orange|red|amber|green|hue|space|font-size|duration)-/
    const offenders = [...walk(join(root, 'packages')), ...walk(join(root, 'apps'))]
      .filter((f) => !f.endsWith('tokens.css'))
      .filter((f) => primitive.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })
})
