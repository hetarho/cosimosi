// The awaken flare's per-frame life, as a pure step over a fixed-size pool — so "an idle pool
// writes nothing" is a unit test rather than something only a running canvas could show
// (the navigation-latch precedent). Motion/look is code, never values.yaml [E7a]; only the pool
// ceiling is tuning, and that stays with the component that sizes the pool.

/** One flare's 0→1 arc peaks mid-life and hands off to the real cell-star as it closes. */
const AWAKEN_DURATION_S = 1.1
const AWAKEN_PEAK_SIZE = 0.9
/** Cap the per-frame step so a large delta (a backgrounded tab resuming) can't skip a whole flare. */
const AWAKEN_MAX_STEP_S = 0.05

export interface AwakenFlarePool {
  /** Rendered size per slot, mutated in place and read by the layer each frame. */
  readonly scales: Float32Array
  /** Each slot's 0→1 life. */
  readonly progress: Float32Array
  readonly active: boolean[]
  /** How many slots are mid-flare — the idle test, kept as a count so it costs no scan. */
  activeCount: number
}

export function createAwakenFlarePool(capacity: number): AwakenFlarePool {
  return {
    scales: new Float32Array(capacity),
    progress: new Float32Array(capacity),
    active: Array.from({ length: capacity }, () => false),
    activeCount: 0,
  }
}

/** Start a flare in `slot`, from zero size. The caller owns the seed position. */
export function igniteAwakenFlare(pool: AwakenFlarePool, slot: number): void {
  if (pool.active[slot]) return
  pool.active[slot] = true
  pool.activeCount += 1
  pool.progress[slot] = 0
  pool.scales[slot] = 0
}

/** The first slot with no flare in it, or -1 when the pool is full. */
export function freeAwakenSlot(pool: AwakenFlarePool): number {
  return pool.active.indexOf(false)
}

/**
 * Advance every live flare by one frame. Returns whether any scale was written — the layer's skip
 * rests on that answer, so an idle pool must return false rather than rewriting its capacity in
 * zeroes. Idling is the steady state: a launch is rare and a flare lasts about a second.
 */
export function advanceAwakenFlares(pool: AwakenFlarePool, deltaSeconds: number): boolean {
  // Every inactive slot is already at zero — a completing flare zeroes its own — so there is
  // genuinely nothing to write.
  if (pool.activeCount === 0) return false
  const step = Math.min(deltaSeconds, AWAKEN_MAX_STEP_S) / AWAKEN_DURATION_S
  for (let slot = 0; slot < pool.active.length; slot++) {
    if (!pool.active[slot]) continue
    const next = (pool.progress[slot] as number) + step
    if (next >= 1) {
      pool.active[slot] = false
      pool.activeCount -= 1
      pool.progress[slot] = 0
      pool.scales[slot] = 0
      continue
    }
    pool.progress[slot] = next
    pool.scales[slot] = Math.sin(next * Math.PI) * AWAKEN_PEAK_SIZE
  }
  return true
}
