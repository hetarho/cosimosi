import { defaultMoodPalette, defineMoodPalette, type MoodPalette } from './palette.ts'

// The id under which the plan-default palette registers — the fail-safe every unset/unknown
// lookup falls back to. It is the default's aesthetic authority, not re-authored here.
export const DEFAULT_PALETTE_ID = 'cosimosi-default'

// A softer, valence-consistent alternative color sense: pleasant moods carry warm sands, golds
// and rose; unpleasant moods carry cool slate and indigo. Authored to pass the axis-consistency
// guardrail with full margin (every mood's hue agrees with its valence direction), so it reads
// as a coherent second palette rather than a random remap. Routed through defineMoodPalette so
// it inherits the same completeness guarantee as the default (all 13 moods present).
const mutedDuskPalette: MoodPalette = defineMoodPalette('muted-dusk', {
  JOY: '#f2b036',
  CALM: '#57b9a1',
  SAD: '#5dabf2',
  ANGER: '#e54479',
  FEAR: '#ab91f2',
  LOVE: '#df85a4',
  NEUTRAL: '#a8a49c',
  EXCITEMENT: '#f47d67',
  GRATITUDE: '#ffa16c',
  RELIEF: '#97d083',
  STRESS: '#b562c8',
  TIRED: '#7eadbd',
  EMPTINESS: '#9ba1cb',
})

// The id → palette authority. The default registers under its stable id (its color table is
// owned elsewhere — this file registers it, it does not re-author it); the alternative sits
// beside it. The count is this record's length, never a declared number.
export const PALETTES: Readonly<Record<string, MoodPalette>> = {
  [DEFAULT_PALETTE_ID]: defaultMoodPalette,
  'muted-dusk': mutedDuskPalette,
}

export interface ResolvedMoodPalette {
  readonly id: string
  readonly palette: MoodPalette
}

// Canonicalize the stored id together with its palette so callers cannot render the fallback while
// retaining an unknown id in a mirror or rollback checkpoint.
export function resolvePaletteById(id: string): ResolvedMoodPalette {
  const palette = PALETTES[id]
  return palette ? { id, palette } : { id: DEFAULT_PALETTE_ID, palette: defaultMoodPalette }
}

export function paletteById(id: string): MoodPalette {
  return resolvePaletteById(id).palette
}

// The pickable set for a chooser UI: each registered id with its display name.
export function listPalettes(): ReadonlyArray<{ id: string; name: string }> {
  return Object.entries(PALETTES).map(([id, palette]) => ({ id, name: palette.name }))
}

// The canonical registry id set — the single source the backend allow-list mirrors (a
// byte-identical fixture keeps the two in sync). Sorted for a stable, comparable shape.
export function paletteIds(): readonly string[] {
  return Object.keys(PALETTES).sort()
}
