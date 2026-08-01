import { useMemo, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import { moodColor, type Mood } from '@cosimosi/emotion'
import { starChannels } from '@cosimosi/universe'
import { Button, Card, TextField, cx } from '@cosimosi/ui'

import { m, moodLabel } from '../../../../shared/i18n/index.ts'
import {
  PLAYGROUND_MAX_DAYS,
  PLAYGROUND_MOODS,
  playgroundMemory,
  playgroundUniverseTime,
  type PlaygroundEntry,
} from '../../model/playground.ts'
import { LandingPlaygroundScene } from '../LandingPlaygroundScene.tsx'

/**
 * The page's argument in miniature: write one line, watch it rise as a star, leave it alone and
 * watch it dim, recall it and watch it return — all through the production projection, so the
 * behaviour on display is the shipped one. Local state only: the page has no session, no
 * transport, and no way to obtain either, so nothing written here can go anywhere.
 */
export function LandingPlayground() {
  const [draft, setDraft] = useState('')
  const [mood, setMood] = useState<Mood>('CALM')
  const [star, setStar] = useState<PlaygroundEntry | null>(null)
  const [day, setDay] = useState(0)

  const launch = () => {
    const text = draft.trim()
    if (text.length === 0) return
    setStar({ text, mood, recallCount: 0, lastRecalledDay: null })
    setDay(0)
  }
  const recall = () => {
    setStar((current) =>
      current === null
        ? null
        : { ...current, recallCount: current.recallCount + 1, lastRecalledDay: day },
    )
  }
  const reset = () => {
    setStar(null)
    setDraft('')
    setDay(0)
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-medium text-text">{m.landing_play_title()}</h2>
        <p className="text-base leading-7 text-text-muted">{m.landing_play_body()}</p>
      </div>
      <Card variant="glass" className="flex flex-col gap-5 p-5 sm:p-6">
        {star === null ? (
          <PlaygroundWriteForm
            draft={draft}
            mood={mood}
            onDraftChange={setDraft}
            onMoodChange={setMood}
            onLaunch={launch}
          />
        ) : (
          <PlaygroundSky
            star={star}
            day={day}
            onDayChange={setDay}
            onRecall={recall}
            onReset={reset}
          />
        )}
        <p className="text-xs text-text-subtle">{m.landing_play_note()}</p>
      </Card>
    </section>
  )
}

function PlaygroundWriteForm({
  draft,
  mood,
  onDraftChange,
  onMoodChange,
  onLaunch,
}: {
  draft: string
  mood: Mood
  onDraftChange: (next: string) => void
  onMoodChange: (next: Mood) => void
  onLaunch: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <TextField
        label={m.landing_play_input_label()}
        placeholder={m.landing_play_input_placeholder()}
        value={draft}
        maxLength={80}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onLaunch()
        }}
      />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-text">{m.landing_play_mood_label()}</p>
        <div className="flex flex-wrap gap-2">
          {PLAYGROUND_MOODS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => onMoodChange(candidate)}
              aria-pressed={candidate === mood}
              className={cx(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
                candidate === mood
                  ? 'border-primary text-text'
                  : 'border-border text-text-subtle hover:border-text-subtle hover:text-text',
              )}
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: moodColor(candidate) }}
              />
              {moodLabel(candidate)}
            </button>
          ))}
        </div>
      </div>
      <Button color="primary" onClick={onLaunch} disabled={draft.trim().length === 0}>
        {m.landing_play_launch()}
      </Button>
    </div>
  )
}

function PlaygroundSky({
  star,
  day,
  onDayChange,
  onRecall,
  onReset,
}: {
  star: PlaygroundEntry
  day: number
  onDayChange: (next: number) => void
  onRecall: () => void
  onReset: () => void
}) {
  const memory = useMemo(() => playgroundMemory(star), [star])
  const universeTime = playgroundUniverseTime(day)
  const channel = starChannels(memory, universeTime)

  // The sentence fades with its star: brightness maps from the render range onto a floor that
  // still lets the words be found again — dim, never gone, which is the product's own claim.
  const { starBrightnessMin, starBrightnessMax } = VALUES.rendering
  const fade =
    (channel.brightness - starBrightnessMin) / (starBrightnessMax - starBrightnessMin || 1)
  const textOpacity = 0.3 + 0.7 * Math.min(1, Math.max(0, fade))

  const daysSinceSeen = day - (star.lastRecalledDay ?? 0)
  const caption =
    daysSinceSeen >= 1
      ? m.landing_play_caption_fading()
      : star.recallCount > 0
        ? m.landing_play_caption_recalled()
        : m.landing_play_caption_born()

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-4/3 overflow-hidden rounded-xl sm:aspect-video">
        <LandingPlaygroundScene memory={memory} universeTime={universeTime} />
        <p
          className="pointer-events-none absolute inset-x-6 bottom-4 text-center text-sm text-text transition-opacity duration-300"
          style={{ opacity: textOpacity }}
        >
          {star.text}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="landing-play-days" className="text-sm font-medium text-text">
            {m.landing_play_time_label()}
          </label>
          <span className="text-sm tabular-nums text-text-muted">
            {m.landing_play_days({ days: day })}
          </span>
        </div>
        <input
          id="landing-play-days"
          type="range"
          min={0}
          max={PLAYGROUND_MAX_DAYS}
          step={1}
          value={day}
          onChange={(event) => onDayChange(Number(event.target.value))}
          className="w-full accent-primary"
        />
      </div>
      <p className="min-h-10 text-sm leading-6 text-text-muted">{caption}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button color="primary" onClick={onRecall}>
          {m.landing_play_recall()}
        </Button>
        <Button color="neutral" variant="text" onClick={onReset}>
          {m.landing_play_reset()}
        </Button>
      </div>
    </div>
  )
}
