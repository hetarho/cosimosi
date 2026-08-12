import type { Transport } from '@connectrpc/connect'

import { createAccountClient, setMoodColor as persistMoodColor } from '@cosimosi/api-client'

import { MOODS, type Mood } from '../mood.ts'
import { defaultMoodPalette, setMoodPalette, type Color, type MoodPalette } from '../palette.ts'
import { resolveMoodColors, type MoodColorRow } from '../mood-color.ts'
import {
  moodColorPresets,
  type MoodColorBucketStat,
  type MoodColorPreset,
} from '../mood-color-preset.ts'

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

/**
 * The cache key both surfaces read presets under. Shared so the write path can invalidate what the
 * read path stored: saving a colour changes the aggregate it came from, so the ranking and every
 * share on screen are stale the moment the save lands.
 */
export function moodColorPresetsQueryKey(mood: Mood): readonly unknown[] {
  return ['mood-color-presets', mood]
}

export async function readMoodColorPresets(
  transport: Transport,
  mood: Mood,
): Promise<readonly MoodColorPreset[]> {
  const response = await createAccountClient(transport).getMoodColorStats({ mood })
  // The order is the server's ranking and is kept as received. A bucket only exists because someone
  // chose a color in it, so a non-positive share is a malformed row, not a rare one: dropping it is
  // what keeps a "0% chose this" out of the UI.
  const stats = response.stats.flatMap<MoodColorBucketStat>((stat) => {
    const color = toColor(stat.swatchColor)
    return color && stat.share > 0 ? [{ bucket: stat.bucket, color, share: stat.share }] : []
  })
  return moodColorPresets(mood, stats)
}

export function applyMoodColors(
  rows: readonly MoodColorRow[],
  fallback: MoodPalette = defaultMoodPalette,
): void {
  setMoodPalette(resolveMoodColors(rows, fallback))
}

function toMood(value: string): Mood | undefined {
  return (MOODS as readonly string[]).includes(value) ? (value as Mood) : undefined
}

function toColor(value: string): Color | undefined {
  return /^#[0-9a-f]{6}$/.test(value) ? (value as Color) : undefined
}
