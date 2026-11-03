import { hexToLinearRgb } from '@cosimosi/color'
import { VALUES } from '@cosimosi/config'
import { moodColor } from '@cosimosi/emotion'
import {
  effectiveBrightness,
  effectiveElapsedDays,
  effectiveElapsedDaysMs,
  effectiveStrength,
  universeTimeMs,
} from '@cosimosi/memory-logic'

import type { EpisodicMemory } from '@cosimosi/memory'

// The pure four-channel projection of an episodic memory onto its big-star body (§3.4). Same
// stored facts always draw the same star: size = EffectiveStrength [V3], brightness =
// EffectiveBrightness [V2] (the read-time forgetting fade — a star unrecalled in universe-time dims
// toward the silent-engram floor, never to 0 [F1][F2]), color = the primary emotion via the emotion
// palette seam and nothing else [I3][M3], shape = the stored seed passed through as immutable input
// [V5][A7]. No `three`, no rendering-vocab dependency — a deterministic function over domain facts.
export interface StarChannels {
  /** World scale (radius) from EffectiveStrength, within [starSizeMin, starSizeMax]. */
  readonly size: number
  /** Brightness from EffectiveBrightness, within [starBrightnessMin, starBrightnessMax]. */
  readonly brightness: number
  /** Emotion color, linear RGB 0..1 (the material's colorNode is linear-space). */
  readonly color: readonly [number, number, number]
  /** Normalized seed 0..1 driving the immutable seed-form. */
  readonly seed: number
}

export function starChannels(memory: EpisodicMemory, universeTime: string | null): StarChannels {
  const { rendering } = VALUES
  const strength = effectiveStrength(memory.baseStrength, memory.recallCount)
  // The real read-time forgetting fade: universe-days since last recall (offset-inclusive), slowed by
  // arousal and connection strength; its range already IS [star_brightness_min, max], so it maps
  // straight to the brightness channel, floored at the silent-engram min [V2][F1][F2].
  const elapsed = effectiveElapsedDays(
    universeTime,
    memory.lastRecalledUniverseTime,
    memory.createdUniverseTime,
    memory.forgettingOffsetDays,
  )
  return {
    size: lerpClamp(rendering.starSizeMin, rendering.starSizeMax, strength),
    brightness: starBrightness(elapsed, memory.emotion.arousal, strength),
    // Linear light: a colorNode attribute bypasses the sRGB decode three applies to `.color.set(hex)`.
    color: hexToLinearRgb(moodColor(memory.emotion.mood)),
    seed: normalizeSeed(memory.seed, memory.id),
  }
}

// EffectiveBrightness already returns [forgetting.brightness_floor, 1] with the floor aligned to
// star_brightness_min, so it IS the render range — clamp it in place, do NOT re-lerp a [0,1]
// fraction (that would lift the silent-engram floor off star_brightness_min). A2/[F2].
function starBrightness(elapsedDays: number, arousal: number, strength: number): number {
  const { rendering } = VALUES
  return clampToRange(
    effectiveBrightness(elapsedDays, arousal, strength),
    rendering.starBrightnessMin,
    rendering.starBrightnessMax,
  )
}

/**
 * The half of a memory set's star channels the clock cannot move, laid out in instance order: size,
 * colour and seed, plus each brightness anchor parsed once. `starBrightnessChannel` answers the half
 * that does move, so a time sweep recomputes one float per star and nothing else. A slot whose
 * memory is missing stays zero in every channel.
 */
export interface StarStaticChannels {
  readonly count: number
  readonly scales: Float32Array
  /** Linear RGB, stride 3. */
  readonly tint: Float32Array
  readonly seed: Float32Array
  readonly present: Uint8Array
  readonly anchorMs: Float64Array
  readonly offsetDays: Float64Array
  readonly arousal: Float64Array
  readonly strength: Float64Array
}

export function starStaticChannels(
  memories: readonly (EpisodicMemory | undefined)[],
): StarStaticChannels {
  const { rendering } = VALUES
  const count = memories.length
  const statics = {
    count,
    scales: new Float32Array(count),
    tint: new Float32Array(count * 3),
    seed: new Float32Array(count),
    present: new Uint8Array(count),
    anchorMs: new Float64Array(count),
    offsetDays: new Float64Array(count),
    arousal: new Float64Array(count),
    strength: new Float64Array(count),
  }
  for (let i = 0; i < count; i++) {
    const memory = memories[i]
    if (!memory) continue
    const strength = effectiveStrength(memory.baseStrength, memory.recallCount)
    const color = hexToLinearRgb(moodColor(memory.emotion.mood))
    statics.present[i] = 1
    statics.scales[i] = lerpClamp(rendering.starSizeMin, rendering.starSizeMax, strength)
    statics.tint[i * 3] = color[0]
    statics.tint[i * 3 + 1] = color[1]
    statics.tint[i * 3 + 2] = color[2]
    statics.seed[i] = normalizeSeed(memory.seed, memory.id)
    statics.anchorMs[i] = Date.parse(memory.lastRecalledUniverseTime ?? memory.createdUniverseTime)
    statics.offsetDays[i] = memory.forgettingOffsetDays
    statics.arousal[i] = memory.emotion.arousal
    statics.strength[i] = strength
  }
  return statics
}

/** Each star's brightness at `universeTime`, the same value `starChannels` gives one memory. */
export function starBrightnessChannel(
  statics: StarStaticChannels,
  universeTime: string | null,
): Float32Array {
  const nowMs = universeTimeMs(universeTime)
  const brightness = new Float32Array(statics.count)
  for (let i = 0; i < statics.count; i++) {
    if (!statics.present[i]) continue
    const elapsed = effectiveElapsedDaysMs(
      nowMs,
      statics.anchorMs[i] ?? Number.NaN,
      statics.offsetDays[i] ?? 0,
    )
    brightness[i] = starBrightness(elapsed, statics.arousal[i] ?? 0, statics.strength[i] ?? 0)
  }
  return brightness
}

// Map a [0,1] fraction into a visual range; a non-finite input (from a skewed/corrupt DTO field the
// domain mapper didn't coerce) floors to `min` rather than producing a NaN scale / width that would
// poison an InstancedMesh matrix or ribbon vertex. Shared with the gist channels — one range-mapping
// guard for every strength→size projection.
export function lerpClamp(min: number, max: number, t: number): number {
  const clamped = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0
  return min + (max - min) * clamped
}

// Clamp an already-in-range value to [min, max]; a non-finite input floors to `min` (same corrupt-DTO
// guard as lerpClamp). Used for EffectiveBrightness, whose own range equals the render range.
function clampToRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

// A meaningless visual value giving each star a distinct-but-coherent form [V5]. The stored
// seed maps deterministically to 0..1; a memory without one falls back to a stable hash of its
// id (still immutable — this only reads, never mutates [A7]).
export function normalizeSeed(seed: bigint | null, id: string): number {
  if (seed !== null) return Number(((seed % 1_000_003n) + 1_000_003n) % 1_000_003n) / 1_000_003
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 1_000_003
  return hash / 1_000_003
}
