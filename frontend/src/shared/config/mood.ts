// Emotion mood vocabulary + color palette (spec 08). Pure: RGB tuples (0..1), NOT
// three.Color, and no three/React/DOM import (constitution §4 — mobile reusable).
//
// The 7 moods are the single source of truth shared with the proto `enum Mood`
// (JOY/CALM/SAD/ANGER/FEAR/LOVE/NEUTRAL; UNSPECIFIED maps to no star mood). Mood
// lives here (not in entities/memory) because the palette — a shared-layer concern
// — must type its keys, and shared cannot import from entities (FSD). entities/memory
// re-exports it. This is distinct from palette.ts (the landing-page theme).
export type Mood = 'joy' | 'calm' | 'sad' | 'anger' | 'fear' | 'love' | 'neutral'

/** Linear RGB in 0..1 (some channels ≥0.8 so emissive stars bloom). */
export type RGB = readonly [number, number, number]

export const MOOD_PALETTE: Record<Mood, RGB> = {
  joy: [1.0, 0.84, 0.3], // warm gold
  calm: [0.4, 0.75, 0.85], // soft cyan
  sad: [0.35, 0.45, 0.72], // muted blue
  anger: [0.92, 0.28, 0.28], // red
  fear: [0.55, 0.35, 0.78], // violet
  love: [0.96, 0.5, 0.72], // rose
  neutral: [0.6, 0.6, 0.6], // grey
}

/** Fallback for an unknown/out-of-range mood (defends acceptance 1.5). */
export const NEUTRAL_RGB: RGB = [0.6, 0.6, 0.6]

/** Mood → RGB with safe fallback; never throws on an unknown string (1.5). */
export function moodRgb(mood: string): RGB {
  return MOOD_PALETTE[mood as Mood] ?? NEUTRAL_RGB
}
