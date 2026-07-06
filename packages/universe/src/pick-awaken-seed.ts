// Seed-pick logic for the activation "awaken" ([E7a]) — the visible half of competitive,
// excitability-based neuron allocation: a recently-active neuron is more excitable, so a nearby
// latent cell is the likely one recruited next. ALL of this is a client presentation decision —
// nothing here is persisted or sent to the server; the real neuron's final position stays
// emergent from the force-sim [I5].

const DAY_MS = 86_400_000

/** The subset of the episodic-memory mirror this heuristic reads (structurally an EpisodicMemory). */
export interface RecentMemory {
  readonly createdUniverseTime: string
  readonly lastRecalledUniverseTime: string | null
  readonly activations: readonly { readonly neuronId: string }[]
}

export interface RecentlyActiveInput {
  readonly memories: readonly RecentMemory[]
  /** Current universe time (ISO date); the window is measured back from here. */
  readonly universeTime: string | null
  /** The [L4] temporal window (universe-days) reused conceptually for "recently active". */
  readonly windowDays: number
  /** Neurons to leave out of the anchor set (e.g. the just-born neurons themselves). */
  readonly excludeIds?: ReadonlySet<string>
}

// The client-side "recently active" heuristic over the visible graph (not a server fact): the
// neurons of any memory created or last recalled within `windowDays` of the current universe
// time. Deduped, order-stable (first appearance wins).
export function recentlyActiveNeuronIds({
  memories,
  universeTime,
  windowDays,
  excludeIds,
}: RecentlyActiveInput): readonly string[] {
  const latest = universeTime ? Date.parse(universeTime) : NaN
  if (Number.isNaN(latest)) return []
  const windowMs = windowDays * DAY_MS
  const seen = new Set<string>()
  const ids: string[] = []
  for (const memory of memories) {
    const active = memory.lastRecalledUniverseTime ?? memory.createdUniverseTime
    const at = Date.parse(active)
    if (Number.isNaN(at) || latest - at > windowMs) continue
    for (const activation of memory.activations) {
      const id = activation.neuronId
      if (seen.has(id) || excludeIds?.has(id)) continue
      seen.add(id)
      ids.push(id)
    }
  }
  return ids
}

export type AwakenAnchor = readonly [number, number, number]

export interface AwakenSeedInput {
  /** The latent field, interleaved xyz (stride 3). */
  readonly positions: Float32Array
  readonly count: number
  /** Latent indices already awakened — never re-picked. */
  readonly consumed: ReadonlySet<number>
  /** Positions of recently-active neurons; empty → the pick is random (no recent cue). */
  readonly anchors: readonly AwakenAnchor[]
  /** How many distinct latent points to pick (one per genuinely-new neuron). */
  readonly births: number
  /** Injected RNG (0..1) so the random fallback is testable/deterministic. */
  readonly random: () => number
}

// Pick `births` DISTINCT latent points to awaken. With anchors: each pick is the still-available
// latent point nearest ANY anchor (excitability draws recruitment toward the recent cluster).
// Without anchors (the first-ever neuron, or nothing recent): a random available point. Picks
// never collide — N simultaneous births consume N distinct latent points (AC A4/A5).
export function pickAwakenSeeds({ positions, count, consumed, anchors, births, random }: AwakenSeedInput): number[] {
  const picked: number[] = []
  const taken = new Set<number>()
  const isAvailable = (index: number) => !consumed.has(index) && !taken.has(index)

  for (let birth = 0; birth < births; birth++) {
    let choice = -1
    if (anchors.length > 0) {
      let best = Number.POSITIVE_INFINITY
      for (let index = 0; index < count; index++) {
        if (!isAvailable(index)) continue
        const distance = nearestAnchorDistanceSq(positions, index, anchors)
        if (distance < best) {
          best = distance
          choice = index
        }
      }
    } else {
      choice = randomAvailable(count, isAvailable, random)
    }
    if (choice < 0) break // the field is exhausted — pick as many distinct as exist
    taken.add(choice)
    picked.push(choice)
  }
  return picked
}

function nearestAnchorDistanceSq(positions: Float32Array, index: number, anchors: readonly AwakenAnchor[]): number {
  const x = positions[index * 3] ?? 0
  const y = positions[index * 3 + 1] ?? 0
  const z = positions[index * 3 + 2] ?? 0
  let best = Number.POSITIVE_INFINITY
  for (const [ax, ay, az] of anchors) {
    const dx = x - ax
    const dy = y - ay
    const dz = z - az
    best = Math.min(best, dx * dx + dy * dy + dz * dz)
  }
  return best
}

function randomAvailable(count: number, isAvailable: (index: number) => boolean, random: () => number): number {
  let available = 0
  for (let index = 0; index < count; index++) if (isAvailable(index)) available++
  if (available === 0) return -1
  let nth = Math.floor(random() * available)
  for (let index = 0; index < count; index++) {
    if (!isAvailable(index)) continue
    if (nth === 0) return index
    nth--
  }
  return -1
}
