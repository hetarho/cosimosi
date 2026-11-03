/**
 * The dirty check that lets a contiguous-slot instanced layer leave last frame's matrices on the
 * GPU. Internal to the generic instanced layer; kept out of the component so the decision is a
 * unit-testable function rather than something only a running WebGPU device can exercise.
 *
 * Everything that can move an instance's matrix rides in one key: the presented coordinate
 * buffer's version, the identity of the appearance input the matrices read, the slot window (count + offset), the flat
 * scale, and an explicit revision a layer bumps when it animates through its own arrays. Nothing
 * derived from the clock belongs here — a position mapper that is animating opts out for as long
 * as it animates (`instanceBufferVersion`).
 */

import type * as THREE from 'three/webgpu'

import { composeInstances, type ComposeInstancesInput } from './instance-compose.ts'
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
  /** The appearance input the matrices depend on, by identity (for instanced nodes: the scales). */
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

/**
 * The buffer version a frame is keyed on. A position mapper derives positions from the buffer, and
 * from the clock only while it animates; settled, it is a pure function of the buffer, so the
 * buffer's own version vouches for it. While it animates, NaN opts the layer out of skipping.
 */
export function instanceBufferVersion(
  version: number | undefined,
  mapped: boolean,
  mapperAnimating: boolean,
): number {
  if (mapped && mapperAnimating) return Number.NaN
  return version ?? Number.NaN
}

/**
 * One frame of an instanced layer once `frame` is filled: an unchanged key shows the matrices
 * already on the GPU, anything else composes them and records the key. Returns null for a skipped
 * frame, otherwise whether the vertex-scale attribute changed and needs an upload.
 */
export function stepInstanceFrame(
  mesh: THREE.InstancedMesh,
  frame: InstanceFrameKey,
  composed: InstanceFrameKey,
  compose: ComposeInstancesInput,
): boolean | null {
  if (sameInstanceFrame(composed, frame)) {
    mesh.count = frame.count
    mesh.visible = true
    return null
  }
  recordInstanceFrame(composed, frame)
  return composeInstances(mesh, compose)
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

export function createCameraRevision() {
  return { x: Number.NaN, y: Number.NaN, z: Number.NaN, w: Number.NaN, revision: 0 }
}

/** Camera-facing geometry must recompose when its view basis changes. */
export function updateCameraRevision(
  frame: ReturnType<typeof createCameraRevision>,
  x: number,
  y: number,
  z: number,
  w = 0,
): number {
  if (frame.x !== x || frame.y !== y || frame.z !== z || frame.w !== w) {
    frame.x = x
    frame.y = y
    frame.z = z
    frame.w = w
    frame.revision += 1
  }
  return frame.revision
}
