import type { Transport } from '@connectrpc/connect'

import { createAccountClient, setMoodColor as persistMoodColor } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'

import { MOODS, type Mood } from '../mood.ts'
import { colorToOkLch, okLchToColor } from '../oklab.ts'
import { defaultMoodPalette, setMoodPalette, type Color, type MoodPalette } from '../palette.ts'
import { PALETTES } from '../registry.ts'
import { resolveMoodColors, snapToEmotionStep, type MoodColorRow } from '../mood-color.ts'

export interface MoodColorRecommendation {
  readonly bucket?: number
  readonly color: Color
  readonly share?: number
}

export async function readMoodColors(transport: Transport): Promise<readonly MoodColorRow[]> {
  const response = await createAccountClient(transport).getMoodColors({})
  return moodColorRows(response.colors)
}

export function moodColorRows(
  rows: readonly { readonly mood: string; readonly color: string }[],
): readonly MoodColorRow[] {
  return rows.flatMap((row) => {
    const mood = toMood(row.mood)
    const color = toColor(row.color)
    return mood && color ? [{ mood, color }] : []
  })
}

export async function writeMoodColor(
  transport: Transport,
  mood: Mood,
  color: Color,
): Promise<MoodColorRow> {
  const saved = await persistMoodColor(transport, mood, color)
  const savedMood = toMood(saved.mood)
  const savedColor = toColor(saved.color)
  if (!savedMood || !savedColor) throw new Error('Account returned an invalid mood color')
  return { mood: savedMood, color: savedColor }
}

export async function readMoodColorRecommendations(
  transport: Transport,
  mood: Mood,
): Promise<readonly MoodColorRecommendation[]> {
  const response = await createAccountClient(transport).getMoodColorStats({ mood })
  const stats = response.stats.flatMap((stat) => {
    const color = toColor(stat.swatchColor)
    return color
      ? [{ bucket: stat.bucket, color, ...(stat.share === undefined ? {} : { share: stat.share }) }]
      : []
  })
  return completeMoodColorRecommendations(mood, stats)
}

export function applyMoodColors(
  rows: readonly MoodColorRow[],
  fallback: MoodPalette = defaultMoodPalette,
): void {
  setMoodPalette(resolveMoodColors(rows, fallback))
}

export function completeMoodColorRecommendations(
  mood: Mood,
  stats: readonly MoodColorRecommendation[],
): readonly MoodColorRecommendation[] {
  const base = defaultMoodPalette.colors[mood]
  const lch = colorToOkLch(base)
  const fallback = [
    base,
    PALETTES['muted-dusk'].colors[mood],
    okLchToColor({
      ...lch,
      h: (lch.h + VALUES.palette.hueBucketDegrees / 2) % 360,
    }),
  ].map(snapToEmotionStep)
  const recommendations: MoodColorRecommendation[] = []
  const seen = new Set<string>()
  for (const recommendation of [...stats, ...fallback.map((color) => ({ color }))]) {
    if (seen.has(recommendation.color)) continue
    seen.add(recommendation.color)
    recommendations.push(recommendation)
    if (recommendations.length === VALUES.palette.recommendationCount) break
  }
  return recommendations
}

function toMood(value: string): Mood | undefined {
  return (MOODS as readonly string[]).includes(value) ? (value as Mood) : undefined
}

function toColor(value: string): Color | undefined {
  return /^#[0-9a-f]{6}$/.test(value) ? (value as Color) : undefined
}
