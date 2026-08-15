import { useMemo, useState } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  PostFX,
  SkySphere,
  UNIVERSE_SKINS,
  UniverseCanvas,
  resolveActiveSkin,
} from '@cosimosi/3d-renderer'
import { VALUES } from '@cosimosi/config'
import {
  MOODS,
  moodColorPresets,
  randomMoodColor,
  type Color,
  type Mood,
  type MoodColorRow,
} from '@cosimosi/emotion'
import {
  moodColorPresetsQueryKey,
  readMoodColorPresets,
  useMoodColorEditor,
} from '@cosimosi/emotion/react'
import { Button, Card, useReducedMotion } from '@cosimosi/ui'
import { MoodStarLayer } from '@cosimosi/universe-render'

import {
  m,
  moodColorPresetDetail,
  moodColorPresetTitle,
  moodLabel,
} from '../../../shared/i18n/index.ts'
import { RANDOM_MOOD_COLOR_SWATCH } from '../../../entities/mood-color/index.ts'

const EMPTY_ROWS: readonly MoodColorRow[] = []

export function ChooseMoodColors({ onContinue }: { onContinue: () => void }) {
  const queryClient = useQueryClient()
  const editor = useMoodColorEditor(EMPTY_ROWS)
  const [selectedMood, setSelectedMood] = useState<Mood>('JOY')

  // A choice here joins the aggregate the presets are drawn from, so the cached shares stop being
  // true the moment it lands.
  const choose = async (mood: Mood, color: Color) => {
    if (!(await editor.choose(mood, color))) return
    await queryClient.invalidateQueries({ queryKey: moodColorPresetsQueryKey(mood) })
  }
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
          <MoodPresets
            mood={selectedMood}
            current={editor.colorFor(selectedMood)}
            disabled={editor.savingMood !== undefined}
            onChoose={(color) => void choose(selectedMood, color)}
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

/**
 * The first-run row: the same preset offers the 감정색 tab opens with, read against the live sky.
 * No picker and no risk gate — every offer here is already a colour the product stands behind, and
 * hand-tuning a hue is what the tab is for.
 */
function MoodPresets({
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
    queryKey: moodColorPresetsQueryKey(mood),
    queryFn: () => readMoodColorPresets(transport, mood),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const presets = query.data ?? moodColorPresets(mood, [])

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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {presets.map((preset) => {
          const detail = moodColorPresetDetail(preset)
          const title = moodColorPresetTitle(preset)
          return (
            <button
              key={preset.kind === 'POPULAR' ? preset.color : preset.kind}
              type="button"
              aria-label={title}
              aria-description={m.palette_preset_label()}
              aria-pressed={preset.kind !== 'RANDOM' && preset.color === current}
              disabled={disabled}
              onClick={() =>
                onChoose(preset.kind === 'RANDOM' ? randomMoodColor(mood) : preset.color)
              }
              className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-lg border border-border px-2 py-2 text-center text-xs text-text-muted aria-pressed:border-text disabled:opacity-60"
            >
              <span
                aria-hidden="true"
                className="size-7 rounded-full border border-border"
                style={
                  preset.kind === 'RANDOM'
                    ? RANDOM_MOOD_COLOR_SWATCH
                    : { backgroundColor: preset.color }
                }
              />
              <span className="font-medium text-text">{title}</span>
              {detail ? <span>{detail}</span> : null}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
