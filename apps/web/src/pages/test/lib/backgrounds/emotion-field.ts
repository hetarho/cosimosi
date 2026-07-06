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

/** An emotion slice resolved to its cumulative span across the field (fractions of 1). */
export interface EmotionStop extends EmotionSlice {
  /** Span start as a fraction 0..1 (running total of prior weights). */
  readonly start: number
  /** Span end as a fraction 0..1. */
  readonly end: number
  /** Span midpoint — the natural anchor for a color stop / arc center. */
  readonly mid: number
}

/**
 * Lay the emotions end-to-end along a 0..1 axis, each occupying an interval ∝ its weight.
 * Feeds proportional constructs: conic arcs, linear color-stop bands, ring segments.
 */
export function cumulativeStops(emotions: readonly EmotionSlice[]): EmotionStop[] {
  const stops: EmotionStop[] = []
  let acc = 0
  for (const emotion of emotions) {
    const start = acc
    const end = acc + emotion.weight
    stops.push({ ...emotion, start, end, mid: (start + end) / 2 })
    acc = end
  }
  return stops
}

/** A 2D placement in the unit box (0..1), plus the slice it belongs to. */
export interface EmotionPlacement extends EmotionSlice {
  readonly x: number
  readonly y: number
  /** Suggested radius (fraction of the box) for a blob, scaled by √weight so area ∝ weight. */
  readonly radius: number
}

/**
 * Even placements via the golden angle (sunflower / Vogel spiral): N points spread across the
 * field without clustering at any count, so a universe with more emotions still divides the
 * space fairly. Blob radius scales with √weight (area, not diameter, tracks the share).
 */
export function goldenAnglePlacements(
  emotions: readonly EmotionSlice[],
  options: { readonly spread?: number; readonly maxRadius?: number } = {},
): EmotionPlacement[] {
  const { spread = 0.42, maxRadius = 0.6 } = options
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const count = emotions.length
  return emotions.map((emotion, index) => {
    const distance = count <= 1 ? 0 : Math.sqrt((index + 0.5) / count) * spread
    const angle = index * goldenAngle
    return {
      ...emotion,
      x: 0.5 + distance * Math.cos(angle),
      y: 0.5 + distance * Math.sin(angle),
      radius: Math.sqrt(emotion.weight) * maxRadius,
    }
  })
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
