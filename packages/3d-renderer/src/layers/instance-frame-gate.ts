/**
 * The dirty check that lets a contiguous-slot instanced layer leave last frame's matrices on the
 * GPU. Internal to the generic instanced layer; kept out of the component so the decision is a
 * unit-testable function rather than something only a running WebGPU device can exercise.
 *
 * Everything that can move an instance's matrix rides in one key: the presented coordinate
 * buffer's version, the appearance channels' identity, the slot window (count + offset), the flat
 * scale, and an explicit revision a layer bumps when it animates through its own arrays. Nothing
 * derived from the clock belongs here — a layer that animates per frame opts out entirely
 * (see the mapper rule in `InstancedNodeLayer`).
 */
export interface InstanceFrameKey {
  /** The presented buffer's version. NaN for an unversioned buffer — see `createInstanceFrameKey`. */
  bufferVersion: number
  /**
   * The presented array itself. A version alone is only unique WITHIN one producer, and the
   * `positions` prop can be repointed at a different ref — a rebuilt sim bridge starts counting
   * from zero — which could land on a number this layer had already composed. The array identity
   * cannot collide that way, and for a versioned producer it moves in lockstep with the version.
   */
  buffer: Float32Array | null
  channels: object | null
  count: number
  firstNodeIndex: number
  scale: number
  animationRevision: number
}

/**
 * A key no real frame can match, so the first frame after a (re)mount always composes.
 *
 * NaN is load-bearing rather than decorative: `NaN !== NaN`, so a caller that has no buffer
 * version to offer — any `CoordinateBufferRef` outside the sim bridge — writes NaN and thereby
 * opts out of skipping altogether. Fail-open is the only safe default here; a wrongly skipped
 * frame is a frozen scene, and nothing in the picture would say why.
 */
export function createInstanceFrameKey(): InstanceFrameKey {
  return {
    bufferVersion: Number.NaN,
    buffer: null,
    channels: null,
    count: -1,
    firstNodeIndex: -1,
    scale: Number.NaN,
    animationRevision: -1,
  }
}

/** True when `candidate` states exactly the frame `last` already composed. */
export function sameInstanceFrame(last: InstanceFrameKey, candidate: InstanceFrameKey): boolean {
  return (
    last.bufferVersion === candidate.bufferVersion &&
    last.buffer === candidate.buffer &&
    last.channels === candidate.channels &&
    last.count === candidate.count &&
    last.firstNodeIndex === candidate.firstNodeIndex &&
    last.scale === candidate.scale &&
    last.animationRevision === candidate.animationRevision
  )
}

/** Record the frame just composed. Field-wise, so the hot loop allocates nothing. */
export function recordInstanceFrame(last: InstanceFrameKey, composed: InstanceFrameKey): void {
  last.bufferVersion = composed.bufferVersion
  last.buffer = composed.buffer
  last.channels = composed.channels
  last.count = composed.count
  last.firstNodeIndex = composed.firstNodeIndex
  last.scale = composed.scale
  last.animationRevision = composed.animationRevision
}

/**
 * Forget the last composed frame, so the next one recomposes unconditionally. Called wherever the
 * matrices the key vouches for are no longer on the GPU — a fresh `InstancedMesh` (a body swap
 * rebuilds one with all-zero matrices), or a frame that hid the mesh for want of coordinates.
 */
export function resetInstanceFrame(last: InstanceFrameKey): void {
  recordInstanceFrame(last, EMPTY_KEY)
}

const EMPTY_KEY = createInstanceFrameKey()
