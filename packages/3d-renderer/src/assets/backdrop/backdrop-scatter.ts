import * as THREE from 'three/webgpu'

// SCATTER — the first of the four axes a backdrop theme composes (scatter · mote · life · tone).
//
// A scatter decides WHERE the decorative motes sit inside the backdrop shell, and nothing else: the
// form of a mote, its twinkle and its colour are the other three axes. Every mode here is a pure
// function of a seeded PRNG and the instance index, so a field is random-looking yet identical on
// every mount and on both platforms — the backdrop carries no domain data, and two devices showing
// the same universe must not disagree about the sky behind it.
//
// The one rule every mode shares is the SIZE rule below: a mote's world size rides its own distance,
// so a near mote and a far one cover about the same handful of pixels. Without it a mode that reaches
// the outer shell would grade itself into invisibility while a close-in mode would fill the screen,
// and the modes would stop being comparable as looks. On top of that distance rule every field deals
// out the four size steps in their declared shares, so a sky is mostly small light with the occasional
// near mote in front of it, wherever the mode happens to have put them.

export type BackdropScatterKey =
  'volume' | 'shell' | 'band' | 'spiral' | 'clumps' | 'strands' | 'belt' | 'lattice' | 'swarm'

/** Innermost shell the scatter starts at, as a fraction of `radius` — keeps the origin clear so the
 *  backdrop never mixes into the universe's own bodies. */
const INNER_FRACTION = 0.28
/** Distance whose motes render at the geometry's own size; nearer/farther scale from here. */
const SIZE_REFERENCE = 60
/** Fixed scatter seed: the field is random-looking yet identical on every mount and platform. */
const SCATTER_SEED = 20260725
/** A second fixed seed, for the size mix alone. Kept separate from the placement stream so that
 *  changing how sizes are handed out can never move a single mote. */
const SIZE_SEED = 20260815

/**
 * The sizes a field draws its motes at — whole multiples of the mote geometry's own size — and how
 * much of the field each one takes.
 *
 * A field wears ALL of them, but not in equal numbers. One size everywhere reads as a texture — a
 * printed grain of identical specks — where a sky is mostly small far light with a few near motes in
 * front of it, so the mix is graded steeply: half the field stays at the geometry's own size and the
 * largest step is a rarity you come across rather than a second layer of dots. Whole steps, because
 * the difference between 1.6 and 1.8 is not a decision anyone can make by looking.
 */
export const BACKDROP_MOTE_SIZE_MIX = [
  { size: 1, share: 0.5 },
  { size: 2, share: 0.3 },
  { size: 3, share: 0.15 },
  { size: 4, share: 0.05 },
] as const

export type BackdropMoteSize = (typeof BACKDROP_MOTE_SIZE_MIX)[number]['size']

/**
 * One size step per mote, the four in their declared shares and in no order the placement can
 * correlate with. Dealt in blocks and then SHUFFLED: a run of one size is exactly the right count
 * but rides the index, which the lattice mode turns into visible bands; a per-mote weighted draw has
 * no such structure but lets the rarest step come out at twice its share on a small field. The
 * shuffle is seeded — separately from the placement — so a field is still identical on every mount
 * and on both platforms. Rounding drift lands on the FIRST step, the one large enough to absorb it.
 */
export function dealBackdropMoteSizes(count: number): Float32Array {
  const sizes = new Float32Array(Math.max(0, count))
  if (count <= 0) return sizes
  let cursor = count
  for (let step = BACKDROP_MOTE_SIZE_MIX.length - 1; step > 0; step--) {
    const { size, share } = BACKDROP_MOTE_SIZE_MIX[step] ?? { size: 1, share: 0 }
    const take = Math.min(cursor, Math.round(count * share))
    sizes.fill(size, cursor - take, cursor)
    cursor -= take
  }
  sizes.fill(BACKDROP_MOTE_SIZE_MIX[0]?.size ?? 1, 0, cursor)
  const random = seededRandom(SIZE_SEED)
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const swap = sizes[i] ?? 1
    sizes[i] = sizes[j] ?? 1
    sizes[j] = swap
  }
  return sizes
}

// Park-Miller minimal-standard LCG — a tiny deterministic PRNG using only integer * and % (all
// operands stay < 2^53, so it is exact and identical across JS engines → web and mobile agree).
const PM_MODULUS = 2147483647 // 2^31 - 1
const PM_MULTIPLIER = 16807

export function seededRandom(seed: number): () => number {
  let state = Math.trunc(seed) % PM_MODULUS
  if (state <= 0) state += PM_MODULUS - 1
  return () => {
    state = (state * PM_MULTIPLIER) % PM_MODULUS
    return (state - 1) / (PM_MODULUS - 1)
  }
}

