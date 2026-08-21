export interface LatentFieldParams {
  /** Reuse force_sim.seed so web and mobile generate the identical, reproducible field. */
  readonly seed: number
  readonly count: number
  /** Hippocampus z-band from force_sim. */
  readonly zMin: number
  readonly zMax: number
  /** World radius of the x,y disc the field fills. */
  readonly radius: number
}

export interface LatentField {
  /** Interleaved xyz instance positions (stride 3), length count*3. */
  readonly positions: Float32Array
  readonly count: number
}

// Park-Miller minimal-standard LCG — a tiny deterministic PRNG using only integer * and % (all
// operands stay < 2^53, so it is exact and identical across JS engines → web and mobile agree).
// Kept self-contained here (not the force-sim engine's RNG) because the latent field is decorative
// and NOT a sim node [E7a]: same seed → same field on every platform and run, no sim coupling.
const PM_MODULUS = 2147483647 // 2^31 - 1
const PM_MULTIPLIER = 16807

function seededRandom(seed: number): () => number {
  let state = Math.trunc(seed) % PM_MODULUS
  if (state <= 0) state += PM_MODULUS - 1
  return () => {
    state = (state * PM_MULTIPLIER) % PM_MODULUS
    return (state - 1) / (PM_MODULUS - 1)
  }
}

// Deterministic seeded field generator ([E7a], AC A2): `count` gray points scattered through the
// hippocampus z-band, filling a LENS — a disc of `radius` in x,y whose z thickness tapers to
// nothing at the rim (the same oblate silhouette the force layout settles into, [C5]; a uniform
// cylinder would draw hard corner edges the memories themselves never reach).
// Points carry ONLY a position — no brightness, no color, no name, no identity; those belong to
// real neurons, never the silent field. Purely rendering data: nothing here is persisted or read
// from the server.
export function generateLatentField({
  seed,
  count,
  zMin,
  zMax,
  radius,
}: LatentFieldParams): LatentField {
  const safeCount = Math.max(0, Math.trunc(count))
  const positions = new Float32Array(safeCount * 3)
  const random = seededRandom(seed)
  const halfSpan = (zMax - zMin) / 2
  const midZ = (zMax + zMin) / 2
  for (let i = 0; i < safeCount; i++) {
    const angle = random() * Math.PI * 2
    // sqrt of a uniform sample → an area-uniform disc (no center clumping).
    const rNorm = Math.sqrt(random())
    positions[i * 3] = Math.cos(angle) * rNorm * radius
    positions[i * 3 + 1] = Math.sin(angle) * rNorm * radius
    // Ellipsoidal cap: the z allowance shrinks toward the rim, so the field's edge-on profile
    // reads as the lens rather than as a slab with sliced faces.
    const zHalf = halfSpan * Math.sqrt(Math.max(0, 1 - rNorm * rNorm))
    positions[i * 3 + 2] = midZ + (random() * 2 - 1) * zHalf
  }
  return { positions, count: safeCount }
}
