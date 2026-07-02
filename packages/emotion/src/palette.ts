import { MOODS, type Mood } from './mood.ts'

export type Color = `#${string}`

export interface MoodPalette {
  readonly name: string
  readonly colors: Readonly<Record<Mood, Color>>
}

export const defaultMoodPalette: MoodPalette = {
  name: 'cosimosi-default',
  colors: {
    JOY: '#ffd166',
    CALM: '#6ec6b8',
    SAD: '#4f7cac',
    ANGER: '#b44c7a',
    FEAR: '#5b5fef',
    LOVE: '#ff5c8a',
    NEUTRAL: '#aeb4bf',
    EXCITEMENT: '#ff7a59',
    GRATITUDE: '#f2c14e',
    RELIEF: '#8fd694',
    STRESS: '#7e5ccf',
    TIRED: '#7f8fa6',
    EMPTINESS: '#5d6470',
  },
}

let activePalette = defaultMoodPalette

export function defineMoodPalette(name: string, colors: Readonly<Record<Mood, Color>>): MoodPalette {
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
}

export function resetMoodPalette(): void {
  activePalette = defaultMoodPalette
}

export function moodColor(mood: Mood): Color {
  return resolvePalette().colors[mood]
}

function assertCompletePalette(palette: MoodPalette): void {
  for (const mood of MOODS) {
    if (!palette.colors[mood]) {
      throw new Error(`Mood palette "${palette.name}" is missing ${mood}`)
    }
  }
}