export interface BackdropScatterSpec {
  /** How many motes to place. */
  readonly count: number
  /** Outer shell radius — no mote may sit outside it (the backdrop nesting invariant). */
  readonly radius: number
}

export interface BackdropScatterResult {
  /** count × 3 world positions. */
  readonly positions: Float32Array
  /** count uniform scales, in the mote geometry's own units. */
  readonly scales: Float32Array
}

/** Places one mote per index. Built per field so a mode can precompute its anchors — cluster
 *  centres, filament endpoints, a lattice side — once instead of per mote. */
type ScatterBuilder = (
  random: () => number,
  count: number,
  radius: number,
) => (index: number, out: THREE.Vector3) => void

/** A direction uniform over the sphere: `cos φ = 1 - 2u` avoids the pole crowding an angle pair
 *  would leave. */
function randomDirection(random: () => number, out: THREE.Vector3): THREE.Vector3 {
  const cosPhi = 1 - 2 * random()
  const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi))
  const theta = random() * Math.PI * 2
  return out.set(sinPhi * Math.cos(theta), sinPhi * Math.sin(theta), cosPhi)
}

/** A radius that fills the shell's VOLUME evenly — the cube root keeps the field off its inner
 *  shells, where an unweighted draw would pack most of the motes. */
function volumeRadius(random: () => number, radius: number, inner = INNER_FRACTION): number {
  const innerCubed = inner ** 3
  return radius * Math.cbrt(innerCubed + random() * (1 - innerCubed))
}

/** Three draws summed and centred — a cheap bell curve. Clusters need one: a flat offset leaves a
 *  cube of motes with visibly straight edges instead of a blob that thins out. */
function bell(random: () => number): number {
  return (random() + random() + random()) / 1.5 - 1
}

