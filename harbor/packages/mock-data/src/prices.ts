import type { LiquidityProvider } from './entities.ts'
import { PAIRS, pairSpec, roundRate, startOfUtcDay, type PairSpec } from './pairs.ts'
import { createRng, type Rng } from './rng.ts'
import { realScheduler, type Scheduler } from './scheduler.ts'

export const TICK_MIN_MS = 250
export const TICK_MAX_MS = 1000
const DAY_MS = 86_400_000
/** Standard deviation of one tick, as a fraction of price (about a fifth of a pip on EURUSD). */
const TICK_VOL = 0.00002
/** Pull back towards the day's open, so a pair cannot wander off over a session. */
const REVERSION = 0.0004

export interface PriceTick {
  pair: string
  mid: number
  /** The day's opening mid (00:00 UTC). */
  open: number
  /** Change from the open, in percent. */
  changePct: number
  /** Time of this tick, epoch ms. */
  at: number
  /** Tick number since the open. */
  seq: number
}

export interface LpQuote {
  lpId: string
  bid: number
  offer: number
}

interface PairState {
  spec: PairSpec
  rng: Rng
  dayStart: number
  open: number
  mid: number
  /** Time of the last tick applied. */
  at: number
  /** Time the next tick is due. */
  nextAt: number
  seq: number
}

/**
 * The price walk as a pure function of (seed, pair, time).
 *
 * Each pair's ticks for a UTC day are a fixed sequence drawn from its own
 * seeded stream: interval, move, interval, move… Asking for the price at time
 * t replays that sequence up to t. So two separate apps (different iframes,
 * different machines) with the same seed show the same price at the same
 * moment, and a reload picks up exactly where the stream would have been.
 */
export class PriceEngine {
  private readonly seed: string
  private readonly states = new Map<string, PairState>()

  constructor(seed: string) {
    this.seed = seed
  }

  private begin(spec: PairSpec, dayStart: number): PairState {
    const rng = createRng(`${this.seed}/px/${spec.pair}/${dayStart / DAY_MS}`)
    const open = roundRate(spec.pair, spec.referenceMid * (1 + rng.range(-0.006, 0.006)))
    return { spec, rng, dayStart, open, mid: open, at: dayStart, nextAt: dayStart + rng.int(TICK_MIN_MS, TICK_MAX_MS), seq: 0 }
  }

  /** Apply every tick due at or before `now`. Returns how many were applied. */
  private advance(state: PairState, now: number): number {
    let applied = 0
    while (state.nextAt <= now && state.nextAt < state.dayStart + DAY_MS) {
      const drift = -REVERSION * Math.log(state.mid / state.open)
      state.mid = state.mid * (1 + drift + TICK_VOL * state.rng.gauss())
      state.at = state.nextAt
      state.seq++
      state.nextAt += state.rng.int(TICK_MIN_MS, TICK_MAX_MS)
      applied++
    }
    return applied
  }

  private stateAt(pair: string, now: number): PairState {
    const dayStart = startOfUtcDay(now)
    let state = this.states.get(pair)
    // New day, or a request for an earlier time than we have replayed to: start that day afresh.
    if (!state || state.dayStart !== dayStart || state.at > now) {
      state = this.begin(pairSpec(pair), dayStart)
      this.states.set(pair, state)
    }
    this.advance(state, now)
    return state
  }

  tick(pair: string, now: number): PriceTick {
    const s = this.stateAt(pair, now)
    const mid = roundRate(pair, s.mid)
    return { pair, mid, open: s.open, changePct: Number((((mid - s.open) / s.open) * 100).toFixed(3)), at: s.at, seq: s.seq }
  }

  /** When the pair's next tick is due after `now`. */
  nextTickAt(pair: string, now: number): number {
    const s = this.stateAt(pair, now)
    // At the day boundary the next tick belongs to tomorrow's sequence.
    return s.nextAt < s.dayStart + DAY_MS ? s.nextAt : s.dayStart + DAY_MS
  }
}

/** An LP quotes mid ± half its own spread, shifted by its own skew. */
export function quoteFor(pair: string, mid: number, lp: Pick<LiquidityProvider, 'id' | 'spreadPips' | 'skewPips'>): LpQuote {
  const { pip } = pairSpec(pair)
  const half = (lp.spreadPips * pip) / 2
  const skew = lp.skewPips * pip
  return { lpId: lp.id, bid: roundRate(pair, mid - half + skew), offer: roundRate(pair, mid + half + skew) }
}

export interface PriceStream {
  /** Latest tick for a pair, without subscribing. */
  latest(pair: string): PriceTick
  /** All LP quotes for a pair at its latest mid. */
  quotes(pair: string): LpQuote[]
  /** Receive every tick for the given pairs. Returns an unsubscribe function. */
  subscribe(pairs: readonly string[], listener: (tick: PriceTick) => void): () => void
  /** Pause and resume delivery (the "disconnect" test switch). Prices keep moving underneath. */
  setConnected(connected: boolean): void
  readonly connected: boolean
  /** Pause delivery while nobody can see the prices (a hidden panel). Independent of the connection state. */
  setSuspended(suspended: boolean): void
  /** Stop all timers. */
  stop(): void
}

export function createPriceStream(options: { seed: string; liquidityProviders?: readonly LiquidityProvider[]; scheduler?: Scheduler }): PriceStream {
  const scheduler = options.scheduler ?? realScheduler
  const engine = new PriceEngine(options.seed)
  const listeners = new Map<string, Set<(tick: PriceTick) => void>>()
  const timers = new Map<string, unknown>()
  let connected = true
  let suspended = false

  const schedule = (pair: string) => {
    const now = scheduler.now()
    const handle = scheduler.setTimeout(() => {
      timers.delete(pair)
      const set = listeners.get(pair)
      if (!set || set.size === 0) return
      if (connected && !suspended) {
        const tick = engine.tick(pair, scheduler.now())
        for (const listener of [...set]) listener(tick)
      }
      schedule(pair)
    }, Math.max(1, engine.nextTickAt(pair, now) - now))
    timers.set(pair, handle)
  }

  return {
    latest: (pair) => engine.tick(pair, scheduler.now()),
    quotes: (pair) => {
      const { mid } = engine.tick(pair, scheduler.now())
      return (options.liquidityProviders ?? []).map((lp) => quoteFor(pair, mid, lp))
    },
    subscribe: (pairs, listener) => {
      for (const pair of pairs) {
        pairSpec(pair)
        let set = listeners.get(pair)
        if (!set) listeners.set(pair, (set = new Set()))
        set.add(listener)
        if (!timers.has(pair)) schedule(pair)
      }
      return () => {
        for (const pair of pairs) {
          const set = listeners.get(pair)
          set?.delete(listener)
          // Nobody listening: stop that pair's timer so closed panels leave nothing running.
          if (set?.size === 0 && timers.has(pair)) {
            scheduler.clearTimeout(timers.get(pair))
            timers.delete(pair)
          }
        }
      }
    },
    setConnected: (value) => {
      connected = value
    },
    get connected() {
      return connected
    },
    setSuspended: (value) => {
      suspended = value
    },
    stop: () => {
      for (const handle of timers.values()) scheduler.clearTimeout(handle)
      timers.clear()
      listeners.clear()
    },
  }
}

export const ALL_PAIRS: readonly string[] = PAIRS.map((p) => p.pair)
