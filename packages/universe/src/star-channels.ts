import { VALUES } from '@cosimosi/config'
import { moodColor } from '@cosimosi/emotion'
import {
  effectiveBrightness,
  effectiveElapsedDays,
  effectiveStrength,
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
  const brightness = effectiveBrightness(elapsed, memory.emotion.arousal, strength)
  return {
    size: lerpClamp(rendering.starSizeMin, rendering.starSizeMax, strength),
    // EffectiveBrightness already returns [forgetting.brightness_floor, 1] with the floor aligned to
    // star_brightness_min, so it IS the render range — clamp it in place, do NOT re-lerp a [0,1]
    // fraction (that would lift the silent-engram floor off star_brightness_min). A2/[F2].
    brightness: clampToRange(brightness, rendering.starBrightnessMin, rendering.starBrightnessMax),
    color: hexToLinearRgb(moodColor(memory.emotion.mood)),
    seed: normalizeSeed(memory.seed, memory.id),
  }
}

// Map a [0,1] fraction into a visual range; a non-finite input (from a skewed/corrupt DTO field the
// domain mapper didn't coerce) floors to `min` rather than producing a NaN scale / width that would
// poison an InstancedMesh matrix or ribbon vertex.
function lerpClamp(min: number, max: number, t: number): number {
  const clamped = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0
  return min + (max - min) * clamped
}

// Clamp an already-in-range value to [min, max]; a non-finite input floors to `min` (same corrupt-DTO
// guard as lerpClamp). Used for EffectiveBrightness, whose own range equals the render range.
function clampToRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

// Parse `#rrggbb` and convert sRGB → linear so the raw floats match the renderer's linear
// working space (three converts `.color.set(hex)` the same way; a colorNode attribute is fed
// straight through, so we convert here).
export function hexToLinearRgb(hex: string): [number, number, number] {
  return [
    srgbToLinear(Number.parseInt(hex.slice(1, 3), 16) / 255),
    srgbToLinear(Number.parseInt(hex.slice(3, 5), 16) / 255),
    srgbToLinear(Number.parseInt(hex.slice(5, 7), 16) / 255),
  ]
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
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