const SCATTER_BUILDERS: Record<BackdropScatterKey, ScatterBuilder> = {
  // Even through the whole shell — the plain sky. Independent draws per mote rather than a
  // Fibonacci lattice: an index-driven spread leaves a spiral you can trace across the sky, and it
  // is exactly the clumping and the voids that make a field read as a sky rather than a pattern.
  volume: (random, _count, radius) => (_index, out) => {
    randomDirection(random, out).multiplyScalar(volumeRadius(random, radius))
  },

  // Everything at arm's length on one thin shell. No depth at all, so the field reads as a printed
  // dome — the flattest look in the set, and the one that leaves the middle distance empty for the
  // universe's own bodies.
  shell: (random, _count, radius) => (_index, out) => {
    randomDirection(random, out).multiplyScalar(radius * (0.9 + 0.1 * random()))
  },

  // A galactic band: the same volume, squeezed toward one plane. A minority of the motes keep the
  // full sphere, so the band lies ACROSS a sparse sky instead of floating in a void.
  band: (random, _count, radius) => (_index, out) => {
    const stray = random() < 0.18
    randomDirection(random, out)
    if (!stray) out.setY(out.y * 0.16).normalize()
    out.multiplyScalar(volumeRadius(random, radius, stray ? INNER_FRACTION : 0.35))
  },

  // Spiral arms: an angle that advances with distance, so each branch trails behind its own radius.
  // The offset is raised to a power before being scaled by the radius, which leaves the arms tight
  // near the core and frayed at the rim — the shape a particle galaxy is recognisable by.
  spiral: (random, _count, radius) => {
    const branches = 4
    const spin = 2.4
    return (index, out) => {
      const branch = ((index % branches) / branches) * Math.PI * 2
      const distance = radius * (0.3 + 0.7 * random() ** 0.55)
      const angle = branch + (distance / radius) * spin
      const spread = (distance / radius) * 0.42
      out.set(
        Math.cos(angle) * distance + bell(random) * spread * radius,
        bell(random) * spread * radius * 0.28,
        Math.sin(angle) * distance + bell(random) * spread * radius,
      )
    }
  },

  // Clusters: a handful of centres, each holding a soft blob of motes, with strays between them.
  // Real skies are graded this way — a few crowded places and a lot of nothing — and it is the one
  // mode where the eye finds groups to rest on.
  clumps: (random, _count, radius) => {
    const centres = Array.from({ length: 14 }, () =>
      randomDirection(random, new THREE.Vector3()).multiplyScalar(
        volumeRadius(random, radius, 0.4),
      ),
    )
    const spread = radius * 0.11
    return (_index, out) => {
      if (random() < 0.22) {
        randomDirection(random, out).multiplyScalar(volumeRadius(random, radius))
        return
      }
      const centre = centres[Math.floor(random() * centres.length)] ?? centres[0]
      out.set(
        centre.x + bell(random) * spread,
        centre.y + bell(random) * spread,
        centre.z + bell(random) * spread,
      )
    }
  },

  // Filaments: motes strung along a few straight runs through the shell, so the sky is crossed by
  // faint threads. The cosmic-web reading of the same count — structure in the placement rather
  // than in any one mote.
  strands: (random, _count, radius) => {
    const strands = Array.from({ length: 7 }, () => ({
      from: randomDirection(random, new THREE.Vector3()).multiplyScalar(
        volumeRadius(random, radius, 0.5),
      ),
      to: randomDirection(random, new THREE.Vector3()).multiplyScalar(
        volumeRadius(random, radius, 0.5),
      ),
    }))
    const jitter = radius * 0.045
    return (_index, out) => {
      const strand = strands[Math.floor(random() * strands.length)] ?? strands[0]
      const t = random()
      out.lerpVectors(strand.from, strand.to, t)
      out.set(
        out.x + bell(random) * jitter,
        out.y + bell(random) * jitter,
        out.z + bell(random) * jitter,
      )
    }
  },

  // One ring around the scene, thick enough to have an inside. Seen from within it is a bright line
  // across the sky that the camera can tilt out of — the only mode with an orientation to find.
  belt: (random, _count, radius) => (_index, out) => {
    const angle = random() * Math.PI * 2
    const distance = radius * (0.62 + 0.26 * random())
    const thickness = radius * 0.06
    out.set(
      Math.cos(angle) * distance + bell(random) * thickness,
      bell(random) * thickness,
      Math.sin(angle) * distance + bell(random) * thickness,
    )
  },

  // A jittered grid. The one deliberately artificial placement: rows line up wherever the camera
  // looks down an axis, which is what makes it read as a constructed space rather than a sky.
  lattice: (random, count, radius) => {
    const side = Math.max(2, Math.ceil(Math.cbrt(count)))
    // The cube is inscribed in the shell, so its farthest corner is exactly on the radius.
    const half = radius / Math.sqrt(3)
    const step = (half * 2) / side
    return (index, out) => {
      const x = index % side
      const y = Math.floor(index / side) % side
      const z = Math.floor(index / (side * side)) % side
      out.set(
        -half + (x + 0.5) * step + bell(random) * step * 0.3,
        -half + (y + 0.5) * step + bell(random) * step * 0.3,
        -half + (z + 0.5) * step + bell(random) * step * 0.3,
      )
    }
  },

  // Close dust: everything crowded into the near shells, so the field sits in front of the universe
  // rather than behind it. Packed, and the mode that most changes how enclosed the scene feels.
  swarm: (random, _count, radius) => (_index, out) => {
    randomDirection(random, out).multiplyScalar(radius * (0.3 + 0.28 * random() ** 1.4))
  },
}

/**
 * Place a field: `count` positions inside `radius`, plus the uniform scale each mote is drawn at.
 *
 * Pure and deterministic — one seeded PRNG threaded through the chosen mode, so the same spec always
 * yields the same field. The scale carries the distance rule, a per-mote jitter drawn from the same
 * stream so a mode cannot accidentally correlate size with place, and the mote's own size step.
 */
export function scatterBackdrop(
  key: BackdropScatterKey,
  { count, radius }: BackdropScatterSpec,
): BackdropScatterResult {
  const positions = new Float32Array(Math.max(0, count) * 3)
  const scales = new Float32Array(Math.max(0, count))
  if (count <= 0) return { positions, scales }
  const random = seededRandom(SCATTER_SEED)
  const sizes = dealBackdropMoteSizes(count)
  const place = (SCATTER_BUILDERS[key] ?? SCATTER_BUILDERS.volume)(random, count, radius)
  const point = new THREE.Vector3()
  for (let i = 0; i < count; i++) {
    place(i, point)
    // A mode may reach past the shell through its own jitter; the backdrop must stay inside the sky
    // sphere, so the point is pulled back rather than the mode being written defensively.
    if (point.lengthSq() > radius * radius) point.setLength(radius)
    positions[i * 3] = point.x
    positions[i * 3 + 1] = point.y
    positions[i * 3 + 2] = point.z
    // The squared-ish draw skews the field toward faint pinpricks with a few bright standouts, the
    // way a real sky is graded, and the distance factor holds on-screen size roughly constant.
    const jitter = 0.45 + 1.15 * random() ** 1.6
    scales[i] = ((jitter * point.length()) / SIZE_REFERENCE) * (sizes[i] ?? 1)
  }
  return { positions, scales }
}
