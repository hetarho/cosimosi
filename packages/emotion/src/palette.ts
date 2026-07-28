import { MOODS, type Mood } from './mood.ts'

export type Color = `#${string}`

export interface MoodPalette {
  readonly name: string
  readonly colors: Readonly<Record<Mood, Color>>
}

// The product's emotion colours. Authored in OkLCH on the 2D language's shared perceptual lightness
// scale (`packages/ui/src/palette.ts`): every entry lands on step 300 (L 0.80), 400 (0.72) or 500
// (0.63), so an emotion colour and the chrome beside it belong to one family. Three channels, each
// with one job:
//
//   hue        is the feeling's identity. The warm arc (rose → coral → amber → gold → green) is
//              pleasant, the cool arc (teal → blue → violet → magenta) unpleasant — the reading
//              `checkPaletteAxisConsistency` guards.
//   chroma     is how vivid the feeling is: ANGER is the most saturated colour in the table,
//              NEUTRAL almost colourless.
//   lightness  follows the HUE, never the feeling's intensity — each hue sits on the step where it
//              is most itself (yellow is only gold when light, magenta only crimson when deep).
//              Emotion may not spend the brightness channel: the rendered brightness of an
//              EpisodicMemory carries its EffectiveStrength, so two memories of equal strength
//              must not differ in luminance because of their mood.
//
// `palette.test.ts` guards both invariants — every entry on one of the three steps, and no two moods
// closer than 0.05 in OkLab. Thirteen feelings have to stay thirteen colours against a dark ground.
export const defaultMoodPalette: MoodPalette = {
  name: 'cosimosi-default',
  colors: {
    JOY: '#e6b731', // gold · h88 C.150 step300
    CALM: '#4eb9ad', // teal · h185 C.100 step400
    SAD: '#70a6f5', // blue · h258 C.130 step400
    ANGER: '#e84461', // crimson · h15 C.200 step500
    FEAR: '#b98cea', // violet · h305 C.140 step400
    LOVE: '#e28597', // rose · h8 C.115 step400
    NEUTRAL: '#a7a59c', // warm grey · h95 C.012 step400
    EXCITEMENT: '#f18154', // coral · h42 C.150 step400
    GRATITUDE: '#ffa65e', // amber · h58 C.137 step300
    RELIEF: '#86d391', // spring green · h148 C.120 step300
    STRESS: '#c05db9', // magenta · h330 C.170 step500
    TIRED: '#82abc1', // dusty steel blue · h232 C.055 step400
    EMPTINESS: '#a29fc9', // violet grey · h288 C.060 step400
  },
}

let activePalette = defaultMoodPalette

// The active palette lives in module state, so a swap is invisible to any view that memoized
// colors into a buffer. This monotonic tick lets such a view key its recompute on the swap.
let paletteVersionCounter = 0
const paletteListeners = new Set<() => void>()

export function defineMoodPalette(
  name: string,
  colors: Readonly<Record<Mood, Color>>,
): MoodPalette {
  const palette = { name, colors }
  assertCompletePalette(palette)
  return palette
}

export function resolvePalette(): MoodPalette {
  return activePalette
}

export function setMoodPalette(palette: MoodPalette): void {
  assertCompletePalette(palette)
  activePalette = palette
  notifyPaletteChange()
}

export function resetMoodPalette(): void {
  activePalette = defaultMoodPalette
  notifyPaletteChange()
}

export function moodColor(mood: Mood): Color {
  return resolvePalette().colors[mood]
}

// A monotonic counter that advances on every active-palette swap — the recompute key for a
// consumer that cannot observe the module-level swap directly.
export function paletteVersion(): number {
  return paletteVersionCounter
}

// Subscribe to active-palette swaps; returns an unsubscribe. Framework-agnostic on purpose, so
// a renderer host can bridge it (e.g. through useSyncExternalStore) without this pure module
// taking a UI-framework dependency.
export function subscribeMoodPalette(listener: () => void): () => void {
  paletteListeners.add(listener)
  return () => {
    paletteListeners.delete(listener)
  }
}

function notifyPaletteChange(): void {
  paletteVersionCounter += 1
  for (const listener of paletteListeners) {
    listener()
  }
}

export function assertCompletePalette(palette: MoodPalette): void {
  for (const mood of MOODS) {
    if (!palette.colors[mood]) {
      throw new Error(`Mood palette "${palette.name}" is missing ${mood}`)
    }
  }
}
