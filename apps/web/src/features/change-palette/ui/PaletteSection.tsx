import { useMemo } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetMoodColorsQueryOptions } from '@cosimosi/api-client'
import { MOODS, type Color, type Mood } from '@cosimosi/emotion'
import {
  completeMoodColorRecommendations,
  moodColorRows,
  readMoodColorRecommendations,
  useMoodColorEditor,
  type MoodColorRecommendation,
} from '@cosimosi/emotion/react'
import { VALUES } from '@cosimosi/config'
import { Card } from '@cosimosi/ui'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

export function PaletteSection() {
  const transport = useTransport()
  const query = useQuery({ ...createGetMoodColorsQueryOptions(transport), retry: false })
  const rows = useMemo(() => moodColorRows(query.data?.colors ?? []), [query.data?.colors])
  const editor = useMoodColorEditor(rows)

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-medium text-text">{m.palette_editor_title()}</h2>
        <p className="mt-1 text-sm text-text-muted">{m.palette_editor_body()}</p>
      </div>
      {query.isPending ? <p className="text-sm text-text-muted">{m.common_loading()}</p> : null}
      {MOODS.map((mood) => (
        <MoodColorRow
          key={mood}
          mood={mood}
          current={editor.colorFor(mood)}
          disabled={query.isPending || editor.savingMood !== undefined}
          onChoose={(color) => editor.choose(mood, color)}
        />
      ))}
      {editor.duplicateMood ? (
        <p role="status" className="text-sm text-warning">
          {m.palette_near_duplicate({ mood: moodLabel(editor.duplicateMood) })}
        </p>
      ) : null}
      {editor.error ? (
        <p role="alert" className="text-sm text-danger">
          {m.palette_save_failed()}
        </p>
      ) : null}
    </Card>
  )
}

function MoodColorRow({
  mood,
  current,
  disabled,
  onChoose,
}: {
  mood: Mood
  current: Color
  disabled: boolean
  onChoose: (color: Color) => void
}) {
  const transport = useTransport()
  const query = useQuery({
    queryKey: ['mood-color-recommendations', mood],
    queryFn: () => readMoodColorRecommendations(transport, mood),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const recommendations = query.data ?? completeMoodColorRecommendations(mood, [])

  return (
    <section className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="size-4 rounded-full border border-border"
          style={{ backgroundColor: current }}
        />
        <h3 className="text-sm font-medium text-text">{moodLabel(mood)}</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {recommendations.slice(0, VALUES.palette.recommendationCount).map((recommendation) => (
          <RecommendationButton
            key={`${recommendation.bucket ?? 'authored'}-${recommendation.color}`}
            recommendation={recommendation}
            selected={recommendation.color === current}
            disabled={disabled}
            onChoose={onChoose}
          />
        ))}
      </div>
    </section>
  )
}

function RecommendationButton({
  recommendation,
  selected,
  disabled,
  onChoose,
}: {
  recommendation: MoodColorRecommendation
  selected: boolean
  disabled: boolean
  onChoose: (color: Color) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={m.palette_recommendation_label()}
      disabled={disabled}
      onClick={() => onChoose(recommendation.color)}
      className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border border-border px-2 py-2 text-xs text-text-muted disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className="size-6 rounded-full border border-border"
        style={{ backgroundColor: recommendation.color }}
      />
      {recommendation.share === undefined
        ? m.palette_recommendation_usual()
        : m.palette_recommendation_share({
            percent: String(Math.round(recommendation.share * 100)),
          })}
    </button>
  )
}
