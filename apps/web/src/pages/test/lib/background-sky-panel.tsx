import { useMemo, useState } from 'react'

import {
  CameraControls,
  PostFX,
  SKY_EFFECTS,
  SkySphere,
  StarField,
  UniverseCanvas,
  resolveSkyEffect,
  type SkyEffectKey,
} from '@cosimosi/3d-renderer'
import { VALUES } from '@cosimosi/config'
import { Badge, Button, useReducedMotion } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'
import { showcaseEmotions } from './emotion-slices.ts'

// The emotion sky as a real 3D body: a BackSide sphere enclosing the star scene, shaded by a TSL
// effect ported from react-bits that samples the universe's emotion palette. Pick an effect, pick
// how many emotions the universe holds — each effect opens on the count it reads best at and offers
// only the counts that stay legible for its structure. Drag to look around inside the sphere.
export function BackgroundSkyPanel() {
  const reducedMotion = useReducedMotion()
  const [effectKey, setEffectKey] = useState<SkyEffectKey>(SKY_EFFECTS[0].key)
  const effect = resolveSkyEffect(effectKey)
  const [count, setCount] = useState<number>(effect.defaultCount)

  // When the effect changes, snap the count to that effect's default (and never above its ceiling).
  const selectEffect = (key: SkyEffectKey) => {
    setEffectKey(key)
    setCount(resolveSkyEffect(key).defaultCount)
  }

  const emotions = useMemo(() => showcaseEmotions(count), [count])

  return (
    <div className="flex flex-col gap-3">
      {/* Effect switcher — one autonomous, emotion-driven sky at a time. */}
      <div className="flex flex-wrap gap-2">
        {SKY_EFFECTS.map((item) => (
          <Button
            key={item.key}
            onClick={() => selectEffect(item.key)}
            color={item.key === effect.key ? 'primary' : 'neutral'}
            aria-pressed={item.key === effect.key}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">{effect.label}</Badge>
        <Badge variant={effect.fidelity === 'faithful' ? 'success' : 'neutral'}>
          {effect.fidelity}
        </Badge>
        <p className="text-sm leading-6 text-text-muted">{effect.blurb}</p>
        {reducedMotion ? (
          <Badge variant="warning">{m.test_harness_background_showcase_reduced_motion()}</Badge>
        ) : null}
      </div>

      {/* Emotion count — only the counts this effect stays legible at. */}
      <div className="flex flex-wrap items-center gap-2">
        {/* i18n-ignore: dev-only /test surface caption */}
        <span className="text-xs font-medium uppercase text-text-subtle">emotions</span>
        {effect.emotionCounts.map((value) => (
          <Button
            key={value}
            size="sm"
            onClick={() => setCount(value)}
            color={value === count ? 'primary' : 'neutral'}
            aria-pressed={value === count}
          >
            {value}
          </Button>
        ))}
        <span className="ml-1 flex items-center gap-1.5">
          {emotions.map((slice) => (
            <span
              key={slice.mood}
              title={`${slice.mood} · ${(slice.weight * 100).toFixed(0)}%`}
              className="h-3.5 w-3.5 rounded-full ring-1 ring-white/30"
              style={{ backgroundColor: slice.color }}
            />
          ))}
        </span>
      </div>

      <div className="h-120 overflow-hidden rounded-2xl bg-background">
        <UniverseCanvas dpr={[1, VALUES.rendering.maxPixelRatio]} fov={60}>
          <SkySphere stops={emotions} effect={effect.key} reducedMotion={reducedMotion} />
          <StarField />
          <CameraControls />
          <PostFX bloom={{ strength: 0.6, radius: 0.6, threshold: 0.3 }} />
        </UniverseCanvas>
      </div>
    </div>
  )
}
