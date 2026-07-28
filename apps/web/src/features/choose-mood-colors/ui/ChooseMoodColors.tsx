import { useMemo, useState } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import {
  PostFX,
  SkySphere,
  UNIVERSE_SKINS,
  UniverseCanvas,
  resolveActiveSkin,
} from '@cosimosi/3d-renderer'
import { VALUES } from '@cosimosi/config'
import { MOODS, type Color, type Mood, type MoodColorRow } from '@cosimosi/emotion'
import {
  completeMoodColorRecommendations,
  readMoodColorRecommendations,
  useMoodColorEditor,
} from '@cosimosi/emotion/react'
import { Button, Card, useReducedMotion } from '@cosimosi/ui'
import { MoodStarLayer } from '@cosimosi/universe-render'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

const EMPTY_ROWS: readonly MoodColorRow[] = []

export function ChooseMoodColors({ onContinue }: { onContinue: () => void }) {
  const editor = useMoodColorEditor(EMPTY_ROWS)
  const [selectedMood, setSelectedMood] = useState<Mood>('JOY')
  const { colorFor } = editor
  const colors = useMemo(
    () => Object.fromEntries(MOODS.map((mood) => [mood, colorFor(mood)])) as Record<Mood, Color>,
    [colorFor],
  )
  const skin = UNIVERSE_SKINS[resolveActiveSkin(VALUES.rendering.activeSkin)]
  const reducedMotion = useReducedMotion()
  const stops = useMemo(() => [{ color: skin.sky.night, weight: 1 }], [skin.sky.night])

  return (
    <main className="relative min-h-dvh overflow-hidden bg-black text-text">
      <div className="absolute inset-0">
        <UniverseCanvas
          dpr={[1, VALUES.rendering.maxPixelRatio]}
          fov={skin.camera.fov}
          clearColor={skin.sky.night}
        >
          <SkySphere stops={stops} effect={skin.sky.effect} reducedMotion={reducedMotion} />
          <MoodStarLayer colors={colors} reducedMotion={reducedMotion} onSelect={setSelectedMood} />
          <PostFX bloom={skin.bloom} />
        </UniverseCanvas>
      </div>
      <div className="pointer-events-none relative z-10 flex min-h-dvh flex-col justify-between gap-6 p-6">
        <header className="pointer-events-auto max-w-md">
          <h1 className="text-xl font-medium">{m.mood_color_onboarding_title()}</h1>
          <p className="mt-2 text-sm text-text-muted">{m.mood_color_onboarding_body()}</p>
        </header>
        <div className="pointer-events-auto mx-auto flex w-full max-w-xl flex-col gap-3">
          <MoodRecommendations
            mood={selectedMood}
            current={editor.colorFor(selectedMood)}
            disabled={editor.savingMood !== undefined}
            onChoose={(color) => editor.choose(selectedMood, color)}
          />
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
          <Button onClick={onContinue}>{m.mood_color_onboarding_skip()}</Button>
        </div>
      </div>
    </main>
  )
}

function MoodRecommendations({
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
    queryKey: ['onboarding-mood-color-recommendations', mood],
    queryFn: () => readMoodColorRecommendations(transport, mood),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const recommendations = query.data ?? completeMoodColorRecommendations(mood, [])

  return (
    <Card className="flex flex-col gap-3 bg-surface/90 backdrop-blur">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="size-5 rounded-full border border-border"
          style={{ backgroundColor: current }}
        />
        <h2 className="font-medium">{moodLabel(mood)}</h2>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {recommendations.map((recommendation) => (
          <button
            key={`${recommendation.bucket ?? 'authored'}-${recommendation.color}`}
            type="button"
            aria-label={m.palette_recommendation_label()}
            aria-pressed={recommendation.color === current}
            disabled={disabled}
            onClick={() => onChoose(recommendation.color)}
            className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border border-border px-2 py-2 text-xs text-text-muted disabled:opacity-60"
          >
            <span
              aria-hidden="true"
              className="size-7 rounded-full border border-border"
              style={{ backgroundColor: recommendation.color }}
            />
            {recommendation.share === undefined
              ? m.palette_recommendation_usual()
              : m.palette_recommendation_share({
                  percent: String(Math.round(recommendation.share * 100)),
                })}
          </button>
        ))}
      </div>
    </Card>
  )
}
