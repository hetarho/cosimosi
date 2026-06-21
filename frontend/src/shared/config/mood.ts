// Emotion mood vocabulary + color palette (spec 08). Pure: RGB tuples (0..1), NOT
// three.Color, and no three/React/DOM import (constitution §4 — mobile reusable).
//
// The 13 moods (4 affective quadrants ×3 + neutral; spec 29) are the single source of
// truth shared with the proto `enum Mood` — existing JOY..NEUTRAL (1–7) are frozen, the
// new 6 appended (UNSPECIFIED maps to no star mood). Mood
// lives here (not in entities/memory) because the palette — a shared-layer concern
// — must type its keys, and shared cannot import from entities (FSD). entities/memory
// re-exports it. This is distinct from palette.ts (the landing-page theme).
export type Mood =
  | 'joy'
  | 'calm'
  | 'sad'
  | 'anger'
  | 'fear'
  | 'love'
  | 'neutral'
  | 'excitement'
  | 'gratitude'
  | 'relief'
  | 'stress'
  | 'tired'
  | 'emptiness'

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
  excitement: [1.0, 0.55, 0.2], // amber (HAP)
  gratitude: [0.55, 0.82, 0.6], // mint (LAP)
  relief: [0.5, 0.82, 0.78], // teal (LAP)
  stress: [0.88, 0.35, 0.5], // magenta (HAN)
  tired: [0.45, 0.5, 0.6], // slate (LAN)
  emptiness: [0.32, 0.34, 0.5], // indigo (LAN)
}

/** Korean display labels — the single source for mood UI text (don't re-list per component). */
export const MOOD_LABEL: Record<Mood, string> = {
  joy: '기쁨',
  calm: '평온',
  sad: '슬픔',
  anger: '분노',
  fear: '두려움',
  love: '사랑',
  neutral: '중립',
  excitement: '설렘',
  gratitude: '감사',
  relief: '안도',
  stress: '스트레스',
  tired: '힘듦',
  emptiness: '공허함',
}

/** The 13 moods in display order — the single source for emotion-filter chips / pickers
 *  (don't re-list per component). Derived from MOOD_LABEL so it can never drift from the labels. */
export const MOODS = Object.keys(MOOD_LABEL) as Mood[]

/** Mood → Korean label with neutral fallback; never throws on an unknown string. */
export function moodLabel(mood: string): string {
  return MOOD_LABEL[mood as Mood] ?? '중립'
}

/** Fallback for an unknown/out-of-range mood (defends acceptance 1.5). */
export const NEUTRAL_RGB: RGB = [0.6, 0.6, 0.6]

/** Mood → RGB with safe fallback; never throws on an unknown string (1.5). */
export function moodRgb(mood: string): RGB {
  return MOOD_PALETTE[mood as Mood] ?? NEUTRAL_RGB
}

/** "#RRGGBB" → linear-RGB tuple (0..1). Direct 8-bit mapping (no gamma) so it is the
 *  inverse of how the palette tuples are authored — a default round-trips within 8-bit.
 *  Returns null on a malformed string (caller falls back to the palette). */
function hexToRgb(hex: string): RGB | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255]
}

/** Star color = the user's per-mood override (spec 30) if set, else the default palette.
 *  `overrides` maps mood → "#RRGGBB"; an unset/malformed entry falls back to moodRgb. */
export function resolveMoodRgb(mood: string, overrides?: Record<string, string>): RGB {
  const hex = overrides?.[mood]
  if (hex) {
    const rgb = hexToRgb(hex)
    if (rgb) return rgb
  }
  return moodRgb(mood)
}

/** Russell circumplex quadrant: high/low arousal × positive/negative valence, + center. */
export type Quadrant = 'HAP' | 'LAP' | 'HAN' | 'LAN' | 'center'

/** Affective placement of a mood (spec 29). Color/UX + extraction-guidance layer only —
 *  memory physics uses AI-extracted intensity/valence, NOT these approximate coords. */
export interface Affect {
  quadrant: Quadrant
  /** Approx arousal 0..1 (circumplex). */
  arousal: number
  /** Approx valence −1..1 (circumplex; 0 = neutral). */
  valence: number
}

/** Mood → 4-quadrant affective placement (spec 29). The quadrant skeleton (HAP/LAP/HAN/LAN)
 *  organizes the 13 moods; coords are approximate circumplex positions for grouping/guidance. */
export const MOOD_AFFECT: Record<Mood, Affect> = {
  joy: { quadrant: 'HAP', arousal: 0.8, valence: 0.8 },
  excitement: { quadrant: 'HAP', arousal: 0.85, valence: 0.65 },
  love: { quadrant: 'HAP', arousal: 0.6, valence: 0.75 },
  calm: { quadrant: 'LAP', arousal: 0.25, valence: 0.55 },
  gratitude: { quadrant: 'LAP', arousal: 0.4, valence: 0.6 },
  relief: { quadrant: 'LAP', arousal: 0.3, valence: 0.45 },
  anger: { quadrant: 'HAN', arousal: 0.8, valence: -0.7 },
  fear: { quadrant: 'HAN', arousal: 0.8, valence: -0.6 },
  stress: { quadrant: 'HAN', arousal: 0.75, valence: -0.55 },
  sad: { quadrant: 'LAN', arousal: 0.4, valence: -0.6 },
  tired: { quadrant: 'LAN', arousal: 0.2, valence: -0.45 },
  emptiness: { quadrant: 'LAN', arousal: 0.2, valence: -0.5 },
  neutral: { quadrant: 'center', arousal: 0, valence: 0 },
}

/** The 13 moods in affect-quadrant order: HAP → LAP → HAN → LAN → neutral. */
export const MOODS_BY_QUADRANT = Object.keys(MOOD_AFFECT) as Mood[]
