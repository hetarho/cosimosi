import { useState } from 'react'

import { Badge, Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'
import { SHADER_EFFECTS, ShaderCanvas } from './backgrounds/index.ts'
import { SHOWCASE_EMOTION_COUNTS, showcaseEmotions } from './backgrounds/showcase-emotions.ts'
import { useReducedMotion } from './backgrounds/use-reduced-motion.ts'

// The emotion sets are constant — precompute once so identities stay stable across renders and the
// shader host never repacks uniforms needlessly.
const SHOWCASE_SETS = SHOWCASE_EMOTION_COUNTS.map((count) => ({
  count,
  emotions: showcaseEmotions(count),
}))

export function BackgroundShowcasePanel() {
  const reducedMotion = useReducedMotion()
  const [selectedKey, setSelectedKey] = useState(() => SHADER_EFFECTS[0]?.key ?? '')
  const effect = SHADER_EFFECTS.find((item) => item.key === selectedKey) ?? SHADER_EFFECTS[0]

  if (!effect) return null // unreachable — SHADER_EFFECTS is always non-empty

  return (
    <div className="flex flex-col gap-4">
      {/* Effect switcher: one autonomous, emotion-driven backdrop at a time. */}
      <div className="flex flex-wrap gap-2">
        {SHADER_EFFECTS.map((item) => (
          <Button
            key={item.key}
            onClick={() => setSelectedKey(item.key)}
            color={item.key === effect.key ? 'primary' : 'neutral'}
            aria-pressed={item.key === effect.key}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">{effect.label}</Badge>
        <p className="text-sm leading-6 text-text-muted">{effect.blurb}</p>
        {reducedMotion ? (
          <Badge variant="warning">{m.test_harness_background_showcase_reduced_motion()}</Badge>
        ) : null}
      </div>

      {/* The same effect holding 1 / 3 / 5 / 7 emotions, so the count-driven structure is legible. */}
      <div className="grid gap-4 sm:grid-cols-2">
        {SHOWCASE_SETS.map(({ count, emotions }) => (
          <figure
            key={count}
            className="relative h-60 overflow-hidden rounded-2xl border border-border bg-background"
          >
            <ShaderCanvas
              body={effect.fragment}
              emotions={emotions}
              reducedMotion={reducedMotion}
            />

            {/* Count chip */}
            <figcaption className="absolute left-3 top-3 rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {count === 1 ? '1 emotion' : `${count} emotions`}
            </figcaption>

            {/* Emotion swatches for this tile */}
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
              {emotions.map((slice) => (
                <span
                  key={slice.mood}
                  title={`${slice.mood} · ${(slice.weight * 100).toFixed(0)}%`}
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-white/40"
                  style={{ backgroundColor: slice.color }}
                />
              ))}
            </div>
          </figure>
        ))}
      </div>
    </div>
  )
}
