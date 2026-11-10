import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/* Accessibility checks on the tokens themselves, so a palette change that
 * breaks contrast fails the build rather than waiting for an audit. */

const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8')

function block(selector: RegExp): Record<string, string> {
  const out: Record<string, string> = {}
  for (const match of css.matchAll(new RegExp(`${selector.source}\\s*\\{([^}]*)\\}`, 'g'))) {
    for (const decl of (match[1] as string).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[decl[1] as string] = (decl[2] as string).trim()
  }
  return out
}

const shared = block(/(?:^|\n):root/)
const themes = {
  dark: { ...shared, ...block(/:root,\s*:root\[data-theme='dark'\]/) },
  light: { ...shared, ...block(/:root,\s*:root\[data-theme='dark'\]/), ...block(/:root\[data-theme='light'\]/) },
}

/** Follow var() references down to a hex colour. */
function resolve(theme: Record<string, string>, name: string): string {
  let value = theme[name]
  for (let hops = 0; value?.startsWith('var(') && hops < 8; hops++) value = theme[value.slice(4, -1).trim()]
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} does not resolve to a hex colour (got ${String(value)})`)
  return value
}

type Rgb = [number, number, number]
const toLinear = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as Rgb
const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(toLinear(a)), luminance(toLinear(b))].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const SURFACES = ['--color-surface-1', '--color-surface-2', '--color-canvas']
const TEXT = ['--color-text-primary', '--color-text-secondary', '--color-text-muted', '--color-accent-text', '--color-buy', '--color-sell', '--color-positive', '--color-warning', '--color-critical', '--color-info']
const CHANNELS = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'magenta', 'purple']

describe.each(Object.entries(themes))('%s theme contrast (WCAG 2.1 AA)', (_name, theme) => {
  it('text colours reach 4.5:1 on every surface they sit on', () => {
    const failures: string[] = []
    for (const text of TEXT) {
      for (const surface of SURFACES) {
        const ratio = contrast(resolve(theme, text), resolve(theme, surface))
        if (ratio < 4.5) failures.push(`${text} on ${surface}: ${ratio.toFixed(2)}`)
      }
    }
    expect(failures).toEqual([])
  })

  it('text on filled backgrounds reaches 4.5:1', () => {
    const pairs: [string, string][] = [
      ['--color-text-on-accent', '--color-accent'],
      ['--color-text-on-accent', '--color-accent-hover'],
      ['--color-mock-text', '--color-mock-bg'],
      ['--color-on-critical', '--color-critical'],
      ...CHANNELS.map((c): [string, string] => [`--color-on-channel-${c}`, `--color-channel-${c}`]),
    ]
    const failures = pairs.map(([fg, bg]) => [fg, bg, contrast(resolve(theme, fg), resolve(theme, bg))] as const).filter(([, , ratio]) => ratio < 4.5)
    expect(failures.map(([fg, bg, ratio]) => `${fg} on ${bg}: ${ratio.toFixed(2)}`)).toEqual([])
  })

  it('UI boundaries and the focus ring reach 3:1', () => {
    const failures: string[] = []
    for (const ui of ['--color-border-strong', '--color-focus', '--color-accent']) {
      for (const surface of SURFACES) {
        const ratio = contrast(resolve(theme, ui), resolve(theme, surface))
        if (ratio < 3) failures.push(`${ui} on ${surface}: ${ratio.toFixed(2)}`)
      }
    }
    expect(failures).toEqual([])
  })
})

/* ---------- colour-blind simulation for buy/sell ---------- */

// Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear RGB.
const SIMULATIONS: Record<string, [Rgb, Rgb, Rgb]> = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
}
const simulate = (rgb: Rgb, m: [Rgb, Rgb, Rgb]): Rgb => m.map((row) => Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]))) as Rgb

function toLab([r, g, b]: Rgb): Rgb {
  const xyz = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883].map((t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)) as Rgb
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])]
}
const deltaE = (a: Rgb, b: Rgb) => Math.hypot(...toLab(a).map((v, i) => v - (toLab(b)[i] as number)))

describe.each(Object.entries(themes))('%s theme buy/sell under colour blindness', (_name, theme) => {
  it('buy and sell stay clearly different in every simulation', () => {
    const buy = toLinear(resolve(theme, '--color-buy'))
    const sell = toLinear(resolve(theme, '--color-sell'))
    const differences = Object.fromEntries(Object.entries(SIMULATIONS).map(([name, matrix]) => [name, Math.round(deltaE(simulate(buy, matrix), simulate(sell, matrix)))]))
    // A difference of about 2 is just noticeable; 20 is unmistakable at a glance.
    for (const [name, difference] of Object.entries(differences)) expect(difference, `${name}: ${JSON.stringify(differences)}`).toBeGreaterThan(20)
    expect(Math.round(deltaE(buy, sell))).toBeGreaterThan(20)
  })
})
