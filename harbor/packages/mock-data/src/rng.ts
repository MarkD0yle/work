/* Seeded randomness. Everything in this package draws from here, so the same
 * seed always produces the same data. `Math.random` is never used. */

/** FNV-1a 32-bit hash of a string. */
export function hashString(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export interface Rng {
  /** Uniform in [0, 1). */
  float(): number
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number
  /** Uniform in [min, max). */
  range(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  chance(probability: number): boolean
  /** Roughly normal, mean 0, standard deviation 1. */
  gauss(): number
  /**
   * An independent stream named by `label`. Generators fork rather than share
   * one stream, so adding a draw to one generator never shifts another's data.
   */
  fork(label: string): Rng
}

export function createRng(seed: string): Rng {
  // mulberry32
  let state = hashString(seed) || 1
  const float = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const rng: Rng = {
    float,
    int: (min, max) => min + Math.floor(float() * (max - min + 1)),
    range: (min, max) => min + float() * (max - min),
    pick: <T,>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error('pick() needs a non-empty list')
      return items[Math.floor(float() * items.length)] as T
    },
    chance: (p) => float() < p,
    // Sum of three uniforms, rescaled: cheap, bounded, close enough to normal for a price walk.
    gauss: () => (float() + float() + float() - 1.5) * 2,
    fork: (label) => createRng(`${seed}/${label}`),
  }
  return rng
}

export const DEFAULT_SEED = 'harbor'

/** The seed comes from `?seed=` in the page URL. */
export function seedFromSearch(search: string): string {
  const value = new URLSearchParams(search).get('seed')?.trim()
  return value ? value.slice(0, 64) : DEFAULT_SEED
}
