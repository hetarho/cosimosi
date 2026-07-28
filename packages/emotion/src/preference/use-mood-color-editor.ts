import { useCallback, useEffect, useState } from 'react'

import { useTransport } from '@connectrpc/connect-query'

import { MOODS, type Mood } from '../mood.ts'
import { nearDuplicateMood, snapToEmotionStep, type MoodColorRow } from '../mood-color.ts'
import { defaultMoodPalette, type Color, type MoodPalette } from '../palette.ts'

import { applyMoodColors, writeMoodColor } from './mood-colors.ts'

type MoodChoices = Partial<Record<Mood, Color>>

export interface MoodColorEditorState {
  readonly choices: MoodChoices
  readonly duplicateMood?: Mood
  readonly error: boolean
  readonly savingMood?: Mood
  readonly choose: (mood: Mood, color: Color) => Promise<void>
  readonly colorFor: (mood: Mood) => Color
}

export function useMoodColorEditor(
  rows: readonly MoodColorRow[],
  fallback: MoodPalette = defaultMoodPalette,
): MoodColorEditorState {
  const transport = useTransport()
  const [choices, setChoices] = useState<MoodChoices>(() => choicesFromRows(rows))
  const [duplicateMood, setDuplicateMood] = useState<Mood>()
  const [savingMood, setSavingMood] = useState<Mood>()
  const [error, setError] = useState(false)

  useEffect(() => {
    setChoices(choicesFromRows(rows))
  }, [rows])

  const choose = useCallback(
    async (mood: Mood, input: Color) => {
      if (savingMood) return
      const color = snapToEmotionStep(input)
      const before = choices
      const beforeDuplicate = duplicateMood
      const otherChoices = Object.fromEntries(
        MOODS.filter((candidateMood) => candidateMood !== mood).map((candidateMood) => [
          candidateMood,
          choices[candidateMood] ?? fallback.colors[candidateMood],
        ]),
      ) as MoodChoices
      setDuplicateMood(nearDuplicateMood(color, otherChoices))
      const optimistic = { ...choices, [mood]: color }
      setChoices(optimistic)
      applyMoodColors(rowsFromChoices(optimistic), fallback)
      setSavingMood(mood)
      setError(false)
      try {
        const saved = await writeMoodColor(transport, mood, color)
        const confirmed = { ...optimistic, [saved.mood]: saved.color }
        setChoices(confirmed)
        applyMoodColors(rowsFromChoices(confirmed), fallback)
      } catch {
        setChoices(before)
        applyMoodColors(rowsFromChoices(before), fallback)
        setDuplicateMood(beforeDuplicate)
        setError(true)
      } finally {
        setSavingMood(undefined)
      }
    },
    [choices, duplicateMood, fallback, savingMood, transport],
  )

  const colorFor = useCallback(
    (mood: Mood) => choices[mood] ?? fallback.colors[mood],
    [choices, fallback],
  )

  return { choices, duplicateMood, error, savingMood, choose, colorFor }
}

function choicesFromRows(rows: readonly MoodColorRow[]): MoodChoices {
  return Object.fromEntries(rows.map((row) => [row.mood, row.color])) as MoodChoices
}

function rowsFromChoices(choices: MoodChoices): MoodColorRow[] {
  return Object.entries(choices).map(([mood, color]) => ({
    mood: mood as Mood,
    color,
  }))
}
