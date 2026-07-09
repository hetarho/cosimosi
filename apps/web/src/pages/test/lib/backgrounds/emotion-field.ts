import type { ComponentType } from 'react'

import { moodColor, type Mood } from '@cosimosi/emotion'

// The contract every emotion-driven background candidate is built against. The universe's
// backdrop is no longer tied to the theme — it carries the *emotions present in the universe*.
// A candidate receives 1..13 emotion slices (each a mood, its palette color, and a normalized
// share) and paints them so the more emotions a universe holds, the more the field is divided
// among them. Candidates are presentation-only: they read colors + a motion flag, nothing else.

/** One emotion present in the universe, with its share of the field. Weights sum to 1. */
export interface EmotionSlice {
  readonly mood: Mood
  /** The mood's palette color (hex from `moodColor`). */
  readonly color: string
  /** Normalized share of the field, 0..1; the sum over all slices is 1. */
  readonly weight: number
}

/** Props every background candidate receives — colors + reduced-motion, nothing domain. */
export interface EmotionBackgroundProps {
  /** 1..13 emotions, ordered primary-first (descending weight). */
  readonly emotions: readonly EmotionSlice[]
  /** OS reduced-motion — candidates must freeze animation (render one static frame) when true. */
  readonly reducedMotion: boolean
  /** Positioning/sizing utilities from the host; the candidate fills this box. */
  readonly className?: string
}

export type EmotionBackground = ComponentType<EmotionBackgroundProps>

/** A selectable background effect for the showcase switcher. */
export interface BackgroundCandidate {
  readonly key: string
  readonly label: string
  readonly blurb: string
  readonly Component: EmotionBackground
}

/**
 * Build normalized, primary-first slices from moods carrying raw (unnormalized) weights.
 * Zero/negative weights drop out; an empty or all-zero map yields no slices.
 */
export function toEmotionSlices(rawWeights: ReadonlyMap<Mood, number>): EmotionSlice[] {
  const entries = [...rawWeights.entries()].filter(([, weight]) => weight > 0)
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  if (total <= 0) return []
  return entries
    .map(([mood, weight]) => ({ mood, color: moodColor(mood), weight: weight / total }))
    .sort((a, b) => b.weight - a.weight || a.mood.localeCompare(b.mood))
}

/** Blend hex colors by weight into one representative `#rrggbb` (a fallback / average tone). */
export function blendEmotionColors(emotions: readonly EmotionSlice[]): string {
  if (emotions.length === 0) return '#0a0a12'
  let r = 0
  let g = 0
  let b = 0
  for (const emotion of emotions) {
    const [er, eg, eb] = hexToRgb(emotion.color)
    r += er * emotion.weight
    g += eg * emotion.weight
    b += eb * emotion.weight
  }
  return rgbToHex(r, g, b)
}

/** Parse `#rgb` / `#rrggbb` into [r,g,b] (0..255). Unknown input falls back to deep space. */
export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.replace(/./g, (c) => c + c) : value
  if (full.length !== 6) return [10, 10, 18]
  const int = Number.parseInt(full, 16)
  if (!Number.isFinite(int)) return [10, 10, 18]
  return [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff]
}

function rgbToHex(r: number, g: number, b: number): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

/** `rgba()` string from a hex color at the given alpha — handy for canvas/gradient fills. */
export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Parse a hex color into normalized [r,g,b] (0..1) — the form shader uniforms want. */
export function hexToRgbNorm(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  return [r / 255, g / 255, b / 255]
}

// ── Shader uniform packing ────────────────────────────────────────────────
// The GLSL backdrops (see shader-canvas.tsx) carry the universe's emotions as
// fixed-length uniform arrays: a color + a normalized weight per slot, plus the
// live count. One mood per slot, 13 slots (= MOODS.length) — the palette ceiling.
// Effects read [0, uCount) and ignore the tail, so the same shader serves a
// 1-emotion universe and a 13-emotion one; the count reshapes the composition.

/** Maximum emotion slots a shader carries — matches the palette's mood count. */
export const MAX_EMOTION_SLOTS = 13

/** Emotion state packed for a WebGL uniform upload. */
export interface EmotionUniforms {
  /** Flat rgb triples (0..1), MAX_EMOTION_SLOTS * 3 long; tail past `count` is zeroed. */
  readonly colors: Float32Array
  /** Normalized shares (0..1), MAX_EMOTION_SLOTS long; tail past `count` is zeroed. */
  readonly weights: Float32Array
  /** Active emotion count (0..MAX_EMOTION_SLOTS). */
  readonly count: number
  /** Weighted-average tint (0..1) — a base tone for empty regions / fallbacks. */
  readonly base: readonly [number, number, number]
}

/** Pack primary-first slices into fixed-length uniform arrays for the shader host. */
export function packEmotionUniforms(emotions: readonly EmotionSlice[]): EmotionUniforms {
  const colors = new Float32Array(MAX_EMOTION_SLOTS * 3)
  const weights = new Float32Array(MAX_EMOTION_SLOTS)
  const count = Math.min(emotions.length, MAX_EMOTION_SLOTS)
  for (let i = 0; i < count; i++) {
    const slice = emotions[i]
    if (!slice) continue
    const [r, g, b] = hexToRgbNorm(slice.color)
    colors[i * 3] = r
    colors[i * 3 + 1] = g
    colors[i * 3 + 2] = b
    weights[i] = slice.weight
  }
  const [br, bg, bb] = hexToRgbNorm(blendEmotionColors(emotions))
  return { colors, weights, count, base: [br, bg, bb] }
}
